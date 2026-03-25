import { prisma } from "@/db/client"

export function findBoardWithZoneBySlug(boardSlug: string) {
  return prisma.board.findUnique({
    where: { slug: boardSlug },
    include: {
      zone: true,
    },
  })
}

export function findPostWithBoardZoneById(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    include: {
      board: {
        include: {
          zone: true,
        },
      },
    },
  })
}

export function findBoardFollow(userId: number, boardId: string) {
  return prisma.boardFollow.findUnique({
    where: {
      userId_boardId: {
        userId,
        boardId,
      },
    },
    select: {
      boardId: true,
    },
  })
}
