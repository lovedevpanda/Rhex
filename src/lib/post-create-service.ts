import { executeAddonWaterfallHook } from "@/addons-host/runtime/hooks"
import { getCurrentUserRecord, type CurrentUserRecord } from "@/db/current-user"
import {
  countAnonymousPostsByAuthorInRange,
  findAnonymousMaskUserById,
} from "@/db/anonymous-post-queries"
import {
  createPostRecord,
  incrementBoardPostCount,
  runPostCreateTransaction,
  updateAuthorAfterPostCreated,
  updatePostContentAndSummary,
} from "@/db/post-create-queries"
import { incrementBoardTreasuryPoints } from "@/db/board-treasury-queries"
import { type Prisma } from "@/db/types"

import { verifyCreatePostCaptchaWithAddonProviders } from "@/lib/addon-captcha-providers"
import { readAddonFormFieldsFromBody } from "@/lib/addon-form-fields"
import { apiError } from "@/lib/api-route"
import { checkBoardPermission, getBoardAccessContextBySlug } from "@/lib/board-access"
import { extractSummaryFromContent } from "@/lib/content"
import { enforceSensitiveText } from "@/lib/content-safety"
import { getBusinessDayRange, parseBusinessDateTime } from "@/lib/formatters"
import { determineLotteryTriggerMode, normalizeLotteryConfig } from "@/lib/lottery"
import { enforceInteractionGate } from "@/lib/interaction-gates"
import { createPostMentionNotifications, stripPostContentUserLinks } from "@/lib/post-mentions"
import { createPostAuctionRecord, enqueuePostAuctionSettlement, normalizePostAuctionConfig } from "@/lib/post-auctions"
import type { PreparedPointDelta } from "@/lib/point-center"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { normalizePostAttachmentInputs, syncPostAttachments } from "@/lib/post-attachments"
import { buildPostContentDocument, getAllPostContentText, serializePostContentDocument } from "@/lib/post-content"
import { createPostRedPacketAfterPostCreated, normalizePostRedPacketConfig } from "@/lib/post-red-packets"
import type { StoredPostRewardPoolConfig } from "@/lib/post-reward-pool-config"
import { normalizeManualTags, syncPostTaxonomy } from "@/lib/post-editor"
import { getBoardTreasuryCreditFromConfiguredCharge } from "@/lib/board-treasury"
import { POINT_LOG_EVENT_TYPES } from "@/lib/point-log-events"
import {  buildPostSlug } from "@/lib/post-slug"
import { getSiteSettings } from "@/lib/site-settings"
import { validatePostPayload } from "@/lib/validators"

const MAX_POST_SLUG_RETRY_COUNT = 8

export type PostCreateStatusMode = "AUTO" | "PUBLISHED" | "PENDING"

interface CreatePostFlowOptions {
  request: Request
  author?: CurrentUserRecord | null
  statusMode?: PostCreateStatusMode
}

function isPostSlugUniqueConstraintError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error) || (error as { code?: string }).code !== "P2002") {
    return false
  }

  const metaTarget = "meta" in error && typeof error.meta === "object" && error.meta && "target" in error.meta
    ? error.meta.target
    : null

  return Array.isArray(metaTarget)
    ? metaTarget.some((item) => item === "slug")
    : true
}

