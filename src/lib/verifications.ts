import {
  createUserVerificationApplication,
  findApprovedUserVerification,
  findApprovedUserVerificationByTypeAndUsername,
  findActiveVerificationTypeBySlug,
  findLatestUserVerificationApplication,
  findVerificationTypeById,
  listActiveVerificationTypes,
  listUserVerificationApplications,
  lockUserVerificationState,
} from "@/db/verification-queries"
import { prisma } from "@/db/client"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-route"
import { enforceSensitiveText } from "@/lib/content-safety"
import { isSvgMarkup } from "@/lib/icon-source"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { POINT_LOG_EVENT_TYPES } from "@/lib/point-log-events"
import { getSiteSettings } from "@/lib/site-settings"
import { revalidateUserProfileMutation } from "@/lib/user-profile-revalidation"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { getUserAvatarPath, getUserDisplayName } from "@/lib/user-display"
import { parseVerificationFormSchema, type VerificationFormField } from "@/lib/verification-form-schema"
export type { VerificationFieldType, VerificationFormField } from "@/lib/verification-form-schema"

export type VerificationBadgeView = {
  id: string
  slug: string
  name: string
  iconText: string
  customIconText?: string | null
  color: string
  description?: string | null
  customDescription?: string | null
}

export type UserVerificationView = {
  id: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  submittedAt: string
  reviewedAt?: string | null
  rejectReason?: string | null
  note?: string | null
  content?: string | null
  customIconText?: string | null
  customDescription?: string | null
  formResponse?: Record<string, string>
  type: VerificationBadgeView
}

export type VerificationTypeListItem = {
  id: string
  name: string
  slug: string
  description?: string | null
  iconText: string
  color: string
  sortOrder: number
  status: boolean
  userLimit: number
  pointsCost: number
  allowResubmitAfterReject: boolean
  formFields: VerificationFormField[]
  currentApplication?: UserVerificationView | null
}

export type VerificationTypeDetail = {
  id: string
  name: string
  slug: string
  description?: string | null
  iconText: string
  color: string
  sortOrder: number
  status: boolean
  userLimit: number
  pointsCost: number
  allowResubmitAfterReject: boolean
  needRemark: boolean
  formFields: VerificationFormField[]
  approvedUserCount: number
  createdAt: string
  updatedAt: string
  featuredApplication?: VerificationDetailApplication | null
}

export type VerificationDetailApplication = {
  id: string
  customIconText?: string | null
  customDescription?: string | null
  user: {
    id: number
    username: string
    displayName: string
    avatarPath?: string | null
  }
}

export type CurrentUserVerificationData = {
  currentUserId: number | null
  types: VerificationTypeListItem[]
  approvedVerification: VerificationBadgeView | null
}

function parseFormResponseJson(input?: string | null) {
  if (!input?.trim()) {
    return {}
  }

  try {
    const parsed = JSON.parse(input) as Record<string, unknown>
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value ?? "")]))
  } catch {
    return {}
  }
}

const CUSTOM_VERIFICATION_ICON_MAX_LENGTH = 24
const CUSTOM_VERIFICATION_ICON_URL_MAX_LENGTH = 2048
const REMOTE_ICON_URL_PATTERN = /^https?:\/\/\S+$/i
const LOCAL_ICON_PATH_PATTERN = /^(\/|\.\/|\.\.\/)\S+$/
const VERIFICATION_CONTENT_MAX_LENGTH = 4_000
const VERIFICATION_FORM_VALUE_MAX_LENGTH = 1_000
const VERIFICATION_CUSTOM_DESCRIPTION_MAX_LENGTH = 600

function normalizeVerificationFormResponse(input: Record<string, string>, fields: VerificationFormField[]) {
  const allowedFieldIds = new Set(fields.map((field) => field.id))
  const entries = Object.entries(input)

  if (entries.length > Math.max(20, fields.length)) {
    throw new Error("Verification form has too many fields")
  }

  const normalized: Record<string, string> = {}
  for (const [key, value] of entries) {
    if (!allowedFieldIds.has(key)) {
      throw new Error("Verification form contains an invalid field")
    }

    const text = String(value ?? "").trim()
    if (text.length > VERIFICATION_FORM_VALUE_MAX_LENGTH) {
      throw new Error("Verification form value is too long")
    }
    normalized[key] = text
  }

  return normalized
}

