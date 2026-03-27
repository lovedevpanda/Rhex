import { writeAdminLog } from "@/lib/admin"
import { apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { getLevelDefinitions, saveLevelDefinitions } from "@/lib/level-system"

export const GET = createAdminRouteHandler(async () => {
  const levels = await getLevelDefinitions()
  return apiSuccess(levels)
}, {
  errorMessage: "读取等级设置失败",
  logPrefix: "[api/admin/levels:GET] unexpected error",
  unauthorizedMessage: "无权访问",
})

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const levels = Array.isArray(body.levels) ? body.levels : []

  const saved = await saveLevelDefinitions(levels)
  await writeAdminLog(adminUser.id, "site.levels.update", "SITE", "level-system", `管理员更新了 ${saved.length} 个等级定义`)
  return apiSuccess(saved, "等级系统设置已保存")
}, {
  errorMessage: "保存等级设置失败",
  logPrefix: "[api/admin/levels:POST] unexpected error",
  unauthorizedMessage: "无权操作",
})
