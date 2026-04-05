import { apiError, apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
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
  const body = await readJsonBody(request)
  const count = Math.max(1, Math.min(100, Number(body.count ?? 1) || 1))
  const points = Math.max(1, Number(body.points ?? 0) || 0)
  const note = typeof body.note === "string" ? body.note.trim() : ""
  const codeCategory = typeof body.codeCategory === "string" ? body.codeCategory.trim() : ""
  const categoryUserLimitInput = body.categoryUserLimit
  const categoryUserLimit = categoryUserLimitInput === null || categoryUserLimitInput === undefined || categoryUserLimitInput === ""
    ? null
    : Math.trunc(Number(categoryUserLimitInput))
  const expiresAtInput = typeof body.expiresAt === "string" ? body.expiresAt.trim() : ""
  const expiresAt = expiresAtInput ? parseBusinessDateTime(expiresAtInput) : null

  if (categoryUserLimit !== null && (!Number.isFinite(categoryUserLimit) || categoryUserLimit < 1)) {
    apiError(400, "分类使用上限必须为正整数，或留空表示不限制")
  }

  if (Number.isNaN(expiresAt?.getTime())) {

    apiError(400, "过期时间格式不正确")
  }

  const rows = await createRedeemCodes({
    count,
    points,
    codeCategory,
    categoryUserLimit,
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
