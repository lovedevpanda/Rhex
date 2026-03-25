import { findBoardWithZoneBySlug, findPostWithBoardZoneById } from "@/db/board-queries"
import { canUserAccess, resolveBoardSettings } from "@/lib/board-settings"


export async function getBoardAccessContextBySlug(boardSlug: string) {
  const board = await findBoardWithZoneBySlug(boardSlug)


  if (!board) {
    return null
  }

  return {
    board,
    zone: board.zone,
    settings: resolveBoardSettings(board.zone, board),
  }
}

export async function getBoardAccessContextByPostId(postId: string) {
  const post = await findPostWithBoardZoneById(postId)


  if (!post) {
    return null
  }

  return {
    post,
    board: post.board,
    zone: post.board.zone,
    settings: resolveBoardSettings(post.board.zone, post.board),
  }
}

export function checkBoardPermission(user: { points: number; level: number; vipLevel?: number; vipExpiresAt?: Date | null } | null, settings: ReturnType<typeof resolveBoardSettings>, action: "view" | "post" | "reply") {
  return canUserAccess(user ? { ...user, vipLevel: user.vipLevel ?? 0, vipExpiresAt: user.vipExpiresAt ?? null } : null, settings, action)
}


