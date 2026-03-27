import { prisma } from "@/db/client"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const boardId = requireStringField(body, "boardId", "缺少节点参数")

  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { id: true } })
  if (!board) {
    apiError(404, "节点不存在")
  }

  const existing = await prisma.boardFollow.findUnique({
    where: {
      userId_boardId: {
        userId: currentUser.id,
        boardId,
      },
    },
  })

  if (existing) {
    await prisma.boardFollow.delete({ where: { id: existing.id } })
    return apiSuccess({ followed: false }, "已取消关注节点")
  }

  await prisma.boardFollow.create({
    data: {
      userId: currentUser.id,
      boardId,
    },
  })

  return apiSuccess({ followed: true }, "关注节点成功")
}, {
  errorMessage: "关注节点失败",
  logPrefix: "[api/boards/follow] unexpected error",
  unauthorizedMessage: "请先登录后再关注节点",
  allowStatuses: ["ACTIVE", "MUTED", "BANNED", "INACTIVE"],
})