function hasNonEmptyFormResponse(input: Record<string, string>) {
  return Object.values(input).some((value) => value.trim().length > 0)
}

function normalizeCustomVerificationIconText(input?: string | null) {
  const normalized = String(input ?? "").trim()

  if (!normalized) {
    return ""
  }

  if (isSvgMarkup(normalized)) {
    throw new Error("请上传 SVG 文件或填写 SVG 链接，暂不支持直接粘贴 SVG 源码")
  }

  if (/^data:/i.test(normalized) || /^blob:/i.test(normalized)) {
    throw new Error("自定义图标不支持 data/blob 地址，请改用图片链接或上传文件")
  }

  if (REMOTE_ICON_URL_PATTERN.test(normalized) || LOCAL_ICON_PATH_PATTERN.test(normalized)) {
    if (normalized.length > CUSTOM_VERIFICATION_ICON_URL_MAX_LENGTH) {
      throw new Error("自定义图标链接过长，请缩短后再提交")
    }
    return normalized
  }

  if (/[<>]/.test(normalized) || /[\r\n]/.test(normalized)) {
    throw new Error("自定义图标格式不正确")
  }

  if (normalized.length > CUSTOM_VERIFICATION_ICON_MAX_LENGTH) {
    throw new Error(`自定义图标不能超过 ${CUSTOM_VERIFICATION_ICON_MAX_LENGTH} 个字符`)
  }

  return normalized
}

function mapVerificationType(type: {
  id: string
  name: string
  slug: string
  description: string | null
  iconText: string | null
  color: string
  formSchemaJson?: string | null
  sortOrder: number
  status: boolean
  userLimit: number
  pointsCost: number
  allowResubmitAfterReject: boolean
}) {
  return {
    id: type.id,
    name: type.name,
    slug: type.slug,
    description: type.description,
    iconText: type.iconText?.trim() || "✔️",
    color: type.color,
    formFields: parseVerificationFormSchema(type.formSchemaJson),
    sortOrder: type.sortOrder,
    status: type.status,
    userLimit: type.userLimit,
    pointsCost: type.pointsCost,
    allowResubmitAfterReject: type.allowResubmitAfterReject,
  }
}

function mapApplication(application: {
  id: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  submittedAt: Date
  reviewedAt: Date | null
  rejectReason: string | null
  note: string | null
  content: string | null
  customIconText: string | null
  customDescription: string | null
  formResponseJson?: string | null
  type: {
    id: string
    slug: string
    name: string
    iconText: string | null
    color: string
    description: string | null
  }
}): UserVerificationView {
  return {
    id: application.id,
    status: application.status,
    submittedAt: application.submittedAt.toISOString(),
    reviewedAt: application.reviewedAt?.toISOString() ?? null,
    rejectReason: application.rejectReason,
    note: application.note,
    content: application.content,
    customIconText: application.customIconText,
    customDescription: application.customDescription,
    formResponse: parseFormResponseJson(application.formResponseJson),
    type: {
      id: application.type.id,
      slug: application.type.slug,
      name: application.type.name,
      iconText: application.type.iconText?.trim() || "✔️",
      color: application.type.color,
      description: application.type.description,
    },
  }
}

function mapDetailApplication(application: {
  id: string
  customIconText: string | null
  customDescription: string | null
  user: {
    id: number
    username: string
    nickname: string | null
    avatarPath: string | null
    status: string | null
  }
}): VerificationDetailApplication {
  return {
    id: application.id,
    customIconText: application.customIconText,
    customDescription: application.customDescription,
    user: {
      id: application.user.id,
      username: application.user.username,
      displayName: getUserDisplayName(application.user, application.user.username),
      avatarPath: getUserAvatarPath(application.user),
    },
  }
}

