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
import { parseVerificationFormSchema, type VerificationFormField } from "@/lib/verification-form-schema"
export type { VerificationFieldType, VerificationFormField } from "@/lib/verification-form-schema"

export type VerificationBadgeView = {
  id: string
  name: string
  iconText: string
  color: string
  description?: string | null
}

export type UserVerificationView = {
  id: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  submittedAt: string
  reviewedAt?: string | null
  rejectReason?: string | null
  note?: string | null
  content?: string | null
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
          color: approvedVerification.type.color,
          description: approvedVerification.type.description,
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
  formResponse?: Record<string, string>
}) {
  const verificationType = await findVerificationTypeById(input.verificationTypeId)

  if (!verificationType || !verificationType.status) {
    throw new Error("认证类型不存在或已停用")
  }

  const existingApproved = await findApprovedUserVerification(input.userId)

  if (existingApproved && existingApproved.typeId !== input.verificationTypeId) {
    throw new Error(`你已通过 ${existingApproved.type.name}，暂不支持重复申请其它认证`)
  }

  const latestApplication = await findLatestUserVerificationApplication(input.userId, input.verificationTypeId)

  if (latestApplication?.status === "PENDING") {
    throw new Error("该认证已在审核中，请等待后台审核")
  }

  if (latestApplication?.status === "APPROVED") {
    throw new Error("你已通过该认证，无需重复申请")
  }

  if (latestApplication?.status === "REJECTED" && !verificationType.allowResubmitAfterReject) {
    throw new Error("该认证当前不允许被拒后再次提交，请联系管理员")
  }

  const formFields = parseVerificationFormSchema(verificationType.formSchemaJson)
  const rawFormResponse = input.formResponse ?? {}
  const normalizedFormResponse = Object.fromEntries(Object.entries(rawFormResponse).map(([key, value]) => [key, String(value ?? "").trim()]))

  for (const field of formFields) {
    if (field.required && !normalizedFormResponse[field.id]) {
      throw new Error(`请填写${field.label}`)
    }
  }

  const content = formFields.length > 0
    ? buildVerificationContentFromFields(formFields, normalizedFormResponse)
    : String(input.content ?? "").trim()

  if (!content) {
    throw new Error(formFields.length > 0 ? "请完善认证申请表单" : "请填写申请说明")
  }

  return createUserVerificationApplication({
    userId: input.userId,
    verificationTypeId: input.verificationTypeId,
    content,
    formResponseJson: formFields.length > 0 ? JSON.stringify(normalizedFormResponse) : null,
  })
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
    color: application.type.color,
    description: application.type.description,
  }
}

