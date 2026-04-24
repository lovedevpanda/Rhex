import { apiSuccess, createUserRouteHandler, readJsonBody, readOptionalStringField, requireStringField } from "@/lib/api-route"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { submitVerificationApplication } from "@/lib/verifications"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const verificationTypeId = requireStringField(body, "verificationTypeId", "请选择认证类型")
  const content = readOptionalStringField(body, "content")
  const customIconText = readOptionalStringField(body, "customIconText")
  const customDescription = readOptionalStringField(body, "customDescription")
  const formResponse = body.formResponse && typeof body.formResponse === "object"
    ? Object.fromEntries(Object.entries(body.formResponse as Record<string, unknown>).map(([key, value]) => [key, String(value ?? "")]))
    : undefined

  const application = await submitVerificationApplication({
    userId: currentUser.id,
    verificationTypeId,
    content,
    customIconText,
    customDescription,
    formResponse,
  })

  logRouteWriteSuccess({
    scope: "verifications-apply",
    action: "submit-verification-application",
  }, {
    userId: currentUser.id,
    targetId: application.id,
    extra: {
      verificationTypeId,
      status: application.status,
      contentAdjusted: application.contentAdjusted,
    },
  })

  return apiSuccess({
    id: application.id,
    status: application.status,
  }, application.contentAdjusted ? "认证申请已提交，部分内容已自动替换，请等待后台审核" : "认证申请已提交，请等待后台审核")
}, {
  errorMessage: "提交失败",
  logPrefix: "[api/verifications/apply] unexpected error",
  unauthorizedMessage: "请先登录后再申请认证",
  allowStatuses: ["ACTIVE", "MUTED"],
})
