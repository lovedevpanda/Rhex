import { apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { withdrawBoardTreasury } from "@/lib/board-applications"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)

  const result = await withdrawBoardTreasury({
    boardId: typeof body.boardId === "string" ? body.boardId : "",
    currentUser,
  })

  return apiSuccess(result, `已提取 ${result.board.name} 节点金库 ${result.amount} ${result.pointName}`)
}, {
  errorMessage: "提取节点金库失败",
  logPrefix: "[api/board-applications/treasury] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
