import { prisma } from "@/db/client"
import { apiError, type JsonObject } from "@/lib/api-route"
import { getRequestIp, type requireAdminUser, writeAdminLog } from "@/lib/admin"

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

type AdminActor = NonNullable<Awaited<ReturnType<typeof requireAdminUser>>>

export async function getVerificationAdminData() {
  const [types, applications] = await Promise.all([
    prisma.verificationType.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        _count: {
          select: { applications: true },
        },
      },
    }),
    prisma.userVerification.findMany({
      orderBy: [{ submittedAt: "desc" }],
      take: 200,
      include: {
        type: true,
        user: {
          select: { id: true, username: true, nickname: true },
        },
        reviewer: {
          select: { id: true, username: true, nickname: true },
        },
      },
    }),
  ])

  return {
    types: types.map((type) => ({
      id: type.id,
      name: type.name,
      slug: type.slug,
      description: type.description,
      iconText: type.iconText,
      color: type.color,
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
        displayName: item.user.nickname?.trim() || item.user.username,
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
            displayName: item.reviewer.nickname?.trim() || item.reviewer.username,
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
  const name = normalizeText(params.body.name)
  const slug = normalizeText(params.body.slug)

  if (!name || !slug) {
    apiError(400, "认证名称和标识不能为空")
  }

  const created = await prisma.verificationType.create({
    data: {
      name,
      slug,
      description: normalizeText(params.body.description) || undefined,
      iconText: normalizeText(params.body.iconText, "✔️") || "✔️",
      color: normalizeText(params.body.color, "#2563eb") || "#2563eb",
      formSchemaJson: typeof params.body.formSchemaJson === "string" ? params.body.formSchemaJson : undefined,
      sortOrder: normalizeNumber(params.body.sortOrder),
      status: params.body.status === undefined ? true : normalizeBoolean(params.body.status),
      needRemark: normalizeBoolean(params.body.needRemark),
      userLimit: Math.max(1, normalizeNumber(params.body.userLimit, 1)),
      allowResubmitAfterReject: params.body.allowResubmitAfterReject === undefined ? true : normalizeBoolean(params.body.allowResubmitAfterReject),
    },
  })

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

    const application = await prisma.userVerification.findUnique({
      where: { id: applicationId },
      include: {
        type: true,
        user: {
          select: { username: true, nickname: true },
        },
      },
    })

    if (!application) {
      apiError(404, "认证申请不存在")
    }

    if (application.status !== "PENDING") {
      apiError(400, "该申请已处理，请刷新列表后再试")
    }

    if (status === "REJECTED" && !rejectReason) {
      apiError(400, "请填写驳回原因")
    }

    await prisma.$transaction(async (tx) => {
      if (status === "APPROVED") {
        await tx.userVerification.updateMany({
          where: { userId: application.userId, status: "APPROVED" },
          data: {
            status: "CANCELLED",
            note: "已有新的认证通过，旧认证已自动失效",
            reviewedAt: new Date(),
            reviewerId: params.admin.id,
          },
        })
      }

      await tx.userVerification.update({
        where: { id: applicationId },
        data: {
          status,
          note: note || undefined,
          rejectReason: status === "REJECTED" ? rejectReason : null,
          reviewedAt: new Date(),
          reviewerId: params.admin.id,
        },
      })
    })

    await writeAdminLog(params.admin.id, `verification.review.${status.toLowerCase()}`, "USER_VERIFICATION", applicationId, `${status === "APPROVED" ? "通过" : "驳回"} ${application.user.nickname?.trim() || application.user.username} 的 ${application.type.name} 认证申请`, requestIp)
    return { reviewed: true, status }
  }

  const name = normalizeText(params.body.name)
  const slug = normalizeText(params.body.slug)

  if (!id || !name || !slug) {
    apiError(400, "缺少必要参数")
  }

  await prisma.verificationType.update({
    where: { id },
    data: {
      name,
      slug,
      description: normalizeText(params.body.description) || undefined,
      iconText: normalizeText(params.body.iconText, "✔️") || "✔️",
      color: normalizeText(params.body.color, "#2563eb") || "#2563eb",
      formSchemaJson: typeof params.body.formSchemaJson === "string" ? params.body.formSchemaJson : undefined,
      sortOrder: normalizeNumber(params.body.sortOrder),
      status: params.body.status === undefined ? true : normalizeBoolean(params.body.status),
      needRemark: normalizeBoolean(params.body.needRemark),
      userLimit: Math.max(1, normalizeNumber(params.body.userLimit, 1)),
      allowResubmitAfterReject: params.body.allowResubmitAfterReject === undefined ? true : normalizeBoolean(params.body.allowResubmitAfterReject),
    },
  })

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

  const applicationCount = await prisma.userVerification.count({ where: { typeId: id } })
  if (applicationCount > 0) {
    apiError(400, "该认证已有申请记录，暂不允许删除")
  }

  await prisma.verificationType.delete({ where: { id } })
  await writeAdminLog(params.admin.id, "verificationType.delete", "VERIFICATION_TYPE", id, "删除认证类型", getRequestIp(params.request))
}
