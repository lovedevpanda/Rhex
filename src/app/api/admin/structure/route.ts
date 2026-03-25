import { BoardStatus } from "@/db/types"
import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

import { requireAdminUser, writeAdminLog } from "@/lib/admin"
import { hasDatabaseUrl } from "@/lib/db-status"
import { DEFAULT_ALLOWED_POST_TYPES_VALUE, serializePostTypes } from "@/lib/post-types"
import { prisma } from "@/db/client"


async function ensureAdmin() {
  const admin = await requireAdminUser()

  if (!admin) {
    return { error: NextResponse.json({ code: 403, message: "无权执行后台操作" }, { status: 403 }) }
  }

  if (!hasDatabaseUrl()) {
    return { error: NextResponse.json({ code: 503, message: "当前未配置数据库，暂不可修改论坛结构" }, { status: 503 }) }
  }

  return { admin }
}

function parseNullableNumber(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined
  }

  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : undefined
}

function parseBoolean(value: unknown) {
  return value === true
}

function buildBoardAdvancedPayload(body: Record<string, unknown>) {
  return {
    postPointDelta: parseNullableNumber(body.postPointDelta),
    replyPointDelta: parseNullableNumber(body.replyPointDelta),
    postIntervalSeconds: parseNullableNumber(body.postIntervalSeconds),
    replyIntervalSeconds: parseNullableNumber(body.replyIntervalSeconds),
    allowedPostTypes: Array.isArray(body.allowedPostTypes) && body.allowedPostTypes.length > 0 ? (body.allowedPostTypes as string[]).join(",") : undefined,
    minViewPoints: parseNullableNumber(body.minViewPoints),
    minViewLevel: parseNullableNumber(body.minViewLevel),
    minPostPoints: parseNullableNumber(body.minPostPoints),
    minPostLevel: parseNullableNumber(body.minPostLevel),
    minReplyPoints: parseNullableNumber(body.minReplyPoints),
    minReplyLevel: parseNullableNumber(body.minReplyLevel),
    minViewVipLevel: parseNullableNumber(body.minViewVipLevel),

    minPostVipLevel: parseNullableNumber(body.minPostVipLevel),
    minReplyVipLevel: parseNullableNumber(body.minReplyVipLevel),
    requirePostReview: body.requirePostReview === undefined ? undefined : parseBoolean(body.requirePostReview),
  }
}

function buildZonePayload(body: Record<string, unknown>, sortOrder: number, name: string, slug: string, description: string, icon: string) {
  return {
    name,
    slug,
    description: description || undefined,
    icon,
    sortOrder,
    postPointDelta: parseNullableNumber(body.postPointDelta) ?? 0,
    replyPointDelta: parseNullableNumber(body.replyPointDelta) ?? 0,
    postIntervalSeconds: parseNullableNumber(body.postIntervalSeconds) ?? 120,
    replyIntervalSeconds: parseNullableNumber(body.replyIntervalSeconds) ?? 3,
    allowedPostTypes: Array.isArray(body.allowedPostTypes) && body.allowedPostTypes.length > 0 ? serializePostTypes(body.allowedPostTypes as never) : DEFAULT_ALLOWED_POST_TYPES_VALUE,

    minViewPoints: parseNullableNumber(body.minViewPoints) ?? 0,
    minViewLevel: parseNullableNumber(body.minViewLevel) ?? 0,
    minPostPoints: parseNullableNumber(body.minPostPoints) ?? 0,
    minPostLevel: parseNullableNumber(body.minPostLevel) ?? 0,
    minReplyPoints: parseNullableNumber(body.minReplyPoints) ?? 0,
    minReplyLevel: parseNullableNumber(body.minReplyLevel) ?? 0,
    requirePostReview: parseBoolean(body.requirePostReview),

    minViewVipLevel: parseNullableNumber(body.minViewVipLevel) ?? 0,
    minPostVipLevel: parseNullableNumber(body.minPostVipLevel) ?? 0,
    minReplyVipLevel: parseNullableNumber(body.minReplyVipLevel) ?? 0,
  }
}

function getUniqueConstraintMessage(type: string, error: Prisma.PrismaClientKnownRequestError) {
  if (error.code !== "P2002") {
    return null
  }

  const target = Array.isArray(error.meta?.target) ? error.meta.target.map((item) => String(item)) : []
  const entityLabel = type === "board" ? "节点" : "分区"

  if (target.includes("slug")) {
    return `${entityLabel} slug 已存在，请换一个更唯一的标识`
  }

  if (target.includes("name")) {
    return `${entityLabel}名称已存在，请更换后再试`
  }

  return `${entityLabel}标识已存在，请检查名称或 slug 是否重复`
}

function handleStructureMutationError(type: string, error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const message = getUniqueConstraintMessage(type, error)

    if (message) {
      return NextResponse.json({ code: 409, message }, { status: 409 })
    }
  }

  console.error("[admin/structure] mutation failed", { type, error })
  return NextResponse.json({ code: 500, message: "保存失败，请稍后重试" }, { status: 500 })
}