export async function createPostFlow(body: unknown, options: CreatePostFlowOptions) {
  const settings = await getSiteSettings()
  const validated = validatePostPayload(body, {
    titleMinLength: settings.postTitleMinLength,
    titleMaxLength: settings.postTitleMaxLength,
    contentMinLength: settings.postContentMinLength,
    contentMaxLength: settings.postContentMaxLength,
  })

  if (!validated.success || !validated.data) {
    apiError(400, validated.message ?? "参数错误")
  }

  const { title, content, isAnonymous, coverPath, boardSlug, postType, bountyPoints, auctionConfig, pollOptions, commentsVisibleToAuthorOnly, loginUnlockContent, replyUnlockContent, replyThreshold, purchaseUnlockContent, purchasePrice, minViewLevel, minViewVipLevel, lotteryConfig } = validated.data

  const addonFields = readAddonFormFieldsFromBody(body)
  await verifyCreatePostCaptchaWithAddonProviders({
    request: options.request,
    payload: {
      title,
      content,
      isAnonymous,
      coverPath,
      boardSlug,
      postType,
      bountyPoints,
      auctionConfig,
      pollOptions,
      commentsVisibleToAuthorOnly,
      loginUnlockContent,
      replyUnlockContent,
      replyThreshold,
      purchaseUnlockContent,
      purchasePrice,
      minViewLevel,
      minViewVipLevel,
      lotteryConfig,
    },
    addonFields,
  })

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
  const normalizedAuction = postType === "AUCTION" ? normalizePostAuctionConfig(auctionConfig) : null
  const normalizedRedPacket = await normalizePostRedPacketConfig(redPacketConfig)
  const redPacketTotalPoints = normalizedRedPacket.data?.enabled
    ? normalizedRedPacket.data.mode === "JACKPOT"
      ? (normalizedRedPacket.data.initialPoints ?? 0)
      : (normalizedRedPacket.data.totalPoints ?? 0)
    : 0

  if (postType === "LOTTERY" && (!normalizedLottery?.success || !normalizedLottery.data)) {
    apiError(400, normalizedLottery?.message ?? "抽奖配置不合法")
  }

  if (postType === "AUCTION" && (!normalizedAuction?.success || !normalizedAuction.data)) {
    apiError(400, normalizedAuction?.message ?? "拍卖配置不合法")
  }

  if (!normalizedRedPacket.success) {
    apiError(400, normalizedRedPacket.message ?? "红包配置不合法")
  }

  if (isAnonymous && normalizedRedPacket.data?.enabled && normalizedRedPacket.data.mode === "RED_PACKET") {
    apiError(400, "匿名发布暂不支持帖子红包")
  }

  const titleHookResult = await executeAddonWaterfallHook("post.title.value", title, {
    request: options.request,
  })
  const hookedTitle = typeof titleHookResult.value === "string" && titleHookResult.value.trim()
    ? titleHookResult.value
    : title
  const titleSafety = await enforceSensitiveText({ scene: "post.title", text: hookedTitle })
  const contentSafety = await enforceSensitiveText({ scene: "post.content", text: content })
  const loginUnlockSafety = loginUnlockContent ? await enforceSensitiveText({ scene: "post.content", text: loginUnlockContent }) : null
  const replyUnlockSafety = replyUnlockContent ? await enforceSensitiveText({ scene: "post.content", text: replyUnlockContent }) : null
  const purchaseUnlockSafety = purchaseUnlockContent ? await enforceSensitiveText({ scene: "post.content", text: purchaseUnlockContent }) : null

  const contentDocument = buildPostContentDocument({
    publicContent: contentSafety.sanitizedText,
    loginUnlockContent: loginUnlockSafety?.sanitizedText ?? "",
    replyUnlockContent: replyUnlockSafety?.sanitizedText ?? "",
    replyThreshold: replyThreshold ?? undefined,
    purchaseUnlockContent: purchaseUnlockSafety?.sanitizedText ?? "",
    purchasePrice: purchasePrice ?? undefined,
    meta: normalizedRedPacket.data?.enabled
      ? {
          rewardPool: normalizedRedPacket.data as StoredPostRewardPoolConfig,
        }
      : undefined,
  })

  const serializedContent = serializePostContentDocument(contentDocument)
  const summary = extractSummaryFromContent(getAllPostContentText(serializedContent))
  const requestUrl = new URL(options.request.url)
  const resolvePostSlug = async () => {
    const baseSlug = buildPostSlug(titleSafety.sanitizedText, settings.postSlugGenerationMode)
    const hooked = await executeAddonWaterfallHook("post.slug.value", baseSlug, {
      request: options.request,
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
    })

    return typeof hooked.value === "string" && hooked.value.trim()
      ? hooked.value.trim()
      : baseSlug
  }

  const [boardContext, author] = await Promise.all([
    getBoardAccessContextBySlug(boardSlug),
    options.author ? Promise.resolve(options.author) : getCurrentUserRecord(),
  ])

  if (!boardContext || !author) {
    apiError(404, "节点或作者不存在")
  }

  let anonymousMaskUser = null

  if (isAnonymous) {
    if (!settings.anonymousPostEnabled) {
      apiError(403, "当前站点未开启匿名发帖")
    }

    if (postType !== "NORMAL" && postType !== "POLL") {
      apiError(400, "匿名发布当前只支持普通帖和投票帖")
    }

    if (!settings.anonymousPostMaskUserId) {
      apiError(400, "后台未配置匿名账号")
    }

    anonymousMaskUser = await findAnonymousMaskUserById(settings.anonymousPostMaskUserId)
    if (!anonymousMaskUser) {
      apiError(400, "匿名账号不存在，请先检查后台配置")
    }

    if (settings.anonymousPostDailyLimit > 0) {
      const { start, end } = getBusinessDayRange()
      const todayAnonymousPostCount = await countAnonymousPostsByAuthorInRange({
        authorId: author.id,
        start,
        end,
      })

      if (todayAnonymousPostCount >= settings.anonymousPostDailyLimit) {
        apiError(400, `你今天可匿名发帖 ${settings.anonymousPostDailyLimit} 次，已达上限`)
      }
    }
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

  enforceInteractionGate({
    action: "POST_CREATE",
    settings: settings.interactionGates,
    user: author,
  })

  const lastPostAt = (author as { lastPostAt?: Date | null }).lastPostAt ?? null
  if (boardContext.settings.postIntervalSeconds > 0 && lastPostAt) {
    const waitSeconds = boardContext.settings.postIntervalSeconds - Math.floor((Date.now() - new Date(lastPostAt).getTime()) / 1000)
    if (waitSeconds > 0) {
      apiError(429, `发帖过于频繁，请 ${waitSeconds} 秒后再试`)
    }
  }

  const preparedPostDelta = await prepareScopedPointDelta({
    scopeKey: "POST_CREATE",
    baseDelta: boardContext.settings.postPointDelta ?? 0,
    userId: author.id,
  })
  const preparedBountyDelta = postType === "BOUNTY" && bountyPoints
    ? await prepareScopedPointDelta({
        scopeKey: "BOUNTY_POST_FREEZE",
        baseDelta: -bountyPoints,
        userId: author.id,
      })
    : null
  const totalRequiredPointCost = Math.max(0, -preparedPostDelta.finalDelta)
    + Math.max(0, -(preparedBountyDelta?.finalDelta ?? 0))
    + (isAnonymous ? settings.anonymousPostPrice : 0)
    + redPacketTotalPoints

  if (author.points < totalRequiredPointCost) {
    apiError(400, `当前${settings.pointName}不足，无法在该节点发布此帖子`)
  }

  const normalizedAttachments = await normalizePostAttachmentInputs(rawBody?.attachments, {
    settings,
    user: author,
  })

  const statusMode = options.statusMode ?? "AUTO"
  const shouldPending = statusMode === "PENDING"
    ? true
    : statusMode === "PUBLISHED"
      ? false
      : Boolean(boardContext.settings.requirePostReview)
  const contentAdjusted = Boolean(
    titleSafety.wasReplaced
    || contentSafety.wasReplaced
    || loginUnlockSafety?.wasReplaced
    || replyUnlockSafety?.wasReplaced
    || purchaseUnlockSafety?.wasReplaced
    || tagsSafety?.wasReplaced,
  )
  let slug = await resolvePostSlug()
  let post = null as Awaited<ReturnType<typeof createPostRecord>> | null
  let createdAuction = null as Awaited<ReturnType<typeof createPostAuctionRecord>> | null
  let mentionUserIds = [] as number[]

  for (let attempt = 0; attempt < MAX_POST_SLUG_RETRY_COUNT; attempt += 1) {
    createdAuction = null
    try {
      post = await runPostCreateTransaction(async (tx) => {
        const lotteryData = normalizedLottery?.data
        const postCreateData: Prisma.PostUncheckedCreateInput = {
          title: titleSafety.sanitizedText,
          slug,
          content: serializedContent,
          coverPath,
          summary: summary || titleSafety.sanitizedText,
          boardId: boardContext.board.id,
          authorId: author.id,
          isAnonymous,
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
          reviewNote: shouldPending ? "当前节点开启发帖审核，帖子已进入审核" : null,
          pollOptions: postType === "POLL" ? { create: pollOptions.map((option, index) => ({ content: option, sortOrder: index })) } : undefined,
          lotteryPrizes: postType === "LOTTERY" ? { create: (lotteryData?.prizes ?? []).map((prize, index) => ({ title: prize.title, description: prize.description, quantity: prize.quantity, sortOrder: index })) } : undefined,
          lotteryConditions: postType === "LOTTERY" ? { create: (lotteryData?.conditions ?? []).map((condition, index) => ({ type: condition.type, operator: condition.operator ?? "GTE", value: condition.value, description: condition.description, groupKey: condition.groupKey ?? "default", sortOrder: index })) } : undefined,
        }

        const createdPost = await createPostRecord(tx, postCreateData)
        if (normalizedAttachments.length > 0) {
          await syncPostAttachments(tx, {
            postId: createdPost.id,
            attachments: normalizedAttachments,
          })
        }
        if (postType === "AUCTION" && normalizedAuction?.success && normalizedAuction.data) {
          createdAuction = await createPostAuctionRecord(tx, {
            postId: createdPost.id,
            sellerId: author.id,
            config: normalizedAuction.data,
            active: !shouldPending,
          })
        }
        await updateAuthorAfterPostCreated(tx, author.id, new Date())

        let authorPointBalanceCursor = author.points

        if (preparedPostDelta.finalDelta !== 0) {
          const postDeltaResult = await applyPointDelta({
            tx,
            userId: author.id,
            beforeBalance: authorPointBalanceCursor,
            prepared: preparedPostDelta,
            pointName: settings.pointName,
            reason: "在指定节点发帖",
            eventType: POINT_LOG_EVENT_TYPES.BOARD_POST_CHARGE,
            eventData: {
              boardId: boardContext.board.id,
              postId: createdPost.id,
              configuredCharge: boardContext.settings.postPointDelta,
              appliedFinalDelta: preparedPostDelta.finalDelta,
            },
            relatedType: "POST",
            relatedId: createdPost.id,
          })
          authorPointBalanceCursor = postDeltaResult.afterBalance

          const treasuryCredit = getBoardTreasuryCreditFromConfiguredCharge(
            boardContext.settings.postPointDelta,
            postDeltaResult.finalDelta,
          )
          if (treasuryCredit > 0) {
            await incrementBoardTreasuryPoints(tx, boardContext.board.id, treasuryCredit)
          }
        }

        if (preparedBountyDelta) {
          const bountyResult = await applyPointDelta({
            tx,
            userId: author.id,
            beforeBalance: authorPointBalanceCursor,
            prepared: preparedBountyDelta,
            pointName: settings.pointName,
            reason: "发布悬赏帖冻结积分",
            relatedType: "POST",
            relatedId: createdPost.id,
          })
          authorPointBalanceCursor = bountyResult.afterBalance
        }

        if (isAnonymous && settings.anonymousPostPrice > 0) {
          const anonymousPreparedDelta: PreparedPointDelta = {
            scopeKey: "POST_CREATE",
            baseDelta: -settings.anonymousPostPrice,
            finalDelta: -settings.anonymousPostPrice,
            appliedRules: [],
          }
          const anonymousResult = await applyPointDelta({
            tx,
            userId: author.id,
            beforeBalance: authorPointBalanceCursor,
            prepared: anonymousPreparedDelta,
            pointName: settings.pointName,
            reason: "匿名发布帖子",
            relatedType: "POST",
            relatedId: createdPost.id,
          })
          authorPointBalanceCursor = anonymousResult.afterBalance
        }

        await createPostRedPacketAfterPostCreated({
          tx,
          postId: createdPost.id,
          senderId: author.id,
          senderBalanceBeforeChange: authorPointBalanceCursor,
          config: normalizedRedPacket.data,
          pointName: settings.pointName,
        })

        await incrementBoardPostCount(tx, boardContext.board.id)

        if (!shouldPending) {
          const mentionResult = await createPostMentionNotifications({
            tx,
            postId: createdPost.id,
            senderId: author.id,
            senderName: isAnonymous && anonymousMaskUser
              ? (anonymousMaskUser.nickname ?? anonymousMaskUser.username)
              : (author.nickname ?? author.username),
            rawPostContent: serializedContent,
          })
          mentionUserIds = mentionResult.mentionUserIds

          if (mentionResult.content !== serializedContent) {
            await updatePostContentAndSummary(
              tx,
              createdPost.id,
              mentionResult.content,
              extractSummaryFromContent(getAllPostContentText(stripPostContentUserLinks(mentionResult.content))) || titleSafety.sanitizedText,
            )
          }
        }

        return createdPost
      })

      break
    } catch (error) {
      if (!isPostSlugUniqueConstraintError(error) || attempt === MAX_POST_SLUG_RETRY_COUNT - 1) {
        throw error
      }

      slug = await resolvePostSlug()
    }
  }

  if (!post) {
    apiError(500, "帖子 slug 生成失败，请稍后再试")
  }

  await syncPostTaxonomy(post.id, titleSafety.sanitizedText, serializedContent, sanitizedManualTags)

  if (createdAuction?.status === "ACTIVE") {
    await enqueuePostAuctionSettlement(createdAuction.id, createdAuction.endsAt)
  }

  return {
    post,
    author,
    auction: createdAuction,
    shouldPending,
    contentAdjusted,
    mentionUserIds,
  }
}
