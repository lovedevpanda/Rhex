import type { AnnouncementStatus } from "@/db/types"

export const SITE_DOCUMENT_TYPES = ["ANNOUNCEMENT", "HELP"] as const
export const SITE_DOCUMENT_SOURCE_TYPES = ["DOCUMENT", "LINK"] as const

export type SiteDocumentType = (typeof SITE_DOCUMENT_TYPES)[number]
export type SiteDocumentSourceType = (typeof SITE_DOCUMENT_SOURCE_TYPES)[number]

export interface SiteDocumentTypeConfig {
  label: string
  collectionPath: string
  collectionTitle: string
}

export interface SiteDocumentRecordBase {
  id: string
  type: SiteDocumentType
  title: string
  content: string
  sourceType: SiteDocumentSourceType
  slug: string | null
  linkUrl: string | null
  titleColor: string | null
  titleBold: boolean
  status: AnnouncementStatus
  isPinned: boolean
  createdAt: string
  publishedAt: string | null
  publishedAtText: string
  creatorName: string
  href: string
  isExternal: boolean
}

export const SITE_DOCUMENT_TYPE_CONFIG: Record<SiteDocumentType, SiteDocumentTypeConfig> = {
  ANNOUNCEMENT: {
    label: "公告",
    collectionPath: "/announcements",
    collectionTitle: "站点文档",
  },
  HELP: {
    label: "帮助文档",
    collectionPath: "/help",
    collectionTitle: "帮助文档",
  },
}

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const ABSOLUTE_HTTP_URL_PATTERN = /^https?:\/\//i

export function isSiteDocumentType(value: unknown): value is SiteDocumentType {
  return typeof value === "string" && SITE_DOCUMENT_TYPES.includes(value as SiteDocumentType)
}

export function isSiteDocumentSourceType(value: unknown): value is SiteDocumentSourceType {
  return typeof value === "string" && SITE_DOCUMENT_SOURCE_TYPES.includes(value as SiteDocumentSourceType)
}

export function getSiteDocumentTypeLabel(type: SiteDocumentType) {
  return SITE_DOCUMENT_TYPE_CONFIG[type].label
}

export function getSiteDocumentSourceTypeLabel(sourceType: SiteDocumentSourceType) {
  return sourceType === "DOCUMENT" ? "文档" : "链接"
}

export function isExternalSiteDocumentHref(value: string) {
  return ABSOLUTE_HTTP_URL_PATTERN.test(value)
}

export function normalizeSiteDocumentTitleColor(value: unknown) {
  const normalized = String(value ?? "").trim()
  return HEX_COLOR_PATTERN.test(normalized) ? normalized : null
}

export function normalizeSiteDocumentLinkUrl(value: unknown) {
  const normalized = String(value ?? "").trim()
  if (!normalized) {
    return null
  }

  if (normalized.startsWith("/")) {
    return normalized
  }

  try {
    const parsed = new URL(normalized)
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

export function normalizeSiteDocumentSlug(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")

  if (!normalized) {
    return ""
  }

  const segments = normalized
    .split("/")
    .map((segment) => segment
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, ""))
    .filter(Boolean)

  return segments.join("/").slice(0, 160)
}

export function buildSiteDocumentHref(input: {
  type: SiteDocumentType
  sourceType: SiteDocumentSourceType
  slug?: string | null
  linkUrl?: string | null
  id?: string
}) {
  if (input.sourceType === "LINK") {
    return input.linkUrl?.trim() || SITE_DOCUMENT_TYPE_CONFIG[input.type].collectionPath
  }

  const basePath = SITE_DOCUMENT_TYPE_CONFIG[input.type].collectionPath
  if (input.slug) {
    return `${basePath}/${input.slug}`
  }

  if (input.type === "ANNOUNCEMENT" && input.id) {
    return `${basePath}#${input.id}`
  }

  return basePath
}
