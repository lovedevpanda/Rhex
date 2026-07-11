import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { applyForOAuthClient, rotateOwnOAuthClientSecret, updateOwnOAuthClient } from "@/lib/oauth-server"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const action = typeof body.action === "string" ? body.action : ""

  if (action === "create") {
    const result = await applyForOAuthClient({
      ownerId: currentUser.id,
      name: body.name,
      description: body.description,
      homepageUrl: body.homepageUrl,
      logoUrl: body.logoUrl,
      redirectUris: body.redirectUris,
      scopes: body.scopes,
    })

    return apiSuccess(result, "OAuth 应用申请已提交，等待管理员审核")
  }

  if (action === "update") {
    await updateOwnOAuthClient({
      ownerId: currentUser.id,
      id: requireStringField(body, "id", "缺少 OAuth 应用 ID"),
      name: body.name,
      description: body.description,
      homepageUrl: body.homepageUrl,
      logoUrl: body.logoUrl,
      redirectUris: body.redirectUris,
      scopes: body.scopes,
    })

    return apiSuccess(undefined, "OAuth 应用已重新提交审核")
  }

  if (action === "rotate-secret") {
    const result = await rotateOwnOAuthClientSecret({
      ownerId: currentUser.id,
      id: requireStringField(body, "id", "缺少 OAuth 应用 ID"),
    })

    return apiSuccess(result, "OAuth 应用 key 已重置")
  }

  apiError(400, "不支持的 OAuth 应用操作")
}, {
  errorMessage: "处理 OAuth 应用失败",
  logPrefix: "[api/oauth/clients] unexpected error",
  unauthorizedMessage: "请先登录后再管理 OAuth 应用",
  allowStatuses: ["ACTIVE"],
})

