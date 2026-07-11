import { revalidateTag, unstable_cache } from "next/cache"

import { FriendLinkStatus } from "@/db/types"

import {
  countPendingFriendLinks,
  createFriendLinkIfAbsent,
  deleteFriendLink,
  findApprovedFriendLinks,
  findFriendLinkById,
  findFriendLinksForAdmin,
  updateFriendLinkIfStatus,
} from "@/db/friend-links"
import { apiError } from "@/lib/api-route"
import { ensureAdminActorPermission } from "@/lib/admin-scope-permissions"
import { enforceSensitiveText } from "@/lib/content-safety"
import { reviewFriendLinkPlacement } from "@/lib/friend-link-auto-review"
import { requireSiteAdminActor } from "@/lib/moderator-permissions"
import { normalizeTrimmedText } from "@/lib/shared/normalizers"
import { getSiteSettings, SITE_SETTINGS_CACHE_TAG } from "@/lib/site-settings"
import { resolveSafeOutboundTarget } from "@/lib/safe-outbound-http"

export const FRIEND_LINKS_CACHE_TAG = "friend-links"


export interface FriendLinkItem {
  id: string
  name: string
  url: string
  logoPath: string | null

  description: string | null
  contact: string | null
  sortOrder: number
  clickCount: number
  status: FriendLinkStatus
  reviewNote: string | null
  createdAt: string
  updatedAt: string
  reviewedAt: string | null
}

export interface FriendLinkListData {
  compact: FriendLinkItem[]
  featured: FriendLinkItem[]
  totalApproved: number
}

export interface FriendLinkSubmissionInput {
  name: string
  url: string
  placementPageUrl: string
  logoPath?: string
  siteOrigin: string
}


export interface AdminFriendLinkInput {
  name: string
  url: string
  logoPath?: string
  sortOrder?: number
  reviewNote?: string
}


function normalizeUrl(value: unknown) {
  const url = String(value ?? "").trim()
  if (!url) {
    return ""
  }
  if (url.length > 2_048) {
    apiError(400, "URL is too long")
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    apiError(400, "Please provide a valid URL")
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    apiError(400, "URL must use http or https")
  }
  if (parsed.username || parsed.password) {
    apiError(400, "URL must not contain credentials")
  }

  return parsed.toString()
}

function normalizeComparableHostname(hostname: string) {
  return hostname.trim().toLowerCase().replace(/^www\./, "")
}

function ensureSameWebsite(url: string, placementPageUrl: string) {
  if (normalizeComparableHostname(new URL(url).hostname) !== normalizeComparableHostname(new URL(placementPageUrl).hostname)) {
    apiError(400, "Website URL and placement page must use the same host")
  }
}

async function ensurePublicFriendLinkUrl(url: string) {
  try {
    await resolveSafeOutboundTarget(url)
  } catch {
    apiError(400, "Website URL must resolve to a public address")
  }
}


function mapItem(item: Awaited<ReturnType<typeof findApprovedFriendLinks>>[number]): FriendLinkItem {
  return {
    id: item.id,
    name: item.name,
    url: item.url,
    logoPath: item.logoPath,

    description: item.description,
    contact: item.contact,
    sortOrder: item.sortOrder,
    clickCount: item.clickCount,
    status: item.status,
    reviewNote: item.reviewNote,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    reviewedAt: item.reviewedAt ? item.reviewedAt.toISOString() : null,
  }
}

async function readFriendLinkListData(compactLimit = 9): Promise<FriendLinkListData> {
  const [compact, featured] = await Promise.all([
    findApprovedFriendLinks(compactLimit),
    findApprovedFriendLinks(),
  ])

  return {
    compact: compact.map(mapItem),
    featured: featured.map(mapItem),
    totalApproved: featured.length,
  }
}

const getPersistentFriendLinkListData = unstable_cache(
  async (compactLimit: number) => readFriendLinkListData(compactLimit),
  ["friend-links:list"],
  {
    tags: [FRIEND_LINKS_CACHE_TAG],
    revalidate: 60,
  },
)

