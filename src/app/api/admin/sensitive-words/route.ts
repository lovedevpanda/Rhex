import { prisma } from "@/db/client"
import { writeAdminLog } from "@/lib/admin"
import { apiError, apiSuccess, createAdminRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { invalidateSensitiveWordRulesCache, normalizeSensitiveActionType, normalizeSensitiveMatchType } from "@/lib/content-safety"
import { getRequestIp } from "@/lib/request-ip"

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const requestIp = getRequestIp(request)
  const body = await readJsonBody(request)
  const matchType = normalizeSensitiveMatchType(String(body.matchType ?? "CONTAINS").trim().toUpperCase())
  const actionType = normalizeSensitiveActionType(String(body.actionType ?? "REJECT").trim().toUpperCase())
  const rawWords = Array.isArray(body.words)
    ? body.words
        .filter((item): item is string => typeof item === "string")
        .join("\n")
    : requireStringField(body, "word", "敏感词不能为空")
  const uniqueWords = [...new Set(rawWords
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean))]

  if (uniqueWords.length === 0) {
    apiError(400, "敏感词不能为空")
  }

  const existingWords = await prisma.sensitiveWord.findMany({
    where: {
      word: {
        in: uniqueWords,
      },
    },
    select: {
      word: true,
    },
  })
  const existingWordSet = new Set(existingWords.map((item) => item.word))
  const nextWords = uniqueWords.filter((item) => !existingWordSet.has(item))

  let createdCount = 0
  if (nextWords.length > 0) {
    const created = await prisma.sensitiveWord.createMany({
      data: nextWords.map((word) => ({
        word,
        matchType,
        actionType,
        status: true,
      })),
      skipDuplicates: true,
    })
    createdCount = created.count
  }

  const skippedCount = uniqueWords.length - createdCount
  invalidateSensitiveWordRulesCache()
  await writeAdminLog(adminUser.id, "sensitiveWord.create", "CONFIG", uniqueWords.length === 1 ? uniqueWords[0] : "batch", `创建敏感词规则 ${createdCount} 条`, requestIp)

  if (uniqueWords.length === 1) {
    return apiSuccess(undefined, skippedCount > 0 ? "该敏感词规则已存在，已跳过" : "敏感词规则已创建")
  }

  return apiSuccess(undefined, skippedCount > 0 ? `已新增 ${createdCount} 条规则，跳过 ${skippedCount} 条重复项` : `已新增 ${createdCount} 条规则`)
}, {
  errorMessage: "创建敏感词规则失败",
  logPrefix: "[api/admin/sensitive-words:POST] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
})

export const PUT = createAdminRouteHandler(async ({ request, adminUser }) => {
  const requestIp = getRequestIp(request)
  const body = await readJsonBody(request)
  const ids = Array.isArray(body.ids) ? body.ids : [requireStringField(body, "id", "缺少规则ID")]

  if (ids.length === 0) {
    apiError(400, "未选择任何规则")
  }

  const updateData: any = {}
  if (body.status !== undefined) updateData.status = Boolean(body.status)
  if (body.actionType !== undefined) updateData.actionType = normalizeSensitiveActionType(String(body.actionType).toUpperCase())
  if (body.replacement !== undefined) updateData.replacement = String(body.replacement)

  await prisma.sensitiveWord.updateMany({
    where: { id: { in: ids } },
    data: updateData,
  })

  invalidateSensitiveWordRulesCache()
  await writeAdminLog(
    adminUser.id,
    "sensitiveWord.update",
    "CONFIG",
    ids.length === 1 ? ids[0] : "batch",
    `批量更新 ${ids.length} 条敏感词规则`,
    requestIp
  )

  return apiSuccess(undefined, "规则已更新")
}, {
  errorMessage: "更新敏感词规则失败",
  logPrefix: "[api/admin/sensitive-words:PUT] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
})

export const DELETE = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const ids = Array.isArray(body.ids) ? body.ids : [requireStringField(body, "id", "缺少规则ID")]

  if (ids.length === 0) {
    apiError(400, "未选择任何规则")
  }

  await prisma.sensitiveWord.deleteMany({
    where: { id: { in: ids } },
  })

  invalidateSensitiveWordRulesCache()
  await writeAdminLog(
    adminUser.id,
    "sensitiveWord.delete",
    "CONFIG",
    ids.length === 1 ? ids[0] : "batch",
    `批量删除 ${ids.length} 条敏感词规则`
  )
  return apiSuccess(undefined, "规则已删除")
}, {
  errorMessage: "删除敏感词规则失败",
  logPrefix: "[api/admin/sensitive-words:DELETE] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
})
