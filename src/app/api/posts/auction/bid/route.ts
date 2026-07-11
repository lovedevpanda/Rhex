import { revalidatePath } from "next/cache"

import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requireNumberField, requireStringField } from "@/lib/api-route"
import { getPostAuctionSummary, placePostAuctionBid } from "@/lib/post-auctions"
import { revalidatePostDataCache, revalidatePostViewerCache } from "@/lib/post-detail-cache"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const postId = requireStringField(body, "postId", "缺少帖子参数")
  const amount = requireNumberField(body, "amount", "缺少出价金额")

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    apiError(400, "出价金额必须为正整数")
  }

  return withRequestWriteGuard(createRequestWriteGuardOptions("posts-auction-bid", {
    request,
    userId: currentUser.id,
    input: {
      postId,
      amount,
    },
  }), async () => {
    const result = await placePostAuctionBid({
      postId,
      userId: currentUser.id,
      amount,
    })

    for (const userId of result.changedUserIds) {
      revalidatePostViewerCache(userId)
      revalidateUserSurfaceCache(userId)
    }

    revalidatePostDataCache({ postId, slug: result.postSlug })
    revalidatePath(`/posts/${result.postSlug}`)
    revalidatePath("/")

    const summary = await getPostAuctionSummary(postId, currentUser.id)

    return apiSuccess(summary, "出价成功")
  })
}, {
  errorMessage: "出价失败",
  logPrefix: "[api/posts/auction/bid] unexpected error",
  unauthorizedMessage: "请先登录后再出价",
  allowStatuses: ["ACTIVE"],
})
