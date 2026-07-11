import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requirePositiveIntegerField, requireStringField } from "@/lib/api-route"
import { acceptYinYangChallenge, createYinYangChallenge, getYinYangLobbyData } from "@/lib/yinyang-contract"
import type { YinYangOption } from "@/lib/yinyang-contract"
import { withRequestWriteGuard } from "@/lib/write-guard"

function requireYinYangOption(value: string, invalidMessage: string): YinYangOption {
  if (value === "A" || value === "B") {
    return value
  }

  apiError(400, invalidMessage)
}

export const GET = createUserRouteHandler(async ({ currentUser }) => {
  const data = await getYinYangLobbyData(currentUser)
  return apiSuccess(data)
}, {
  errorMessage: "阴阳契数据加载失败",
  logPrefix: "[api/yinyang-contract:GET] unexpected error",
  unauthorizedMessage: "请先登录后查看阴阳契",
})

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const action = requireStringField(body, "action", "不支持的操作")

  if (action === "create") {
    const question = requireStringField(body, "question", "请输入问题")
    const optionA = requireStringField(body, "optionA", "请输入答案A")
    const optionB = requireStringField(body, "optionB", "请输入答案B")
    const correctOption = requireStringField(body, "correctOption", "请选择正确答案")
    const stakePoints = requirePositiveIntegerField(body, "stakePoints", "请输入正确的积分彩头")
    const input = {
      question,
      optionA,
      optionB,
      correctOption: requireYinYangOption(correctOption, "正确答案不合法"),
      stakePoints,
    }
    return withRequestWriteGuard({
      request,
      userId: currentUser.id,
      scope: "yinyang-contract-create",
      cooldownMs: 1_000,
      cooldownMessage: "发起挑战过于频繁，请稍后再试",
      dedupeKey: JSON.stringify(input),
      dedupeWindowMs: 10_000,
      releaseOnError: true,
    }, async () => {
      const data = await createYinYangChallenge(currentUser, input)
      return apiSuccess(data, "挑战已创建")
    })
  }

  if (action === "accept") {
    const challengeId = requireStringField(body, "challengeId", "缺少挑战参数")
    const selectedOption = requireStringField(body, "selectedOption", "请选择答案")
    const input = {
      challengeId,
      selectedOption: requireYinYangOption(selectedOption, "答案不合法"),
    }
    return withRequestWriteGuard({
      request,
      userId: currentUser.id,
      scope: "yinyang-contract-accept",
      cooldownMs: 500,
      cooldownMessage: "应战过于频繁，请稍后再试",
      dedupeKey: `${input.challengeId}:${input.selectedOption}`,
      dedupeWindowMs: 5_000,
      releaseOnError: true,
    }, async () => {
      const data = await acceptYinYangChallenge(currentUser, input)
      return apiSuccess(data, "挑战已完成结算")
    })
  }

  apiError(400, "不支持的操作")

}, {
  errorMessage: "阴阳契操作失败",
  logPrefix: "[api/yinyang-contract:POST] unexpected error",
  unauthorizedMessage: "请先登录后参与阴阳契",
})
