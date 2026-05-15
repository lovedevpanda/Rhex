import { prisma } from "@/db/client"
import type { Prisma } from "@/db/types"
import { createAdminLogEntry } from "@/db/admin-log-queries"
import { formatDateTime } from "@/lib/formatters"
import { PublicRouteError } from "@/lib/public-route-error"
import { deleteStoredUploadFile } from "@/lib/upload"

export type AdminAttachmentReferenceFilter = "ALL" | "REFERENCED" | "ORPHAN"

export interface AdminAttachmentFilters {
  keyword?: string
  bucketType?: string
  referenceStatus?: string
  page?: number
  pageSize?: number
}

export interface AdminAttachmentItem {
  id: string
  userId: number
  userName: string
  userHandle: string
  bucketType: string
  originalName: string
  fileName: string
  fileExt: string
  mimeType: string
  fileSize: number
  fileHash: string | null
  storagePath: string
  urlPath: string
  createdAt: string
  createdAtText: string
  postAttachmentCount: number
  directReferenceCount: number
  referenceCount: number
  referenceStatus: "REFERENCED" | "ORPHAN"
  referenceSources: string[]
}

export interface AdminAttachmentManagementResult {
  filters: {
    keyword: string
    bucketType: string
    referenceStatus: AdminAttachmentReferenceFilter
  }
  summary: {
    total: number
    referenced: number
    orphan: number
    totalBytes: number
  }
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
  rows: AdminAttachmentItem[]
  bucketOptions: Array<{
    value: string
    label: string
    count: number
  }>
}

export interface AdminAttachmentCleanupResult {
  dryRun: boolean
  scanned: number
  deletedRecords: number
  deletedFiles: number
  retainedSharedFiles: number
  failed: number
  candidates: AdminAttachmentItem[]
}

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
const CLEANUP_DEFAULT_LIMIT = 100
const CLEANUP_MAX_LIMIT = 500

const uploadListSelect = {
  id: true,
  userId: true,
  bucketType: true,
  originalName: true,
  fileName: true,
  fileExt: true,
  mimeType: true,
  fileSize: true,
  fileHash: true,
  storagePath: true,
  urlPath: true,
  createdAt: true,
  user: {
    select: {
      username: true,
      nickname: true,
    },
  },
  _count: {
    select: {
      postAttachments: true,
    },
  },
} satisfies Prisma.UploadSelect

type UploadListRow = Prisma.UploadGetPayload<{ select: typeof uploadListSelect }>

interface UploadReferenceState {
  postAttachmentCount: number
  directReferenceCount: number
  sources: Set<string>
}

interface UploadScanResult {
  total: number
  rows: UploadListRow[]
}

function normalizePage(value: unknown) {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function normalizePageSize(value: unknown) {
  const pageSize = Number(value)
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    return DEFAULT_PAGE_SIZE
  }

  return Math.min(pageSize, MAX_PAGE_SIZE)
}

function normalizeCleanupLimit(value: unknown) {
  const limit = Number(value)
  if (!Number.isInteger(limit) || limit <= 0) {
    return CLEANUP_DEFAULT_LIMIT
  }

  return Math.min(limit, CLEANUP_MAX_LIMIT)
}

function normalizeReferenceFilter(value: unknown): AdminAttachmentReferenceFilter {
  return value === "REFERENCED" || value === "ORPHAN" ? value : "ALL"
}

function buildUploadWhere(filters: AdminAttachmentFilters): Prisma.UploadWhereInput {
  const keyword = filters.keyword?.trim() ?? ""
  const bucketType = filters.bucketType?.trim() ?? "ALL"

  return {
    ...(bucketType && bucketType !== "ALL" ? { bucketType } : {}),
    ...(keyword
      ? {
          OR: [
            { id: { contains: keyword, mode: "insensitive" } },
            { originalName: { contains: keyword, mode: "insensitive" } },
            { fileName: { contains: keyword, mode: "insensitive" } },
            { fileExt: { contains: keyword, mode: "insensitive" } },
            { mimeType: { contains: keyword, mode: "insensitive" } },
            { urlPath: { contains: keyword, mode: "insensitive" } },
            { storagePath: { contains: keyword, mode: "insensitive" } },
            { user: { username: { contains: keyword, mode: "insensitive" } } },
            { user: { nickname: { contains: keyword, mode: "insensitive" } } },
          ],
        }
      : {}),
  }
}

