import { prisma } from "@/db/client"
import { apiError, readOptionalStringField, type JsonObject } from "@/lib/api-route"
import { enforceSensitiveText } from "@/lib/content-safety"
import { buildPostContentDocument, serializePostContentDocument } from "@/lib/post-content"
import { syncPostTaxonomy } from "@/lib/post-editor"
import { parseNonNegativeSafeInteger, parsePositiveSafeInteger } from "@/lib/shared/safe-integer"

const APPEND_INTERVAL_MS = 60 * 60 * 1000

export async function updatePostFlow(input: {
  body: JsonObject
  currentUser: {
    id: number
    role: string
  }
}) {
  const postId = readOptionalStringField(input.body, "postId")
  const title = readOptionalStringField(input.body, "title")
  const content = readOptionalStringField(input.body, "content")
  const commentsVisibleToAuthorOnly = Boolean(input.body.commentsVisibleToAuthorOnly)
  const replyUnlockContent = readOptionalStringField(input.body, "replyUnlockContent")
  const replyThreshold = parsePositiveSafeInteger(input.body.replyThreshold) ?? 1
  const purchaseUnlockContent = readOptionalStringField(input.body, "purchaseUnlockContent")
  const purchasePrice = parsePositiveSafeInteger(input.body.purchasePrice) ?? 0
  const minViewLevel = parseNonNegativeSafeInteger(input.body.minViewLevel) ?? 0
  const appendedContent = readOptionalStringField(input.body, "appendedContent")

  if (!postId) {
    apiError(400, "缺少帖子 ID")
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      slug: true,
      authorId: true,
      editableUntil: true,
      title: true,
      content: true,
      type: true,
      boardId: true,
      bountyPoints: true,
      lastAppendedAt: true,
      appendices: {
        orderBy: { sortOrder: "desc" },
        take: 1,
        select: { sortOrder: true },
      },
      pollOptions: {
        orderBy: { sortOrder: "asc" },
        select: { content: true },
      },
    },
  })

  if (!post) {
    apiError(404, "帖子不存在")
  }

  const isAdmin = input.currentUser.role === "ADMIN" || input.currentUser.role === "MODERATOR"
  if (!isAdmin && post.authorId !== input.currentUser.id) {
    apiError(403, "无权修改该帖子")
  }

  const canEditOriginal = Boolean(post.editableUntil && new Date(post.editableUntil).getTime() > Date.now()) || isAdmin
  const isAppendRequest = Boolean(appendedContent)
  const isOriginalEditRequest = Boolean(title || content || replyUnlockContent || purchaseUnlockContent)

  if (isOriginalEditRequest && !canEditOriginal) {
    apiError(400, "该帖子已超过 10 分钟编辑窗口，请使用附言追加功能")
  }

  if (isAppendRequest && canEditOriginal) {
    apiError(400, "帖子仍在编辑窗口内，请使用编辑功能修改原文")
  }

  if (!isAppendRequest && canEditOriginal) {
    if (!title || !content) {
      apiError(400, "标题和正文不能为空")
    }

    const titleSafety = await enforceSensitiveText({ scene: "post.title", text: title })
    const contentSafety = await enforceSensitiveText({ scene: "post.content", text: content })
    const replyUnlockSafety = replyUnlockContent ? await enforceSensitiveText({ scene: "post.content", text: replyUnlockContent }) : null
    const purchaseUnlockSafety = purchaseUnlockContent ? await enforceSensitiveText({ scene: "post.content", text: purchaseUnlockContent }) : null

    const serializedContent = serializePostContentDocument(buildPostContentDocument({
      publicContent: contentSafety.sanitizedText,
      replyUnlockContent: replyUnlockSafety?.sanitizedText ?? "",
      replyThreshold: replyUnlockContent ? replyThreshold : undefined,
      purchaseUnlockContent: purchaseUnlockSafety?.sanitizedText ?? "",
      purchasePrice: purchaseUnlockContent ? purchasePrice : undefined,
    }))

    await prisma.post.update({
      where: { id: postId },
      data: {
        title: titleSafety.sanitizedText,
        content: serializedContent,
        commentsVisibleToAuthorOnly,
        minViewLevel,
        reviewNote: titleSafety.shouldReview || contentSafety.shouldReview ? "编辑内容命中敏感词规则，请复核" : undefined,
      },
    })

    await syncPostTaxonomy(postId, titleSafety.sanitizedText, serializedContent)

    return {
      post,
      mode: "edit" as const,
      shouldReview: titleSafety.shouldReview || contentSafety.shouldReview,
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

  await prisma.post.update({
    where: { id: postId },
    data: {
      appendedContent: appendSafety.sanitizedText,
      lastAppendedAt: new Date(),
      reviewNote: appendSafety.shouldReview ? "追加内容命中敏感词审核规则，请复核" : undefined,
      appendices: {
        create: {
          content: appendSafety.sanitizedText,
          sortOrder: nextSortOrder,
        },
      },
    },
  })

  return {
    post,
    mode: "append" as const,
    shouldReview: appendSafety.shouldReview,
  }
}
