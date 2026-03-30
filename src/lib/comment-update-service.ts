import { createCommentMentionNotifications, updateCommentContentById, findEditableCommentById } from "@/db/comment-queries"

import { apiError } from "@/lib/api-route"
import { enforceSensitiveText } from "@/lib/content-safety"
import { extractMentionTexts, findMentionUsers, resolveMentionsInText } from "@/lib/comment-mentions"
import { getSiteSettings } from "@/lib/site-settings"
import { validateCommentPayload } from "@/lib/validators"

export async function updateCommentFlow(input: {
  body: unknown
  currentUser: {
    id: number
    role?: string | null
    username?: string | null
    nickname?: string | null
  }
}) {
  const validated = validateCommentPayload(input.body)

  if (!validated.success || !validated.data) {
    apiError(400, validated.message ?? "参数错误")
  }

  const { postId, content } = validated.data
  const rawBody = input.body as Record<string, unknown> | null
  const rawCommentId = rawBody?.commentId
  const commentId = typeof rawCommentId === "string" ? rawCommentId.trim() : ""

  if (!commentId) {
    apiError(400, "缺少评论 ID")
  }

  const [comment, settings] = await Promise.all([
    findEditableCommentById(commentId),
    getSiteSettings(),
  ])

  if (!comment || comment.postId !== postId || comment.status !== "NORMAL") {
    apiError(404, "评论不存在或不可编辑")
  }

  const isAdmin = input.currentUser.role === "ADMIN" || input.currentUser.role === "MODERATOR"
  const isOwner = comment.userId === input.currentUser.id

  if (!isAdmin && !isOwner) {
    apiError(403, "没有权限编辑该评论")
  }

  if (!isAdmin) {
    const editWindowMinutes = Math.max(0, settings.commentEditableMinutes)
    const expiresAt = new Date(comment.createdAt).getTime() + editWindowMinutes * 60 * 1000
    if (Date.now() > expiresAt) {
      apiError(403, `该评论已超过 ${editWindowMinutes} 分钟编辑窗口`)
    }
  }

  const contentSafety = await enforceSensitiveText({ scene: "comment.content", text: content })
  const mentionTexts = extractMentionTexts(contentSafety.sanitizedText)
  const mentionUsers = await findMentionUsers(mentionTexts)
  const resolvedComment = resolveMentionsInText(contentSafety.sanitizedText, mentionUsers)

  const updated = await updateCommentContentById(commentId, {
    content: resolvedComment.content,
    reviewNote: contentSafety.shouldReview ? "评论编辑内容命中敏感词规则，请复核" : null,
  })

  if (!contentSafety.shouldReview) {
    await createCommentMentionNotifications({
      commentId: updated.id,
      senderId: input.currentUser.id,
      senderName: input.currentUser.nickname || input.currentUser.username || "用户",
      content: resolvedComment.content,
      mentionUserIds: resolvedComment.mentions.map((item) => item.id),
      excludeUserIds: [updated.replyToUserId ?? 0],
    })
  }

  return {
    updated,
    contentSafety,
  }
}
