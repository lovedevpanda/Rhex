import { togglePostFavorite } from "@/db/interaction-queries"
import {  apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { handlePostFavoriteSideEffects } from "@/lib/interaction-side-effects"
import { logRequestSucceeded } from "@/lib/request-log"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const postId = requireStringField(body, "postId", "缺少帖子参数")

  const result = await togglePostFavorite({
    userId: currentUser.id,
    postId,
  })

  await handlePostFavoriteSideEffects({
    favored: result.favored,
    postId,
    userId: currentUser.id,
  })

  logRequestSucceeded({
    scope: "posts-favorite",
    action: "toggle-post-favorite",
    userId: currentUser.id,
    targetId: postId,
  }, {
    favored: result.favored,
  })

  return apiSuccess({ favored: result.favored }, result.favored ? "收藏成功" : "已取消收藏")
}, {
  errorMessage: "帖子收藏失败",
  logPrefix: "[api/posts/favorite] unexpected error",
  unauthorizedMessage: "请先登录后再收藏",
  allowStatuses: ["ACTIVE", "MUTED"],
})

