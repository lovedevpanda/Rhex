import { BoardStatus, CommentStatus } from "@/db/types"

import { prisma } from "@/db/client"

export function hideCommentById(commentId: string) {
  return prisma.comment.update({
    where: { id: commentId },
    data: { status: CommentStatus.HIDDEN },
  })
}

export function showCommentById(commentId: string) {
  return prisma.comment.update({
    where: { id: commentId },
    data: { status: CommentStatus.NORMAL },
  })
}

export function findBoardPostingState(boardId: string) {
  return prisma.board.findUnique({
    where: { id: boardId },
    select: { allowPost: true },
  })
}

export function updateBoardPostingState(boardId: string, allowPost: boolean) {
  return prisma.board.update({
    where: { id: boardId },
    data: { allowPost },
  })
}

export function findBoardVisibilityState(boardId: string) {
  return prisma.board.findUnique({
    where: { id: boardId },
    select: { status: true },
  })
}

export function updateBoardVisibilityState(boardId: string, status: BoardStatus) {
  return prisma.board.update({
    where: { id: boardId },
    data: { status },
  })
}
