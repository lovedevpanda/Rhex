import { BoardStatus, PinScope, PostStatus } from "@/db/types"

import { prisma } from "@/db/client"

export function findPostFeatureState(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    select: { isFeatured: true },
  })
}

export function updatePostFeatureState(postId: string, isFeatured: boolean) {
  return prisma.post.update({
    where: { id: postId },
    data: { isFeatured },
  })
}

export function findPostPinState(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    select: { isPinned: true },
  })
}

export function updatePostPinState(postId: string, isPinned: boolean, pinScope: PinScope) {

  return prisma.post.update({
    where: { id: postId },
    data: { isPinned, pinScope },
  })
}

export function updatePostStatus(postId: string, status: PostStatus, reviewNote?: string | null, publishedAt?: Date) {
  return prisma.post.update({
    where: { id: postId },
    data: {
      status,
      reviewNote,
      publishedAt,
    },
  })
}

export function findPostMoveBoardContext(postId: string, boardSlug: string) {
  return Promise.all([
    prisma.post.findUnique({
      where: { id: postId },
      select: {
        slug: true,
        boardId: true,
        board: { select: { slug: true, name: true } },
      },
    }),
    prisma.board.findUnique({
      where: { slug: boardSlug },
      select: { id: true, slug: true, name: true, status: true },
    }),
  ])
}

export function movePostToBoard(postId: string, boardId: string) {
  return prisma.post.update({
    where: { id: postId },
    data: { boardId },
  })
}

export { BoardStatus }
