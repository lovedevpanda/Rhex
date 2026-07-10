import { apiError, apiSuccess, createAdminRouteHandler, readJsonBody, readOptionalStringField, requireStringField, type JsonObject } from "@/lib/api-route"
import { getRequestIp } from "@/lib/admin"
import { executeAdminAction } from "@/lib/admin-action-management"
import { isPublicRouteError } from "@/lib/public-route-error"

const BATCH_POST_ACTIONS = new Set([
  "post.hide",
  "post.show",
  "post.lock",
  "post.unlock",
  "post.delete",
  "post.moveBoard",
])

function readPostIds(body: JsonObject) {
  const rawIds = body.postIds
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    apiError(400, "\u8bf7\u9009\u62e9\u8981\u5904\u7406\u7684\u5e16\u5b50")
  }

  if (rawIds.length > 100) {
    apiError(400, "\u5355\u6b21\u6700\u591a\u6279\u91cf\u5904\u7406 100 \u7bc7\u5e16\u5b50")
  }

  const ids = rawIds.map((item) => {
    if (typeof item !== "string") {
      apiError(400, "\u5e16\u5b50\u6807\u8bc6\u683c\u5f0f\u4e0d\u6b63\u786e")
    }

    const id = item.trim()
    if (!id || id.length > 191) {
      apiError(400, "\u5e16\u5b50\u6807\u8bc6\u683c\u5f0f\u4e0d\u6b63\u786e")
    }

    return id
  })

  if (new Set(ids).size !== ids.length) {
    apiError(400, "\u5e16\u5b50\u6807\u8bc6\u4e0d\u80fd\u91cd\u590d")
  }

  return ids
}

function getErrorMessage(error: unknown) {
  if (isPublicRouteError(error)) {
    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return "操作失败"
}

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const action = requireStringField(body, "action", "缺少批量操作类型")
  const postIds = readPostIds(body)
  const message = readOptionalStringField(body, "message")

  if (!BATCH_POST_ACTIONS.has(action)) {
    apiError(400, "暂不支持该批量操作")
  }

  if (action === "post.moveBoard") {
    requireStringField(body, "boardSlug", "请选择目标节点")
  }

  const requestIp = getRequestIp(request)
  const failures: Array<{ postId: string; message: string }> = []
  let successCount = 0

  for (const postId of postIds) {
    try {
      await executeAdminAction({
        actor: adminUser,
        adminUserId: adminUser.id,
        action,
        targetId: postId,
        message,
        requestIp,
        body: {
          ...body,
          action,
          targetId: postId,
        },
      })
      successCount += 1
    } catch (error) {
      failures.push({ postId, message: getErrorMessage(error) })
    }
  }

  if (successCount === 0) {
    apiError(400, failures[0]?.message ?? "批量操作失败")
  }

  const failedCount = failures.length
  const resultMessage = failedCount > 0
    ? `已处理 ${successCount} 篇帖子，${failedCount} 篇失败`
    : `已处理 ${successCount} 篇帖子`

  return apiSuccess({
    successCount,
    failedCount,
    failures,
  }, resultMessage)
}, {
  errorMessage: "批量管理帖子失败",
  logPrefix: "[api/admin/posts/bulk] unexpected error",
  unauthorizedMessage: "无权批量管理帖子",
  allowModerator: true,
})
