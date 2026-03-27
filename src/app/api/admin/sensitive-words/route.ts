import { prisma } from "@/db/client"
import { writeAdminLog } from "@/lib/admin"
import { apiSuccess, createAdminRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const word = requireStringField(body, "word", "敏感词不能为空")
  const matchType = String(body.matchType ?? "CONTAINS").trim().toUpperCase()
  const actionType = String(body.actionType ?? "REJECT").trim().toUpperCase()

  const created = await prisma.sensitiveWord.create({
    data: { word, matchType, actionType, status: true },
  })
  await writeAdminLog(adminUser.id, "sensitiveWord.create", "CONFIG", created.id, `创建敏感词规则 ${word}`)
  return apiSuccess(undefined, "敏感词规则已创建")
}, {
  errorMessage: "创建敏感词规则失败",
  logPrefix: "[api/admin/sensitive-words:POST] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
})

export const PUT = createAdminRouteHandler(async ({ request, adminUser }) => {
  const requestIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip")?.trim() ?? null
  const body = await readJsonBody(request)
  const id = requireStringField(body, "id", "缺少规则ID")

  await prisma.sensitiveWord.update({
    where: { id },
    data: { status: Boolean(body.status) },
  })
  await writeAdminLog(adminUser.id, "sensitiveWord.toggle", "CONFIG", id, `切换敏感词规则状态为 ${Boolean(body.status) ? "启用" : "停用"}`, requestIp)

  return apiSuccess(undefined, "规则状态已更新")
}, {
  errorMessage: "更新敏感词规则失败",
  logPrefix: "[api/admin/sensitive-words:PUT] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
})

export const DELETE = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const id = requireStringField(body, "id", "缺少规则ID")

  await prisma.sensitiveWord.delete({ where: { id } })
  await writeAdminLog(adminUser.id, "sensitiveWord.delete", "CONFIG", id, "删除敏感词规则")
  return apiSuccess(undefined, "规则已删除")
}, {
  errorMessage: "删除敏感词规则失败",
  logPrefix: "[api/admin/sensitive-words:DELETE] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
})
