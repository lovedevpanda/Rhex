import { prisma } from "@/db/client"

import { apiError } from "@/lib/api-route"
import { extractSummaryFromContent } from "@/lib/content"
import { enforceSensitiveText } from "@/lib/content-safety"
import { createPostMentionNotifications, stripPostContentUserLinks } from "@/lib/post-mentions"
import { buildPostContentDocument, getAllPostContentText, serializePostContentDocument } from "@/lib/post-content"
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
  const validated = validatePostPayload({
    boardSlug: "__edit__",
    postType: "NORMAL",
    ...((input.body as Record<string, unknown> | null) ?? {}),
    title: typeof (input.body as Record<string, unknown> | null)?.title === "string" ? (input.body as Record<string, unknown>).title : "临时编辑标题占位符",
    content: typeof (input.body as Record<string, unknown> | null)?.content === "string" ? (input.body as Record<string, unknown>).content : "临时编辑正文内容占位符不少于十个字",
  })

  if (!validated.success || !validated.data) {
    apiError(400, validated.message ?? "参数错误")
  }

  const { title, content, replyUnlockContent, replyThreshold, purchaseUnlockContent, purchasePrice, commentsVisibleToAuthorOnly, minViewLevel, } = validated.data
  const rawAppendedContent = (input.body as Record<string, unknown> | null)?.appendedContent
  const appendedContent = typeof rawAppendedContent === "string"
    ? rawAppendedContent.trim()
    : ""
  const rawBody = input.body as Record<string, unknown>
  const manualTags = normalizeManualTags(Array.isArray(rawBody?.manualTags)
    ? rawBody.manualTags.filter((item): item is string => typeof item === "string")
    : [])
  const sanitizedManualTags = normalizeManualTags(manualTags)

  const settings = await getSiteSettings()

  const post = await prisma.post.findUnique({
    where: { id: input.postId },
    select: {
      id: true,
      slug: true,
      authorId: true,
      createdAt: true,
      lastAppendedAt: true,
      appendices: {
        select: {
          sortOrder: true,
        },
        orderBy: {
          sortOrder: "desc",
        },
        take: 1,
      },
    },
  })

  if (!post) {
    apiError(404, "帖子不存在")
  }

  const isAdmin = input.currentUser.role === "ADMIN" || input.currentUser.role === "MODERATOR"
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

    await prisma.$transaction(async (tx) => {
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
          title: titleSafety.sanitizedText,
          content: nextContent,
          summary: nextSummary,
          commentsVisibleToAuthorOnly,
          minViewLevel,
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

  await prisma.$transaction(async (tx) => {
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
        appendedContent: nextAppendedContent,
        lastAppendedAt: new Date(),
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
