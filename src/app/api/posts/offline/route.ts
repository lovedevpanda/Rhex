import { revalidatePath } from "next/cache"

import { apiSuccess, createRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { revalidateHomeSidebarStatsCache } from "@/lib/home-sidebar-stats"
import { offlineOwnPost } from "@/lib/post-offline"
import { expireTaxonomyCacheImmediately } from "@/lib/taxonomy-cache"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"

export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const postId = requireStringField(body, "postId", "缺少帖子标识")
  const reason = String(body.reason ?? "").trim()

  const result = await offlineOwnPost({ postId, reason })

  revalidateHomeSidebarStatsCache()
  expireTaxonomyCacheImmediately()
  revalidateUserSurfaceCache(result.userId)
  revalidatePath(`/posts/${result.post.slug}`)
  revalidatePath("/")
  revalidatePath("/admin")

  return apiSuccess(
    result,
    result.price.amount > 0 ? `帖子已下线，扣除 ${result.price.amount} ${result.pointName}` : "帖子已下线",
  )
}, {
  errorMessage: "帖子下线失败",
  logPrefix: "[api/posts/offline] unexpected error",
})