export async function POST(request: Request) {

  const guard = await ensureAdmin()
  if (guard.error) return guard.error
  const { admin } = guard

  const body = await request.json()
  const type = String(body.type ?? "")
  const name = String(body.name ?? "").trim()
  const slug = String(body.slug ?? "").trim()
  const description = String(body.description ?? "").trim()
  const sortOrder = Number(body.sortOrder ?? 0) || 0

  if (!type || !name || !slug) {
    return NextResponse.json({ code: 400, message: "名称和标识不能为空" }, { status: 400 })
  }

  if (type === "zone") {
    try {
      const icon = String(body.icon ?? "📚").trim() || "📚"
      const zone = await prisma.zone.create({
        data: buildZonePayload(body as Record<string, unknown>, sortOrder, name, slug, description, icon),
      })

      await writeAdminLog(admin.id, "zone.create", "ZONE", zone.id, `创建分区 ${name}`)
      return NextResponse.json({ code: 0, message: "分区已创建", data: { id: zone.id } })
    } catch (error) {
      return handleStructureMutationError(type, error)
    }
  }

  if (type === "board") {
    const zoneId = String(body.zoneId ?? "").trim()
    if (!zoneId) {
      return NextResponse.json({ code: 400, message: "请选择所属分区" }, { status: 400 })
    }

    try {
      const icon = String(body.icon ?? "💬").trim() || "💬"
      const board = await prisma.board.create({
        data: {
          zoneId,
          name,
          slug,
          description: description || undefined,
          iconPath: icon,
          sortOrder,
          status: BoardStatus.ACTIVE,
          ...buildBoardAdvancedPayload(body as Record<string, unknown>),
        },
      })

      await writeAdminLog(admin.id, "board.create", "BOARD", board.id, `创建节点 ${name}`)
      return NextResponse.json({ code: 0, message: "节点已创建", data: { id: board.id } })
    } catch (error) {
      return handleStructureMutationError(type, error)
    }
  }


  return NextResponse.json({ code: 400, message: "不支持的结构类型" }, { status: 400 })
}

export async function PUT(request: Request) {
  const guard = await ensureAdmin()
  if (guard.error) return guard.error
  const { admin } = guard

  const body = await request.json()
  const type = String(body.type ?? "")
  const id = String(body.id ?? "")
  const name = String(body.name ?? "").trim()
  const slug = String(body.slug ?? "").trim()
  const description = String(body.description ?? "").trim()
  const sortOrder = Number(body.sortOrder ?? 0) || 0

  if (!type || !id || !name || !slug) {
    return NextResponse.json({ code: 400, message: "缺少必要参数" }, { status: 400 })
  }

  if (type === "zone") {
    try {
      const icon = String(body.icon ?? "📚").trim() || "📚"
      await prisma.zone.update({
        where: { id },
        data: buildZonePayload(body as Record<string, unknown>, sortOrder, name, slug, description, icon),
      })
      await writeAdminLog(admin.id, "zone.update", "ZONE", id, `更新分区 ${name}`)
      return NextResponse.json({ code: 0, message: "分区已更新" })
    } catch (error) {
      return handleStructureMutationError(type, error)
    }
  }

  if (type === "board") {
    try {
      const zoneId = String(body.zoneId ?? "").trim()
      const icon = String(body.icon ?? "💬").trim() || "💬"
      await prisma.board.update({
        where: { id },
        data: {
          name,
          slug,
          description: description || undefined,
          iconPath: icon,
          sortOrder,
          zoneId: zoneId || null,
          status: body.status === "HIDDEN" || body.status === "DISABLED" ? body.status : BoardStatus.ACTIVE,
          allowPost: body.allowPost === undefined ? undefined : Boolean(body.allowPost),
          ...buildBoardAdvancedPayload(body as Record<string, unknown>),
        },
      })
      await writeAdminLog(admin.id, "board.update", "BOARD", id, `更新节点 ${name}`)
      return NextResponse.json({ code: 0, message: "节点已更新" })
    } catch (error) {
      return handleStructureMutationError(type, error)
    }
  }



  return NextResponse.json({ code: 400, message: "不支持的结构类型" }, { status: 400 })
}

export async function DELETE(request: Request) {
  const guard = await ensureAdmin()
  if (guard.error) return guard.error
  const { admin } = guard

  const requestIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip")?.trim() ?? null
  const body = await request.json()
  const type = String(body.type ?? "")
  const id = String(body.id ?? "")

  if (!type || !id) {
    return NextResponse.json({ code: 400, message: "缺少必要参数" }, { status: 400 })
  }

  if (type === "zone") {
    const boardCount = await prisma.board.count({ where: { zoneId: id } })
    if (boardCount > 0) {
      return NextResponse.json({ code: 400, message: "请先删除或迁移该分区下的节点" }, { status: 400 })
    }
    await prisma.zone.delete({ where: { id } })
    await writeAdminLog(admin.id, "zone.delete", "ZONE", id, "删除分区")
    return NextResponse.json({ code: 0, message: "分区已删除" })
  }

  if (type === "board") {
    const postCount = await prisma.post.count({ where: { boardId: id } })
    if (postCount > 0) {
      return NextResponse.json({ code: 400, message: "该节点下仍有帖子，不能直接删除" }, { status: 400 })
    }
    await prisma.board.delete({ where: { id } })
    await writeAdminLog(admin.id, "board.delete", "BOARD", id, "删除节点", requestIp)
    return NextResponse.json({ code: 0, message: "节点已删除" })
  }

  return NextResponse.json({ code: 400, message: "不支持的结构类型" }, { status: 400 })
}
