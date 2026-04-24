import {
  createUserVerificationApplication,
  findApprovedUserVerification,
  findLatestUserVerificationApplication,
  findVerificationTypeById,
  listActiveVerificationTypes,
  listUserVerificationApplications,
  updateUserVerificationById,
} from "@/db/verification-queries"
import { getCurrentUser } from "@/lib/auth"
import { enforceSensitiveText } from "@/lib/content-safety"
import { parseVerificationFormSchema, type VerificationFormField } from "@/lib/verification-form-schema"
export type { VerificationFieldType, VerificationFormField } from "@/lib/verification-form-schema"

export type VerificationBadgeView = {
  id: string
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
  allowResubmitAfterReject: boolean
  formFields: VerificationFormField[]
  currentApplication?: UserVerificationView | null
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
const INLINE_SVG_PATTERN = /^<svg[\s\S]*<\/svg>$/i

function hasNonEmptyFormResponse(input: Record<string, string>) {
  return Object.values(input).some((value) => value.trim().length > 0)
}

function normalizeCustomVerificationIconText(input?: string | null) {
  const normalized = String(input ?? "").trim()

  if (!normalized) {
    return ""
  }

  if (INLINE_SVG_PATTERN.test(normalized)) {
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
      name: application.type.name,
      iconText: application.type.iconText?.trim() || "✔️",
      color: application.type.color,
      description: application.type.description,
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
  const verificationType = await findVerificationTypeById(input.verificationTypeId)

  if (!verificationType || !verificationType.status) {
    throw new Error("认证类型不存在或已停用")
  }

  const existingApproved = await findApprovedUserVerification(input.userId)
  const approvedSameTypeApplication = existingApproved?.typeId === input.verificationTypeId
    ? existingApproved
    : null

  if (existingApproved && !approvedSameTypeApplication) {
    throw new Error(`你已通过 ${existingApproved.type.name}，暂不支持重复申请其它认证`)
  }

  const latestApplication = await findLatestUserVerificationApplication(input.userId, input.verificationTypeId)

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
  const normalizedFormResponse = Object.fromEntries(Object.entries(rawFormResponse).map(([key, value]) => [key, String(value ?? "").trim()]))
  const approvedFormResponse = approvedSameTypeApplication
    ? parseFormResponseJson(approvedSameTypeApplication.formResponseJson)
    : {}
  const effectiveRawFormResponse = approvedSameTypeApplication && !hasNonEmptyFormResponse(normalizedFormResponse)
    ? approvedFormResponse
    : normalizedFormResponse
  const customIconText = normalizeCustomVerificationIconText(input.customIconText)
  const customDescription = String(input.customDescription ?? "").trim()
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

  const application = await createUserVerificationApplication({
    userId: input.userId,
    verificationTypeId: input.verificationTypeId,
    content,
    customIconText: customIconText || null,
    customDescription: customDescriptionSafety?.sanitizedText || null,
    formResponseJson: formFields.length > 0 ? JSON.stringify(sanitizedFormResponse) : null,
  })

  return {
    ...application,
    contentAdjusted: Boolean(
      contentSafety?.wasReplaced
      || customDescriptionSafety?.wasReplaced
      || Object.keys(effectiveRawFormResponse).some((key) => sanitizedFormResponse[key] !== effectiveRawFormResponse[key]),
    ),
  }
}

export async function unbindCurrentUserVerification(userId: number) {
  const approvedApplication = await findApprovedUserVerification(userId)

  if (!approvedApplication) {
    throw new Error("当前没有已绑定的认证")
  }

  await updateUserVerificationById(approvedApplication.id, {
    status: "CANCELLED",
    note: "用户主动解除认证绑定",
    reviewedAt: new Date(),
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
    name: application.type.name,
    iconText: application.type.iconText?.trim() || "✔️",
    customIconText: application.customIconText,
    color: application.type.color,
    description: application.type.description,
    customDescription: application.customDescription,
  }
}