export async function getFriendLinkListData(compactLimit = 9): Promise<FriendLinkListData> {
  return getPersistentFriendLinkListData(compactLimit)
}

async function readFriendLinkPageData() {
  const [settings, links] = await Promise.all([
    getSiteSettings(),
    findApprovedFriendLinks(),
  ])

  return {
    enabled: settings.friendLinksEnabled,
    announcement: settings.friendLinkAnnouncement,
    applicationEnabled: settings.friendLinkApplicationEnabled,
    links: links.map(mapItem),
  }
}

const getPersistentFriendLinkPageData = unstable_cache(
  readFriendLinkPageData,
  ["friend-links:page"],
  {
    tags: [FRIEND_LINKS_CACHE_TAG, SITE_SETTINGS_CACHE_TAG],
    revalidate: 60,
  },
)

export async function getFriendLinkPageData() {
  return getPersistentFriendLinkPageData()
}

export function revalidateFriendLinksCache() {
  try {
    revalidateTag(FRIEND_LINKS_CACHE_TAG, { expire: 0 })
  } catch {
    // Ignore when called outside a Next.js request context.
  }
}

export async function getAdminFriendLinkPageData(status?: string) {
  await ensureAdminActorPermission(
    await requireSiteAdminActor(),
    "admin.operations.manage",
    "无权限访问友情链接管理",
  )

  const [settings, items, pendingCount] = await Promise.all([
    getSiteSettings(),
    findFriendLinksForAdmin(status === "PENDING" || status === "APPROVED" || status === "REJECTED" || status === "DISABLED" ? status : "ALL"),
    countPendingFriendLinks(),
  ])

  return {
    settings: {
      friendLinksEnabled: settings.friendLinksEnabled,
      friendLinkApplicationEnabled: settings.friendLinkApplicationEnabled,
      friendLinkAnnouncement: settings.friendLinkAnnouncement,
    },
    pendingCount,
    items: items.map(mapItem),
  }
}

export async function submitFriendLinkApplication(input: FriendLinkSubmissionInput) {
  const settings = await getSiteSettings()

  if (!settings.friendLinksEnabled) {
    apiError(400, "站点暂未开启友情链接")
  }

  if (!settings.friendLinkApplicationEnabled) {
    apiError(400, "当前暂未开放友情链接申请")
  }

  const rawName = normalizeTrimmedText(input.name, 40)
  const url = normalizeUrl(input.url)
  const placementPageUrl = normalizeUrl(input.placementPageUrl)
  const logoPath = normalizeTrimmedText(input.logoPath, 300)

  if (!rawName) {
    apiError(400, "请输入网站名称")
  }

  if (!url) {
    apiError(400, "请输入网站链接")
  }

  if (!placementPageUrl) {
    apiError(400, "请输入友情链接所在页面")
  }

  ensureSameWebsite(url, placementPageUrl)
  await ensurePublicFriendLinkUrl(url)

  const nameSafety = await enforceSensitiveText({ scene: "friendLink.name", text: rawName })
  const autoReview = await reviewFriendLinkPlacement(placementPageUrl, input.siteOrigin)
  const friendLink = await createFriendLinkIfAbsent({
    name: nameSafety.sanitizedText,
    url,
    logoPath: logoPath || null,
    status: autoReview.autoApproved ? FriendLinkStatus.APPROVED : FriendLinkStatus.PENDING,
    reviewNote: autoReview.reviewNote,
    reviewedAt: autoReview.autoApproved ? new Date() : null,
  })
  if (!friendLink) {
    apiError(409, "This website URL has already been submitted")
  }

  return {
    ...friendLink,
    contentAdjusted: nameSafety.wasReplaced,
    autoApproved: autoReview.autoApproved,
  }
}


