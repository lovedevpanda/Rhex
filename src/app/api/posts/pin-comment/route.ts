import { prisma } from "@/db/client"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const postId = requireStringField(body, "postId", "缺少必要参数")
  const commentId = requireStringField(body, "commentId", "缺少必要参数")
  const action = body.action === "unpin" ? "unpin" : "pin"

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
    },
  })

  if (!post) {
    apiError(404, "帖子不存在")
  }

  const isAdmin = currentUser.role === "ADMIN"
  const isOwner = currentUser.id === post.authorId

  if (!isOwner && !isAdmin) {
    apiError(403, "无权操作评论置顶")
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      postId: true,
      parentId: true,
      status: true,
      isPinnedByAuthor: true,
    },
  })

  if (!comment || comment.postId !== postId || comment.status !== "NORMAL") {
    apiError(404, "评论不存在或不可操作")
  }

  if (comment.parentId) {
    apiError(400, "仅支持置顶一级评论")
  }

  await prisma.$transaction(async (tx) => {
    if (action === "pin") {
      await tx.comment.updateMany({
        where: {
          postId,
          parentId: null,
          isPinnedByAuthor: true,
        },
        data: {
          isPinnedByAuthor: false,
        },
      })

      await tx.comment.update({
        where: { id: commentId },
        data: { isPinnedByAuthor: true },
      })
      return
    }

    await tx.comment.update({
      where: { id: commentId },
      data: { isPinnedByAuthor: false },
    })
  })

  return apiSuccess(undefined, action === "pin" ? "评论已置顶" : "已取消评论置顶")
}, {
  errorMessage: "评论置顶操作失败",
  logPrefix: "[api/posts/pin-comment] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})