function buildPagination(total: number, requestedPage: number, requestedPageSize: number) {
  const pageSize = normalizePageSize(requestedPageSize)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, requestedPage), totalPages)

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
  }
}

function createReferenceStateMap(rows: UploadListRow[]) {
  return new Map<string, UploadReferenceState>(rows.map((row) => [
    row.id,
    {
      postAttachmentCount: row._count.postAttachments,
      directReferenceCount: 0,
      sources: row._count.postAttachments > 0 ? new Set(["帖子附件"]) : new Set<string>(),
    },
  ]))
}

function addReference(
  states: Map<string, UploadReferenceState>,
  uploadIds: string[],
  source: string,
) {
  for (const uploadId of uploadIds) {
    const state = states.get(uploadId)
    if (!state) {
      continue
    }

    state.directReferenceCount += 1
    state.sources.add(source)
  }
}

function matchExactPath(value: string | null | undefined, uploadIdsByUrlPath: Map<string, string[]>) {
  if (!value) {
    return []
  }

  return uploadIdsByUrlPath.get(value) ?? []
}

function matchContainedPaths(value: string | null | undefined, rows: UploadListRow[]) {
  if (!value) {
    return []
  }

  return rows.filter((row) => value.includes(row.urlPath) || value.includes(row.id)).map((row) => row.id)
}

function buildContainsOr(rows: UploadListRow[], field: string) {
  return rows.flatMap((row) => ([
    { [field]: { contains: row.urlPath } },
    { [field]: { contains: row.id } },
  ]))
}