export async function createFriendLinkByAdmin(input: AdminFriendLinkInput) {
  await ensureAdminActorPermission(
    await requireSiteAdminActor(),
    "admin.operations.manage",
    "无权操作友情链接",
  )

  const rawName = normalizeTrimmedText(input.name, 40)
  const url = normalizeUrl(input.url)
  const logoPath = normalizeTrimmedText(input.logoPath, 300)
  const reviewNote = normalizeTrimmedText(input.reviewNote, 300)
  const sortOrder = Math.max(0, Number(input.sortOrder ?? 0) || 0)

  if (!rawName) {
    apiError(400, "请输入网站名称")
  }

  if (!url) {
    apiError(400, "请输入网站链接")
  }

  await ensurePublicFriendLinkUrl(url)
  const nameSafety = await enforceSensitiveText({ scene: "friendLink.name", text: rawName })
  const created = await createFriendLinkIfAbsent({
    name: nameSafety.sanitizedText,
    url,
    logoPath: logoPath || null,
    sortOrder,
    reviewNote: reviewNote || null,
    status: FriendLinkStatus.APPROVED,
    reviewedAt: new Date(),
  })
  if (!created) {
    apiError(409, "This website URL already exists")
  }
  return created
}


export async function reviewFriendLink(input: {
  id: string
  action: "approve" | "reject" | "disable" | "update"
  reviewNote?: string
  sortOrder?: number
  name?: string
  url?: string
  logoPath?: string
}) {
  await ensureAdminActorPermission(
    await requireSiteAdminActor(),
    "admin.operations.manage",
    "No permission to manage friend links",
  )

  const existing = await findFriendLinkById(input.id)
  if (!existing) {
    apiError(404, "Friend link does not exist")
  }

  const reviewNote = normalizeTrimmedText(input.reviewNote, 300) || null
  const sortOrder = Math.max(0, Number(input.sortOrder ?? existing.sortOrder) || 0)
  let expectedStatuses: FriendLinkStatus[]
  let data: Parameters<typeof updateFriendLinkIfStatus>[2]

  if (input.action === "approve") {
    expectedStatuses = [FriendLinkStatus.PENDING]
    data = { status: FriendLinkStatus.APPROVED, reviewNote, sortOrder, reviewedAt: new Date() }
  } else if (input.action === "reject") {
    expectedStatuses = [FriendLinkStatus.PENDING]
    data = { status: FriendLinkStatus.REJECTED, reviewNote, reviewedAt: new Date() }
  } else if (input.action === "disable") {
    expectedStatuses = [FriendLinkStatus.APPROVED]
    data = { status: FriendLinkStatus.DISABLED, reviewNote, reviewedAt: new Date() }
  } else {
    const rawName = normalizeTrimmedText(input.name ?? existing.name, 40)
    const url = normalizeUrl(input.url ?? existing.url)
    const logoPath = normalizeTrimmedText(input.logoPath ?? existing.logoPath, 300)
    await ensurePublicFriendLinkUrl(url)
    const nameSafety = await enforceSensitiveText({ scene: "friendLink.name", text: rawName })
    expectedStatuses = [existing.status]
    data = {
      name: nameSafety.sanitizedText,
      url,
      logoPath: logoPath || null,
      sortOrder,
      reviewNote,
    }
  }

  const updated = await updateFriendLinkIfStatus(input.id, expectedStatuses, data)
  if (!updated) {
    apiError(409, "Friend link state changed; refresh and retry")
  }

  return updated
}

export async function deleteFriendLinkByAdmin(id: string) {
  await ensureAdminActorPermission(
    await requireSiteAdminActor(),
    "admin.operations.manage",
    "无权操作友情链接",
  )

  const normalizedId = normalizeTrimmedText(id, 100)
  if (!normalizedId) {
    apiError(400, "缺少友情链接 ID")
  }

  const existing = await findFriendLinkById(normalizedId)
  if (!existing) {
    apiError(404, "友情链接不存在")
  }

  return deleteFriendLink(normalizedId)
}