export async function getCurrentUserVerificationData(): Promise<CurrentUserVerificationData> {
  const currentUser = await getCurrentUser()
  const currentUserId = currentUser?.id ?? null

  const [types, applications, approvedVerification] = await Promise.all([
    listActiveVerificationTypes(),
    currentUserId
      ? listUserVerificationApplications(currentUserId)
      : Promise.resolve([]),
    currentUserId
      ? findApprovedUserVerification(currentUserId)
      : Promise.resolve(null),
  ])

  const applicationMap = new Map<string, UserVerificationView>()
  for (const item of applications) {
    if (!applicationMap.has(item.typeId)) {
      applicationMap.set(item.typeId, mapApplication(item))
    }
  }

  return {
    currentUserId,
    types: types.map((type) => ({
      ...mapVerificationType(type),
      currentApplication: applicationMap.get(type.id) ?? null,
    })),
    approvedVerification: approvedVerification
      ? {
          id: approvedVerification.type.id,
          slug: approvedVerification.type.slug,
          name: approvedVerification.type.name,
          iconText: approvedVerification.type.iconText?.trim() || "✔️",
          customIconText: approvedVerification.customIconText,
          color: approvedVerification.type.color,
          description: approvedVerification.type.description,
          customDescription: approvedVerification.customDescription,
        }
      : null,
  }
}

function buildVerificationContentFromFields(fields: VerificationFormField[], formResponse: Record<string, string>) {
  if (fields.length === 0) {
    return ""
  }

  return fields
    .map((field) => `${field.label}：${String(formResponse[field.id] ?? "").trim()}`)
    .filter((line) => !line.endsWith("："))
    .join("\n")
}

