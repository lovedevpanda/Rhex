import { findPostAppendState, findPostUpdateContext, lockPostAppendTarget, runPostUpdateTransaction } from "@/db/post-update-queries"
import { findPostAttachmentsByPostId } from "@/db/post-attachment-queries"

import type { SessionActor } from "@/lib/auth"
import { apiError } from "@/lib/api-route"
import { verifyCreatePostCaptchaWithAddonProviders } from "@/lib/addon-captcha-providers"
import { readAddonFormFieldsFromBody } from "@/lib/addon-form-fields"
import { canAdminActorManageBoardWithPermission } from "@/lib/admin-scope-permissions"
import { resolveHookedStringValue } from "@/lib/addon-hook-values"
import { resolveBoardSettings } from "@/lib/board-settings"
import { extractSummaryFromContent } from "@/lib/content"
import { enforceSensitiveText } from "@/lib/content-safety"
import { createPostMentionNotifications, stripPostContentUserLinks } from "@/lib/post-mentions"
import { normalizePostAttachmentInputs, syncPostAttachments } from "@/lib/post-attachments"
import { processInternalPostCardEmbeds } from "@/lib/post-card-embed.server"
import { buildPostContentDocument, getAllPostContentText, getPostContentMeta, serializePostContentDocument } from "@/lib/post-content"
import { isPostStillEditable, resolvePostEditWindowMinutes } from "@/lib/post-edit-window"
import { normalizeManualTags, syncPostTaxonomy } from "@/lib/post-editor"
import { getSiteSettings } from "@/lib/site-settings"
import { validatePostPayload } from "@/lib/validators"
import { resolveAdminActorFromSessionUser } from "@/lib/moderator-permissions"
import { queryAddonPosts } from "@/addons-host/runtime/posts"
import { executeAddonActionHook, executeAddonWaterfallHook } from "@/addons-host/runtime/hooks"

const APPEND_INTERVAL_MS = 60 * 60 * 1000