export async function resolveUploadReferenceStates(rows: UploadListRow[]) {
  const states = createReferenceStateMap(rows)
  if (rows.length === 0) {
    return states
  }

  const urlPaths = Array.from(new Set(rows.map((row) => row.urlPath).filter(Boolean)))
  const uploadIdsByUrlPath = new Map<string, string[]>()
  for (const row of rows) {
    const existing = uploadIdsByUrlPath.get(row.urlPath) ?? []
    existing.push(row.id)
    uploadIdsByUrlPath.set(row.urlPath, existing)
  }

  const [
    users,
    boards,
    posts,
    appendices,
    comments,
    messages,
    friendLinks,
    badges,
    siteSettings,
    rssSources,
    announcements,
    boardApplications,
  ] = await Promise.all([
    prisma.user.findMany({ where: { avatarPath: { in: urlPaths } }, select: { avatarPath: true } }),
    prisma.board.findMany({ where: { OR: [{ iconPath: { in: urlPaths } }, { coverPath: { in: urlPaths } }] }, select: { iconPath: true, coverPath: true } }),
    prisma.post.findMany({
      where: { OR: [{ coverPath: { in: urlPaths } }, ...buildContainsOr(rows, "content"), ...buildContainsOr(rows, "appendedContent")] },
      select: { coverPath: true, content: true, appendedContent: true },
    }),
    prisma.postAppendix.findMany({ where: { OR: buildContainsOr(rows, "content") }, select: { content: true } }),
    prisma.comment.findMany({ where: { OR: buildContainsOr(rows, "content") }, select: { content: true } }),
    prisma.directMessage.findMany({ where: { OR: buildContainsOr(rows, "body") }, select: { body: true } }),
    prisma.friendLink.findMany({ where: { logoPath: { in: urlPaths } }, select: { logoPath: true } }),
    prisma.badge.findMany({ where: { OR: [{ iconPath: { in: urlPaths } }, { imageUrl: { in: urlPaths } }] }, select: { iconPath: true, imageUrl: true } }),
    prisma.siteSetting.findMany({
      where: {
        OR: [
          { siteLogoPath: { in: urlPaths } },
          ...buildContainsOr(rows, "appStateJson"),
          ...buildContainsOr(rows, "headerAppLinksJson"),
          ...buildContainsOr(rows, "footerLinksJson"),
          ...buildContainsOr(rows, "markdownEmojiMapJson"),
        ],
      },
      select: { siteLogoPath: true, appStateJson: true, headerAppLinksJson: true, footerLinksJson: true, markdownEmojiMapJson: true },
    }),
    prisma.rssSource.findMany({ where: { logoPath: { in: urlPaths } }, select: { logoPath: true } }),
    prisma.announcement.findMany({
      where: { OR: [...buildContainsOr(rows, "content"), { linkUrl: { in: urlPaths } }] },
      select: { content: true, linkUrl: true },
    }),
    prisma.boardApplication.findMany({ where: { OR: [{ icon: { in: urlPaths } }, ...buildContainsOr(rows, "icon")] }, select: { icon: true } }),
  ])

  for (const item of users) {
    addReference(states, matchExactPath(item.avatarPath, uploadIdsByUrlPath), "用户头像")
  }
  for (const item of boards) {
    addReference(states, matchExactPath(item.iconPath, uploadIdsByUrlPath), "节点图标")
    addReference(states, matchExactPath(item.coverPath, uploadIdsByUrlPath), "节点封面")
  }
  for (const item of posts) {
    addReference(states, matchExactPath(item.coverPath, uploadIdsByUrlPath), "帖子封面")
    addReference(states, matchContainedPaths(item.content, rows), "帖子内容")
    addReference(states, matchContainedPaths(item.appendedContent, rows), "帖子追加内容")
  }
  for (const item of appendices) {
    addReference(states, matchContainedPaths(item.content, rows), "帖子附加内容")
  }
  for (const item of comments) {
    addReference(states, matchContainedPaths(item.content, rows), "评论内容")
  }
  for (const item of messages) {
    addReference(states, matchContainedPaths(item.body, rows), "私信内容")
  }
  for (const item of friendLinks) {
    addReference(states, matchExactPath(item.logoPath, uploadIdsByUrlPath), "友情链接")
  }
  for (const item of badges) {
    addReference(states, matchExactPath(item.iconPath, uploadIdsByUrlPath), "勋章图标")
    addReference(states, matchExactPath(item.imageUrl, uploadIdsByUrlPath), "勋章图片")
  }
  for (const item of siteSettings) {
    addReference(states, matchExactPath(item.siteLogoPath, uploadIdsByUrlPath), "站点 Logo")
    addReference(states, matchContainedPaths(item.appStateJson, rows), "站点设置")
    addReference(states, matchContainedPaths(item.headerAppLinksJson, rows), "站点设置")
    addReference(states, matchContainedPaths(item.footerLinksJson, rows), "站点设置")
    addReference(states, matchContainedPaths(item.markdownEmojiMapJson, rows), "站点设置")
  }
  for (const item of rssSources) {
    addReference(states, matchExactPath(item.logoPath, uploadIdsByUrlPath), "RSS 源")
  }
  for (const item of announcements) {
    addReference(states, matchContainedPaths(item.content, rows), "站点文档")
    addReference(states, matchExactPath(item.linkUrl, uploadIdsByUrlPath), "站点文档链接")
  }
  for (const item of boardApplications) {
    addReference(states, matchExactPath(item.icon, uploadIdsByUrlPath), "节点申请")
    addReference(states, matchContainedPaths(item.icon, rows), "节点申请")
  }

  return states
}

function isReferenced(state: UploadReferenceState) {
  return state.postAttachmentCount + state.directReferenceCount > 0
}

function mapUploadItem(row: UploadListRow, state: UploadReferenceState): AdminAttachmentItem {
  const referenceCount = state.postAttachmentCount + state.directReferenceCount

  return {
    id: row.id,
    userId: row.userId,
    userName: row.user.nickname ?? row.user.username,
    userHandle: `@${row.user.username}`,
    bucketType: row.bucketType,
    originalName: row.originalName,
    fileName: row.fileName,
    fileExt: row.fileExt,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    fileHash: row.fileHash,
    storagePath: row.storagePath,
    urlPath: row.urlPath,
    createdAt: row.createdAt.toISOString(),
    createdAtText: formatDateTime(row.createdAt),
    postAttachmentCount: state.postAttachmentCount,
    directReferenceCount: state.directReferenceCount,
    referenceCount,
    referenceStatus: referenceCount > 0 ? "REFERENCED" : "ORPHAN",
    referenceSources: Array.from(state.sources),
  }
}