export async function submitVerificationApplication(input: {
  userId: number
  verificationTypeId: string
  content?: string
  customIconText?: string
  customDescription?: string
  formResponse?: Record<string, string>
}) {
  const verificationTypeId = input.verificationTypeId.trim()
  if (!verificationTypeId || verificationTypeId.length > 100) {
    throw new Error("Invalid verification type")
  }

  const verificationType = await findVerificationTypeById(verificationTypeId)

  if (!verificationType || !verificationType.status) {
    throw new Error("认证类型不存在或已停用")
  }

  const existingApproved = await findApprovedUserVerification(input.userId)
  const approvedSameTypeApplication = existingApproved?.typeId === verificationTypeId
    ? existingApproved
    : null

  if (existingApproved && !approvedSameTypeApplication) {
    throw new Error(`你已通过 ${existingApproved.type.name}，暂不支持重复申请其它认证`)
  }

  const latestApplication = await findLatestUserVerificationApplication(input.userId, verificationTypeId)

  if (latestApplication?.status === "PENDING") {
    throw new Error("该认证已在审核中，请等待后台审核")
  }

  if (latestApplication?.status === "APPROVED" && !approvedSameTypeApplication) {
    throw new Error("你已通过该认证，无需重复申请")
  }

  if (latestApplication?.status === "REJECTED" && !verificationType.allowResubmitAfterReject && !approvedSameTypeApplication) {
    throw new Error("该认证当前不允许被拒后再次提交，请联系管理员")
  }

  const formFields = parseVerificationFormSchema(verificationType.formSchemaJson)
  const rawFormResponse = input.formResponse ?? {}
  const normalizedFormResponse = normalizeVerificationFormResponse(rawFormResponse, formFields)
  const approvedFormResponse = approvedSameTypeApplication
    ? parseFormResponseJson(approvedSameTypeApplication.formResponseJson)
    : {}
  const effectiveRawFormResponse = approvedSameTypeApplication && !hasNonEmptyFormResponse(normalizedFormResponse)
    ? approvedFormResponse
    : normalizedFormResponse
  const customIconText = normalizeCustomVerificationIconText(input.customIconText)
  const customDescription = String(input.customDescription ?? "").trim()
  if (customDescription.length > VERIFICATION_CUSTOM_DESCRIPTION_MAX_LENGTH) {
    throw new Error("Verification description is too long")
  }
  const hasManualCustomizationChange = approvedSameTypeApplication
    ? customIconText !== (approvedSameTypeApplication.customIconText?.trim() ?? "")
      || customDescription !== (approvedSameTypeApplication.customDescription?.trim() ?? "")
    : false

  if (approvedSameTypeApplication && !hasManualCustomizationChange) {
    throw new Error("请先修改自定义图标或个性描述，再提交审核")
  }

  for (const field of formFields) {
    if (field.required && !effectiveRawFormResponse[field.id]) {
      throw new Error(`请填写${field.label}`)
    }
  }

  const sanitizedFormResponse = Object.fromEntries(await Promise.all(Object.entries(effectiveRawFormResponse).map(async ([key, value]) => {
    if (!value) {
      return [key, ""] as const
    }

    const safety = await enforceSensitiveText({ scene: "verification.content", text: value })
    return [key, safety.sanitizedText] as const
  })))
  const rawContent = approvedSameTypeApplication
    ? approvedSameTypeApplication.content
    : String(input.content ?? "").trim()
  if (rawContent.length > VERIFICATION_CONTENT_MAX_LENGTH) {
    throw new Error("Verification content is too long")
  }
  const contentSafety = formFields.length === 0 && rawContent
    ? await enforceSensitiveText({ scene: "verification.content", text: rawContent })
    : null
  const customDescriptionSafety = customDescription
    ? await enforceSensitiveText({ scene: "verification.customDescription", text: customDescription })
    : null
  const content = formFields.length > 0
    ? buildVerificationContentFromFields(formFields, sanitizedFormResponse)
    : (contentSafety?.sanitizedText ?? "")

  if (!content) {
    throw new Error(formFields.length > 0 ? "请完善认证申请表单" : "请填写申请说明")
  }

  if (content.length > VERIFICATION_CONTENT_MAX_LENGTH) {
    throw new Error("Verification application content is too long")
  }

  const shouldChargePoints = !approvedSameTypeApplication && verificationType.pointsCost > 0
  const settings = shouldChargePoints ? await getSiteSettings() : null
  const preparedApplicationCost = shouldChargePoints
    ? await prepareScopedPointDelta({
        scopeKey: "VERIFICATION_APPLICATION",
        baseDelta: -verificationType.pointsCost,
        userId: input.userId,
      })
    : null

  const application = await prisma.$transaction(async (tx) => {
    // Serialize application and unbind state for this user. A request guard only
    // protects a short window and cannot prevent independent parallel writes.
    const latestUser = await lockUserVerificationState(tx, input.userId)
    if (!latestUser) {
      throw new Error("用户不存在")
    }

    const approvedInTx = await tx.userVerification.findFirst({
      where: { userId: input.userId, status: "APPROVED" },
      orderBy: [{ reviewedAt: "desc" }, { submittedAt: "desc" }],
      select: { id: true, typeId: true },
    })
    if ((approvedInTx?.id ?? null) !== (approvedSameTypeApplication?.id ?? null)) {
      apiError(409, "认证状态已变化，请刷新后重试")
    }
    if (approvedInTx && approvedInTx.typeId !== verificationTypeId) {
      apiError(409, "已经绑定其他已通过的认证")
    }

    const latestApplicationInTx = await tx.userVerification.findFirst({
      where: {
        userId: input.userId,
        typeId: verificationTypeId,
      },
      orderBy: [{ submittedAt: "desc" }],
      select: { status: true },
    })
    if (latestApplicationInTx?.status === "PENDING") {
      throw new Error("该认证已在审核中，请等待后台审核")
    }
    if (latestApplicationInTx?.status === "REJECTED" && !verificationType.allowResubmitAfterReject && !approvedInTx) {
      throw new Error("该认证类型不允许被驳回后重新提交")
    }

    const createdApplication = await createUserVerificationApplication({
      userId: input.userId,
      verificationTypeId: verificationTypeId,
      content,
      customIconText: customIconText || null,
      customDescription: customDescriptionSafety?.sanitizedText || null,
      formResponseJson: formFields.length > 0 ? JSON.stringify(sanitizedFormResponse) : null,
      client: tx,
    })

    if (preparedApplicationCost && settings) {
      await applyPointDelta({
        tx,
        userId: input.userId,
        beforeBalance: latestUser.points,
        prepared: preparedApplicationCost,
        pointName: settings.pointName,
        insufficientMessage: `${settings.pointName}不足，无法提交${verificationType.name}认证申请`,
        reason: `提交${verificationType.name}认证申请`,
        eventType: POINT_LOG_EVENT_TYPES.VERIFICATION_APPLICATION,
        eventData: {
          verificationTypeId: verificationType.id,
          verificationTypeName: verificationType.name,
          pointsCost: verificationType.pointsCost,
        },
      })
    }

    return createdApplication
  })

  if (preparedApplicationCost) {
    revalidateUserSurfaceCache(input.userId)
  }

  return {
    ...application,
    contentAdjusted: Boolean(
      contentSafety?.wasReplaced
      || customDescriptionSafety?.wasReplaced
      || Object.keys(effectiveRawFormResponse).some((key) => sanitizedFormResponse[key] !== effectiveRawFormResponse[key]),
    ),
  }
}

