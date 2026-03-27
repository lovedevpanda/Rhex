import { apiError, apiSuccess, createAdminRouteHandler } from "@/lib/api-route"
import { parseBusinessDateTime } from "@/lib/formatters"
import { createRedeemCodes, getRedeemCodeList } from "@/lib/redeem-codes"

export const GET = createAdminRouteHandler(async () => {
  const redeemCodes = await getRedeemCodeList()
  return apiSuccess(redeemCodes)
}, {
  errorMessage: "读取兑换码失败",
  logPrefix: "[api/admin/redeem-codes:GET] unexpected error",
  unauthorizedMessage: "无权访问",
})

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await request.json()
  const count = Math.max(1, Math.min(100, Number(body.count ?? 1) || 1))
  const points = Math.max(1, Number(body.points ?? 0) || 0)
  const note = typeof body.note === "string" ? body.note.trim() : ""
  const expiresAtInput = typeof body.expiresAt === "string" ? body.expiresAt.trim() : ""
  const expiresAt = expiresAtInput ? parseBusinessDateTime(expiresAtInput) : null


  if (Number.isNaN(expiresAt?.getTime())) {
    apiError(400, "过期时间格式不正确")
  }

  const rows = await createRedeemCodes({
    count,
    points,
    createdById: adminUser.id,
    note,
    expiresAt,
  })

  return apiSuccess(rows, `已生成 ${rows.length} 个兑换码`)
}, {
  errorMessage: "兑换码生成失败",
  logPrefix: "[api/admin/redeem-codes:POST] unexpected error",
  unauthorizedMessage: "无权操作",
})
