import { Prisma } from "@/db/types"
import {
  BoardStatus,
  countBoardsByZone,
  countPostsByBoard,
  createBoard,
  createZone,
  deleteBoard,
  deleteZone,
  updateBoard,
  updateZone,
} from "@/db/admin-structure-queries"

import { apiError, readOptionalNumberField, readOptionalStringField, type JsonObject } from "@/lib/api-route"
import type { AdminActor } from "@/lib/moderator-permissions"
import { ensureCanEditBoard, ensureCanEditZone, isSiteAdmin } from "@/lib/moderator-permissions"

import { DEFAULT_ALLOWED_POST_TYPES_VALUE, serializePostTypes } from "@/lib/post-types"
import { normalizeNullablePostListDisplayMode } from "@/lib/post-list-display"


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
    postListDisplayMode: normalizeNullablePostListDisplayMode(body.postListDisplayMode) ?? undefined,
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
    postListDisplayMode: normalizeNullablePostListDisplayMode(body.postListDisplayMode) ?? null,
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
      apiError(409, message)
    }
  }

  throw error
}

export async function createStructureItem(params: {
  body: JsonObject
  adminId: number
  actor: AdminActor
}) {
  if (!isSiteAdmin(params.actor)) {
    apiError(403, "仅管理员可创建分区或节点")
  }

  const rawBody = params.body as Record<string, unknown>
  const type = readOptionalStringField(rawBody, "type")
  const name = readOptionalStringField(rawBody, "name")
  const slug = readOptionalStringField(rawBody, "slug")
  const description = readOptionalStringField(rawBody, "description")
  const sortOrder = readOptionalNumberField(rawBody, "sortOrder") ?? 0

  if (!type || !name || !slug) {
    apiError(400, "名称和标识不能为空")
  }

  if (type === "zone") {
    try {
      const icon = readOptionalStringField(rawBody, "icon") || "📚"
      const zone = await createZone(buildZonePayload(rawBody, sortOrder, name, slug, description, icon))

      return { message: "分区已创建", data: { id: zone.id }, action: "zone.create", targetType: "ZONE", targetId: zone.id, detail: `创建分区 ${name}` }
    } catch (error) {
      handleStructureMutationError(type, error)
    }
  }

  if (type === "board") {
    const zoneId = readOptionalStringField(rawBody, "zoneId")
    if (!zoneId) {
      apiError(400, "请选择所属分区")
    }

    try {
      const icon = readOptionalStringField(rawBody, "icon") || "💬"
      const board = await createBoard({
        zoneId,
        name,
        slug,
        description: description || undefined,
        iconPath: icon,
        sortOrder,
        status: BoardStatus.ACTIVE,
        ...buildBoardAdvancedPayload(rawBody),
      })

      return { message: "节点已创建", data: { id: board.id }, action: "board.create", targetType: "BOARD", targetId: board.id, detail: `创建节点 ${name}` }
    } catch (error) {
      handleStructureMutationError(type, error)
    }
  }

  apiError(400, "不支持的结构类型")
}

export async function updateStructureItem(params: {
  body: JsonObject
  adminId: number
  actor: AdminActor
}) {
  const rawBody = params.body as Record<string, unknown>
  const type = readOptionalStringField(rawBody, "type")
  const id = readOptionalStringField(rawBody, "id")
  const name = readOptionalStringField(rawBody, "name")
  const slug = readOptionalStringField(rawBody, "slug")
  const description = readOptionalStringField(rawBody, "description")
  const sortOrder = readOptionalNumberField(rawBody, "sortOrder") ?? 0

  if (!type || !id || !name || !slug) {
    apiError(400, "缺少必要参数")
  }

  if (type === "zone") {
    try {
      await ensureCanEditZone(params.actor, id)
      const icon = readOptionalStringField(rawBody, "icon") || "📚"
      await updateZone(id, buildZonePayload(rawBody, sortOrder, name, slug, description, icon))

      return { message: "分区已更新", action: "zone.update", targetType: "ZONE", targetId: id, detail: `更新分区 ${name}` }
    } catch (error) {
      handleStructureMutationError(type, error)
    }
  }

  if (type === "board") {
    try {
      const currentBoard = await ensureCanEditBoard(params.actor, id)
      const zoneId = readOptionalStringField(rawBody, "zoneId")
      if (!isSiteAdmin(params.actor) && (zoneId || null) !== currentBoard.zoneId) {
        apiError(403, "版主不能调整节点所属分区")
      }
      const icon = readOptionalStringField(rawBody, "icon") || "💬"
      await updateBoard(id, {
        name,
        slug,
        description: description || undefined,
        iconPath: icon,
        sortOrder,
        zoneId: zoneId || null,
        status: rawBody.status === "HIDDEN" || rawBody.status === "DISABLED" ? rawBody.status as BoardStatus : BoardStatus.ACTIVE,
        allowPost: rawBody.allowPost === undefined ? undefined : Boolean(rawBody.allowPost),
        ...buildBoardAdvancedPayload(rawBody),
      })

      return { message: "节点已更新", action: "board.update", targetType: "BOARD", targetId: id, detail: `更新节点 ${name}` }
    } catch (error) {
      handleStructureMutationError(type, error)
    }
  }

  apiError(400, "不支持的结构类型")
}

export async function deleteStructureItem(params: {
  body: JsonObject
  adminId: number
  requestIp: string | null
  actor: AdminActor
}) {
  if (!isSiteAdmin(params.actor)) {
    apiError(403, "仅管理员可删除分区或节点")
  }

  const rawBody = params.body as Record<string, unknown>
  const type = readOptionalStringField(rawBody, "type")
  const id = readOptionalStringField(rawBody, "id")

  if (!type || !id) {
    apiError(400, "缺少必要参数")
  }

  if (type === "zone") {
    const boardCount = await countBoardsByZone(id)

    if (boardCount > 0) {
      apiError(400, "请先删除或迁移该分区下的节点")
    }

    await deleteZone(id)

    return { message: "分区已删除", action: "zone.delete", targetType: "ZONE", targetId: id, detail: "删除分区" }
  }

  if (type === "board") {
    const postCount = await countPostsByBoard(id)

    if (postCount > 0) {
      apiError(400, "该节点下仍有帖子，不能直接删除")
    }

    await deleteBoard(id)

    return { message: "节点已删除", action: "board.delete", targetType: "BOARD", targetId: id, detail: "删除节点" }
  }

  apiError(400, "不支持的结构类型")
}