async function findUploadsMatchingReference(where: Prisma.UploadWhereInput, filter: AdminAttachmentReferenceFilter, options: {
  page: number
  pageSize: number
}): Promise<UploadScanResult> {
  if (filter === "ALL") {
    const total = await prisma.upload.count({ where })
    const pagination = buildPagination(total, options.page, options.pageSize)
    const rows = await prisma.upload.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      select: uploadListSelect,
    })

    return { total, rows }
  }

  const matchingRows: UploadListRow[] = []
  let total = 0
  let cursor: string | undefined
  const targetStart = (Math.max(1, options.page) - 1) * options.pageSize

  while (true) {
    const batch = await prisma.upload.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: 100,
      select: uploadListSelect,
    })

    if (batch.length === 0) {
      break
    }

    const states = await resolveUploadReferenceStates(batch)
    for (const row of batch) {
      const state = states.get(row.id)
      const referenced = state ? isReferenced(state) : false
      const matched = filter === "REFERENCED" ? referenced : !referenced

      if (!matched) {
        continue
      }

      if (total >= targetStart && matchingRows.length < options.pageSize) {
        matchingRows.push(row)
      }
      total += 1
    }

    cursor = batch[batch.length - 1]?.id
  }

  return { total, rows: matchingRows }
}

async function findOrphanUploads(where: Prisma.UploadWhereInput, limit: number) {
  const rows: UploadListRow[] = []
  let scanned = 0
  let cursor: string | undefined

  while (rows.length < limit) {
    const batch = await prisma.upload.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: 100,
      select: uploadListSelect,
    })

    if (batch.length === 0) {
      break
    }

    scanned += batch.length
    const states = await resolveUploadReferenceStates(batch)
    for (const row of batch) {
      const state = states.get(row.id)
      if (state && !isReferenced(state)) {
        rows.push(row)
      }
      if (rows.length >= limit) {
        break
      }
    }

    cursor = batch[batch.length - 1]?.id
  }

  return { scanned, rows }
}

export async function getAdminAttachmentManagement(filters: AdminAttachmentFilters = {}): Promise<AdminAttachmentManagementResult> {
  const where = buildUploadWhere(filters)
  const keyword = filters.keyword?.trim() ?? ""
  const bucketType = filters.bucketType?.trim() || "ALL"
  const referenceStatus = normalizeReferenceFilter(filters.referenceStatus)
  const page = normalizePage(filters.page)
  const pageSize = normalizePageSize(filters.pageSize)
  const [bucketGroups, aggregate, allFilteredUploads, scanResult] = await Promise.all([
    prisma.upload.groupBy({
      by: ["bucketType"],
      _count: { _all: true },
      orderBy: { bucketType: "asc" },
    }),
    prisma.upload.aggregate({ where, _sum: { fileSize: true } }),
    prisma.upload.findMany({ where, orderBy: { createdAt: "desc" }, select: uploadListSelect }),
    findUploadsMatchingReference(where, referenceStatus, { page, pageSize }),
  ])

  const allStates = await resolveUploadReferenceStates(allFilteredUploads)
  const referenced = allFilteredUploads.filter((row) => {
    const state = allStates.get(row.id)
    return state ? isReferenced(state) : false
  }).length
  const rowStates = await resolveUploadReferenceStates(scanResult.rows)
  const pagination = buildPagination(scanResult.total, page, pageSize)

  return {
    filters: {
      keyword,
      bucketType,
      referenceStatus,
    },
    summary: {
      total: allFilteredUploads.length,
      referenced,
      orphan: Math.max(0, allFilteredUploads.length - referenced),
      totalBytes: aggregate._sum.fileSize ?? 0,
    },
    pagination,
    rows: scanResult.rows.map((row) => mapUploadItem(row, rowStates.get(row.id) ?? {
      postAttachmentCount: row._count.postAttachments,
      directReferenceCount: 0,
      sources: new Set<string>(),
    })),
    bucketOptions: bucketGroups.map((item) => ({
      value: item.bucketType,
      label: item.bucketType,
      count: item._count._all,
    })),
  }
}

