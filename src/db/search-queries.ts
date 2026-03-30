import { prisma } from "@/db/client"
import { pinnedPostOrderBy, postListInclude } from "@/db/queries"

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
    include: postListInclude,
    orderBy: pinnedPostOrderBy,
    skip: (params.page - 1) * normalizedPageSize,
    take: normalizedPageSize,
  })
}
