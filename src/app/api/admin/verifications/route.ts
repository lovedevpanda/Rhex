import { NextResponse } from "next/server"

import { prisma } from "@/db/client"
import { getRequestIp, requireAdminUser, writeAdminLog } from "@/lib/admin"

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

async function ensureAdmin() {
  const admin = await requireAdminUser()

  if (!admin) {
    return { error: NextResponse.json({ code: 403, message: "无权执行后台操作" }, { status: 403 }) }
  }

  return { admin }
}

export async function GET() {
  const guard = await ensureAdmin()
  if (guard.error) return guard.error

  const [types, applications] = await Promise.all([
    prisma.verificationType.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        _count: {
          select: {
            applications: true,
          },
        },
      },
    }),
    prisma.userVerification.findMany({
      orderBy: [{ submittedAt: "desc" }],
      take: 200,
      include: {
        type: true,
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            username: true,
            nickname: true,
          },
        },
      },
    }),
  ])

  return NextResponse.json({
    code: 0,
    data: {
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
    },
  })
}

export async function POST(request: Request) {
  const guard = await ensureAdmin()
  if (guard.error) return guard.error

  const { admin } = guard
  const requestIp = getRequestIp(request)
  const body = await request.json()

  const name = normalizeText(body.name)
  const slug = normalizeText(body.slug)

  if (!name || !slug) {
    return NextResponse.json({ code: 400, message: "认证名称和标识不能为空" }, { status: 400 })
  }

  const created = await prisma.verificationType.create({
    data: {
      name,
      slug,
      description: normalizeText(body.description) || undefined,
      iconText: normalizeText(body.iconText, "✔️") || "✔️",
      color: normalizeText(body.color, "#2563eb") || "#2563eb",
      formSchemaJson: typeof body.formSchemaJson === "string" ? body.formSchemaJson : undefined,
      sortOrder: normalizeNumber(body.sortOrder),
      status: body.status === undefined ? true : normalizeBoolean(body.status),
      needRemark: normalizeBoolean(body.needRemark),
      userLimit: Math.max(1, normalizeNumber(body.userLimit, 1)),
      allowResubmitAfterReject: body.allowResubmitAfterReject === undefined ? true : normalizeBoolean(body.allowResubmitAfterReject),
    },
  })

  await writeAdminLog(admin.id, "verificationType.create", "VERIFICATION_TYPE", created.id, `创建认证类型 ${created.name}`, requestIp)
  return NextResponse.json({ code: 0, message: "认证类型已创建", data: { id: created.id } })
}

export async function PUT(request: Request) {
  const guard = await ensureAdmin()
  if (guard.error) return guard.error

  const { admin } = guard
  const requestIp = getRequestIp(request)
  const body = await request.json()
  const id = normalizeText(body.id)
  const action = normalizeText(body.action)

  if (action === "review") {
    const applicationId = normalizeText(body.applicationId)
    const status = normalizeText(body.status)
    const note = normalizeText(body.note)
    const rejectReason = normalizeText(body.rejectReason)

    if (!applicationId || (status !== "APPROVED" && status !== "REJECTED")) {
      return NextResponse.json({ code: 400, message: "审核参数无效" }, { status: 400 })
    }

    const application = await prisma.userVerification.findUnique({
      where: { id: applicationId },
      include: {
        type: true,
        user: {
          select: {
            username: true,
            nickname: true,
          },
        },
      },
    })

    if (!application) {
      return NextResponse.json({ code: 404, message: "认证申请不存在" }, { status: 404 })
    }

    if (application.status !== "PENDING") {
      return NextResponse.json({ code: 400, message: "该申请已处理，请刷新列表后再试" }, { status: 400 })
    }

    if (status === "REJECTED" && !rejectReason) {
      return NextResponse.json({ code: 400, message: "请填写驳回原因" }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      if (status === "APPROVED") {
        await tx.userVerification.updateMany({
          where: {
            userId: application.userId,
            status: "APPROVED",
          },
          data: {
            status: "CANCELLED",
            note: "已有新的认证通过，旧认证已自动失效",
            reviewedAt: new Date(),
            reviewerId: admin.id,
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
          reviewerId: admin.id,
        },
      })
    })

    await writeAdminLog(admin.id, `verification.review.${status.toLowerCase()}`, "USER_VERIFICATION", applicationId, `${status === "APPROVED" ? "通过" : "驳回"} ${application.user.nickname?.trim() || application.user.username} 的 ${application.type.name} 认证申请`, requestIp)
    return NextResponse.json({ code: 0, message: status === "APPROVED" ? "认证申请已通过" : "认证申请已驳回" })
  }

  const name = normalizeText(body.name)
  const slug = normalizeText(body.slug)

  if (!id || !name || !slug) {
    return NextResponse.json({ code: 400, message: "缺少必要参数" }, { status: 400 })
  }

  await prisma.verificationType.update({
    where: { id },
    data: {
      name,
      slug,
      description: normalizeText(body.description) || undefined,
      iconText: normalizeText(body.iconText, "✔️") || "✔️",
      color: normalizeText(body.color, "#2563eb") || "#2563eb",
      formSchemaJson: typeof body.formSchemaJson === "string" ? body.formSchemaJson : undefined,
      sortOrder: normalizeNumber(body.sortOrder),
      status: body.status === undefined ? true : normalizeBoolean(body.status),
      needRemark: normalizeBoolean(body.needRemark),
      userLimit: Math.max(1, normalizeNumber(body.userLimit, 1)),
      allowResubmitAfterReject: body.allowResubmitAfterReject === undefined ? true : normalizeBoolean(body.allowResubmitAfterReject),
    },
  })

  await writeAdminLog(admin.id, "verificationType.update", "VERIFICATION_TYPE", id, `更新认证类型 ${name}`, requestIp)
  return NextResponse.json({ code: 0, message: "认证类型已更新" })
}

export async function DELETE(request: Request) {
  const guard = await ensureAdmin()
  if (guard.error) return guard.error

  const { admin } = guard
  const requestIp = getRequestIp(request)
  const body = await request.json()
  const id = normalizeText(body.id)

  if (!id) {
    return NextResponse.json({ code: 400, message: "缺少必要参数" }, { status: 400 })
  }

  const applicationCount = await prisma.userVerification.count({ where: { typeId: id } })
  if (applicationCount > 0) {
    return NextResponse.json({ code: 400, message: "该认证已有申请记录，暂不允许删除" }, { status: 400 })
  }

  await prisma.verificationType.delete({ where: { id } })
  await writeAdminLog(admin.id, "verificationType.delete", "VERIFICATION_TYPE", id, "删除认证类型", requestIp)
  return NextResponse.json({ code: 0, message: "认证类型已删除" })
}
