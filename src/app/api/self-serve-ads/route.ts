import { revalidatePath } from "next/cache"

import { apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { submitSelfServeAdOrder } from "@/lib/self-serve-ads"
import type { SelfServeAdPurchaseDraft, SelfServeAdSlotType } from "@/lib/self-serve-ads.shared"
import { withRequestWriteGuard } from "@/lib/write-guard"

function normalizeSlotType(value: unknown): SelfServeAdSlotType {
  return value === "IMAGE" ? "IMAGE" : "TEXT"
}

function normalizeDurationMonths(value: unknown): SelfServeAdPurchaseDraft["durationMonths"] {
  return value === 1 || value === 3 || value === 6 || value === 12 ? value : 1
}

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const draft: SelfServeAdPurchaseDraft = {
    slotType: normalizeSlotType(body.slotType),
    slotIndex: Number(body.slotIndex ?? 0),
    title: typeof body.title === "string" ? body.title : "",
    linkUrl: typeof body.linkUrl === "string" ? body.linkUrl : "",
    imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : "",
    textColor: typeof body.textColor === "string" ? body.textColor : "#0f172a",
    backgroundColor: typeof body.backgroundColor === "string" ? body.backgroundColor : "#f8fafc",
    durationMonths: normalizeDurationMonths(typeof body.durationMonths === "number" ? body.durationMonths : Number(body.durationMonths ?? 0)),
  }

  return withRequestWriteGuard({
    request,
    userId: currentUser.id,
    scope: "self-serve-ads-submit",
    cooldownMs: 1_500,
    cooldownMessage: "广告申请提交过于频繁，请稍后再试",
    dedupeKey: JSON.stringify(draft),
    dedupeWindowMs: 15_000,
    releaseOnError: true,
  }, async () => {
    const result = await submitSelfServeAdOrder(draft)

    revalidatePath("/")
    revalidatePath("/funs/self-serve-ads")
    return apiSuccess(undefined, result.contentAdjusted
      ? "广告申请已提交，部分内容已自动替换，待管理员审核"
      : "广告申请已提交，待管理员审核")
  })
}, {
  errorMessage: "广告申请提交失败",
  logPrefix: "[api/self-serve-ads] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
