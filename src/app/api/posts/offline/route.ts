import { apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { revalidateUpdatedPostMutation } from "@/lib/content-mutation-revalidation"
import { revalidateHomeSidebarStatsCache } from "@/lib/home-sidebar-stats"
import { offlineOwnPost } from "@/lib/post-offline"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const postId = requireStringField(body, "postId", "缺少帖子标识")
  const reason = String(body.reason ?? "").trim()

  const result = await offlineOwnPost({ postId, reason, actorId: currentUser.id })

  revalidateHomeSidebarStatsCache()
  revalidateUpdatedPostMutation({
    postId: result.post.id,
    postSlug: result.post.slug,
    boardSlug: result.post.board.slug,
    zoneSlug: result.post.board.zone?.slug,
    authorId: result.userId,
  })

  return apiSuccess(
    result,
    result.price.amount > 0 ? `帖子已下线，扣除 ${result.price.amount} ${result.pointName}` : "帖子已下线",
  )
}, {
  errorMessage: "帖子下线失败",
  logPrefix: "[api/posts/offline] unexpected error",
  unauthorizedMessage: "请先登录后再下线帖子",
  allowStatuses: ["ACTIVE", "MUTED"],
  forbiddenMessages: {
    BANNED: "账号已被拉黑，无法下线帖子",
  },
})

