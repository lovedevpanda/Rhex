import { getCurrentUserRecord } from "@/db/current-user"
import { ChangeType, type Prisma } from "@/db/types"

import { prisma } from "@/db/client"
import { apiError } from "@/lib/api-route"
import { checkBoardPermission, getBoardAccessContextBySlug } from "@/lib/board-access"
import { extractSummaryFromContent } from "@/lib/content"
import { enforceSensitiveText } from "@/lib/content-safety"
import { parseBusinessDateTime } from "@/lib/formatters"
import { determineLotteryTriggerMode, normalizeLotteryConfig } from "@/lib/lottery"
import { createPostMentionNotifications, stripPostContentUserLinks } from "@/lib/post-mentions"

import { buildPostContentDocument, getAllPostContentText, serializePostContentDocument } from "@/lib/post-content"
import { createPostRedPacketAfterPostCreated, normalizePostRedPacketConfig } from "@/lib/post-red-packets"
import { normalizeManualTags, syncPostTaxonomy } from "@/lib/post-editor"
import { getSiteSettings } from "@/lib/site-settings"
import { validatePostPayload } from "@/lib/validators"

function createPostSlug(title: string) {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 50)

  return `${normalized || "post"}-${Date.now()}`
}

export async function createPostFlow(body: unknown) {
  const validated = validatePostPayload(body)

  if (!validated.success || !validated.data) {
    apiError(400, validated.message ?? "参数错误")
  }

  const { title, content, coverPath, boardSlug, postType, bountyPoints, pollOptions, commentsVisibleToAuthorOnly, replyUnlockContent, replyThreshold, purchaseUnlockContent, purchasePrice, minViewLevel, minViewVipLevel, lotteryConfig } = validated.data

  const rawBody = body as Record<string, unknown>
  const manualTags = normalizeManualTags(Array.isArray(rawBody?.manualTags)
    ? rawBody.manualTags.filter((item): item is string => typeof item === "string")
    : [])
  const tagsSafety = manualTags.length > 0 ? await enforceSensitiveText({ scene: "post.tags", text: manualTags.join("\n") }) : null
  const sanitizedManualTags = normalizeManualTags(tagsSafety?.sanitizedText.split(/\n+/).map((item) => item.trim()).filter(Boolean) ?? manualTags)
  const redPacketConfig = rawBody?.redPacketConfig && typeof rawBody.redPacketConfig === "object" && !Array.isArray(rawBody.redPacketConfig)
    ? rawBody.redPacketConfig as Record<string, unknown>
    : null
  const pollExpiresAt = typeof rawBody?.pollExpiresAt === "string" && rawBody.pollExpiresAt.trim() ? parseBusinessDateTime(rawBody.pollExpiresAt) : null

  const normalizedLottery = postType === "LOTTERY" ? normalizeLotteryConfig(lotteryConfig) : null
  const normalizedRedPacket = await normalizePostRedPacketConfig(redPacketConfig)
  const redPacketTotalPoints = normalizedRedPacket.data?.enabled ? normalizedRedPacket.data.totalPoints : 0

  if (postType === "LOTTERY" && (!normalizedLottery?.success || !normalizedLottery.data)) {
    apiError(400, normalizedLottery?.message ?? "抽奖配置不合法")
  }

  if (!normalizedRedPacket.success) {
    apiError(400, normalizedRedPacket.message ?? "红包配置不合法")
  }

  const titleSafety = await enforceSensitiveText({ scene: "post.title", text: title })
  const contentSafety = await enforceSensitiveText({ scene: "post.content", text: content })
  const replyUnlockSafety = replyUnlockContent ? await enforceSensitiveText({ scene: "post.content", text: replyUnlockContent }) : null
  const purchaseUnlockSafety = purchaseUnlockContent ? await enforceSensitiveText({ scene: "post.content", text: purchaseUnlockContent }) : null

  const contentDocument = buildPostContentDocument({
    publicContent: contentSafety.sanitizedText,
    replyUnlockContent: replyUnlockSafety?.sanitizedText ?? "",
    replyThreshold: replyThreshold ?? undefined,
    purchaseUnlockContent: purchaseUnlockSafety?.sanitizedText ?? "",
    purchasePrice: purchasePrice ?? undefined,
  })

  const serializedContent = serializePostContentDocument(contentDocument)
  const summary = extractSummaryFromContent(getAllPostContentText(serializedContent))

  const [boardContext, author, settings] = await Promise.all([
    getBoardAccessContextBySlug(boardSlug),
    getCurrentUserRecord(),
    getSiteSettings(),
  ])

  if (!boardContext || !author) {
    apiError(404, "节点或作者不存在")
  }

  if (boardContext.board.status !== "ACTIVE" || !boardContext.board.allowPost) {
    apiError(403, "当前节点暂不允许发帖")
  }

  const permission = checkBoardPermission(author, boardContext.settings, "post")
  if (!permission.allowed) {
    apiError(403, permission.message || "当前没有发帖权限")
  }

  if (!boardContext.settings.allowedPostTypes.includes(postType)) {
    apiError(403, "当前节点不支持此帖子类型")
  }

  const lastPostAt = (author as { lastPostAt?: Date | null }).lastPostAt ?? null
  if (boardContext.settings.postIntervalSeconds > 0 && lastPostAt) {
    const waitSeconds = boardContext.settings.postIntervalSeconds - Math.floor((Date.now() - new Date(lastPostAt).getTime()) / 1000)
    if (waitSeconds > 0) {
      apiError(429, `发帖过于频繁，请 ${waitSeconds} 秒后再试`)
    }
  }

  const totalPointCost = Math.max(0, -(boardContext.settings.postPointDelta ?? 0))
    + (postType === "BOUNTY" ? (bountyPoints ?? 0) : 0)
    + redPacketTotalPoints

  if (author.points < totalPointCost) {
    apiError(400, `当前${settings.pointName}不足，无法在该节点发布此帖子`)
  }

  const shouldPending = Boolean(boardContext.settings.requirePostReview || titleSafety.shouldReview || contentSafety.shouldReview || replyUnlockSafety?.shouldReview || purchaseUnlockSafety?.shouldReview || tagsSafety?.shouldReview)

  const post = await prisma.$transaction(async (tx) => {
    const lotteryData = normalizedLottery?.data
    const postCreateData: Prisma.PostUncheckedCreateInput = {
      title: titleSafety.sanitizedText,
      slug: createPostSlug(titleSafety.sanitizedText),
      content: serializedContent,
      coverPath,
      summary: summary || titleSafety.sanitizedText,
      boardId: boardContext.board.id,
      authorId: author.id,
      type: postType,
      status: shouldPending ? "PENDING" : "NORMAL",
      commentsVisibleToAuthorOnly,
      minViewLevel,
      minViewVipLevel,
      bountyPoints: postType === "BOUNTY" ? bountyPoints : null,
      pollExpiresAt: postType === "POLL" ? pollExpiresAt : null,
      lotteryStatus: postType === "LOTTERY" ? (shouldPending ? "DRAFT" : "ACTIVE") : null,
      lotteryTriggerMode: postType === "LOTTERY"
        ? determineLotteryTriggerMode({ endsAt: lotteryData?.endsAt ?? null, participantGoal: lotteryData?.participantGoal ?? null })
        : null,
      lotteryStartsAt: postType === "LOTTERY" ? (lotteryData?.startsAt ?? new Date()) : null,
      lotteryEndsAt: postType === "LOTTERY" ? (lotteryData?.endsAt ?? null) : null,
      lotteryParticipantGoal: postType === "LOTTERY" ? (lotteryData?.participantGoal ?? null) : null,
      editableUntil: new Date(Date.now() + Math.max(0, settings.postEditableMinutes) * 60 * 1000),
      publishedAt: shouldPending ? null : new Date(),
      reviewNote: titleSafety.shouldReview || contentSafety.shouldReview || tagsSafety?.shouldReview ? "命中敏感词规则，已进入审核" : null,
      pollOptions: postType === "POLL" ? { create: pollOptions.map((option, index) => ({ content: option, sortOrder: index })) } : undefined,
      lotteryPrizes: postType === "LOTTERY" ? { create: (lotteryData?.prizes ?? []).map((prize, index) => ({ title: prize.title, description: prize.description, quantity: prize.quantity, sortOrder: index })) } : undefined,
      lotteryConditions: postType === "LOTTERY" ? { create: (lotteryData?.conditions ?? []).map((condition, index) => ({ type: condition.type, operator: condition.operator ?? "GTE", value: condition.value, description: condition.description, groupKey: condition.groupKey ?? "default", sortOrder: index })) } : undefined,
    }

    const createdPost = await tx.post.create({ data: { ...postCreateData, activityAt: new Date() } })

    const pointDelta = boardContext.settings.postPointDelta ?? 0

    const totalDeduction = Math.max(0, -pointDelta) + (postType === "BOUNTY" ? (bountyPoints ?? 0) : 0) + redPacketTotalPoints
    const totalIncrease = Math.max(0, pointDelta)

    const userUpdateData: {
      postCount: { increment: number }
      lastPostAt: Date
      points?: { decrement: number } | { increment: number }
    } = {
      postCount: { increment: 1 },
      lastPostAt: new Date(),
    }

    if (totalDeduction > 0) {
      userUpdateData.points = { decrement: totalDeduction }
    } else if (totalIncrease > 0) {
      userUpdateData.points = { increment: totalIncrease }
    }

    await tx.user.update({ where: { id: author.id }, data: userUpdateData })

    if (pointDelta !== 0) {
      await tx.pointLog.create({
        data: {
          userId: author.id,
          changeType: pointDelta > 0 ? ChangeType.INCREASE : ChangeType.DECREASE,
          changeValue: Math.abs(pointDelta),
          reason: pointDelta > 0 ? `在指定节点发帖获得${settings.pointName}` : `在指定节点发帖扣除${settings.pointName}`,
          relatedType: "POST",
          relatedId: createdPost.id,
        },
      })
    }

    if (postType === "BOUNTY" && bountyPoints) {
      await tx.pointLog.create({
        data: {
          userId: author.id,
          changeType: ChangeType.DECREASE,
          changeValue: bountyPoints,
          reason: `发布悬赏帖冻结${settings.pointName}`,
          relatedType: "POST",
          relatedId: createdPost.id,
        },
      })
    }

    await createPostRedPacketAfterPostCreated({
      tx,
      postId: createdPost.id,
      senderId: author.id,
      config: normalizedRedPacket.data,
      pointName: settings.pointName,
    })

    await tx.board.update({
      where: { id: boardContext.board.id },
      data: {
        postCount: { increment: 1 },
      },
    })

    if (!shouldPending) {
      const mentionResult = await createPostMentionNotifications({
        tx,
        postId: createdPost.id,
        senderId: author.id,
        senderName: author.nickname ?? author.username,
        rawPostContent: serializedContent,
      })

      if (mentionResult.content !== serializedContent) {
        await tx.post.update({
          where: { id: createdPost.id },
          data: {
            content: mentionResult.content,
            summary: extractSummaryFromContent(getAllPostContentText(stripPostContentUserLinks(mentionResult.content))) || titleSafety.sanitizedText,
          },
        })
      }
    }

    return createdPost
  })

  await syncPostTaxonomy(post.id, titleSafety.sanitizedText, serializedContent, sanitizedManualTags)

  return {
    post,
    author,
    shouldPending,
  }
}
