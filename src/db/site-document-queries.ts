import { AnnouncementStatus, Prisma, SiteDocumentSourceType, SiteDocumentType } from "@/db/types"

import { prisma } from "@/db/client"

export const siteDocumentInclude = {
  creator: {
    select: {
      username: true,
      nickname: true,
    },
  },
} satisfies Prisma.AnnouncementInclude

export type SiteDocumentRow = Prisma.AnnouncementGetPayload<{
  include: typeof siteDocumentInclude
}>

interface SiteDocumentMutationInput {
  title: string
  content: string
  status: AnnouncementStatus
  isPinned: boolean
  publishedAt: Date | null
  type: SiteDocumentType
  sourceType: SiteDocumentSourceType
  slug: string | null
  linkUrl: string | null
  titleColor: string | null
  titleBold: boolean
}

function buildWhereClause(options: {
  id?: string
  type?: SiteDocumentType
  slug?: string
  publishedOnly?: boolean
}): Prisma.AnnouncementWhereInput {
  return {
    ...(options.id ? { id: options.id } : {}),
    ...(options.type ? { type: options.type } : {}),
    ...(options.slug ? { slug: options.slug } : {}),
    ...(options.publishedOnly ? { status: AnnouncementStatus.PUBLISHED } : {}),
  }
}

async function findSiteDocuments(options: {
  id?: string
  type?: SiteDocumentType
  slug?: string
  publishedOnly?: boolean
  limit?: number
}) {
  return prisma.announcement.findMany({
    where: buildWhereClause(options),
    orderBy: [
      { isPinned: "desc" },
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
    take: typeof options.limit === "number" ? options.limit : undefined,
    include: siteDocumentInclude,
  })
}

export function findPublishedSiteDocuments(type: SiteDocumentType, limit?: number) {
  return findSiteDocuments({
    type,
    publishedOnly: true,
    limit,
  })
}

export async function findSiteDocumentById(id: string) {
  const record = await prisma.announcement.findUnique({
    where: { id },
    include: siteDocumentInclude,
  })

  return record ?? null
}

export async function findPublishedSiteDocumentByTypeAndSlug(type: SiteDocumentType, slug: string) {
  const [item] = await findSiteDocuments({
    type,
    slug,
    publishedOnly: true,
    limit: 1,
  })

  return item ?? null
}

export function findAdminSiteDocuments() {
  return findSiteDocuments({})
}

export function createSiteDocumentRecord(data: SiteDocumentMutationInput & { createdBy: number }) {
  return prisma.announcement.create({
    data,
    include: siteDocumentInclude,
  })
}

export function updateSiteDocumentRecordById(id: string, data: SiteDocumentMutationInput) {
  return prisma.announcement.update({
    where: { id },
    data,
    include: siteDocumentInclude,
  })
}

export function deleteSiteDocumentRecordById(id: string) {
  return prisma.announcement.delete({ where: { id } })
}

export async function findSiteDocumentSlugsByBase(type: SiteDocumentType, baseSlug: string, excludeId?: string) {
  const rows = await prisma.announcement.findMany({
    where: {
      type,
      slug: {
        not: null,
        startsWith: baseSlug,
      },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      slug: true,
    },
  })

  return rows
    .map((item) => item.slug)
    .filter((slug): slug is string => typeof slug === "string" && (slug === baseSlug || slug.startsWith(`${baseSlug}-`)))
}
