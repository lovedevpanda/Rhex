import { apiError, apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import {
  addPostToFavoriteCollection,
  createFavoriteCollection,
  deleteFavoriteCollection,
  getFavoriteCollectionModalData,
  getUserFavoriteCollectionManageData,
  removePostFromFavoriteCollection,
  reviewFavoriteCollectionSubmission,
  updateFavoriteCollection,
} from "@/lib/favorite-collections"
import { revalidatePostDataCache, revalidatePostSidebarCache, revalidatePostViewerCache } from "@/lib/post-detail-cache"
import { withRequestWriteGuard } from "@/lib/write-guard"

function revalidateFavoriteCollectionPostCaches(input: {
  userId: number
  postId?: string | null
  favoriteCreated?: boolean
  affectedPostIds?: string[]
}) {
  const affectedPostIds = new Set(input.affectedPostIds ?? [])

  for (const postId of affectedPostIds) {
    revalidatePostSidebarCache({ postId })
  }

  if (input.favoriteCreated && input.postId) {
    revalidatePostDataCache({ postId: input.postId })
  }

  if (affectedPostIds.size > 0 || input.favoriteCreated) {
    revalidatePostViewerCache(input.userId)
  }
}

export const GET = createUserRouteHandler<unknown>(async ({ request, currentUser }) => {
  const url = new URL(request.url)
  const view = url.searchParams.get("view")?.trim() ?? "modal"
  const pageValue = Number(url.searchParams.get("page") ?? "1")

  if (view === "owned") {
    const data = await getUserFavoriteCollectionManageData(currentUser.id, {
      page: Number.isFinite(pageValue) ? pageValue : 1,
    })
    return apiSuccess(data)
  }

  const postId = url.searchParams.get("postId")?.trim() ?? ""
  const data = await getFavoriteCollectionModalData({
    userId: currentUser.id,
    postId,
    page: Number.isFinite(pageValue) ? pageValue : 1,
    q: url.searchParams.get("q"),
  })
  return apiSuccess(data)
}, {
  errorMessage: "合集数据加载失败",
  logPrefix: "[api/favorite-collections:GET] unexpected error",
  unauthorizedMessage: "请先登录后再使用合集功能",
  allowStatuses: ["ACTIVE", "MUTED"],
})

export const POST = createUserRouteHandler<unknown>(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const action = typeof body.action === "string" ? body.action.trim() : ""

  return withRequestWriteGuard({
    request,
    userId: currentUser.id,
    scope: "favorite-collections",
    cooldownMs: 1_000,
    dedupeKey: JSON.stringify({
      action,
      collectionId: typeof body.collectionId === "string" ? body.collectionId.trim() : "",
      postId: typeof body.postId === "string" ? body.postId.trim() : "",
      submissionId: typeof body.submissionId === "string" ? body.submissionId.trim() : "",
      decision: body.decision,
    }),
    dedupeWindowMs: 5_000,
    releaseOnError: true,
  }, async () => {
  if (action === "create") {
    const created = await createFavoriteCollection({
      userId: currentUser.id,
      input: body.collection && typeof body.collection === "object" ? body.collection as Record<string, unknown> : {},
      postId: typeof body.postId === "string" ? body.postId.trim() : undefined,
    })
    revalidateFavoriteCollectionPostCaches({
      userId: currentUser.id,
      postId: created.postId,
      favoriteCreated: created.favoriteCreated,
      affectedPostIds: created.affectedPostIds,
    })
    return apiSuccess(created, body.postId
      ? (created.contentAdjusted ? "合集已创建，帖子已加入，部分内容已自动替换" : "合集已创建，帖子已加入")
      : (created.contentAdjusted ? "合集已创建，部分内容已自动替换" : "合集已创建"))
  }

  if (action === "add-post") {
    const result = await addPostToFavoriteCollection({
      userId: currentUser.id,
      postId: typeof body.postId === "string" ? body.postId.trim() : "",
      collectionId: typeof body.collectionId === "string" ? body.collectionId.trim() : "",
    })
    revalidateFavoriteCollectionPostCaches({
      userId: currentUser.id,
      postId: result.postId,
      favoriteCreated: result.favoriteCreated,
      affectedPostIds: result.affectedPostIds,
    })
    return apiSuccess(result, result.message)
  }

  if (action === "update") {
    const updated = await updateFavoriteCollection({
      userId: currentUser.id,
      collectionId: typeof body.collectionId === "string" ? body.collectionId.trim() : "",
      input: body.collection && typeof body.collection === "object" ? body.collection as Record<string, unknown> : {},
    })
    revalidateFavoriteCollectionPostCaches({
      userId: currentUser.id,
      affectedPostIds: updated.affectedPostIds,
    })
    return apiSuccess(updated, updated.contentAdjusted ? "合集已更新，部分内容已自动替换" : "合集已更新")
  }

  if (action === "delete") {
    const deleted = await deleteFavoriteCollection({
      userId: currentUser.id,
      collectionId: typeof body.collectionId === "string" ? body.collectionId.trim() : "",
    })
    revalidateFavoriteCollectionPostCaches({
      userId: currentUser.id,
      affectedPostIds: deleted.affectedPostIds,
    })
    return apiSuccess(deleted, "合集已删除")
  }

  if (action === "remove-post") {
    const result = await removePostFromFavoriteCollection({
      userId: currentUser.id,
      collectionId: typeof body.collectionId === "string" ? body.collectionId.trim() : "",
      postId: typeof body.postId === "string" ? body.postId.trim() : "",
    })
    revalidateFavoriteCollectionPostCaches({
      userId: currentUser.id,
      postId: result.postId,
      affectedPostIds: result.affectedPostIds,
    })
    return apiSuccess(result, "帖子已移出合集")
  }

  if (action === "review-submission") {
    const result = await reviewFavoriteCollectionSubmission({
      userId: currentUser.id,
      submissionId: typeof body.submissionId === "string" ? body.submissionId.trim() : "",
      decision: body.decision === "APPROVE" || body.decision === "REJECT"
        ? body.decision
        : apiError(400, "Unsupported submission review decision"),
      reviewNote: typeof body.reviewNote === "string" ? body.reviewNote : undefined,
    })
    revalidateFavoriteCollectionPostCaches({
      userId: currentUser.id,
      postId: result.postId,
      affectedPostIds: result.affectedPostIds,
    })
    return apiSuccess(result, result.status === "APPROVED" ? "投稿已通过" : "投稿已驳回")
  }

  apiError(400, "Unsupported collection action")
  })
}, {
  errorMessage: "合集操作失败",
  logPrefix: "[api/favorite-collections:POST] unexpected error",
  unauthorizedMessage: "请先登录后再使用合集功能",
  allowStatuses: ["ACTIVE", "MUTED"],
})
