import { randomUUID } from "node:crypto"

import { prisma } from "@/db/client"

import { revalidateTag, unstable_cache } from "next/cache"

export { SelfServeAdsIntroPage } from "@/components/self-serve-ads-intro-page"
export { SelfServeAdsPurchasePage } from "@/components/self-serve-ads-purchase-page"
export { SelfServeAdsSidebar } from "@/components/self-serve-ads-sidebar"
export { getSelfServeAdsAppConfig, updateSelfServeAdsAppConfig } from "@/lib/app-config"

import { countPendingSelfServeOrders, findSelfServeApprovedAds, findSelfServeOrderById, findSelfServeOrdersForAdmin, updateSelfServeOrder } from "@/db/self-serve-ads"
import { createSystemNotification, submitSelfServeAdOrderTransaction } from "@/db/self-serve-ads-write-queries"

import { ensureAdminActorPermission } from "@/lib/admin-scope-permissions"
import { getCurrentUser } from "@/lib/auth"
import { getSelfServeAdsAppConfig as loadSelfServeAdsAppConfig } from "@/lib/app-config"
import { enforceSensitiveText } from "@/lib/content-safety"
import { serializeDateTime } from "@/lib/formatters"
import { requireSiteAdminActor } from "@/lib/moderator-permissions"
import { buildSelfServeAdPriceMap, getSelfServeAdPrice, toSelfServeAdConfig, validateSelfServeAdPurchaseDraft } from "@/lib/self-serve-ads.shared"

import { normalizeNonNegativeInteger, normalizePositiveInteger, normalizeTrimmedText } from "@/lib/shared/normalizers"

import type { SelfServeAdItem, SelfServeAdPurchaseDraft, SelfServeAdSlotType, SelfServeAdsPanelData } from "@/lib/self-serve-ads.shared"
import { getSiteSettings, SITE_SETTINGS_CACHE_TAG } from "@/lib/site-settings"

export const SELF_SERVE_ADS_CACHE_TAG = "self-serve-ads"


async function ensureCanManageSelfServeAdsAdmin() {
  await ensureAdminActorPermission(
    await requireSiteAdminActor(),
    "admin.apps.manage",
    "无权限管理自助广告",
  )
}

function buildPlaceholder(slotType: SelfServeAdSlotType, slotIndex: number): SelfServeAdItem {

  return { id: `placeholder-${slotType}-${slotIndex}`, slotType, slotIndex, title: null, linkUrl: null, imageUrl: null, textColor: null, backgroundColor: null, durationMonths: null, pricePoints: null, status: "EMPTY", reviewNote: null, startsAt: null, endsAt: null, createdAt: null, isPlaceholder: true }
}

function mapItem(item: Awaited<ReturnType<typeof findSelfServeApprovedAds>>[number]): SelfServeAdItem {
  return {
    id: item.id,
    slotType: item.slotType,
    slotIndex: item.slotIndex,
    title: item.title,
    linkUrl: item.linkUrl,
    imageUrl: item.imageUrl,
    textColor: item.textColor,
    backgroundColor: item.backgroundColor,
    durationMonths: item.durationMonths,
    pricePoints: item.pricePoints,
    status: item.status,
    reviewNote: item.reviewNote,
    startsAt: item.startsAt ? serializeDateTime(item.startsAt) : null,
    endsAt: item.endsAt ? serializeDateTime(item.endsAt) : null,
    createdAt: serializeDateTime(item.createdAt),
    isPlaceholder: false,
  }
}

function mergeSlots(slotType: SelfServeAdSlotType, slotCount: number, approved: Awaited<ReturnType<typeof findSelfServeApprovedAds>>) {
  const grouped = new Map<number, SelfServeAdItem>()
  approved.filter((item: Awaited<ReturnType<typeof findSelfServeApprovedAds>>[number]) => item.slotType === slotType).forEach((item: Awaited<ReturnType<typeof findSelfServeApprovedAds>>[number]) => {
    if (!grouped.has(item.slotIndex)) grouped.set(item.slotIndex, mapItem(item))
  })
  return Array.from({ length: slotCount }, (_, index) => grouped.get(index) ?? buildPlaceholder(slotType, index))
}

async function readSelfServeAdsPanelData(): Promise<SelfServeAdsPanelData | null> {
  const [appConfig, settings] = await Promise.all([loadSelfServeAdsAppConfig(), getSiteSettings()])
  const config = toSelfServeAdConfig(appConfig)
  if (!config.enabled) return null

  const approved = await findSelfServeApprovedAds("self-serve-ads")
  return {
    appCode: "self-serve-ads",
    enabled: true,
    title: config.cardTitle,
    placeholderLabel: config.placeholderLabel,
    pointName: settings.pointName,
    imageSlots: mergeSlots("IMAGE", config.imageSlotCount, approved),
    textSlots: mergeSlots("TEXT", config.textSlotCount, approved),
    prices: buildSelfServeAdPriceMap(config),
  }
}