export async function getVerificationTypeDetailBySlug(slug: string, options: {
  username?: string | null
} = {}): Promise<VerificationTypeDetail | null> {
  const normalizedSlug = slug.trim()
  if (!normalizedSlug) {
    return null
  }

  const verificationType = await findActiveVerificationTypeBySlug(normalizedSlug)
  if (!verificationType) {
    return null
  }

  const requestedUsername = options.username?.trim()
  const featuredApplication = requestedUsername
    ? await findApprovedUserVerificationByTypeAndUsername(verificationType.id, requestedUsername)
    : null

  return {
    id: verificationType.id,
    name: verificationType.name,
    slug: verificationType.slug,
    description: verificationType.description,
    iconText: verificationType.iconText?.trim() || "✔️",
    color: verificationType.color,
    formFields: parseVerificationFormSchema(verificationType.formSchemaJson, {
      allowFallbackLabel: true,
      coerceInvalidType: true,
    }),
    sortOrder: verificationType.sortOrder,
    status: verificationType.status,
    userLimit: verificationType.userLimit,
    pointsCost: verificationType.pointsCost,
    allowResubmitAfterReject: verificationType.allowResubmitAfterReject,
    needRemark: verificationType.needRemark,
    approvedUserCount: verificationType._count.applications,
    createdAt: verificationType.createdAt.toISOString(),
    updatedAt: verificationType.updatedAt.toISOString(),
    featuredApplication: featuredApplication ? mapDetailApplication(featuredApplication) : null,
  }
}

export async function unbindCurrentUserVerification(userId: number) {
  const result = await prisma.$transaction(async (tx) => {
    const user = await lockUserVerificationState(tx, userId)
    if (!user) {
      throw new Error("用户不存在")
    }

    const current = await tx.userVerification.findFirst({
      where: { userId, status: "APPROVED" },
      orderBy: [{ reviewedAt: "desc" }, { submittedAt: "desc" }],
      select: { id: true },
    })
    if (!current) {
      throw new Error("当前没有已绑定的认证")
    }

    const cancelled = await tx.userVerification.updateMany({
      where: { id: current.id, userId, status: "APPROVED" },
      data: {
        status: "CANCELLED",
        note: "用户主动解除认证绑定",
        reviewedAt: new Date(),
      },
    })
    if (cancelled.count !== 1) {
      apiError(409, "认证状态已变化，请刷新后重试")
    }

    return { username: user.username }
  })

  revalidateUserProfileMutation({
    userId,
    username: result.username,
  })
}

export async function getUserApprovedVerificationBadge(userId: number | null | undefined): Promise<VerificationBadgeView | null> {
  if (!userId) {
    return null
  }

  const application = await findApprovedUserVerification(userId)

  if (!application) {
    return null
  }

  return {
    id: application.type.id,
    slug: application.type.slug,
    name: application.type.name,
    iconText: application.type.iconText?.trim() || "✔️",
    customIconText: application.customIconText,
    color: application.type.color,
    description: application.type.description,
    customDescription: application.customDescription,
  }
}

