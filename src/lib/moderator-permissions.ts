import type { Prisma } from "@/db/types"
import { PinScope, UserRole } from "@/db/types"

import {
  findManagedBoardContext,
  findManagedCommentContext,
  findManagedPostContext,
  findManagedUserContext,
  findManagedZoneContext,
  findModeratorActorById,
  type ModeratorScopeRecord,
} from "@/db/admin-actor-queries"
import { getCurrentUser, type SessionActor } from "@/lib/auth"
import { apiError } from "@/lib/api-route"

export interface AdminActor {
  id: number
  username: string
  nickname: string | null
  role: "ADMIN" | "MODERATOR"
  status: SessionActor["status"]
  moderatedZoneScopes: Array<{
    zoneId: string
    zoneName: string
    zoneSlug: string
    canEditSettings: boolean
  }>
  moderatedBoardScopes: Array<{
    boardId: string
    boardName: string
    boardSlug: string
    zoneId: string | null
    zoneName: string | null
    zoneSlug: string | null
    canEditSettings: boolean
  }>
}

function mapAdminActor(record: SessionActor | ModeratorScopeRecord): AdminActor {
  return {
    id: record.id,
    username: record.username,
    nickname: record.nickname,
    role: record.role as "ADMIN" | "MODERATOR",
    status: record.status,
    moderatedZoneScopes: "moderatedZoneScopes" in record
      ? record.moderatedZoneScopes.map((scope) => ({
          zoneId: scope.zoneId,
          zoneName: scope.zone.name,
          zoneSlug: scope.zone.slug,
          canEditSettings: scope.canEditSettings,
        }))
      : [],
    moderatedBoardScopes: "moderatedBoardScopes" in record
      ? record.moderatedBoardScopes.map((scope) => ({
          boardId: scope.boardId,
          boardName: scope.board.name,
          boardSlug: scope.board.slug,
          zoneId: scope.board.zoneId ?? null,
          zoneName: scope.board.zone?.name ?? null,
          zoneSlug: scope.board.zone?.slug ?? null,
          canEditSettings: scope.canEditSettings,
        }))
      : [],
  }
}

export function isSiteAdmin(actor: AdminActor | null | undefined) {
  return actor?.role === UserRole.ADMIN
}

export function isScopedModerator(actor: AdminActor | null | undefined) {
  return actor?.role === UserRole.MODERATOR
}

export function getManagedZoneIds(actor: AdminActor) {
  return [...new Set(actor.moderatedZoneScopes.map((scope) => scope.zoneId))]
}

export function getManagedBoardIds(actor: AdminActor) {
  return [...new Set(actor.moderatedBoardScopes.map((scope) => scope.boardId))]
}

export function buildManagedBoardWhereInput(actor: AdminActor): Prisma.BoardWhereInput | undefined {
  if (isSiteAdmin(actor)) {
    return undefined
  }

  const zoneIds = getManagedZoneIds(actor)
  const boardIds = getManagedBoardIds(actor)
  const or: Prisma.BoardWhereInput[] = []

  if (zoneIds.length > 0) {
    or.push({ zoneId: { in: zoneIds } })
  }

  if (boardIds.length > 0) {
    or.push({ id: { in: boardIds } })
  }

  return or.length > 0 ? { OR: or } : { id: { in: [] } }
}

export function buildManagedZoneWhereInput(actor: AdminActor): Prisma.ZoneWhereInput | undefined {
  if (isSiteAdmin(actor)) {
    return undefined
  }

  const zoneIds = getManagedZoneIds(actor)
  return zoneIds.length > 0 ? { id: { in: zoneIds } } : { id: { in: [] } }
}

export function buildManagedPostWhereInput(actor: AdminActor): Prisma.PostWhereInput | undefined {
  if (isSiteAdmin(actor)) {
    return undefined
  }

  const zoneIds = getManagedZoneIds(actor)
  const boardIds = getManagedBoardIds(actor)
  const or: Prisma.PostWhereInput[] = []

  if (zoneIds.length > 0) {
    or.push({ board: { zoneId: { in: zoneIds } } })
  }

  if (boardIds.length > 0) {
    or.push({ boardId: { in: boardIds } })
  }

  return or.length > 0 ? { OR: or } : { id: { in: [] } }
}

export async function resolveAdminActorFromSessionUser(user: SessionActor | null): Promise<AdminActor | null> {
  if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MODERATOR)) {
    return null
  }

  if (user.role === UserRole.ADMIN) {
    return mapAdminActor(user)
  }

  const moderator = await findModeratorActorById(user.id)

  if (!moderator || moderator.role !== UserRole.MODERATOR) {
    return null
  }

  return mapAdminActor(moderator)
}

export async function requireAdminActor() {
  return resolveAdminActorFromSessionUser(await getCurrentUser())
}

export async function requireSiteAdminActor() {
  const actor = await requireAdminActor()
  if (!actor || !isSiteAdmin(actor)) {
    return null
  }
  return actor
}

export function canManageZone(actor: AdminActor, zoneId: string | null | undefined) {
  if (isSiteAdmin(actor)) {
    return true
  }

  if (!zoneId) {
    return false
  }

  return actor.moderatedZoneScopes.some((scope) => scope.zoneId === zoneId)
}