async function deleteUploadFileIfUnshared(row: UploadListRow, deletingIds: Set<string>) {
  const sharedCount = await prisma.upload.count({
    where: {
      storagePath: row.storagePath,
      id: { notIn: Array.from(deletingIds) },
    },
  })

  if (sharedCount > 0) {
    return "retained" as const
  }

  try {
    await deleteStoredUploadFile(row.storagePath)
    return "deleted" as const
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return "missing" as const
    }

    throw error
  }
}

export async function cleanupOrphanUploads(input: {
  dryRun?: boolean
  limit?: number
  bucketType?: string
  keyword?: string
  adminId?: number
  ip?: string | null
}): Promise<AdminAttachmentCleanupResult> {
  const limit = normalizeCleanupLimit(input.limit)
  const dryRun = input.dryRun !== false
  const where = buildUploadWhere({
    keyword: input.keyword,
    bucketType: input.bucketType,
  })
  const { scanned, rows } = await findOrphanUploads(where, limit)
  const states = await resolveUploadReferenceStates(rows)
  const candidates = rows.map((row) => mapUploadItem(row, states.get(row.id) ?? {
    postAttachmentCount: row._count.postAttachments,
    directReferenceCount: 0,
    sources: new Set<string>(),
  }))

  if (dryRun) {
    return {
      dryRun,
      scanned,
      deletedRecords: 0,
      deletedFiles: 0,
      retainedSharedFiles: 0,
      failed: 0,
      candidates,
    }
  }

  const deletingIds = new Set(rows.map((row) => row.id))
  let deletedRecords = 0
  let deletedFiles = 0
  let retainedSharedFiles = 0
  let failed = 0
  const deletedStoragePaths = new Set<string>()

  for (const row of rows) {
    const latest = await prisma.upload.findUnique({ where: { id: row.id }, select: uploadListSelect })
    if (!latest) {
      continue
    }

    const latestStates = await resolveUploadReferenceStates([latest])
    const latestState = latestStates.get(latest.id)
    if (latestState && isReferenced(latestState)) {
      failed += 1
      continue
    }

    try {
      if (!deletedStoragePaths.has(latest.storagePath)) {
        const result = await deleteUploadFileIfUnshared(latest, deletingIds)
        if (result === "retained") {
          retainedSharedFiles += 1
        } else {
          deletedFiles += 1
          deletedStoragePaths.add(latest.storagePath)
        }
      }

      await prisma.upload.delete({ where: { id: latest.id } })
      deletedRecords += 1
    } catch (error) {
      failed += 1
      console.error("[admin-attachments] failed to cleanup upload", latest.id, error)
    }
  }

  if (input.adminId) {
    await createAdminLogEntry({
      adminId: input.adminId,
      action: "attachments.cleanup-orphans",
      targetType: "Upload",
      targetId: "bulk",
      detail: `清理无引用资源：删除记录 ${deletedRecords} 条，删除文件 ${deletedFiles} 个，共扫描 ${scanned} 条`,
      ip: input.ip,
    })
  }

  return {
    dryRun,
    scanned,
    deletedRecords,
    deletedFiles,
    retainedSharedFiles,
    failed,
    candidates,
  }
}

export async function deleteOrphanUploadById(input: {
  uploadId: string
  adminId?: number
  ip?: string | null
}) {
  const upload = await prisma.upload.findUnique({ where: { id: input.uploadId }, select: uploadListSelect })
  if (!upload) {
    throw new PublicRouteError("附件记录不存在", 404)
  }

  const states = await resolveUploadReferenceStates([upload])
  const state = states.get(upload.id)
  if (state && isReferenced(state)) {
    throw new PublicRouteError("该资源仍被引用，不能删除")
  }

  const fileResult = await deleteUploadFileIfUnshared(upload, new Set([upload.id]))
  await prisma.upload.delete({ where: { id: upload.id } })

  if (input.adminId) {
    await createAdminLogEntry({
      adminId: input.adminId,
      action: "attachments.delete-orphan",
      targetType: "Upload",
      targetId: upload.id,
      detail: `删除无引用资源：${upload.originalName}（${fileResult === "retained" ? "共享文件保留" : "文件已删除"}）`,
      ip: input.ip,
    })
  }

  return {
    uploadId: upload.id,
    fileDeleted: fileResult !== "retained",
  }
}