export async function updatePostFlow(input: {
  postId: string
  body: unknown
  request: Request
  currentUser: SessionActor
}) {
  const settings = await getSiteSettings()
  const requestUrl = new URL(input.request.url)
  const hookContext = {
    request: input.request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
  }
  const postCardEmbedOptions = {
    requestUrl: input.request.url,
    requestHeaders: input.request.headers,
    currentPostId: input.postId,
    postLinkDisplayMode: settings.postLinkDisplayMode,
  }
  const fallbackTitle = "占".repeat(settings.postTitleMinLength)
  const fallbackContent = "文".repeat(settings.postContentMinLength)
  const validated = validatePostPayload({
    boardSlug: "__edit__",
    postType: "NORMAL",
    ...((input.body as Record<string, unknown> | null) ?? {}),
    title: typeof (input.body as Record<string, unknown> | null)?.title === "string" ? (input.body as Record<string, unknown>).title : fallbackTitle,
    content: typeof (input.body as Record<string, unknown> | null)?.content === "string" ? (input.body as Record<string, unknown>).content : fallbackContent,
  }, {
    titleMinLength: settings.postTitleMinLength,
    titleMaxLength: settings.postTitleMaxLength,
    contentMinLength: settings.postContentMinLength,
    contentMaxLength: settings.postContentMaxLength,
  })

  if (!validated.success || !validated.data) {
    apiError(400, validated.message ?? "参数错误")
  }

  const { title, content, coverPath, loginUnlockContent, replyUnlockContent, replyThreshold, purchaseUnlockContent, purchasePrice, commentsVisibleToAuthorOnly, minViewLevel, minViewVipLevel } = validated.data
  const addonFields = readAddonFormFieldsFromBody(input.body)
  const rawAppendedContent = (input.body as Record<string, unknown> | null)?.appendedContent
  const appendedContent = typeof rawAppendedContent === "string"
    ? rawAppendedContent.trim()
    : ""
  const rawBody = input.body as Record<string, unknown>
  const manualTags = normalizeManualTags(Array.isArray(rawBody?.manualTags)
    ? rawBody.manualTags.filter((item): item is string => typeof item === "string")
    : [])
  const sanitizedManualTags = normalizeManualTags(manualTags)

  const post = await findPostUpdateContext(input.postId)

  if (!post) {
    apiError(404, "帖子不存在")
  }

  const adminActor = await resolveAdminActorFromSessionUser(input.currentUser)
  const canManagePost = Boolean(
    adminActor
    && await canAdminActorManageBoardWithPermission(
      adminActor,
      "admin.content.manage",
      post.boardId,
      post.board.zoneId,
    ),
  )
  const existingContentMeta = getPostContentMeta(post.content)
  const canEditFull = canManagePost || input.currentUser.id === post.authorId
  if (!canEditFull) {
    apiError(403, "没有权限编辑该帖子")
  }

  const boardSettings = resolveBoardSettings(post.board.zone, post.board)
  const postEditableMinutes = resolvePostEditWindowMinutes(
    settings.postEditableMinutes,
    boardSettings.postEditRules,
    input.currentUser,
  )
  const canEditNormally = canManagePost || isPostStillEditable(post.createdAt, postEditableMinutes)

  if (canEditNormally && !appendedContent) {
    await verifyCreatePostCaptchaWithAddonProviders({
      request: input.request,
      payload: {
        title,
        content,
        isAnonymous: post.isAnonymous,
        coverPath,
        boardSlug: post.board.slug,
        postType: post.type,
        bountyPoints: validated.data.bountyPoints,
        auctionConfig: validated.data.auctionConfig,
        pollOptions: validated.data.pollOptions,
        commentsVisibleToAuthorOnly,
        loginUnlockContent,
        replyUnlockContent,
        replyThreshold,
        purchaseUnlockContent,
        purchasePrice,
        minViewLevel,
        minViewVipLevel,
        lotteryConfig: validated.data.lotteryConfig,
      },
      addonFields,
    })
    const existingAttachments = await findPostAttachmentsByPostId(post.id)
    const normalizedAttachments = await normalizePostAttachmentInputs(rawBody?.attachments, {
      settings,
      user: {
        id: input.currentUser.id,
        role: input.currentUser.role,
        level: input.currentUser.level,
        vipLevel: input.currentUser.vipLevel,
        vipExpiresAt: input.currentUser.vipExpiresAt,
      },
      uploadOwnerUserIds: canManagePost ? [input.currentUser.id, post.authorId] : [post.authorId],
      allowedExistingAttachmentIds: existingAttachments.map((attachment) => attachment.id),
    })
    const titleHookResult = await executeAddonWaterfallHook("post.title.value", title, {
      ...hookContext,
      payload: {
        mode: "update",
        postId: input.postId,
        boardSlug: post.board.slug,
        postType: post.type,
      },
    })
    const { value: hookedTitle, changed: titleHookAdjusted } = resolveHookedStringValue(title, titleHookResult.value)
    const contentHookResult = await executeAddonWaterfallHook("post.content.value", content, {
      ...hookContext,
      payload: {
        mode: "update",
        postId: input.postId,
        boardSlug: post.board.slug,
        postType: post.type,
      },
    })
    const { value: hookedContent, changed: contentHookAdjusted } = resolveHookedStringValue(content, contentHookResult.value)
    const titleSafety = await enforceSensitiveText({ scene: "post.title", text: hookedTitle })
    const contentSafety = await enforceSensitiveText({ scene: "post.content", text: hookedContent })
    const loginUnlockSafety = loginUnlockContent ? await enforceSensitiveText({ scene: "post.content", text: loginUnlockContent }) : null
    const replyUnlockSafety = replyUnlockContent ? await enforceSensitiveText({ scene: "post.content", text: replyUnlockContent }) : null
    const purchaseUnlockSafety = purchaseUnlockContent ? await enforceSensitiveText({ scene: "post.content", text: purchaseUnlockContent }) : null
    const tagsSafety = sanitizedManualTags.length > 0 ? await enforceSensitiveText({ scene: "post.tags", text: sanitizedManualTags.join("\n") }) : null
    const [
      publicContentWithCards,
      loginUnlockContentWithCards,
      replyUnlockContentWithCards,
      purchaseUnlockContentWithCards,
    ] = await Promise.all([
      processInternalPostCardEmbeds(contentSafety.sanitizedText, postCardEmbedOptions),
      loginUnlockSafety ? processInternalPostCardEmbeds(loginUnlockSafety.sanitizedText, postCardEmbedOptions) : "",
      replyUnlockSafety ? processInternalPostCardEmbeds(replyUnlockSafety.sanitizedText, postCardEmbedOptions) : "",
      purchaseUnlockSafety ? processInternalPostCardEmbeds(purchaseUnlockSafety.sanitizedText, postCardEmbedOptions) : "",
    ])

    const normalizedReplyThreshold = replyUnlockContent ? (replyThreshold ?? 1) : undefined
    const normalizedPurchasePrice = purchaseUnlockContent ? (purchasePrice ?? 1) : undefined
    const serializedContent = serializePostContentDocument(buildPostContentDocument({
      publicContent: publicContentWithCards,
      loginUnlockContent: loginUnlockContentWithCards,
      replyUnlockContent: replyUnlockContentWithCards,
      replyThreshold: normalizedReplyThreshold,
      purchaseUnlockContent: purchaseUnlockContentWithCards,
      purchasePrice: normalizedPurchasePrice,
      meta: existingContentMeta,
    }))
    const summary = extractSummaryFromContent(getAllPostContentText(serializedContent))
    const contentAdjusted = Boolean(
      titleHookAdjusted
      || contentHookAdjusted
      || titleSafety.wasReplaced
      || contentSafety.wasReplaced
      || loginUnlockSafety?.wasReplaced
      || replyUnlockSafety?.wasReplaced
      || purchaseUnlockSafety?.wasReplaced
      || tagsSafety?.wasReplaced,
    )

    let finalContent = serializedContent
    let mentionUserIds = [] as number[]

    await executeAddonActionHook("post.update.before", {
      postId: input.postId,
      editorId: String(input.currentUser.id),
      changes: {
        title: titleSafety.sanitizedText,
        content: publicContentWithCards,
        coverPath,
        loginUnlockContent: loginUnlockContentWithCards,
        replyUnlockContent: replyUnlockContentWithCards,
        replyThreshold: normalizedReplyThreshold,
        purchaseUnlockContent: purchaseUnlockContentWithCards,
        purchasePrice: normalizedPurchasePrice,
        commentsVisibleToAuthorOnly,
        minViewLevel,
        minViewVipLevel,
        manualTags: sanitizedManualTags,
      },
    }, {
      ...hookContext,
      throwOnError: true,
    })

    await runPostUpdateTransaction(async (tx) => {
      const activityAt = new Date()
      let nextContent = serializedContent
      let nextSummary = summary

      const mentionResult = await createPostMentionNotifications({
        tx,
        postId: input.postId,
        senderId: input.currentUser.id,
        senderName: input.currentUser.id === post.authorId ? "楼主" : "管理员",
        rawPostContent: serializedContent,
        excludeUserIds: [post.authorId],
      })
      nextContent = mentionResult.content
      nextSummary = extractSummaryFromContent(getAllPostContentText(stripPostContentUserLinks(mentionResult.content))) || summary
      mentionUserIds = mentionResult.mentionUserIds

      finalContent = nextContent

      await tx.post.update({
        where: { id: input.postId },
        data: {
          activityAt,
          title: titleSafety.sanitizedText,
          content: nextContent,
          coverPath,
          summary: nextSummary,
          commentsVisibleToAuthorOnly,
          minViewLevel,
          minViewVipLevel,
        },
      })

      await syncPostAttachments(tx, {
        postId: input.postId,
        attachments: normalizedAttachments,
      })
    })

    const taxonomyResult = await syncPostTaxonomy(input.postId, titleSafety.sanitizedText, finalContent, sanitizedManualTags)
    const updatedPost = (await queryAddonPosts({
      ids: [input.postId],
      statuses: ["NORMAL", "PENDING", "LOCKED", "OFFLINE"],
      limit: 1,
    })).items[0]

    await executeAddonActionHook("post.update.after", {
      postId: input.postId,
      editorId: String(input.currentUser.id),
      changes: {
        title: titleSafety.sanitizedText,
        content: finalContent,
        coverPath,
        summary: extractSummaryFromContent(getAllPostContentText(stripPostContentUserLinks(finalContent))),
        commentsVisibleToAuthorOnly,
        minViewLevel,
        minViewVipLevel,
        manualTags: sanitizedManualTags,
      },
      ...(updatedPost ? { post: updatedPost } : {}),
    }, hookContext)

    return {
      post,
      mode: "edit" as const,
      contentAdjusted,
      mentionUserIds,
      affectedTagSlugs: taxonomyResult.affectedTagSlugs,
    }
  }

  if (!appendedContent) {
    apiError(400, "超过编辑时限后只能追加内容")
  }

  if (!canManagePost && post.lastAppendedAt) {
    const waitMs = APPEND_INTERVAL_MS - (Date.now() - new Date(post.lastAppendedAt).getTime())
    if (waitMs > 0) {
      apiError(429, `追加过于频繁，请 ${Math.ceil(waitMs / (60 * 1000))} 分钟后再试`)
    }
  }

  const appendedContentHookResult = await executeAddonWaterfallHook("post.content.value", appendedContent, {
    ...hookContext,
    payload: {
      mode: "append",
      postId: input.postId,
      boardSlug: post.board.slug,
      postType: post.type,
    },
  })
  const { value: hookedAppendedContent, changed: appendHookAdjusted } = resolveHookedStringValue(appendedContent, appendedContentHookResult.value)
  const appendSafety = await enforceSensitiveText({ scene: "post.content", text: hookedAppendedContent })
  const appendedContentWithCards = await processInternalPostCardEmbeds(appendSafety.sanitizedText, {
    ...postCardEmbedOptions,
  })
  let mentionUserIds = [] as number[]

  await executeAddonActionHook("post.update.before", {
    postId: input.postId,
    editorId: String(input.currentUser.id),
    changes: { appendedContent: appendedContentWithCards, mode: "append" },
  }, {
    ...hookContext,
    throwOnError: true,
  })

  await runPostUpdateTransaction(async (tx) => {
    if (!await lockPostAppendTarget(tx, input.postId)) {
      apiError(404, "帖子不存在")
    }

    const latestAppendState = await findPostAppendState(tx, input.postId)
    if (!latestAppendState) {
      apiError(404, "帖子不存在")
    }

    if (!canManagePost && latestAppendState.lastAppendedAt) {
      const waitMs = APPEND_INTERVAL_MS - (Date.now() - new Date(latestAppendState.lastAppendedAt).getTime())
      if (waitMs > 0) {
        apiError(429, `追加过于频繁，请 ${Math.ceil(waitMs / (60 * 1000))} 分钟后再试`)
      }
    }

    const nextSortOrder = (latestAppendState.appendices[0]?.sortOrder ?? -1) + 1
    const activityAt = new Date()
    let nextAppendedContent = appendedContentWithCards

    const mentionResult = await createPostMentionNotifications({
      tx,
      postId: input.postId,
      senderId: input.currentUser.id,
      senderName: input.currentUser.id === post.authorId ? "楼主" : "管理员",
      rawPostContent: appendedContentWithCards,
      excludeUserIds: [post.authorId],
    })
    nextAppendedContent = mentionResult.content
    mentionUserIds = mentionResult.mentionUserIds

    await tx.post.update({
      where: { id: input.postId },
      data: {
        activityAt,
        lastCommentedAt: activityAt,
        appendedContent: nextAppendedContent,
        lastAppendedAt: activityAt,
        appendices: {
          create: {
            content: nextAppendedContent,
            sortOrder: nextSortOrder,
          },
        },
      },
    })
  })

  const updatedPost = (await queryAddonPosts({
    ids: [input.postId],
    statuses: ["NORMAL", "PENDING", "LOCKED", "OFFLINE"],
    limit: 1,
  })).items[0]
  await executeAddonActionHook("post.update.after", {
    postId: input.postId,
    editorId: String(input.currentUser.id),
    changes: { appendedContent: appendedContentWithCards, mode: "append" },
    ...(updatedPost ? { post: updatedPost } : {}),
  }, hookContext)

  return {
    post,
    mode: "append" as const,
    contentAdjusted: appendHookAdjusted || appendSafety.wasReplaced,
    mentionUserIds,
    affectedTagSlugs: [] as string[],
  }
}
