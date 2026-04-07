import { findPostUpdateContext, runPostUpdateTransaction } from "@/db/post-update-queries"

import { apiError } from "@/lib/api-route"
import { extractSummaryFromContent } from "@/lib/content"
import { enforceSensitiveText } from "@/lib/content-safety"
import { createPostMentionNotifications, stripPostContentUserLinks } from "@/lib/post-mentions"
import { buildPostContentDocument, getAllPostContentText, getPostContentMeta, serializePostContentDocument } from "@/lib/post-content"
import { normalizeManualTags, syncPostTaxonomy } from "@/lib/post-editor"
import { getSiteSettings } from "@/lib/site-settings"
import { validatePostPayload } from "@/lib/validators"

const APPEND_INTERVAL_MS = 60 * 60 * 1000

export async function updatePostFlow(input: {
  postId: string
  body: unknown
  currentUser: {
    id: number
    role?: string | null
  }
}) {
  const settings = await getSiteSettings()
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

  const { title, content, coverPath, replyUnlockContent, replyThreshold, purchaseUnlockContent, purchasePrice, commentsVisibleToAuthorOnly, minViewLevel, minViewVipLevel } = validated.data
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

  const isAdmin = input.currentUser.role === "ADMIN"
  const existingContentMeta = getPostContentMeta(post.content)
  const canEditFull = isAdmin || input.currentUser.id === post.authorId
  if (!canEditFull) {
    apiError(403, "没有权限编辑该帖子")
  }

  const editDeadline = new Date(post.createdAt).getTime() + Math.max(0, settings.postEditableMinutes) * 60 * 1000
  const canEditNormally = isAdmin || (editDeadline > Date.now())

  if (canEditNormally && !appendedContent) {
    const titleSafety = await enforceSensitiveText({ scene: "post.title", text: title })
    const contentSafety = await enforceSensitiveText({ scene: "post.content", text: content })
    const replyUnlockSafety = replyUnlockContent ? await enforceSensitiveText({ scene: "post.content", text: replyUnlockContent }) : null
    const purchaseUnlockSafety = purchaseUnlockContent ? await enforceSensitiveText({ scene: "post.content", text: purchaseUnlockContent }) : null
    const tagsSafety = sanitizedManualTags.length > 0 ? await enforceSensitiveText({ scene: "post.tags", text: sanitizedManualTags.join("\n") }) : null

    const normalizedReplyThreshold = replyUnlockContent ? (replyThreshold ?? 1) : undefined
    const normalizedPurchasePrice = purchaseUnlockContent ? (purchasePrice ?? 1) : undefined
    const serializedContent = serializePostContentDocument(buildPostContentDocument({
      publicContent: contentSafety.sanitizedText,
      replyUnlockContent: replyUnlockSafety?.sanitizedText ?? "",
      replyThreshold: normalizedReplyThreshold,
      purchaseUnlockContent: purchaseUnlockSafety?.sanitizedText ?? "",
      purchasePrice: normalizedPurchasePrice,
      meta: existingContentMeta,
    }))
    const summary = extractSummaryFromContent(getAllPostContentText(serializedContent))
    const shouldReview = Boolean(
      titleSafety.shouldReview
      || contentSafety.shouldReview
      || replyUnlockSafety?.shouldReview
      || purchaseUnlockSafety?.shouldReview
      || tagsSafety?.shouldReview,
    )

    let finalContent = serializedContent

    await runPostUpdateTransaction(async (tx) => {
      const activityAt = new Date()
      let nextContent = serializedContent
      let nextSummary = summary

      if (!shouldReview) {
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
      }

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
          reviewNote: titleSafety.shouldReview || contentSafety.shouldReview || tagsSafety?.shouldReview ? "编辑内容命中敏感词规则，请复核" : undefined,
        },
      })
    })

    await syncPostTaxonomy(input.postId, titleSafety.sanitizedText, finalContent, sanitizedManualTags)

    return {
      post,
      mode: "edit" as const,
      shouldReview,
    }
  }

  if (!appendedContent) {
    apiError(400, "超过编辑时限后只能追加内容")
  }

  if (!isAdmin && post.lastAppendedAt) {
    const waitMs = APPEND_INTERVAL_MS - (Date.now() - new Date(post.lastAppendedAt).getTime())
    if (waitMs > 0) {
      apiError(429, `追加过于频繁，请 ${Math.ceil(waitMs / (60 * 1000))} 分钟后再试`)
    }
  }

  const appendSafety = await enforceSensitiveText({ scene: "post.content", text: appendedContent })
  const nextSortOrder = (post.appendices[0]?.sortOrder ?? -1) + 1

  await runPostUpdateTransaction(async (tx) => {
    const activityAt = new Date()
    let nextAppendedContent = appendSafety.sanitizedText

    if (!appendSafety.shouldReview) {
      const mentionResult = await createPostMentionNotifications({
        tx,
        postId: input.postId,
        senderId: input.currentUser.id,
        senderName: input.currentUser.id === post.authorId ? "楼主" : "管理员",
        rawPostContent: appendSafety.sanitizedText,
        excludeUserIds: [post.authorId],
      })
      nextAppendedContent = mentionResult.content
    }

    await tx.post.update({
      where: { id: input.postId },
      data: {
        activityAt,
        appendedContent: nextAppendedContent,
        lastAppendedAt: activityAt,
        reviewNote: appendSafety.shouldReview ? "追加内容命中敏感词审核规则，请复核" : undefined,
        appendices: {
          create: {
            content: nextAppendedContent,
            sortOrder: nextSortOrder,
          },
        },
      },
    })
  })

  return {
    post,
    mode: "append" as const,
    shouldReview: appendSafety.shouldReview,
  }
}
