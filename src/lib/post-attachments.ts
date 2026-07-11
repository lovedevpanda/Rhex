import path from "node:path"
import { randomUUID } from "node:crypto"

import type { Prisma } from "@/db/types"

import { prisma } from "@/db/client"
import {
  createPostAttachment,
  createPostAttachmentPurchase,
  deletePostAttachmentsByIds,
  findAttachmentPurchaseUserById,
  findPostAttachmentById,
  findPostAttachmentsByPostId,
  findPurchasedPostAttachmentPurchase,
  listPurchasedPostAttachmentPurchases,
  postAttachmentSelect,
  updatePostAttachment,
} from "@/db/post-attachment-queries"
import { findUploadsByIdsForUser } from "@/db/upload-queries"
import { canAdminActorManageBoardWithPermission } from "@/lib/admin-scope-permissions"
import { apiError } from "@/lib/api-route"
import { countUserRepliesByPostId } from "@/db/comment-queries"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { POINT_LOG_EVENT_TYPES } from "@/lib/point-log-events"
import { getSiteSettings, type SiteSettingsData } from "@/lib/site-settings"
import { isPublicReadablePostStatus } from "@/lib/post-types"
import { isHttpUrl } from "@/lib/shared/url"
import { isVipActive, type VipStateSource } from "@/lib/vip-status"
import { resolveAdminActorFromSessionUser } from "@/lib/moderator-permissions"
import { normalizeUploadExtension } from "@/lib/upload-rules"

