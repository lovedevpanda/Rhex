import {
  countVerificationApplicationsByType,
  createVerificationTypeRecord,
  deleteVerificationTypeRecord,
  findAdminVerificationTypes,
  findRecentVerificationApplications,
  findVerificationApplicationForReview,
  runVerificationReviewTransaction,
  updateVerificationTypeRecord,
} from "@/db/admin-verification-queries"
import { apiError, type JsonObject } from "@/lib/api-route"
import { getRequestIp, writeAdminLog } from "@/lib/admin"
import type { AdminActor } from "@/lib/moderator-permissions"
import { createSystemNotification } from "@/lib/notification-writes"
import { getUserDisplayName } from "@/lib/user-display"
import { parseVerificationFormSchema } from "@/lib/verification-form-schema"

function normalizeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim()
}

function normalizeBoolean(value: unknown) {
  return value === true
}

function normalizeNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function buildVerificationTypeWriteInput(body: JsonObject) {
  return {
    name: normalizeText(body.name),
    slug: normalizeText(body.slug),
    description: normalizeText(body.description) || undefined,
    iconText: normalizeText(body.iconText, "✔️") || "✔️",
    color: normalizeText(body.color, "#2563eb") || "#2563eb",
    formSchemaJson: typeof body.formSchemaJson === "string" ? body.formSchemaJson : undefined,
    sortOrder: normalizeNumber(body.sortOrder),
    status: body.status === undefined ? true : normalizeBoolean(body.status),
    needRemark: normalizeBoolean(body.needRemark),
    userLimit: Math.max(1, normalizeNumber(body.userLimit, 1)),
    allowResubmitAfterReject: body.allowResubmitAfterReject === undefined ? true : normalizeBoolean(body.allowResubmitAfterReject),
  }
}

function buildVerificationReviewNotification(params: {
  typeName: string
  status: "APPROVED" | "REJECTED"
  note: string
  rejectReason: string
}) {
  if (params.status === "APPROVED") {
    return {
      title: `你的${params.typeName}认证申请已通过`,
      content: `你提交的${params.typeName}认证申请已通过审核。${params.note ? ` 审核备注：${params.note}` : ""}`,
    }
  }

  return {
    title: `你的${params.typeName}认证申请未通过`,
    content: `你提交的${params.typeName}认证申请未通过审核。驳回原因：${params.rejectReason}${params.note ? `。审核备注：${params.note}` : ""}`,
  }
}

export async function getVerificationAdminData() {
  const [types, applications] = await Promise.all([
    findAdminVerificationTypes(),
    findRecentVerificationApplications(),
  ])

  return {
    types: types.map((type) => ({
      id: type.id,
      name: type.name,
      slug: type.slug,
      description: type.description ?? "",
      iconText: type.iconText ?? "✔️",
      color: type.color,
      formFields: parseVerificationFormSchema(type.formSchemaJson, {
        allowFallbackLabel: true,
        coerceInvalidType: true,
      }),
      sortOrder: type.sortOrder,
      status: type.status,
      needRemark: type.needRemark,
      userLimit: type.userLimit,
      allowResubmitAfterReject: type.allowResubmitAfterReject,
      createdAt: type.createdAt.toISOString(),
      updatedAt: type.updatedAt.toISOString(),
      applicationCount: type._count.applications,
    })),
    applications: applications.map((item) => ({
      id: item.id,
      status: item.status,
      content: item.content,
      customIconText: item.customIconText,
      customDescription: item.customDescription,
      formResponseJson: item.formResponseJson,
      note: item.note,
      rejectReason: item.rejectReason,
      submittedAt: item.submittedAt.toISOString(),
      reviewedAt: item.reviewedAt?.toISOString() ?? null,
      typeId: item.typeId,
      reviewerId: item.reviewerId,
      user: {
        id: item.user.id,
        username: item.user.username,
        displayName: getUserDisplayName(item.user),
      },
      type: {
        id: item.type.id,
        name: item.type.name,
        iconText: item.type.iconText,
        color: item.type.color,
      },
      reviewer: item.reviewer
        ? {
            id: item.reviewer.id,
            username: item.reviewer.username,
            displayName: getUserDisplayName(item.reviewer),
          }
        : null,
    })),
  }
}

export async function createVerificationType(params: {
  body: JsonObject
  admin: AdminActor
  request: Request
}) {
  const payload = buildVerificationTypeWriteInput(params.body)
  const { name, slug } = payload

  if (!name || !slug) {
    apiError(400, "认证名称和标识不能为空")
  }

  const created = await createVerificationTypeRecord(payload)

  await writeAdminLog(params.admin.id, "verificationType.create", "VERIFICATION_TYPE", created.id, `创建认证类型 ${created.name}`, getRequestIp(params.request))
  return { id: created.id }
}

export async function updateVerificationTypeOrReview(params: {
  body: JsonObject
  admin: AdminActor
  request: Request
}) {
  const id = normalizeText(params.body.id)
  const action = normalizeText(params.body.action)
  const requestIp = getRequestIp(params.request)

  if (action === "review") {
    const applicationId = normalizeText(params.body.applicationId)
    const status = normalizeText(params.body.status)
    const note = normalizeText(params.body.note)
    const rejectReason = normalizeText(params.body.rejectReason)

    if (!applicationId || (status !== "APPROVED" && status !== "REJECTED")) {
      apiError(400, "审核参数无效")
    }

    const application = await findVerificationApplicationForReview(applicationId)

    if (!application) {
      apiError(404, "认证申请不存在")
    }

    if (application.status !== "PENDING") {
      apiError(400, "该申请已处理，请刷新列表后再试")
    }

    if (status === "REJECTED" && !rejectReason) {
      apiError(400, "请填写驳回原因")
    }

    const notification = buildVerificationReviewNotification({
      typeName: application.type.name,
      status,
      note,
      rejectReason,
    })

    await runVerificationReviewTransaction({
      applicationId,
      userId: application.userId,
      adminId: params.admin.id,
      status,
      note,
      rejectReason,
      afterReview: async (tx) => {
        await createSystemNotification({
          client: tx,
          userId: application.userId,
          senderId: params.admin.id,
          relatedType: "ANNOUNCEMENT",
          relatedId: applicationId,
          title: notification.title,
          content: notification.content,
        })
      },
    })

    await writeAdminLog(params.admin.id, `verification.review.${status.toLowerCase()}`, "USER_VERIFICATION", applicationId, `${status === "APPROVED" ? "通过" : "驳回"} ${getUserDisplayName(application.user)} 的 ${application.type.name} 认证申请`, requestIp)
    return { reviewed: true, status }
  }

  const payload = buildVerificationTypeWriteInput(params.body)
  const { name, slug } = payload

  if (!id || !name || !slug) {
    apiError(400, "缺少必要参数")
  }

  await updateVerificationTypeRecord(id, payload)

  await writeAdminLog(params.admin.id, "verificationType.update", "VERIFICATION_TYPE", id, `更新认证类型 ${name}`, requestIp)
  return { reviewed: false }
}

export async function deleteVerificationType(params: {
  body: JsonObject
  admin: AdminActor
  request: Request
}) {
  const id = normalizeText(params.body.id)

  if (!id) {
    apiError(400, "缺少必要参数")
  }

  const applicationCount = await countVerificationApplicationsByType(id)
  if (applicationCount > 0) {
    apiError(400, "该认证已有申请记录，暂不允许删除")
  }

  await deleteVerificationTypeRecord(id)
  await writeAdminLog(params.admin.id, "verificationType.delete", "VERIFICATION_TYPE", id, "删除认证类型", getRequestIp(params.request))
}
