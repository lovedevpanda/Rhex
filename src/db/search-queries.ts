import { prisma } from "@/db/client"
import type { Prisma } from "@/db/types"
import { pinnedPostOrderBy } from "@/db/queries"

const searchPostListSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  content: true,
  coverPath: true,
  type: true,
  status: true,
  isPinned: true,
  pinScope: true,
  isFeatured: true,
  minViewLevel: true,
  minViewVipLevel: true,
  commentCount: true,
  likeCount: true,
  favoriteCount: true,
  viewCount: true,
  tipCount: true,
  tipTotalPoints: true,
  publishedAt: true,
  createdAt: true,
  board: {
    select: {
      name: true,
      slug: true,
      iconPath: true,
    },
  },
  author: {
    select: {
      id: true,
      username: true,
      nickname: true,
      avatarPath: true,
      status: true,
      vipLevel: true,
      vipExpiresAt: true,
    },
  },
  redPacket: {
    select: {
      id: true,
    },
  },
} satisfies Prisma.PostSelect

export function buildPostSearchWhere(keyword: string) {
  return {
    status: "NORMAL" as const,
    OR: [
      { title: { contains: keyword, mode: "insensitive" as const } },
      { summary: { contains: keyword, mode: "insensitive" as const } },
      { author: { username: { contains: keyword, mode: "insensitive" as const } } },
      { author: { nickname: { contains: keyword, mode: "insensitive" as const } } },
      { board: { name: { contains: keyword, mode: "insensitive" as const } } },
    ],
  }
}

export function countSearchPosts(where: ReturnType<typeof buildPostSearchWhere>) {
  return prisma.post.count({ where })
}

export function findSearchPosts(params: {
  where: ReturnType<typeof buildPostSearchWhere>
  page: number
  pageSize: number
}) {
  const normalizedPageSize = Math.min(Math.max(1, params.pageSize), 50)

  return prisma.post.findMany({
    where: params.where,
    select: searchPostListSelect,
    orderBy: pinnedPostOrderBy,
    skip: (params.page - 1) * normalizedPageSize,
    take: normalizedPageSize,
  })
}
