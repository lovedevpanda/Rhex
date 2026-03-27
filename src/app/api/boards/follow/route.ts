import { prisma } from "@/db/client"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { withRequestWriteGuard } from "@/lib/write-guard"


export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const boardId = requireStringField(body, "boardId", "缺少节点参数")

  return withRequestWriteGuard({
    request,
    userId: currentUser.id,
    scope: "boards-follow-toggle",
    cooldownMs: 1_500,
    dedupeKey: `${currentUser.id}:${boardId}`,
  }, async () => {
    const board = await prisma.board.findUnique({ where: { id: boardId }, select: { id: true } })
    if (!board) {
      apiError(404, "节点不存在")
    }

    try {
      await prisma.boardFollow.delete({
        where: {
          userId_boardId: {
            userId: currentUser.id,
            boardId,
          },
        },
      })
      return apiSuccess({ followed: false }, "已取消关注节点")
    } catch (error) {
      const isNotFound = error instanceof Error && "code" in error && (error as { code?: string }).code === "P2025"
      if (!isNotFound) {
        throw error
      }
    }

    try {
      await prisma.boardFollow.create({
        data: {
          userId: currentUser.id,
          boardId,
        },
      })
    } catch (error) {
      const isConflict = error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002"
      if (!isConflict) {
        throw error
      }
    }

    return apiSuccess({ followed: true }, "关注节点成功")

  })
}, {

  errorMessage: "关注节点失败",
  logPrefix: "[api/boards/follow] unexpected error",
  unauthorizedMessage: "请先登录后再关注节点",
  allowStatuses: ["ACTIVE", "MUTED", "BANNED", "INACTIVE"],
})