export const DEFAULT_ATTACHMENT_ALLOWED_EXTENSIONS = ["zip", "rar", "7z", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"] as const
export const MAX_POST_ATTACHMENTS = 20

type UploadRecord = Awaited<ReturnType<typeof findUploadsByIdsForUser>>[number]
type PostAttachmentRecord = Prisma.PostAttachmentGetPayload<{ select: typeof postAttachmentSelect }>
type PostAttachmentActionRecord = NonNullable<Awaited<ReturnType<typeof findPostAttachmentById>>>

export interface PostAttachmentDraftPayload {
  id?: string
  sourceType?: string
  uploadId?: string
  name?: string
  externalUrl?: string
  externalCode?: string
  minDownloadLevel?: number | string
  minDownloadVipLevel?: number | string
  pointsCost?: number | string
  requireReplyUnlock?: boolean
}

export interface NormalizedPostAttachmentInput {
  id?: string
  sourceType: "UPLOAD" | "EXTERNAL_LINK"
  uploadId: string | null
  name: string
  fileExt: string | null
  mimeType: string | null
  fileSize: number | null
  externalUrl: string | null
  externalCode: string | null
  minDownloadLevel: number
  minDownloadVipLevel: number
  pointsCost: number
  requireReplyUnlock: boolean
  sortOrder: number
}

export interface AttachmentViewerState {
  requirementLabels: string[]
  canDownload: boolean
  canPurchase: boolean
  hasPurchasedAccess: boolean
  blockedReason: string
}

interface AttachmentViewerInput extends VipStateSource {
  id?: number | null
  level?: number | null
  role?: string | null
}

export interface PostAttachmentUploadPermissionState {
  canBypassPermission: boolean
  canAddAttachments: boolean
  currentLevel: number
  currentVipLevel: number
}

function normalizeNonNegativeInteger(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

function normalizeBoolean(value: unknown) {
  return value === true || value === "true" || value === "1" || value === 1
}

function normalizeAttachmentSourceType(value: unknown): "UPLOAD" | "EXTERNAL_LINK" {
  return value === "EXTERNAL_LINK" ? "EXTERNAL_LINK" : "UPLOAD"
}

function normalizeAttachmentExtension(value?: string | null) {
  return String(value ?? "").trim().toLowerCase().replace(/^\./, "")
}

function getCurrentVipLevel(user: VipStateSource | null | undefined) {
  return isVipActive(user) ? Math.max(0, user?.vipLevel ?? 0) : 0
}

export function resolvePostAttachmentUploadPermission(params: {
  settings: Pick<SiteSettingsData, "attachmentMinUploadLevel" | "attachmentMinUploadVipLevel">
  user: AttachmentViewerInput | null | undefined
}): PostAttachmentUploadPermissionState {
  const currentLevel = Math.max(0, params.user?.level ?? 0)
  const currentVipLevel = getCurrentVipLevel(params.user)
  const canBypassPermission = params.user?.role === "ADMIN"
  const canAddAttachments = canBypassPermission || (
    currentLevel >= params.settings.attachmentMinUploadLevel
    && currentVipLevel >= params.settings.attachmentMinUploadVipLevel
  )

  return {
    canBypassPermission,
    canAddAttachments,
    currentLevel,
    currentVipLevel,
  }
}

function deriveExternalAttachmentName(externalUrl: string, fallbackIndex: number) {
  try {
    const parsedUrl = new URL(externalUrl)
    const lastSegment = parsedUrl.pathname.split("/").filter(Boolean).at(-1) ?? ""
    const decodedName = lastSegment ? decodeURIComponent(lastSegment) : ""
    return decodedName || parsedUrl.hostname || `外部附件 ${fallbackIndex + 1}`
  } catch {
    return `外部附件 ${fallbackIndex + 1}`
  }
}

function getExtensionFromExternalUrl(externalUrl: string) {
  try {
    const parsedUrl = new URL(externalUrl)
    return normalizeAttachmentExtension(path.extname(parsedUrl.pathname))
  } catch {
    return normalizeUploadExtension(externalUrl)
  }
}

function assertHttpUrl(value: string, message: string) {
  if (!isHttpUrl(value)) {
    apiError(400, message)
  }
}

function buildAttachmentPermissionDeniedMessage(settings: Pick<SiteSettingsData, "attachmentMinUploadLevel" | "attachmentMinUploadVipLevel">, currentLevel: number, currentVipLevel: number) {
  if (currentVipLevel < settings.attachmentMinUploadVipLevel && settings.attachmentMinUploadVipLevel > 0) {
    return `当前账号至少需要 VIP${settings.attachmentMinUploadVipLevel} 才能添加帖子附件`
  }

  if (currentLevel < settings.attachmentMinUploadLevel && settings.attachmentMinUploadLevel > 0) {
    return `当前账号至少需要达到 Lv.${settings.attachmentMinUploadLevel} 才能添加帖子附件`
  }

  return "当前账号暂不具备添加帖子附件的权限"
}

function buildRequirementLabels(params: {
  attachment: Pick<NormalizedPostAttachmentInput | PostAttachmentRecord, "minDownloadLevel" | "minDownloadVipLevel" | "pointsCost" | "requireReplyUnlock">
  pointName: string
}) {
  const labels: string[] = []

  if (params.attachment.minDownloadLevel > 0) {
    labels.push(`Lv.${params.attachment.minDownloadLevel}`)
  }

  if (params.attachment.minDownloadVipLevel > 0) {
    labels.push(`VIP${params.attachment.minDownloadVipLevel}`)
  }

  if (params.attachment.pointsCost > 0) {
    labels.push(`${params.attachment.pointsCost} ${params.pointName}`)
  }

  if (params.attachment.requireReplyUnlock) {
    labels.push("回复可下")
  }

  return labels.length > 0 ? labels : ["公开下载"]
}

export function resolveAttachmentViewerState(params: {
  attachment: Pick<NormalizedPostAttachmentInput | PostAttachmentRecord, "minDownloadLevel" | "minDownloadVipLevel" | "pointsCost" | "requireReplyUnlock">
  pointName: string
  siteEnabled: boolean
  viewer?: AttachmentViewerInput | null
  userReplyCount?: number
  hasPurchasedAccess?: boolean
  isOwnerOrAdmin?: boolean
}): AttachmentViewerState {
  const requirementLabels = buildRequirementLabels({
    attachment: params.attachment,
    pointName: params.pointName,
  })

  if (params.isOwnerOrAdmin) {
    return {
      requirementLabels,
      canDownload: true,
      canPurchase: false,
      hasPurchasedAccess: true,
      blockedReason: "",
    }
  }

  if (!params.siteEnabled) {
    return {
      requirementLabels,
      canDownload: false,
      canPurchase: false,
      hasPurchasedAccess: Boolean(params.hasPurchasedAccess),
      blockedReason: "附件下载功能暂未开放",
    }
  }

  const viewerLevel = Math.max(0, params.viewer?.level ?? 0)
  const viewerVipLevel = getCurrentVipLevel(params.viewer)

  if (params.attachment.minDownloadVipLevel > 0 && viewerVipLevel < params.attachment.minDownloadVipLevel) {
    return {
      requirementLabels,
      canDownload: false,
      canPurchase: false,
      hasPurchasedAccess: Boolean(params.hasPurchasedAccess),
      blockedReason: `下载需达到 VIP${params.attachment.minDownloadVipLevel}`,
    }
  }

  if (viewerLevel < params.attachment.minDownloadLevel) {
    return {
      requirementLabels,
      canDownload: false,
      canPurchase: false,
      hasPurchasedAccess: Boolean(params.hasPurchasedAccess),
      blockedReason: `下载需达到 Lv.${params.attachment.minDownloadLevel}`,
    }
  }

  if (params.attachment.requireReplyUnlock && (params.userReplyCount ?? 0) < 1) {
    return {
      requirementLabels,
      canDownload: false,
      canPurchase: false,
      hasPurchasedAccess: Boolean(params.hasPurchasedAccess),
      blockedReason: params.viewer?.id ? "回复本帖后可下载" : "登录并回复本帖后可下载",
    }
  }

  if (params.attachment.pointsCost > 0 && !params.hasPurchasedAccess) {
    return {
      requirementLabels,
      canDownload: false,
      canPurchase: Boolean(params.viewer?.id),
      hasPurchasedAccess: false,
      blockedReason: params.viewer?.id ? "" : `登录后可支付 ${params.attachment.pointsCost} ${params.pointName} 获取下载权限`,
    }
  }

  return {
    requirementLabels,
    canDownload: true,
    canPurchase: false,
    hasPurchasedAccess: Boolean(params.hasPurchasedAccess),
    blockedReason: "",
  }
}

function resolveAttachmentSettings(settings: SiteSettingsData) {
  return {
    attachmentUploadEnabled: settings.attachmentUploadEnabled,
    attachmentDownloadEnabled: settings.attachmentDownloadEnabled,
    attachmentMinUploadLevel: settings.attachmentMinUploadLevel,
    attachmentMinUploadVipLevel: settings.attachmentMinUploadVipLevel,
    attachmentAllowedExtensions: settings.attachmentAllowedExtensions,
    attachmentMaxFileSizeMb: settings.attachmentMaxFileSizeMb,
  }
}

function isSiteDownloadEnabledForAttachment(
  attachment: Pick<NormalizedPostAttachmentInput | PostAttachmentRecord, "sourceType">,
  settings: Pick<SiteSettingsData, "attachmentDownloadEnabled">,
) {
  return attachment.sourceType === "EXTERNAL_LINK" ? true : settings.attachmentDownloadEnabled
}

export async function normalizePostAttachmentInputs(
  rawAttachments: unknown,
  options: {
    settings: SiteSettingsData
    user: AttachmentViewerInput & { id: number }
    uploadOwnerUserIds?: number[]
    allowedExistingAttachmentIds?: string[]
    tx?: Prisma.TransactionClient
    skipFeatureEnabledCheck?: boolean
    skipUploadPermissionCheck?: boolean
  },
): Promise<NormalizedPostAttachmentInput[]> {
  if (rawAttachments === undefined || rawAttachments === null) {
    return []
  }

  if (!Array.isArray(rawAttachments)) {
    apiError(400, "附件参数格式不正确")
  }

  if (rawAttachments.length > MAX_POST_ATTACHMENTS) {
    apiError(400, `单个帖子最多添加 ${MAX_POST_ATTACHMENTS} 个附件`)
  }

  const settings = resolveAttachmentSettings(options.settings)
  const uploadPermission = resolvePostAttachmentUploadPermission({
    settings,
    user: options.user,
  })
  const attachmentDrafts = rawAttachments.map((item) => (item && typeof item === "object" && !Array.isArray(item) ? item as PostAttachmentDraftPayload : null))

  if (attachmentDrafts.some((item) => item === null)) {
    apiError(400, "附件参数格式不正确")
  }

  const normalizedAttachmentDrafts = attachmentDrafts as PostAttachmentDraftPayload[]
  const existingAttachmentIds = new Set(
    (options.allowedExistingAttachmentIds ?? [])
      .map((item) => String(item ?? "").trim())
      .filter(Boolean),
  )
  const hasNewAttachment = normalizedAttachmentDrafts.some((item) => {
    const existingId = String(item?.id ?? "").trim()
    return !existingId || !existingAttachmentIds.has(existingId)
  })
  const hasNewUploadAttachment = normalizedAttachmentDrafts.some((item) => {
    if (normalizeAttachmentSourceType(item?.sourceType) !== "UPLOAD") {
      return false
    }

    const existingId = String(item?.id ?? "").trim()
    return !existingId || !existingAttachmentIds.has(existingId)
  })

  if (
    !options.skipFeatureEnabledCheck
    && !settings.attachmentUploadEnabled
    && hasNewUploadAttachment
    && !uploadPermission.canBypassPermission
  ) {
    apiError(403, "当前站点未开启附件上传功能")
  }

  if (
    !options.skipUploadPermissionCheck
    && !uploadPermission.canAddAttachments
    && hasNewAttachment
  ) {
    apiError(403, buildAttachmentPermissionDeniedMessage(settings, uploadPermission.currentLevel, uploadPermission.currentVipLevel))
  }

  const uploadIds = Array.from(new Set(
    normalizedAttachmentDrafts
      .map((item) => String(item?.uploadId ?? "").trim())
      .filter(Boolean),
  ))
  const uploadOwnerUserIds = Array.from(new Set((options.uploadOwnerUserIds?.length ? options.uploadOwnerUserIds : [options.user.id]).filter((item): item is number => Number.isInteger(item) && item > 0)))
  const ownedUploads = (await Promise.all(uploadOwnerUserIds.map((ownerUserId) => findUploadsByIdsForUser(ownerUserId, uploadIds, options.tx)))).flat()
  const uploadMap = new Map<string, UploadRecord>(ownedUploads.map((item) => [item.id, item]))

  if (ownedUploads.length !== uploadIds.length) {
    apiError(400, "存在无效的附件上传记录，请重新上传后再试")
  }

  const allowedExtensions = new Set(settings.attachmentAllowedExtensions.map((item) => normalizeAttachmentExtension(item)))
  const maxFileSizeBytes = Math.max(1, settings.attachmentMaxFileSizeMb) * 1024 * 1024

  return normalizedAttachmentDrafts.map((draft, index) => {
    const sourceType = normalizeAttachmentSourceType(draft?.sourceType)
    const existingId = String(draft?.id ?? "").trim() || undefined
    const minDownloadLevel = normalizeNonNegativeInteger(draft?.minDownloadLevel, 0)
    const minDownloadVipLevel = normalizeNonNegativeInteger(draft?.minDownloadVipLevel, 0)
    const pointsCost = normalizeNonNegativeInteger(draft?.pointsCost, 0)
    const requireReplyUnlock = normalizeBoolean(draft?.requireReplyUnlock)

    if (minDownloadLevel > 999 || minDownloadVipLevel > 999) {
      apiError(400, "附件下载等级门槛不能超过 999")
    }

    if (pointsCost > 100000) {
      apiError(400, `附件购买价格不能超过 100000 ${options.settings.pointName}`)
    }

    if (sourceType === "UPLOAD") {
      const uploadId = String(draft?.uploadId ?? "").trim()
      const upload = uploadMap.get(uploadId)

      if (!upload) {
        apiError(400, "存在未完成上传的附件，请重新上传后再试")
      }

      const normalizedExt = normalizeAttachmentExtension(upload.fileExt || upload.originalName)
      if (!normalizedExt || !allowedExtensions.has(normalizedExt)) {
        apiError(400, `附件 ${upload.originalName} 的格式不在允许范围内`)
      }

      if (upload.fileSize > maxFileSizeBytes) {
        apiError(400, `附件 ${upload.originalName} 超过 ${settings.attachmentMaxFileSizeMb}MB 限制`)
      }

      return {
        id: existingId,
        sourceType,
        uploadId,
        name: upload.originalName,
        fileExt: normalizedExt || null,
        mimeType: upload.mimeType || null,
        fileSize: upload.fileSize ?? null,
        externalUrl: null,
        externalCode: null,
        minDownloadLevel,
        minDownloadVipLevel,
        pointsCost,
        requireReplyUnlock,
        sortOrder: index,
      }
    }

    const externalUrl = String(draft?.externalUrl ?? "").trim()
    const externalCode = String(draft?.externalCode ?? "").trim()
    const name = String(draft?.name ?? "").trim() || deriveExternalAttachmentName(externalUrl, index)
    const fileExt = normalizeAttachmentExtension(path.extname(name)) || getExtensionFromExternalUrl(externalUrl)

    if (!externalUrl) {
      apiError(400, "请填写第三方附件链接")
    }

    assertHttpUrl(externalUrl, "第三方附件链接仅支持 http 或 https 地址")

    if (name.length > 200) {
      apiError(400, "附件名称不能超过 200 个字符")
    }

    if (externalUrl.length > 2000) {
      apiError(400, "第三方附件链接不能超过 2000 个字符")
    }

    if (externalCode.length > 100) {
      apiError(400, "提取码不能超过 100 个字符")
    }

    return {
      id: existingId,
      sourceType,
      uploadId: null,
      name,
      fileExt: fileExt || null,
      mimeType: null,
      fileSize: null,
      externalUrl,
      externalCode: externalCode || null,
      minDownloadLevel,
      minDownloadVipLevel,
      pointsCost,
      requireReplyUnlock,
      sortOrder: index,
    }
  })
}

export async function syncPostAttachments(
  tx: Prisma.TransactionClient,
  params: {
    postId: string
    attachments: NormalizedPostAttachmentInput[]
  },
) {
  const existingAttachments = await findPostAttachmentsByPostId(params.postId, tx)
  const existingById = new Map(existingAttachments.map((item) => [item.id, item]))
  const seenIds = new Set<string>()
  const retainedIds = new Set<string>()

  for (const attachment of params.attachments) {
    if (attachment.id) {
      if (seenIds.has(attachment.id)) {
        apiError(400, "附件列表中存在重复项，请刷新后重试")
      }

      seenIds.add(attachment.id)
      const existing = existingById.get(attachment.id)
      if (!existing) {
        apiError(400, "附件信息已过期，请刷新页面后重试")
      }

      retainedIds.add(existing.id)
      await updatePostAttachment(existing.id, {
        uploadId: attachment.uploadId,
        sourceType: attachment.sourceType,
        name: attachment.name,
        fileExt: attachment.fileExt,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
        externalUrl: attachment.externalUrl,
        externalCode: attachment.externalCode,
        minDownloadLevel: attachment.minDownloadLevel,
        minDownloadVipLevel: attachment.minDownloadVipLevel,
        pointsCost: attachment.pointsCost,
        requireReplyUnlock: attachment.requireReplyUnlock,
        sortOrder: attachment.sortOrder,
      }, tx)
      continue
    }

    await createPostAttachment({
      postId: params.postId,
      uploadId: attachment.uploadId,
      sourceType: attachment.sourceType,
      name: attachment.name,
      fileExt: attachment.fileExt,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      externalUrl: attachment.externalUrl,
      externalCode: attachment.externalCode,
      minDownloadLevel: attachment.minDownloadLevel,
      minDownloadVipLevel: attachment.minDownloadVipLevel,
      pointsCost: attachment.pointsCost,
      requireReplyUnlock: attachment.requireReplyUnlock,
      sortOrder: attachment.sortOrder,
    }, tx)
  }

  const deleteIds = existingAttachments
    .filter((item) => !retainedIds.has(item.id))
    .map((item) => item.id)

  await deletePostAttachmentsByIds(deleteIds, tx)
}

export async function getPurchasedPostAttachmentIds(postId: string, userId?: number) {
  if (!userId) {
    return new Set<string>()
  }

  const purchases = await listPurchasedPostAttachmentPurchases(postId, userId)

  return new Set(
    purchases
      .map((item) => item.attachmentId)
      .filter(Boolean),
  )
}

interface AttachmentAccessContext {
  settings: SiteSettingsData
  attachment: PostAttachmentActionRecord
  hasPurchasedAccess: boolean
  userReplyCount: number
  viewerState: AttachmentViewerState
  isOwnerOrAdmin: boolean
}

async function canManageAttachmentPost(currentUser: AttachmentViewerInput, attachment: PostAttachmentActionRecord) {
  if (currentUser.role !== "ADMIN" && currentUser.role !== "MODERATOR") {
    return false
  }

  const adminActor = await resolveAdminActorFromSessionUser({
    id: currentUser.id ?? 0,
    username: "",
    nickname: null,
    role: currentUser.role,
    status: "ACTIVE",
  })

  return Boolean(
    adminActor
    && await canAdminActorManageBoardWithPermission(
      adminActor,
      "admin.content.manage",
      attachment.post.boardId,
      attachment.post.board.zoneId,
    ),
  )
}

async function loadAttachmentAccessContext(params: {
  attachmentId: string
  currentUser?: AttachmentViewerInput | null
}) {
  const [settings, attachment] = await Promise.all([
    getSiteSettings(),
    findPostAttachmentById(params.attachmentId),
  ])

  if (!attachment) {
    apiError(404, "附件不存在")
  }

  const isOwnerOrAdmin = Boolean(
    params.currentUser?.id
    && (
      params.currentUser.id === attachment.post.authorId
      || await canManageAttachmentPost(params.currentUser, attachment)
    ),
  )

  if (!isPublicReadablePostStatus(attachment.post.status) && !isOwnerOrAdmin) {
    apiError(404, "附件当前不可访问")
  }

  const [purchase, userReplyCount] = await Promise.all([
    params.currentUser?.id
      ? findPurchasedPostAttachmentPurchase({
          userId: params.currentUser.id,
          attachmentId: attachment.id,
        })
      : Promise.resolve(null),
    params.currentUser?.id
      ? countUserRepliesByPostId(attachment.postId, params.currentUser.id)
      : Promise.resolve(0),
  ])

  const viewerState = resolveAttachmentViewerState({
    attachment,
    pointName: settings.pointName,
    siteEnabled: isSiteDownloadEnabledForAttachment(attachment, settings),
    viewer: params.currentUser,
    userReplyCount,
    hasPurchasedAccess: Boolean(purchase),
    isOwnerOrAdmin,
  })

  return {
    settings,
    attachment,
    hasPurchasedAccess: Boolean(purchase),
    userReplyCount,
    viewerState,
    isOwnerOrAdmin,
  } satisfies AttachmentAccessContext
}

export async function requireAccessiblePostAttachment(params: {
  attachmentId: string
  currentUser?: AttachmentViewerInput | null
}) {
  const context = await loadAttachmentAccessContext(params)

  if (!context.viewerState.canDownload) {
    apiError(403, context.viewerState.blockedReason || "当前无权下载该附件")
  }

  return context
}

export async function revealExternalPostAttachment(params: {
  attachmentId: string
  currentUser?: AttachmentViewerInput | null
}) {
  const context = await requireAccessiblePostAttachment(params)

  if (context.attachment.sourceType !== "EXTERNAL_LINK" || !context.attachment.externalUrl) {
    apiError(400, "当前附件不是第三方链接类型")
  }

  return {
    settings: context.settings,
    attachment: context.attachment,
  }
}

function buildAttachmentPurchaseReason(attachmentName: string, price: number, pointName: string) {
  return `购买附件下载权限（${attachmentName}，${price}${pointName}）`
}

export async function purchasePostAttachment(input: {
  userId: number
  attachmentId: string
}) {
  const settings = await getSiteSettings()

  return prisma.$transaction(async (tx) => {
    const attachment = await findPostAttachmentById(input.attachmentId, tx)

    if (!attachment || !isPublicReadablePostStatus(attachment.post.status)) {
      apiError(404, "附件不存在或当前不可购买")
    }

    if (attachment.pointsCost <= 0) {
      apiError(400, "当前附件不支持积分购买")
    }

    if (attachment.post.authorId === input.userId) {
      apiError(400, "作者无需购买自己的附件")
    }

    const existingPurchase = await findPurchasedPostAttachmentPurchase({
      userId: input.userId,
      attachmentId: attachment.id,
    }, tx)

    if (existingPurchase) {
      return { alreadyOwned: true }
    }

    const [buyer, seller, userReplyCount] = await Promise.all([
      findAttachmentPurchaseUserById(input.userId, tx),
      findAttachmentPurchaseUserById(attachment.post.authorId, tx),
      tx.comment.count({
        where: {
          postId: attachment.postId,
          userId: input.userId,
          status: "NORMAL",
        },
      }),
    ])

    if (!buyer || !seller) {
      apiError(404, "当前用户不存在")
    }

    const viewerState = resolveAttachmentViewerState({
      attachment,
      pointName: settings.pointName,
      siteEnabled: isSiteDownloadEnabledForAttachment(attachment, settings),
      viewer: buyer,
      userReplyCount,
      hasPurchasedAccess: false,
      isOwnerOrAdmin: false,
    })

    if (!viewerState.canPurchase) {
      apiError(403, viewerState.blockedReason || "当前无权购买该附件")
    }

    const buyerPreparedDelta = await prepareScopedPointDelta({
      scopeKey: "POST_UNLOCK_OUTGOING",
      baseDelta: -attachment.pointsCost,
      userId: input.userId,
    })
    const sellerPreparedDelta = await prepareScopedPointDelta({
      scopeKey: "POST_UNLOCK_INCOMING",
      baseDelta: attachment.pointsCost,
      userId: attachment.post.authorId,
    })

    const purchaseInsert = await createPostAttachmentPurchase({
      id: `pap_${randomUUID()}`,
      postId: attachment.postId,
      attachmentId: attachment.id,
      buyerId: input.userId,
      sellerId: attachment.post.authorId,
      pointsCost: attachment.pointsCost,
    }, tx)

    if (purchaseInsert.count === 0) {
      return { alreadyOwned: true }
    }

    await applyPointDelta({
      tx,
      userId: input.userId,
      beforeBalance: buyer.points,
      prepared: buyerPreparedDelta,
      pointName: settings.pointName,
      insufficientMessage: `当前${settings.pointName}不足`,
      reason: buildAttachmentPurchaseReason(attachment.name, attachment.pointsCost, settings.pointName),
      eventType: POINT_LOG_EVENT_TYPES.POST_ATTACHMENT_PURCHASE_PAID,
      eventData: {
        postId: attachment.postId,
        attachmentId: attachment.id,
        buyerId: input.userId,
        sellerId: attachment.post.authorId,
        configuredPrice: attachment.pointsCost,
        appliedFinalDelta: buyerPreparedDelta.finalDelta,
      },
      relatedType: "POST",
      relatedId: attachment.postId,
    })

    await applyPointDelta({
      tx,
      userId: attachment.post.authorId,
      beforeBalance: seller.points,
      prepared: sellerPreparedDelta,
      pointName: settings.pointName,
      reason: "帖子附件被购买",
      eventType: POINT_LOG_EVENT_TYPES.POST_ATTACHMENT_PURCHASE_SOLD,
      eventData: {
        postId: attachment.postId,
        attachmentId: attachment.id,
        buyerId: input.userId,
        sellerId: attachment.post.authorId,
        configuredPrice: attachment.pointsCost,
        appliedFinalDelta: sellerPreparedDelta.finalDelta,
      },
      relatedType: "POST",
      relatedId: attachment.postId,
    })

    return {
      alreadyOwned: false,
      attachment,
    }
  })
}
