import { TargetType } from "@/db/types"

import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, readOptionalStringField, requireStringField } from "@/lib/api-route"
import { createReport } from "@/lib/reports"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const targetType = requireStringField(body, "targetType", "请填写完整的举报信息").toUpperCase()
  const targetId = requireStringField(body, "targetId", "请填写完整的举报信息")
  const reasonType = requireStringField(body, "reasonType", "请填写完整的举报信息")
  const reasonDetail = readOptionalStringField(body, "reasonDetail")

  if (targetType !== TargetType.POST && targetType !== TargetType.COMMENT && targetType !== TargetType.USER) {
    apiError(400, "不支持的举报类型")
  }

  await createReport({
    reporterId: currentUser.id,
    targetType,
    targetId,
    reasonType,
    reasonDetail: reasonDetail || null,
  })

  return apiSuccess(undefined, "举报已提交，管理员会尽快处理")
}, {
  errorMessage: "举报提交失败",
  logPrefix: "[api/reports/create] unexpected error",
  unauthorizedMessage: "请先登录后再举报",
  allowStatuses: ["ACTIVE", "MUTED", "BANNED", "INACTIVE"],
})
