import { apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { revalidatePostDataCache, revalidatePostViewerCache } from "@/lib/post-detail-cache"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { purchasePostBlock } from "@/lib/post-unlock"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const postId = requireStringField(body, "postId", "缺少必要参数")
  const blockId = requireStringField(body, "blockId", "缺少必要参数")

  return withRequestWriteGuard(createRequestWriteGuardOptions("posts-purchase", {
    request,
    userId: currentUser.id,
    input: {
      postId,
      blockId,
    },
  }), async () => {
    const result = await purchasePostBlock({
      userId: currentUser.id,
      postId,
      blockId,
    })

    revalidatePostDataCache({ postId })
    revalidatePostViewerCache(currentUser.id)

    if (!result.alreadyOwned) {
      revalidateUserSurfaceCache(currentUser.id)
      revalidateUserSurfaceCache(result.sellerId)
    }

    return apiSuccess({
      blockId,
      alreadyOwned: result.alreadyOwned,
    }, result.alreadyOwned ? "你已购买过该隐藏内容" : "购买成功，隐藏内容已解锁")
  })
}, {
  errorMessage: "购买失败",
  logPrefix: "[api/posts/purchase] unexpected error",
  unauthorizedMessage: "请先登录后再购买",
  allowStatuses: ["ACTIVE", "MUTED"],
})
