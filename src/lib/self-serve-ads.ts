import { randomUUID } from "node:crypto"

export { SelfServeAdsIntroPage } from "@/components/self-serve-ads-intro-page"
export { SelfServeAdsPurchasePage } from "@/components/self-serve-ads-purchase-page"
export { SelfServeAdsSidebar } from "@/components/self-serve-ads-sidebar"
export { getSelfServeAdsAppConfig, updateSelfServeAdsAppConfig } from "@/lib/app-config"

import { countPendingSelfServeOrders, findSelfServeApprovedAds, findSelfServeOrderById, findSelfServeOrdersForAdmin, updateSelfServeOrder } from "@/db/self-serve-ads"
import { createSystemNotification, submitSelfServeAdOrderTransaction } from "@/db/self-serve-ads-write-queries"

import { getCurrentUser } from "@/lib/auth"
import { getSelfServeAdsAppConfig as loadSelfServeAdsAppConfig } from "@/lib/app-config"
import { serializeDateTime } from "@/lib/formatters"
import { buildSelfServeAdPriceMap, getSelfServeAdPrice, toSelfServeAdConfig } from "@/lib/self-serve-ads.shared"
import { normalizeNonNegativeInteger, normalizePositiveInteger } from "@/lib/shared/normalizers"

import type { SelfServeAdItem, SelfServeAdPurchaseDraft, SelfServeAdSlotType, SelfServeAdsPanelData } from "@/lib/self-serve-ads.shared"
import { getSiteSettings } from "@/lib/site-settings"




function normalizeText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength)
}

function normalizeColor(value: unknown, fallback: string) {
  const color = String(value ?? "").trim()
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(color) ? color : fallback
}

function normalizeUrl(value: unknown) {
  const url = String(value ?? "").trim()
  if (!url) throw new Error("请填写广告链接")
  if (!/^https?:\/\//i.test(url)) throw new Error("广告链接必须以 http:// 或 https:// 开头")
  try {
    return new URL(url).toString()
  } catch {
    throw new Error("请输入有效的广告链接")
  }
}

function normalizeImageUrl(value: unknown) {
  const url = String(value ?? "").trim()
  if (!url) throw new Error("请填写广告图片地址")
  if (!/^https?:\/\//i.test(url)) throw new Error("广告图片地址必须以 http:// 或 https:// 开头")
  try {
    return new URL(url).toString()
  } catch {
    throw new Error("请输入有效的广告图片地址")
  }
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

export async function getSelfServeAdsPanelData(): Promise<SelfServeAdsPanelData | null> {
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

export async function submitSelfServeAdOrder(input: SelfServeAdPurchaseDraft) {
  const [user, appConfig, settings] = await Promise.all([getCurrentUser(), loadSelfServeAdsAppConfig(), getSiteSettings()])
  if (!user) throw new Error("请先登录后再购买广告位")

  const config = toSelfServeAdConfig(appConfig)
  if (!config.enabled) throw new Error("当前未开放广告位购买")

  const slotType = input.slotType === "IMAGE" ? "IMAGE" : "TEXT"
  const slotLimit = slotType === "IMAGE" ? config.imageSlotCount : config.textSlotCount
  const slotIndex = Math.max(0, Number(input.slotIndex) || 0)
  if (slotIndex >= slotLimit) throw new Error("广告位不存在或已失效")

  const durationMonths = input.durationMonths === 1 || input.durationMonths === 3 || input.durationMonths === 6 || input.durationMonths === 12 ? input.durationMonths : 1
  const linkUrl = normalizeUrl(input.linkUrl)
  const title = normalizeText(input.title, 30)
  const imageUrl = slotType === "IMAGE" ? normalizeImageUrl(input.imageUrl) : null
  const textColor = slotType === "TEXT" ? normalizeColor(input.textColor, "#0f172a") : null
  const backgroundColor = slotType === "TEXT" ? normalizeColor(input.backgroundColor, "#f8fafc") : null
  if (slotType === "TEXT" && !title) throw new Error("请填写广告标题")

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
    title: slotType === "TEXT" ? title : null,
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

  return result.order

}

export async function getSelfServeAdsAdminData() {
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
  const existing = await findSelfServeOrderById(input.id)
  if (!existing) throw new Error("广告订单不存在")

  const slotIndex = normalizeNonNegativeInteger(input.slotIndex ?? existing.slotIndex, 0)
  const durationMonths = normalizePositiveInteger(input.durationMonths ?? existing.durationMonths, existing.durationMonths ?? 1)

  const reviewNote = normalizeText(input.reviewNote ?? existing.reviewNote, 300) || null
  const title = existing.slotType === "TEXT" ? normalizeText(input.title ?? existing.title, 30) : null
  const linkUrl = normalizeUrl(input.linkUrl ?? existing.linkUrl)
  const imageUrl = existing.slotType === "IMAGE" ? normalizeImageUrl(input.imageUrl ?? existing.imageUrl) : null
  const textColor = existing.slotType === "TEXT" ? normalizeColor(input.textColor ?? existing.textColor, "#0f172a") : null
  const backgroundColor = existing.slotType === "TEXT" ? normalizeColor(input.backgroundColor ?? existing.backgroundColor, "#f8fafc") : null

  if (input.action === "approve") {
    const startsAt = new Date()
    const endsAt = new Date(startsAt)
    endsAt.setMonth(endsAt.getMonth() + durationMonths)
    const updated = await updateSelfServeOrder(existing.id, { slotIndex, title, linkUrl, imageUrl, textColor, backgroundColor, durationMonths, status: "APPROVED", reviewNote, startsAt, endsAt })
    await createSystemNotification({
      userId: existing.userId,
      relatedId: existing.id,
      title: "你的广告位申请已通过审核",
      content: `你提交的${existing.slotType === "IMAGE" ? "图片" : "文字"}广告位申请已通过审核，现已开始展示。${reviewNote ? ` 审核备注：${reviewNote}` : ""}`,
    })
    return updated

  }

  if (input.action === "reject") {
    const updated = await updateSelfServeOrder(existing.id, { slotIndex, title, linkUrl, imageUrl, textColor, backgroundColor, durationMonths, status: "REJECTED", reviewNote })
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
    title,
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

