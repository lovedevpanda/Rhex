import { revalidatePath } from "next/cache"

import { apiSuccess, createRouteHandler, readJsonBody } from "@/lib/api-route"
import { getRequestIp } from "@/lib/request-ip"
import { withWriteGuard } from "@/lib/write-guard"
import { revalidateFriendLinksCache, submitFriendLinkApplication } from "@/lib/friend-links"
import { resolveSiteOrigin } from "@/lib/site-origin"

export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const name = typeof body.name === "string" ? body.name : ""
  const url = typeof body.url === "string" ? body.url : ""
  const placementPageUrl = typeof body.placementPageUrl === "string" ? body.placementPageUrl : ""
  const logoPath = typeof body.logoPath === "string" ? body.logoPath : ""
  const siteOrigin = await resolveSiteOrigin().catch(() => new URL(request.url).origin)
  const result = await withWriteGuard({
    scope: "friend-links-apply",
    identity: { ip: getRequestIp(request) },
    cooldownMs: 15_000,
    cooldownMessage: "Too many applications; please try again later",
    dedupeKey: JSON.stringify({ url: url.trim(), placementPageUrl: placementPageUrl.trim() }),
    dedupeWindowMs: 60_000,
    releaseOnError: true,
  }, async () => submitFriendLinkApplication({
    name,
    url,
    placementPageUrl,
    logoPath,
    siteOrigin,
  }))

  if (result.autoApproved) {
    revalidateFriendLinksCache()
    revalidatePath("/")
    revalidatePath("/link")
  }

  const message = result.autoApproved
    ? result.contentAdjusted
      ? "申请已提交，部分内容已自动替换，并已自动审核通过"
      : "申请已提交，并已自动审核通过"
    : result.contentAdjusted
      ? "申请已提交，部分内容已自动替换，待管理员审核"
      : "申请已提交，待管理员审核"

  return apiSuccess(undefined, message)
}, {
  errorMessage: "申请提交失败",
  logPrefix: "[api/friend-links/apply] unexpected error",
})

