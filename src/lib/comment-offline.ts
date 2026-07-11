import { CommentStatus } from "@/db/types"

import { findCommentOfflineTarget, runCommentOfflineTransaction, updateCommentOfflineTarget } from "@/db/comment-offline-queries"
import { apiError } from "@/lib/api-route"
import { canUserOfflineComment, resolveBoardSettings } from "@/lib/board-settings"
import { createSystemNotification } from "@/lib/notification-writes"
import { isPublicReadablePostStatus } from "@/lib/post-types"

export async function offlineCommentByPolicy(input: {
  commentId: string
  actorId: number
  reason?: string | null
}) {
  const reason = String(input.reason ?? "").trim()

  const result = await runCommentOfflineTransaction(async (tx) => {
    const comment = await findCommentOfflineTarget(input.commentId, tx)

    if (!comment) {
      apiError(404, "评论不存在")
    }

    if (comment.status !== CommentStatus.NORMAL) {
      apiError(400, "当前评论状态不支持下线")
    }

    if (!isPublicReadablePostStatus(comment.post.status)) {
      apiError(400, "当前帖子状态不支持下线评论")
    }

    const settings = resolveBoardSettings(comment.post.board.zone, comment.post.board)
    const permission = canUserOfflineComment(input.actorId, settings, {
      postAuthorId: comment.post.authorId,
      commentAuthorId: comment.userId,
    })

    if (!permission.allowed) {
      apiError(403, permission.message)
    }

    const actorIsCommentAuthor = input.actorId === comment.userId
    const reviewNote = [
      reason || null,
      actorIsCommentAuthor ? "用户自主下线评论" : "楼主下线评论",
    ].filter(Boolean).join("；")

    const updated = await updateCommentOfflineTarget(tx, {
      commentId: comment.id,
      actorId: input.actorId,
      reviewNote,
    })

    if (!updated) {
      apiError(409, "评论状态已变更，请刷新后重试")
    }

    return {
      actorIsCommentAuthor,
      comment: updated,
      postSlug: updated.post.slug,
      boardSlug: updated.post.board.slug,
      postTitle: updated.post.title,
    }
  })

  if (!result.actorIsCommentAuthor) {
    await createSystemNotification({
      userId: result.comment.userId,
      senderId: input.actorId,
      relatedType: "COMMENT",
      relatedId: result.comment.id,
      title: "评论已被楼主下线",
      content: `你在《${result.postTitle}》下的评论已被楼主下线。${reason ? ` 处理说明：${reason}` : ""}`,
    }).catch((error) => {
      console.warn("[comment-offline] failed to notify comment author", error)
    })
  }

  return result
}
