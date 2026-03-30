import { countUserBoardFollows, countUserFavorites, countUserLikedPosts, countUserPosts, countUserReplies, findUserBoardFollowsById, findUserFavoritePostsById, findUserLikedPostsById, findUserPostsById, findUserRepliesById } from "@/db/user-queries"
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

export interface UserPostsResult {
  items: ReturnType<typeof mapListPost>[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export interface UserRepliesResult {
  items: Array<{
    id: string
    content: string
    createdAt: string
    postId: string
    postTitle: string
    postSlug: string
    boardName: string
    likeCount: number
    replyToUsername?: string | null
  }>
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export interface UserLikedPostsResult {
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

function resolvePagination(options: { page?: number; pageSize?: number }, defaultPageSize: number) {
  const pageSize = Math.min(50, Math.max(1, normalizePositiveInteger(options.pageSize, defaultPageSize)))
  const requestedPage = normalizePositiveInteger(options.page, 1)

  return { pageSize, requestedPage }
}

function resolvePagedResult(total: number, pageSize: number, requestedPage: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
  }
}

function createEmptyPageResult(pageSize: number) {
  return {
    page: 1,
    pageSize,
    total: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  }
}

export async function getUserPosts(userId: number, options: { page?: number; pageSize?: number } = {}): Promise<UserPostsResult> {
  const { pageSize, requestedPage } = resolvePagination(options, 10)

  try {
    const total = await countUserPosts(userId)
    const pagination = resolvePagedResult(total, pageSize, requestedPage)
    const posts = await findUserPostsById(userId, { page: pagination.page, pageSize })

    return {
      items: posts.map(mapListPost),
      ...pagination,
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      ...createEmptyPageResult(pageSize),
    }
  }
}

export async function getUserFavoritePosts(userId: number, options: { page?: number; pageSize?: number } = {}): Promise<UserFavoritePostsResult> {
  const { pageSize, requestedPage } = resolvePagination(options, 10)

  try {
    const total = await countUserFavorites(userId)
    const pagination = resolvePagedResult(total, pageSize, requestedPage)
    const favorites = await findUserFavoritePostsById(userId, { page: pagination.page, pageSize })

    return {
      items: favorites.map((favorite) => mapListPost(favorite.post)),
      ...pagination,
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      ...createEmptyPageResult(pageSize),
    }
  }
}

export async function getUserReplies(userId: number, options: { page?: number; pageSize?: number } = {}): Promise<UserRepliesResult> {
  const { pageSize, requestedPage } = resolvePagination(options, 10)

  try {
    const total = await countUserReplies(userId)
    const pagination = resolvePagedResult(total, pageSize, requestedPage)
    const replies = await findUserRepliesById(userId, { page: pagination.page, pageSize })

    return {
      items: replies.map((reply) => ({
        id: reply.id,
        content: reply.content,
        createdAt: reply.createdAt.toISOString(),
        postId: reply.post.id,
        postTitle: reply.post.title,
        postSlug: reply.post.slug,
        boardName: reply.post.board.name,
        likeCount: reply.likeCount,
        replyToUsername: reply.replyToUser?.username ?? null,
      })),
      ...pagination,
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      ...createEmptyPageResult(pageSize),
    }
  }
}

export async function getUserLikedPosts(userId: number, options: { page?: number; pageSize?: number } = {}): Promise<UserLikedPostsResult> {
  const { pageSize, requestedPage } = resolvePagination(options, 10)

  try {
    const total = await countUserLikedPosts(userId)
    const pagination = resolvePagedResult(total, pageSize, requestedPage)
    const likes = await findUserLikedPostsById(userId, { page: pagination.page, pageSize })

    return {
      items: likes.flatMap((like) => (like.post ? [mapListPost(like.post)] : [])),
      ...pagination,
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      ...createEmptyPageResult(pageSize),
    }
  }
}

export async function getUserBoardFollows(userId: number, options: { page?: number; pageSize?: number } = {}): Promise<UserBoardFollowsResult> {
  const { pageSize, requestedPage } = resolvePagination(options, 12)

  try {
    const total = await countUserBoardFollows(userId)
    const pagination = resolvePagedResult(total, pageSize, requestedPage)
    const follows = await findUserBoardFollowsById(userId, { page: pagination.page, pageSize })

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
      ...pagination,
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      ...createEmptyPageResult(pageSize),
    }
  }
}
