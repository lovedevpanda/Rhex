import { apiError, apiSuccess, createAdminRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { getRequestIp, writeAdminLog } from "@/lib/admin"
import { reviewOAuthClient, rotateOAuthClientSecretByAdmin, updateOAuthClientByAdmin, type OAuthClientListItem } from "@/lib/oauth-server"

export const POST = createAdminRouteHandler<OAuthClientListItem | { clientSecret: string }>(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const action = typeof body.action === "string" ? body.action : ""
  const id = requireStringField(body, "id", "缺少 OAuth 应用 ID")

  if (action === "edit") {
    const client = await updateOAuthClientByAdmin({
      id,
      name: body.name,
      description: body.description,
      homepageUrl: body.homepageUrl,
      logoUrl: body.logoUrl,
      redirectUris: body.redirectUris,
      scopes: body.scopes,
    })

    await writeAdminLog(
      adminUser.id,
      "oauth-client.edit",
      "OAUTH_CLIENT",
      id,
      `编辑 OAuth client ${client.clientId}`,
      getRequestIp(request),
    )

    return apiSuccess(client, "OAuth 应用已更新")
  }

  if (action === "approve" || action === "reject" || action === "disable") {
    const client = await reviewOAuthClient({
      id,
      reviewerId: adminUser.id,
      action,
      reviewNote: body.reviewNote,
    })

    await writeAdminLog(
      adminUser.id,
      `oauth-client.${action}`,
      "OAUTH_CLIENT",
      id,
      `${action} OAuth client ${client.clientId}`,
      getRequestIp(request),
    )

    return apiSuccess(client, "OAuth 应用已处理")
  }

  if (action === "rotate-secret") {
    const result = await rotateOAuthClientSecretByAdmin({ id })

    await writeAdminLog(
      adminUser.id,
      "oauth-client.rotate-secret",
      "OAUTH_CLIENT",
      id,
      "重置 OAuth 应用 key",
      getRequestIp(request),
    )

    return apiSuccess(result, "OAuth 应用 key 已重置")
  }

  apiError(400, "不支持的 OAuth 应用操作")
}, {
  errorMessage: "处理 OAuth 应用失败",
  logPrefix: "[api/admin/apps/oauth-server/clients] unexpected error",
  unauthorizedMessage: "无权管理 OAuth 应用",
  allowModerator: false,
  permission: "admin.operations.manage",
})