export function canManageBoard(actor: AdminActor, boardId: string, zoneId?: string | null) {
  if (isSiteAdmin(actor)) {
    return true
  }

  if (actor.moderatedBoardScopes.some((scope) => scope.boardId === boardId)) {
    return true
  }

  return canManageZone(actor, zoneId)
}

export function canEditZoneSettings(actor: AdminActor, zoneId: string | null | undefined) {
  if (isSiteAdmin(actor)) {
    return true
  }

  if (!zoneId) {
    return false
  }

  return actor.moderatedZoneScopes.some((scope) => scope.zoneId === zoneId && scope.canEditSettings)
}

export function canEditBoardSettings(actor: AdminActor, boardId: string, zoneId?: string | null) {
  if (isSiteAdmin(actor)) {
    return true
  }

  if (actor.moderatedBoardScopes.some((scope) => scope.boardId === boardId && scope.canEditSettings)) {
    return true
  }

  return canEditZoneSettings(actor, zoneId)
}

export function canWithdrawBoardTreasury(actor: AdminActor, boardId: string, options?: {
  zoneId?: string | null
  moderatorsCanWithdrawBoardTreasury?: boolean
}) {
  if (isSiteAdmin(actor)) {
    return true
  }

  if (!options?.moderatorsCanWithdrawBoardTreasury) {
    return false
  }

  return canManageBoard(actor, boardId, options.zoneId)
}

export function getAvailablePinScopes(actor: AdminActor, options: { zoneId?: string | null; currentPinScope?: PinScope | null }) {
  if (isSiteAdmin(actor)) {
    return [PinScope.NONE, PinScope.BOARD, PinScope.ZONE, PinScope.GLOBAL]
  }

  if (options.currentPinScope === PinScope.GLOBAL) {
    return [] as PinScope[]
  }

  const canUseZonePin = Boolean(options.zoneId && canManageZone(actor, options.zoneId))

  if (options.currentPinScope === PinScope.ZONE && !canUseZonePin) {
    return [] as PinScope[]
  }

  const scopes: PinScope[] = [PinScope.NONE, PinScope.BOARD]

  if (canUseZonePin) {
    scopes.push(PinScope.ZONE)
  }

  return scopes
}

export async function getManagedPostContext(postId: string) {
  return findManagedPostContext(postId)
}

export async function ensureCanManagePost(actor: AdminActor, postId: string) {
  const post = await getManagedPostContext(postId)
  if (!post) {
    apiError(404, "帖子不存在")
  }

  if (!canManageBoard(actor, post.boardId, post.board.zoneId)) {
    apiError(403, "无权管理该帖子")
  }

  return post
}

export async function getManagedCommentContext(commentId: string) {
  return findManagedCommentContext(commentId)
}

export async function ensureCanManageComment(actor: AdminActor, commentId: string) {
  const comment = await getManagedCommentContext(commentId)
  if (!comment) {
    apiError(404, "评论不存在")
  }

  if (!canManageBoard(actor, comment.post.boardId, comment.post.board.zoneId)) {
    apiError(403, "无权管理该评论")
  }

  return comment
}

export async function getManagedBoardContext(boardId: string) {
  return findManagedBoardContext(boardId)
}

export async function ensureCanManageBoard(actor: AdminActor, boardId: string) {
  const board = await getManagedBoardContext(boardId)
  if (!board) {
    apiError(404, "节点不存在")
  }

  if (!canManageBoard(actor, board.id, board.zoneId)) {
    apiError(403, "无权管理该节点")
  }

  return board
}

export async function ensureCanEditBoard(actor: AdminActor, boardId: string) {
  const board = await ensureCanManageBoard(actor, boardId)
  if (!canEditBoardSettings(actor, board.id, board.zoneId)) {
    apiError(403, "无权修改该节点设置")
  }
  return board
}

export async function getManagedZoneContext(zoneId: string) {
  return findManagedZoneContext(zoneId)
}

export async function ensureCanManageZone(actor: AdminActor, zoneId: string) {
  const zone = await getManagedZoneContext(zoneId)
  if (!zone) {
    apiError(404, "分区不存在")
  }

  if (!canManageZone(actor, zone.id)) {
    apiError(403, "无权管理该分区")
  }

  return zone
}

export async function ensureCanEditZone(actor: AdminActor, zoneId: string) {
  const zone = await ensureCanManageZone(actor, zoneId)
  if (!canEditZoneSettings(actor, zone.id)) {
    apiError(403, "无权修改该分区设置")
  }
  return zone
}

export async function ensureCanModerateUser(actor: AdminActor, params: {
  targetUserId: number
  postId?: string
  commentId?: string
}) {
  if (isSiteAdmin(actor)) {
    return
  }

  const targetUser = await findManagedUserContext(params.targetUserId)
  if (!targetUser) {
    apiError(404, "用户不存在")
  }

  if (targetUser.role !== UserRole.USER) {
    apiError(403, "版主不能操作管理员或版主账号")
  }

  if (params.commentId) {
    const comment = await ensureCanManageComment(actor, params.commentId)
    if (comment.userId !== params.targetUserId) {
      apiError(403, "无权修改该用户状态")
    }
    return
  }

  if (params.postId) {
    const post = await ensureCanManagePost(actor, params.postId)
    if (post.authorId !== params.targetUserId) {
      apiError(403, "无权修改该用户状态")
    }
    return
  }

  apiError(400, "版主执行用户状态操作时必须绑定所属帖子或评论")
}
