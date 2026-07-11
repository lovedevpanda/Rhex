import { apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { withdrawBoardTreasury } from "@/lib/board-applications"
import { createPublicWriteDedupeKey, withPublicWriteGuard } from "@/lib/public-write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const boardId = typeof body.boardId === "string" ? body.boardId : ""

  return withPublicWriteGuard("board-applications-treasury-withdraw", {
    request,
    userId: currentUser.id,
    dedupeKey: createPublicWriteDedupeKey(boardId),
  }, async () => {
    const result = await withdrawBoardTreasury({
      boardId,
      currentUser,
    })

    return apiSuccess(result, `已提取 ${result.board.name} 节点金库 ${result.amount} ${result.pointName}`)
  })
}, {
  errorMessage: "提取节点金库失败",
  logPrefix: "[api/board-applications/treasury] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