const getPersistentSelfServeAdsPanelData = unstable_cache(
  readSelfServeAdsPanelData,
  ["self-serve-ads:panel"],
  {
    tags: [SELF_SERVE_ADS_CACHE_TAG, SITE_SETTINGS_CACHE_TAG],
    revalidate: 60,
  },
)

export async function getSelfServeAdsPanelData(): Promise<SelfServeAdsPanelData | null> {
  return getPersistentSelfServeAdsPanelData()
}

export function revalidateSelfServeAdsCache() {
  try {
    revalidateTag(SELF_SERVE_ADS_CACHE_TAG, { expire: 0 })
  } catch {
    // Ignore when called outside a Next.js request context.
  }
}

export async function submitSelfServeAdOrder(input: SelfServeAdPurchaseDraft) {
  const [user, appConfig, settings] = await Promise.all([getCurrentUser(), loadSelfServeAdsAppConfig(), getSiteSettings()])
  if (!user) throw new Error("请先登录后再购买广告位")

  const config = toSelfServeAdConfig(appConfig)
  if (!config.enabled) throw new Error("当前未开放广告位购买")

  const slotType = input.slotType === "IMAGE" ? "IMAGE" : "TEXT"
  const slotLimit = slotType === "IMAGE" ? config.imageSlotCount : config.textSlotCount
  const slotIndex = Math.max(0, Number(input.slotIndex) || 0)
  if (slotIndex >= slotLimit) throw new Error("广告位不存在或已失效")

  const validation = validateSelfServeAdPurchaseDraft(input)
  if (!validation.success) throw new Error(validation.firstError ?? "广告表单校验失败")

  const { title, linkUrl, imageUrl, textColor, backgroundColor, durationMonths } = validation.normalized
  const titleSafety = slotType === "TEXT" && title
    ? await enforceSensitiveText({ scene: "selfServeAd.title", text: title })
    : null


  const pricePoints = getSelfServeAdPrice(config, slotType, durationMonths)
  if (pricePoints <= 0) throw new Error("当前广告价格未配置，暂不可购买")

  const occupied = await findSelfServeApprovedAds("self-serve-ads")
  if (occupied.some((item: Awaited<ReturnType<typeof findSelfServeApprovedAds>>[number]) => item.slotType === slotType && item.slotIndex === slotIndex)) throw new Error("该广告位已被租用，请选择其他广告位")

  const orderId = randomUUID()
  const result = await submitSelfServeAdOrderTransaction({
    orderId,
    userId: user.id,
    appCode: "self-serve-ads",
    slotType,
    slotIndex,
    title: slotType === "TEXT" ? (titleSafety?.sanitizedText ?? title) : null,
    linkUrl,
    imageUrl,
    textColor,
    backgroundColor,
    durationMonths,
    pricePoints,
    pointReason: `[app:self-serve-ads] 购买${slotType === "IMAGE" ? "图片" : "文字"}广告位 ${durationMonths} 个月`,
  })

  if (result.error === "POINTS_NOT_ENOUGH") {
    throw new Error(`${settings.pointName}不足，无法购买广告位`)
  }

  return {
    ...result.order,
    contentAdjusted: Boolean(titleSafety?.wasReplaced),
  }

}

export async function getSelfServeAdsAdminData() {
  await ensureCanManageSelfServeAdsAdmin()

  const [appConfig, settings, items, pendingCount] = await Promise.all([
    loadSelfServeAdsAppConfig(),
    getSiteSettings(),
    findSelfServeOrdersForAdmin("self-serve-ads"),
    countPendingSelfServeOrders("self-serve-ads"),
  ])

  const config = toSelfServeAdConfig(appConfig)
  return {
    appCode: "self-serve-ads",
    installed: true,
    pointName: settings.pointName,
    config,
    pendingCount,
    items: items.map((item: Awaited<ReturnType<typeof findSelfServeOrdersForAdmin>>[number]) => ({ ...mapItem(item), userId: item.userId })),
  }
}

