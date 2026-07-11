import { prisma } from "@/db/client"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { canAdminActorManageBoardWithPermission } from "@/lib/admin-scope-permissions"
import { resolveAdminActorFromSessionUser } from "@/lib/moderator-permissions"
import { revalidatePostCommentCache } from "@/lib/post-detail-cache"

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
      boardId: true,
      board: {
        select: {
          zoneId: true,
        },
      },
    },
  })

  if (!post) {
    apiError(404, "帖子不存在")
  }

  const adminActor = await resolveAdminActorFromSessionUser(currentUser)
  const canManageComments = Boolean(
    adminActor
    && await canAdminActorManageBoardWithPermission(
      adminActor,
      "admin.comments.manage",
      post.boardId,
      post.board.zoneId,
    ),
  )
  const isOwner = currentUser.id === post.authorId

  if (!isOwner && !canManageComments) {
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
      const pinned = await tx.comment.updateMany({
        where: {
          id: commentId,
          postId,
          parentId: null,
          status: "NORMAL",
        },
        data: {
          isPinnedByAuthor: true,
        },
      })

      if (pinned.count !== 1) {
        apiError(409, "评论状态已变更，请刷新后重试")
      }

      await tx.comment.updateMany({
        where: {
          postId,
          parentId: null,
          isPinnedByAuthor: true,
          id: { not: commentId },
        },
        data: {
          isPinnedByAuthor: false,
        },
      })
      return
    }

    const unpinned = await tx.comment.updateMany({
      where: {
        id: commentId,
        postId,
        parentId: null,
        status: "NORMAL",
      },
      data: { isPinnedByAuthor: false },
    })

    if (unpinned.count !== 1) {
      apiError(409, "评论状态已变更，请刷新后重试")
    }
  })

  revalidatePostCommentCache({ postId })

  return apiSuccess(undefined, action === "pin" ? "评论已置顶" : "已取消评论置顶")
}, {
  errorMessage: "评论置顶操作失败",
  logPrefix: "[api/posts/pin-comment] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})

