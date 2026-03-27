import { NextResponse } from "next/server"

import { createAdminRouteHandler, readJsonBody } from "@/lib/api-route"

import {
  createVerificationType,
  deleteVerificationType,
  getVerificationAdminData,
  updateVerificationTypeOrReview,
} from "@/lib/admin-verification-service"

export const GET = createAdminRouteHandler(async () => {
  const data = await getVerificationAdminData()
  return NextResponse.json({
    code: 0,
    data,
  })
}, {
  errorMessage: "读取认证管理数据失败",
  logPrefix: "[api/admin/verifications:GET] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
})

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const data = await createVerificationType({
    body,
    admin: adminUser,
    request,
  })

  return NextResponse.json({ code: 0, message: "认证类型已创建", data })
}, {
  errorMessage: "创建认证类型失败",
  logPrefix: "[api/admin/verifications:POST] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
})

export const PUT = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const result = await updateVerificationTypeOrReview({
    body,
    admin: adminUser,
    request,
  })

  return NextResponse.json({
    code: 0,
    message: result.reviewed ? (result.status === "APPROVED" ? "认证申请已通过" : "认证申请已驳回") : "认证类型已更新",
  })
}, {
  errorMessage: "更新认证管理数据失败",
  logPrefix: "[api/admin/verifications:PUT] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
})

export const DELETE = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  await deleteVerificationType({
    body,
    admin: adminUser,
    request,
  })

  return NextResponse.json({ code: 0, message: "认证类型已删除" })
}, {
  errorMessage: "删除认证类型失败",
  logPrefix: "[api/admin/verifications:DELETE] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
})
