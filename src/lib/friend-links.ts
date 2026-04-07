import { FriendLinkStatus } from "@/db/types"

import {
  countPendingFriendLinks,
  createFriendLink,
  findApprovedFriendLinks,
  findFriendLinkById,
  findFriendLinkByUrl,
  findFriendLinksForAdmin,
  updateFriendLink,
} from "@/db/friend-links"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-route"
import { normalizeTrimmedText } from "@/lib/shared/normalizers"
import { getSiteSettings } from "@/lib/site-settings"


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
  logoPath?: string
}


export interface AdminFriendLinkInput extends FriendLinkSubmissionInput {
  sortOrder?: number
  reviewNote?: string
}


function normalizeUrl(value: unknown) {
  const url = String(value ?? "").trim()
  if (!url) {
    return ""
  }

  if (!/^https?:\/\//i.test(url)) {
    apiError(400, "链接地址必须以 http:// 或 https:// 开头")
  }

  try {
    return new URL(url).toString()
  } catch {
    apiError(400, "请输入有效的链接地址")
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

export async function getFriendLinkListData(): Promise<FriendLinkListData> {
  const [compact, featured] = await Promise.all([
    findApprovedFriendLinks(9),
    findApprovedFriendLinks(),
  ])

  return {
    compact: compact.map(mapItem),
    featured: featured.map(mapItem),
    totalApproved: featured.length,
  }
}

export async function getFriendLinkPageData() {
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

export async function getAdminFriendLinkPageData(status?: string) {
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

  const name = normalizeTrimmedText(input.name, 40)
  const url = normalizeUrl(input.url)
  const logoPath = normalizeTrimmedText(input.logoPath, 300)

  if (!name) {
    apiError(400, "请输入网站名称")
  }

  if (!url) {
    apiError(400, "请输入网站链接")
  }

  const duplicated = await findFriendLinkByUrl(url)
  if (duplicated) {
    apiError(409, "该网站链接已存在，请勿重复提交")
  }

  return createFriendLink({
    name,
    url,
    logoPath: logoPath || null,
    status: FriendLinkStatus.PENDING,
  })
}


export async function createFriendLinkByAdmin(input: AdminFriendLinkInput) {
  const name = normalizeTrimmedText(input.name, 40)
  const url = normalizeUrl(input.url)
  const logoPath = normalizeTrimmedText(input.logoPath, 300)
  const reviewNote = normalizeTrimmedText(input.reviewNote, 300)
  const sortOrder = Math.max(0, Number(input.sortOrder ?? 0) || 0)

  if (!name) {
    apiError(400, "请输入网站名称")
  }

  if (!url) {
    apiError(400, "请输入网站链接")
  }

  const duplicated = await findFriendLinkByUrl(url)
  if (duplicated) {
    apiError(409, "该网站链接已存在，请勿重复创建")
  }

  return createFriendLink({
    name,
    url,
    logoPath: logoPath || null,
    sortOrder,
    reviewNote: reviewNote || null,
    status: FriendLinkStatus.APPROVED,
    reviewedAt: new Date(),
  })
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
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    apiError(401, "请先登录")
  }

  const existing = await findFriendLinkById(input.id)
  if (!existing) {
    apiError(404, "友情链接不存在")
  }


  const reviewNote = normalizeTrimmedText(input.reviewNote, 300) || null
  const sortOrder = Math.max(0, Number(input.sortOrder ?? existing.sortOrder) || 0)

  if (input.action === "approve") {
    return updateFriendLink(input.id, {
      status: FriendLinkStatus.APPROVED,
      reviewNote,
      sortOrder,
      reviewedAt: new Date(),
    })
  }

  if (input.action === "reject") {
    return updateFriendLink(input.id, {
      status: FriendLinkStatus.REJECTED,
      reviewNote,
      reviewedAt: new Date(),
    })
  }

  if (input.action === "disable") {
    return updateFriendLink(input.id, {
      status: FriendLinkStatus.DISABLED,
      reviewNote,
      reviewedAt: new Date(),
    })
  }

  const name = normalizeTrimmedText(input.name ?? existing.name, 40)
  const url = normalizeUrl(input.url ?? existing.url)
  const logoPath = normalizeTrimmedText(input.logoPath ?? existing.logoPath, 300)

  return updateFriendLink(input.id, {
    name,
    url,
    logoPath: logoPath || null,

    sortOrder,
    reviewNote,
  })
}
