import { apiSuccess, createAdminRouteHandler, readJsonBody, readOptionalStringField } from "@/lib/api-route"
import { createInviteCodes, getInviteCodeList } from "@/lib/invite-codes"

export const GET = createAdminRouteHandler(async () => {
  const inviteCodes = await getInviteCodeList()
  return apiSuccess(inviteCodes)
}, {
  errorMessage: "读取邀请码失败",
  logPrefix: "[api/admin/invite-codes:GET] unexpected error",
  unauthorizedMessage: "无权访问",
})

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const count = Math.max(1, Math.min(100, Number(body.count ?? 1) || 1))
  const note = readOptionalStringField(body, "note")

  const rows = await createInviteCodes({
    count,
    createdById: adminUser.id,
    note,
  })

  return apiSuccess(rows, `已生成 ${rows.length} 个邀请码`)
}, {
  errorMessage: "生成邀请码失败",
  logPrefix: "[api/admin/invite-codes:POST] unexpected error",
  unauthorizedMessage: "无权操作",
})
