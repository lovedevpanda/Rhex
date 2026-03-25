import { ChangeType } from "@/db/types"
import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { getBoardAccessContextBySlug, checkBoardPermission } from "@/lib/board-access"
import { ContentSafetyError, enforceSensitiveText } from "@/lib/content-safety"
import { extractSummaryFromContent } from "@/lib/content"
import { hasDatabaseUrl } from "@/lib/db-status"
import { evaluateUserLevelProgress } from "@/lib/level-system"
import { determineLotteryTriggerMode, normalizeLotteryConfig } from "@/lib/lottery"
import { buildPostContentDocument, getAllPostContentText, serializePostContentDocument } from "@/lib/post-content"

import { syncPostTaxonomy } from "@/lib/post-editor"
import { prisma } from "@/db/client"
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

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()
  const body = await request.json()
  const validated = validatePostPayload(body)

  if (!currentUser) {
    return NextResponse.json({ code: 401, message: "请先登录后再发帖" }, { status: 401 })
  }

  if (currentUser.status === "MUTED" || currentUser.status === "BANNED") {
    return NextResponse.json({ code: 403, message: currentUser.status === "BANNED" ? "账号已被拉黑，无法发帖" : "账号已被禁言，暂不可发帖" }, { status: 403 })
  }

  if (!validated.success || !validated.data) {
    return NextResponse.json({ code: 400, message: validated.message ?? "参数错误" }, { status: 400 })
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ code: 503, message: "当前未配置数据库，暂不可写入帖子" }, { status: 503 })
  }

  try {
    const { title, content, boardSlug, postType, bountyPoints, pollOptions, commentsVisibleToAuthorOnly, replyUnlockContent, replyThreshold, purchaseUnlockContent, purchasePrice, minViewLevel, lotteryConfig } = validated.data

    const pollExpiresAt = typeof body.pollExpiresAt === "string" && body.pollExpiresAt.trim() ? new Date(body.pollExpiresAt) : null
    const normalizedLottery = postType === "LOTTERY" ? normalizeLotteryConfig(lotteryConfig) : null
    if (postType === "LOTTERY" && (!normalizedLottery?.success || !normalizedLottery.data)) {
      return NextResponse.json({ code: 400, message: normalizedLottery?.message ?? "抽奖配置不合法" }, { status: 400 })
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
      prisma.user.findUnique({ where: { username: currentUser.username } }),
      getSiteSettings(),
    ])

    if (!boardContext || !author) {

      return NextResponse.json({ code: 404, message: "节点或作者不存在" }, { status: 404 })
    }

    if (boardContext.board.status !== "ACTIVE" || !boardContext.board.allowPost) {
      return NextResponse.json({ code: 403, message: "当前节点暂不允许发帖" }, { status: 403 })
    }

    const permission = checkBoardPermission(author, boardContext.settings, "post")
    if (!permission.allowed) {
      return NextResponse.json({ code: 403, message: permission.message || "当前没有发帖权限" }, { status: 403 })
    }

    if (!boardContext.settings.allowedPostTypes.includes(postType)) {
      return NextResponse.json({ code: 403, message: "当前节点不支持此帖子类型" }, { status: 403 })
    }

    const lastPostAt = (author as { lastPostAt?: Date | null }).lastPostAt ?? null
    if (boardContext.settings.postIntervalSeconds > 0 && lastPostAt) {
      const waitSeconds = boardContext.settings.postIntervalSeconds - Math.floor((Date.now() - new Date(lastPostAt).getTime()) / 1000)

      if (waitSeconds > 0) {
        return NextResponse.json({ code: 429, message: `发帖过于频繁，请 ${waitSeconds} 秒后再试` }, { status: 429 })
      }
    }

    const totalPointCost = Math.max(0, -(boardContext.settings.postPointDelta ?? 0)) + (postType === "BOUNTY" ? (bountyPoints ?? 0) : 0)

    if (author.points < totalPointCost) {
      return NextResponse.json({ code: 400, message: `当前${settings.pointName}不足，无法在该节点发布此帖子` }, { status: 400 })
    }


    const shouldPending = Boolean(boardContext.settings.requirePostReview || titleSafety.shouldReview || contentSafety.shouldReview || replyUnlockSafety?.shouldReview || purchaseUnlockSafety?.shouldReview)

    const post = await prisma.$transaction(async (tx) => {
      const lotteryData = normalizedLottery?.data
      const postCreateData = {
        title: titleSafety.sanitizedText,
        slug: createPostSlug(titleSafety.sanitizedText),
        content: serializedContent,
        summary: summary || titleSafety.sanitizedText,
        board: {
          connect: { id: boardContext.board.id },
        },
        author: {
          connect: { id: author.id },
        },
        type: postType,
        status: shouldPending ? "PENDING" : "NORMAL",
        commentsVisibleToAuthorOnly,
        minViewLevel,
        bountyPoints: postType === "BOUNTY" ? bountyPoints : null,
        pollExpiresAt: postType === "POLL" ? pollExpiresAt : null,
        lotteryStatus: postType === "LOTTERY" ? (shouldPending ? "DRAFT" : "ACTIVE") : null,
        lotteryTriggerMode: postType === "LOTTERY" ? determineLotteryTriggerMode({
          endsAt: lotteryData?.endsAt ?? null,
          participantGoal: lotteryData?.participantGoal ?? null,
        }) : null,
        lotteryStartsAt: postType === "LOTTERY" ? (lotteryData?.startsAt ?? new Date()) : null,
        lotteryEndsAt: postType === "LOTTERY" ? (lotteryData?.endsAt ?? null) : null,
        lotteryParticipantGoal: postType === "LOTTERY" ? (lotteryData?.participantGoal ?? null) : null,
        editableUntil: new Date(Date.now() + 10 * 60 * 1000),
        publishedAt: shouldPending ? null : new Date(),
        reviewNote: titleSafety.shouldReview || contentSafety.shouldReview ? "命中敏感词规则，已进入审核" : null,
        pollOptions: postType === "POLL"
          ? {
              create: pollOptions.map((option, index) => ({
                content: option,
                sortOrder: index,
              })),
            }
          : undefined,
        lotteryPrizes: postType === "LOTTERY"
          ? {
              create: (lotteryData?.prizes ?? []).map((prize, index) => ({
                title: prize.title,
                description: prize.description,
                quantity: prize.quantity,
                sortOrder: index,
              })),
            }
          : undefined,
        lotteryConditions: postType === "LOTTERY"
          ? {
              create: (lotteryData?.conditions ?? []).map((condition, index) => ({
                type: condition.type,
                operator: condition.operator ?? "GTE",
                value: condition.value,
                description: condition.description,
                groupKey: condition.groupKey ?? "default",
                sortOrder: index,
              })),
            }
          : undefined,
      } as never


      const createdPost = await tx.post.create({
        data: postCreateData,
      })

      const pointDelta = boardContext.settings.postPointDelta ?? 0
      const totalDeduction = Math.max(0, -pointDelta) + (postType === "BOUNTY" ? (bountyPoints ?? 0) : 0)
      const totalIncrease = Math.max(0, pointDelta)
      const userUpdateData: {
        postCount: { increment: number }
        lastPostAt: Date
        points?: { decrement: number } | { increment: number }
      } = {
        postCount: {
          increment: 1,
        },
        lastPostAt: new Date(),
      }

      if (totalDeduction > 0) {
        userUpdateData.points = {
          decrement: totalDeduction,
        }
      } else if (totalIncrease > 0) {
        userUpdateData.points = {
          increment: totalIncrease,
        }
      }

      await tx.user.update({
        where: { id: author.id },
        data: userUpdateData,
      })

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

      await tx.board.update({
        where: { id: boardContext.board.id },
        data: {
          postCount: {
            increment: 1,
          },
        },
      })

      return createdPost
    })

    await syncPostTaxonomy(post.id, titleSafety.sanitizedText, serializedContent)
    await evaluateUserLevelProgress(author.id)

    return NextResponse.json({
      code: 0,
      message: shouldPending ? "帖子命中敏感词或审核规则，已提交审核" : "success",
      data: {
        id: post.id,
        slug: post.slug,
        status: post.status,
      },
    })
  } catch (error) {
    console.error(error)
    if (error instanceof ContentSafetyError) {
      return NextResponse.json({ code: 400, message: error.message }, { status: error.statusCode })
    }
    const message = error instanceof Error && error.message ? error.message : "创建帖子失败"
    return NextResponse.json({ code: 500, message }, { status: 500 })
  }
}




