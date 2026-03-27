import { requireActiveCurrentUserRecord } from "@/db/current-user"
import { apiError, apiSuccess, createCustomRouteHandler, readJsonBody, requireNumberField, requireStringField } from "@/lib/api-route"
import { createGobangMatch, getGobangPlayerSummary, listGobangMatches, makeGobangMove } from "@/lib/gobang"


async function buildGobangContext(): Promise<Awaited<ReturnType<typeof requireActiveCurrentUserRecord>>> {
  try {
    return await requireActiveCurrentUserRecord()
  } catch (error) {
    const message = error instanceof Error ? error.message : "请先登录"
    const status = message === "当前登录用户不存在" ? 401 : 403
    apiError(status, status === 401 ? "请先登录" : message)
  }
}

export const GET = createCustomRouteHandler(async ({ context: user }) => {
  const [matches, summary] = await Promise.all([
    listGobangMatches(user.id),
    getGobangPlayerSummary(user),
  ])

  return apiSuccess({ matches, summary })
}, {
  buildContext: buildGobangContext,
  errorMessage: "加载对局失败",
  logPrefix: "[api/gobang:GET] unexpected error",
})

export const POST = createCustomRouteHandler<unknown, Awaited<ReturnType<typeof requireActiveCurrentUserRecord>>>(async ({ request, context: user }) => {
  const body = await readJsonBody(request)
  const action = requireStringField(body, "action", "不支持的操作")

  if (action === "create") {
    const result = await createGobangMatch(user)
    return apiSuccess(result, result.policy.mode === "FREE" ? "已开始免费挑战" : "已开始付费挑战")
  }

  if (action === "move") {
    const matchId = requireStringField(body, "matchId", "缺少对局参数")
    const x = requireNumberField(body, "x", "缺少落子坐标")
    const y = requireNumberField(body, "y", "缺少落子坐标")
    const data = await makeGobangMove({ matchId, user, x, y })
    return apiSuccess(data, data.winnerId === user.id ? "你赢了，奖励已到账" : data.winnerId === 0 ? "AI 获胜，再接再厉" : "落子成功")
  }

  apiError(400, "不支持的操作")
}, {
  buildContext: buildGobangContext,
  errorMessage: "五子棋操作失败",
  logPrefix: "[api/gobang:POST] unexpected error",
})
