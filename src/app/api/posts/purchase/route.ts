import { prisma } from "@/db/client"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { parsePostContentDocument } from "@/lib/post-content"
import { purchasePostBlock } from "@/lib/post-unlock"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const postId = requireStringField(body, "postId", "缺少必要参数")
  const blockId = requireStringField(body, "blockId", "缺少必要参数")

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      content: true,
      status: true,
    },
  })

  if (!post || post.status !== "NORMAL") {
    apiError(404, "帖子不存在或当前不可购买")
  }

  if (post.authorId === currentUser.id) {
    apiError(400, "作者无需购买自己的隐藏内容")
  }

  const targetBlock = parsePostContentDocument(post.content).blocks.find((block) => block.id === blockId && block.type === "PURCHASE_UNLOCK")
  if (!targetBlock || !targetBlock.price) {
    apiError(404, "未找到可购买的隐藏内容")
  }

  const result = await purchasePostBlock({
    userId: currentUser.id,
    postId,
    blockId,
    price: targetBlock.price,
    sellerId: post.authorId,
  })

  return apiSuccess({
    blockId,
    alreadyOwned: result.alreadyOwned,
  }, result.alreadyOwned ? "你已购买过该隐藏内容" : "购买成功，隐藏内容已解锁")
}, {
  errorMessage: "购买失败",
  logPrefix: "[api/posts/purchase] unexpected error",
  unauthorizedMessage: "请先登录后再购买",
  allowStatuses: ["ACTIVE", "MUTED"],
})
