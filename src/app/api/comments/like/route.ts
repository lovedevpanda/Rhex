import { NotificationType } from "@/db/types"
import { toggleCommentLike } from "@/db/interaction-queries"
import {  apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { enqueueSyncUserReceivedLikes } from "@/lib/level-system"
import { enqueueNotification } from "@/lib/notification-writes"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const commentId = requireStringField(body, "commentId", "缺少评论参数")

  return withRequestWriteGuard(createRequestWriteGuardOptions("comments-like", {
    request,
    userId: currentUser.id,
    input: {
      commentId,
    },
  }), async () => {
    const result = await toggleCommentLike({
      userId: currentUser.id,
      commentId,
      senderName: currentUser.nickname ?? currentUser.username,
    })

    if (result.targetUserId) {
      void enqueueSyncUserReceivedLikes(result.targetUserId, { notifyOnUpgrade: true })
      revalidateUserSurfaceCache(result.targetUserId)
    }

    if (result.liked && result.notificationTargetUserId) {
      void enqueueNotification({
        userId: result.notificationTargetUserId,
        type: NotificationType.LIKE,
        senderId: currentUser.id,
        relatedType: "COMMENT",
        relatedId: commentId,
        title: "你的评论收到了赞",
        content: `${currentUser.nickname ?? currentUser.username} 赞了你的评论：${result.commentPreview}`,
      })
    }

    const requestUrl = new URL(request.url)
    await executeAddonActionHook("comment.like.after", {
      commentId,
      userId: currentUser.id,
      liked: result.liked,
    }, { request, pathname: requestUrl.pathname, searchParams: requestUrl.searchParams })

    return apiSuccess({ liked: result.liked }, result.liked ? "点赞成功" : "已取消点赞")
  })
}, {
  errorMessage: "评论点赞失败",
  logPrefix: "[api/comments/like] unexpected error",
  unauthorizedMessage: "请先登录后再点赞",
  allowStatuses: ["ACTIVE", "MUTED"],
})

