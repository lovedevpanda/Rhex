import { NotificationType } from "@/db/types"
import { togglePostLike } from "@/db/interaction-queries"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { handlePostLikeSideEffects } from "@/lib/interaction-side-effects"
import { enqueueNotification } from "@/lib/notification-writes"
import { logRequestSucceeded } from "@/lib/request-log"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const postId = String(body.postId ?? "")

  if (!postId) {
    apiError(400, "缺少帖子参数")
  }

  const result = await togglePostLike({
    userId: currentUser.id,
    postId,
    senderName: currentUser.nickname ?? currentUser.username,
  })

  await handlePostLikeSideEffects({
    liked: result.liked,
    postId,
    userId: currentUser.id,
    targetUserId: result.targetUserId,
  })

  if (result.liked && result.notificationTargetUserId) {
    void enqueueNotification({
      userId: result.notificationTargetUserId,
      type: NotificationType.LIKE,
      senderId: currentUser.id,
      relatedType: "POST",
      relatedId: postId,
      title: "你的帖子收到了赞",
      content: `${currentUser.nickname ?? currentUser.username} 赞了你的帖子：${result.postTitle}`,
    })
  }

  logRequestSucceeded({
    scope: "posts-like",
    action: "toggle-post-like",
    userId: currentUser.id,
    targetId: postId,
  }, {
    liked: result.liked,
  })

  return apiSuccess({ liked: result.liked }, result.liked ? "点赞成功" : "已取消点赞")
}, {
  errorMessage: "帖子点赞失败",
  logPrefix: "[api/posts/like] unexpected error",
  unauthorizedMessage: "请先登录后再点赞",
  allowStatuses: ["ACTIVE", "MUTED"],
})