export async function reviewSelfServeAdOrder(input: {
  id: string
  action: "approve" | "reject" | "expire" | "update"
  reviewNote?: string
  slotIndex?: number
  title?: string
  linkUrl?: string
  imageUrl?: string
  textColor?: string
  backgroundColor?: string
  durationMonths?: number
}) {
  await ensureCanManageSelfServeAdsAdmin()

  const existing = await findSelfServeOrderById(input.id)
  if (!existing) throw new Error("广告订单不存在")

  const slotIndex = normalizeNonNegativeInteger(input.slotIndex ?? existing.slotIndex, 0)
  const durationMonths = normalizePositiveInteger(input.durationMonths ?? existing.durationMonths, existing.durationMonths ?? 1)

  const reviewNote = normalizeTrimmedText(input.reviewNote ?? existing.reviewNote, 300) || null
  const adminDraftValidation = validateSelfServeAdPurchaseDraft({
    slotType: existing.slotType,
    slotIndex,
    title: String(input.title ?? existing.title ?? ""),
    linkUrl: String(input.linkUrl ?? existing.linkUrl ?? ""),
    imageUrl: String(input.imageUrl ?? existing.imageUrl ?? ""),
    textColor: String(input.textColor ?? existing.textColor ?? "#0f172a"),
    backgroundColor: String(input.backgroundColor ?? existing.backgroundColor ?? "#f8fafc"),
    durationMonths: durationMonths === 1 || durationMonths === 3 || durationMonths === 6 || durationMonths === 12 ? durationMonths : 1,
  })
  if (!adminDraftValidation.success) throw new Error(adminDraftValidation.firstError ?? "广告表单校验失败")
  const { title, linkUrl, imageUrl, textColor, backgroundColor } = adminDraftValidation.normalized
  const titleSafety = existing.slotType === "TEXT" && title
    ? await enforceSensitiveText({ scene: "selfServeAd.title", text: title })
    : null
  const sanitizedTitle = titleSafety?.sanitizedText ?? title


  if (input.action === "approve") {
    const startsAt = new Date()
    const endsAt = new Date(startsAt)
    endsAt.setMonth(endsAt.getMonth() + durationMonths)
    const updated = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`self-serve-ads:slot:${existing.appCode}:${existing.slotType}:${slotIndex}`}))`

      const latest = await tx.selfServeAdOrder.findUnique({
        where: { id: existing.id },
        select: { id: true, status: true },
      })
      if (!latest) {
        throw new Error("广告订单不存在")
      }
      if (latest.status !== "PENDING") {
        throw new Error("广告订单状态已变更，请刷新后再试")
      }

      const occupied = await tx.selfServeAdOrder.findFirst({
        where: {
          appCode: existing.appCode,
          slotType: existing.slotType,
          slotIndex,
          status: "APPROVED",
          id: { not: existing.id },
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: startsAt } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: startsAt } }] },
          ],
        },
        select: { id: true },
      })
      if (occupied) {
        throw new Error("该广告位已被租用，请调整广告位后再审核")
      }

      return tx.selfServeAdOrder.update({
        where: { id: existing.id },
        data: {
          slotIndex,
          title: sanitizedTitle,
          linkUrl,
          imageUrl,
          textColor,
          backgroundColor,
          durationMonths,
          status: "APPROVED",
          reviewNote,
          startsAt,
          endsAt,
        },
      })
    })
    await createSystemNotification({
      userId: existing.userId,
      relatedId: existing.id,
      title: "你的广告位申请已通过审核",
      content: `你提交的${existing.slotType === "IMAGE" ? "图片" : "文字"}广告位申请已通过审核，现已开始展示。${reviewNote ? ` 审核备注：${reviewNote}` : ""}`,
    })
    return updated

  }

  if (input.action === "reject") {
    const updated = await updateSelfServeOrder(existing.id, { slotIndex, title: sanitizedTitle, linkUrl, imageUrl, textColor, backgroundColor, durationMonths, status: "REJECTED", reviewNote })
    await createSystemNotification({
      userId: existing.userId,
      relatedId: existing.id,
      title: "你的广告位申请未通过审核",
      content: `你提交的${existing.slotType === "IMAGE" ? "图片" : "文字"}广告位申请未通过审核。${reviewNote ? ` 审核备注：${reviewNote}` : ""}`,
    })
    return updated

  }

  if (input.action === "expire") {
    return updateSelfServeOrder(existing.id, { status: "EXPIRED", reviewNote, endsAt: new Date() })
  }

  const updated = await updateSelfServeOrder(existing.id, {
    slotIndex,
    title: sanitizedTitle,
    linkUrl,
    imageUrl,
    textColor,
    backgroundColor,
    durationMonths,
    reviewNote,
    status: existing.status === "APPROVED" ? "PENDING" : existing.status,
    startsAt: existing.status === "APPROVED" ? null : existing.startsAt,
    endsAt: existing.status === "APPROVED" ? null : existing.endsAt,
  })

  if (existing.status === "APPROVED") {
    await createSystemNotification({
      userId: existing.userId,
      relatedId: existing.id,
      title: "你的广告位内容已更新，等待重新审核",
      content: `你提交的${existing.slotType === "IMAGE" ? "图片" : "文字"}广告位内容已修改，已重新进入审核队列，审核通过后才会重新展示。${reviewNote ? ` 审核备注：${reviewNote}` : ""}`,
    })
  }


  return updated
}

