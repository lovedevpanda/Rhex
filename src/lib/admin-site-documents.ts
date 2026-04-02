import { AnnouncementStatus } from "@/db/types"
import {
  createSiteDocumentRecord,
  deleteSiteDocumentRecordById,
  findAdminSiteDocuments,
  findSiteDocumentById,
  findSiteDocumentSlugsByBase,
  type SiteDocumentRow,
  updateSiteDocumentRecordById,
} from "@/db/site-document-queries"

import { requireAdminUser } from "@/lib/admin"
import { apiError } from "@/lib/api-route"
import { formatMonthDayTime, serializeDateTime } from "@/lib/formatters"
import {
  buildSiteDocumentHref,
  getSiteDocumentSourceTypeLabel,
  getSiteDocumentTypeLabel,
  isExternalSiteDocumentHref,
  isSiteDocumentSourceType,
  isSiteDocumentType,
  normalizeSiteDocumentLinkUrl,
  normalizeSiteDocumentSlug,
  normalizeSiteDocumentTitleColor,
  type SiteDocumentSourceType,
  type SiteDocumentType,
} from "@/lib/site-document-types"

export interface AdminSiteDocumentItem {
  id: string
  type: SiteDocumentType
  typeLabel: string
  title: string
  content: string
  sourceType: SiteDocumentSourceType
  sourceTypeLabel: string
  slug: string | null
  linkUrl: string | null
  titleColor: string | null
  titleBold: boolean
  status: AnnouncementStatus
  isPinned: boolean
  createdAt: string
  createdAtText: string
  publishedAt: string | null
  publishedAtText: string | null
  creatorName: string
  href: string
  isExternal: boolean
}

export interface AdminSiteDocumentInput {
  id?: string
  type?: string
  title: string
  content?: string
  sourceType?: string
  slug?: string
  linkUrl?: string
  titleColor?: string
  titleBold?: boolean
  status: string
  isPinned?: boolean
}

function normalizeText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength)
}

function normalizeStatus(value: unknown): AnnouncementStatus {
  if (value === AnnouncementStatus.DRAFT || value === AnnouncementStatus.PUBLISHED || value === AnnouncementStatus.OFFLINE) {
    return value
  }

  return AnnouncementStatus.DRAFT
}

function normalizeType(value: unknown): SiteDocumentType {
  return isSiteDocumentType(value) ? value : "ANNOUNCEMENT"
}

function normalizeSourceType(value: unknown): SiteDocumentSourceType {
  return isSiteDocumentSourceType(value) ? value : "DOCUMENT"
}

function mapRequiredDateTime(input: string | Date) {
  const value = serializeDateTime(input)
  if (!value) {
    apiError(500, "站点文档时间序列化失败")
  }

  return value
}

function mapSiteDocument(item: SiteDocumentRow): AdminSiteDocumentItem {
  const type = item.type as SiteDocumentType
  const sourceType = item.sourceType as SiteDocumentSourceType
  const publishedAt = item.publishedAt ? mapRequiredDateTime(item.publishedAt) : null
  const href = buildSiteDocumentHref({
    id: item.id,
    type,
    sourceType,
    slug: item.slug,
    linkUrl: item.linkUrl,
  })

  return {
    id: item.id,
    type,
    typeLabel: getSiteDocumentTypeLabel(type),
    title: item.title,
    content: item.content,
    sourceType,
    sourceTypeLabel: getSiteDocumentSourceTypeLabel(sourceType),
    slug: item.slug,
    linkUrl: item.linkUrl,
    titleColor: item.titleColor,
    titleBold: item.titleBold,
    status: item.status,
    isPinned: item.isPinned,
    createdAt: mapRequiredDateTime(item.createdAt),
    createdAtText: formatMonthDayTime(item.createdAt),
    publishedAt,
    publishedAtText: publishedAt ? formatMonthDayTime(publishedAt) : null,
    creatorName: item.creator.nickname ?? item.creator.username,
    href,
    isExternal: isExternalSiteDocumentHref(href),
  }
}

async function ensureUniqueDocumentSlug(type: SiteDocumentType, inputSlug: string, excludeId?: string) {
  const baseSlug = normalizeSiteDocumentSlug(inputSlug)
  if (!baseSlug) {
    apiError(400, "文档 slug 不可为空")
  }

  const existingSlugs = new Set(await findSiteDocumentSlugsByBase(type, baseSlug, excludeId))
  if (!existingSlugs.has(baseSlug)) {
    return baseSlug
  }

  let index = 2
  let candidate = `${baseSlug}-${index}`
  while (existingSlugs.has(candidate)) {
    index += 1
    candidate = `${baseSlug}-${index}`
  }

  return candidate
}

export async function getAdminSiteDocumentList(): Promise<AdminSiteDocumentItem[]> {
  const currentUser = await requireAdminUser()
  if (!currentUser) {
    apiError(403, "无权限访问站点文档数据")
  }

  const items = await findAdminSiteDocuments()
  return items.map(mapSiteDocument)
}

