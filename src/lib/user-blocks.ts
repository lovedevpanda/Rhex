import { findBlockedUserIdsForViewer, findUserBlockRelationState } from "@/db/block-queries"
import { apiError } from "@/lib/api-route"

export interface UserBlockRelationState {
  hasBlocked: boolean
  isBlockedBy: boolean
  isBlocked: boolean
}

function createEmptyRelationState(): UserBlockRelationState {
  return {
    hasBlocked: false,
    isBlockedBy: false,
    isBlocked: false,
  }
}

export async function getUserBlockRelationState(viewerUserId: number | undefined, targetUserId: number): Promise<UserBlockRelationState> {
  if (!viewerUserId || viewerUserId === targetUserId) {
    return createEmptyRelationState()
  }

  const relation = await findUserBlockRelationState(viewerUserId, targetUserId)

  return {
    ...relation,
    isBlocked: relation.hasBlocked || relation.isBlockedBy,
  }
}

export async function getBlockedUserIdSetForViewer(viewerUserId: number | undefined, targetUserIds: number[]) {
  if (!viewerUserId) {
    return new Set<number>()
  }

  const blockedUserIds = await findBlockedUserIdsForViewer(viewerUserId, targetUserIds)
  return new Set(blockedUserIds)
}

export async function ensureUsersCanInteract(params: {
  actorId: number
  targetUserId: number
  blockedMessage?: string
  blockedByMessage?: string
  defaultMessage?: string
}) {
  const relation = await getUserBlockRelationState(params.actorId, params.targetUserId)

  if (relation.hasBlocked) {
    apiError(403, params.blockedMessage ?? params.defaultMessage ?? "你已拉黑该用户，无法继续操作")
  }

  if (relation.isBlockedBy) {
    apiError(403, params.blockedByMessage ?? params.defaultMessage ?? "对方已将你拉黑，无法继续操作")
  }

  return relation
}

export async function getUserProfileAccessState(viewerUserId: number | undefined, profileOwnerUserId: number) {
  const relation = await getUserBlockRelationState(viewerUserId, profileOwnerUserId)

  if (relation.isBlockedBy) {
    return {
      allowed: false,
      reason: "该用户已将你拉黑，当前无法访问其主页。",
      relation,
    }
  }

  return {
    allowed: true,
    reason: "",
    relation,
  }
}
