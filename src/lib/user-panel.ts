import { countUserBoardFollows, countUserFavorites, findUserBoardFollowsById, findUserFavoritesById } from "@/db/user-queries"
import { mapListPost } from "@/lib/post-map"
import { normalizePositiveInteger } from "@/lib/shared/normalizers"

export interface UserFavoritePostsResult {
  items: ReturnType<typeof mapListPost>[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export interface UserBoardFollowsResult {
  items: Array<{
    id: string
    name: string
    slug: string
    description?: string | null
    iconPath?: string | null
    followerCount: number
    postCount: number
    zoneName?: string | null
    zoneSlug?: string | null
  }>
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export async function getUserFavoritePosts(userId: number, options: { page?: number; pageSize?: number } = {}): Promise<UserFavoritePostsResult> {
  const pageSize = Math.max(1, normalizePositiveInteger(options.pageSize, 10))
  const requestedPage = normalizePositiveInteger(options.page, 1)

  try {
    const total = await countUserFavorites(userId)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const page = Math.min(requestedPage, totalPages)
    const favorites = await findUserFavoritesById(userId, { page, pageSize })

    return {
      items: favorites.map((favorite) => mapListPost(favorite.post)),
      page,
      pageSize,
      total,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      page: 1,
      pageSize,
      total: 0,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
    }
  }
}

export async function getUserBoardFollows(userId: number, options: { page?: number; pageSize?: number } = {}): Promise<UserBoardFollowsResult> {
  const pageSize = Math.max(1, normalizePositiveInteger(options.pageSize, 12))
  const requestedPage = normalizePositiveInteger(options.page, 1)

  try {
    const total = await countUserBoardFollows(userId)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const page = Math.min(requestedPage, totalPages)
    const follows = await findUserBoardFollowsById(userId, { page, pageSize })

    return {
      items: follows.map((follow) => ({
        id: follow.board.id,
        name: follow.board.name,
        slug: follow.board.slug,
        description: follow.board.description,
        iconPath: follow.board.iconPath,
        followerCount: follow.board.followerCount,
        postCount: follow.board.postCount,
        zoneName: follow.board.zone?.name ?? null,
        zoneSlug: follow.board.zone?.slug ?? null,
      })),
      page,
      pageSize,
      total,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      page: 1,
      pageSize,
      total: 0,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
    }
  }
}
