import { revalidatePath } from "next/cache"

import { apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { offlineCommentByPolicy } from "@/lib/comment-offline"
import { revalidateContentListCaches } from "@/lib/content-list-cache"
import { revalidateHomeSidebarStatsCache } from "@/lib/home-sidebar-stats"
import { revalidatePostDetailCache } from "@/lib/post-detail-cache"
import { createPublicWriteDedupeKey, withPublicWriteGuard } from "@/lib/public-write-guard"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const commentId = requireStringField(body, "commentId", "缺少评论标识")
  const reason = String(body.reason ?? "").trim()

  return withPublicWriteGuard("comments-offline", {
    request,
    userId: currentUser.id,
    dedupeKey: createPublicWriteDedupeKey(commentId, reason),
  }, async () => {
    const result = await offlineCommentByPolicy({
      commentId,
      reason,
      actorId: currentUser.id,
    })

    revalidateContentListCaches()
    revalidateHomeSidebarStatsCache()
    revalidatePostDetailCache({ postId: result.comment.postId, slug: result.postSlug })
    revalidateUserSurfaceCache(result.comment.userId)
    revalidateUserSurfaceCache(currentUser.id)
    revalidatePath(`/posts/${result.postSlug}`)
    revalidatePath(`/boards/${result.boardSlug}`)
    revalidatePath("/notifications")
    revalidatePath("/admin")

    return apiSuccess({
      commentId: result.comment.id,
      status: result.comment.status,
      reviewNote: result.comment.reviewNote,
    }, result.actorIsCommentAuthor ? "评论已下线" : "用户评论已下线")
  })
}, {
  errorMessage: "评论下线失败",
  logPrefix: "[api/comments/offline] unexpected error",
})
