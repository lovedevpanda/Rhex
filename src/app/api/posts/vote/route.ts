import { prisma } from "@/db/client"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { revalidatePostDataCache, revalidatePostViewerCache } from "@/lib/post-detail-cache"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const postId = requireStringField(body, "postId", "缺少必要参数")
  const optionId = requireStringField(body, "optionId", "缺少必要参数")


  await prisma.$transaction(async (tx) => {
    const post = await tx.post.findUnique({
      where: { id: postId },
      select: { id: true, type: true, status: true },
    })

    if (!post || post.status !== "NORMAL") {
      apiError(400, "帖子不存在或尚未通过审核")
    }

    if (post.type !== "POLL") {
      apiError(400, "当前帖子不是投票帖")
    }

    const option = await tx.pollOption.findFirst({
      where: { id: optionId, postId },
      select: { id: true },
    })

    if (!option) {
      apiError(400, "投票选项不存在")
    }

    // The unique (postId, userId) constraint is the concurrency authority.
    // A prior read can race with another request, so increment only when this
    // request actually inserts the vote.
    const createdVote = await tx.pollVote.createMany({
      data: {
        postId,
        optionId,
        userId: currentUser.id,
      },
      skipDuplicates: true,
    })

    if (createdVote.count === 0) {
      apiError(400, "你已经投过票了")
    }

    await tx.pollOption.update({
      where: { id: optionId },
      data: {
        voteCount: {
          increment: 1,
        },
      },
    })
  })

  revalidatePostDataCache({ postId })
  revalidatePostViewerCache(currentUser.id)

  return apiSuccess(undefined, "投票成功")
}, {
  errorMessage: "投票失败",
  logPrefix: "[api/posts/vote] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