export async function saveAdminSiteDocument(input: AdminSiteDocumentInput) {
  const currentUser = await requireAdminUser()
  if (!currentUser) {
    apiError(403, "无权操作站点文档")
  }

  const currentRecord = input.id ? await findSiteDocumentById(String(input.id)) : null
  if (input.id && !currentRecord) {
    apiError(404, "站点文档不存在")
  }

  const title = normalizeText(input.title, 120)
  const status = normalizeStatus(input.status)
  const type = normalizeType(input.type)
  const sourceType = normalizeSourceType(input.sourceType)
  const isPinned = Boolean(input.isPinned)
  const titleBold = Boolean(input.titleBold)
  const titleColor = normalizeSiteDocumentTitleColor(input.titleColor)

  if (!title) {
    apiError(400, "文档标题不能为空")
  }

  let content = String(input.content ?? "").trim()
  let slug: string | null = null
  let linkUrl: string | null = null

  if (sourceType === "DOCUMENT") {
    if (!content) {
      apiError(400, "文档内容不能为空")
    }

    const rawSlug = normalizeSiteDocumentSlug(input.slug) || normalizeSiteDocumentSlug(title)
    slug = await ensureUniqueDocumentSlug(type, rawSlug, input.id)
  } else {
    linkUrl = normalizeSiteDocumentLinkUrl(input.linkUrl)
    if (!linkUrl) {
      apiError(400, "跳转链接格式不正确")
    }
    content = ""
  }

  const publishedAt = status === AnnouncementStatus.PUBLISHED
    ? currentRecord?.publishedAt ?? new Date()
    : status === AnnouncementStatus.DRAFT
      ? null
      : currentRecord?.publishedAt ?? null

  const record = input.id
    ? await updateSiteDocumentRecordById(String(input.id), {
        title,
        content,
        status,
        isPinned,
        publishedAt,
        type,
        sourceType,
        slug,
        linkUrl,
        titleColor,
        titleBold,
      })
    : await createSiteDocumentRecord({
        title,
        content,
        status,
        isPinned,
        publishedAt,
        createdBy: currentUser.id,
        type,
        sourceType,
        slug,
        linkUrl,
        titleColor,
        titleBold,
      })

  return mapSiteDocument(record)
}

export async function removeAdminSiteDocument(id: string) {
  const currentUser = await requireAdminUser()
  if (!currentUser) {
    apiError(403, "无权删除站点文档")
  }

  if (!id) {
    apiError(404, "站点文档不存在")
  }

  await deleteSiteDocumentRecordById(id)
}

export async function toggleAdminSiteDocumentPin(id: string, isPinned: boolean) {
  const currentUser = await requireAdminUser()
  if (!currentUser) {
    apiError(403, "无权更新站点文档")
  }

  if (!id) {
    apiError(404, "站点文档不存在")
  }

  const currentRecord = await findSiteDocumentById(id)
  if (!currentRecord) {
    apiError(404, "站点文档不存在")
  }

  const updated = await updateSiteDocumentRecordById(id, {
    title: currentRecord.title,
    content: currentRecord.content,
    status: currentRecord.status,
    isPinned,
    publishedAt: currentRecord.publishedAt,
    type: currentRecord.type as SiteDocumentType,
    sourceType: currentRecord.sourceType as SiteDocumentSourceType,
    slug: currentRecord.slug,
    linkUrl: currentRecord.linkUrl,
    titleColor: currentRecord.titleColor,
    titleBold: currentRecord.titleBold,
  })

  return mapSiteDocument(updated)
}

export async function updateAdminSiteDocumentStatus(id: string, status: string) {
  const currentUser = await requireAdminUser()
  if (!currentUser) {
    apiError(403, "无权更新站点文档")
  }

  if (!id) {
    apiError(404, "站点文档不存在")
  }

  const currentRecord = await findSiteDocumentById(id)
  if (!currentRecord) {
    apiError(404, "站点文档不存在")
  }

  const normalizedStatus = normalizeStatus(status)
  const publishedAt = normalizedStatus === AnnouncementStatus.PUBLISHED
    ? currentRecord.publishedAt ?? new Date()
    : normalizedStatus === AnnouncementStatus.DRAFT
      ? null
      : currentRecord.publishedAt

  const updated = await updateSiteDocumentRecordById(id, {
    title: currentRecord.title,
    content: currentRecord.content,
    status: normalizedStatus,
    isPinned: currentRecord.isPinned,
    publishedAt,
    type: currentRecord.type as SiteDocumentType,
    sourceType: currentRecord.sourceType as SiteDocumentSourceType,
    slug: currentRecord.slug,
    linkUrl: currentRecord.linkUrl,
    titleColor: currentRecord.titleColor,
    titleBold: currentRecord.titleBold,
  })

  return mapSiteDocument(updated)
}
