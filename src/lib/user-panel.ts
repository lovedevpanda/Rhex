import {
  countUserBoardFollows,
  countUserPostFollows,
  countUserTagFollows,
  countUserUserFollows,
  findUserBoardFollowsById,
  findUserPostFollowsById,
  findUserTagFollowsById,
  findUserUserFollowsById,
} from "@/db/follow-queries"
import { countUserBlocks, findUserBlocksById } from "@/db/block-queries"
import { countUserFavorites, countUserLikedPosts, countUserPosts, countUserReplies, findUserFavoritePostsById, findUserLikedPostsById, findUserPostsById, findUserRepliesById } from "@/db/user-queries"
import { mapListPost } from "@/lib/post-map"
import { normalizePositiveInteger } from "@/lib/shared/normalizers"
import { getUserDisplayName } from "@/lib/users"

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

export interface UserUserFollowsResult {
  items: Array<{
    id: number
    username: string
    displayName: string
    bio: string
    avatarPath?: string | null
    status: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
    level: number
    postCount: number
    commentCount: number
    likeReceivedCount: number
    followerCount: number
  }>
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export interface UserTagFollowsResult {
  items: Array<{
    id: string
    name: string
    slug: string
    postCount: number
    followerCount: number
  }>
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export interface UserPostFollowsResult {
  items: ReturnType<typeof mapListPost>[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export interface UserBlocksResult {
  items: Array<{
    id: number
    username: string
    displayName: string
    bio: string
    avatarPath?: string | null
    status: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
    level: number
    postCount: number
    commentCount: number
    likeReceivedCount: number
    followerCount: number
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

export async function getUserUserFollows(userId: number, options: { page?: number; pageSize?: number } = {}): Promise<UserUserFollowsResult> {
  const { pageSize, requestedPage } = resolvePagination(options, 12)

  try {
    const total = await countUserUserFollows(userId)
    const pagination = resolvePagedResult(total, pageSize, requestedPage)
    const follows = await findUserUserFollowsById(userId, { page: pagination.page, pageSize })

    return {
      items: follows.map((follow) => ({
        id: follow.following.id,
        username: follow.following.username,
        displayName: getUserDisplayName(follow.following),
        bio: follow.following.bio?.trim() || "这个用户还没有留下简介。",
        avatarPath: follow.following.avatarPath,
        status: follow.following.status,
        level: follow.following.level,
        postCount: follow.following.postCount,
        commentCount: follow.following.commentCount,
        likeReceivedCount: follow.following.likeReceivedCount,
        followerCount: follow.following._count.followedByUsers,
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

export async function getUserTagFollows(userId: number, options: { page?: number; pageSize?: number } = {}): Promise<UserTagFollowsResult> {
  const { pageSize, requestedPage } = resolvePagination(options, 18)

  try {
    const total = await countUserTagFollows(userId)
    const pagination = resolvePagedResult(total, pageSize, requestedPage)
    const follows = await findUserTagFollowsById(userId, { page: pagination.page, pageSize })

    return {
      items: follows.map((follow) => ({
        id: follow.tag.id,
        name: follow.tag.name,
        slug: follow.tag.slug,
        postCount: follow.tag._count.posts,
        followerCount: follow.tag._count.followers,
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

export async function getUserPostFollows(userId: number, options: { page?: number; pageSize?: number } = {}): Promise<UserPostFollowsResult> {
  const { pageSize, requestedPage } = resolvePagination(options, 10)

  try {
    const total = await countUserPostFollows(userId)
    const pagination = resolvePagedResult(total, pageSize, requestedPage)
    const follows = await findUserPostFollowsById(userId, { page: pagination.page, pageSize })

    return {
      items: follows.map((follow) => mapListPost(follow.post)),
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

export async function getUserBlocks(userId: number, options: { page?: number; pageSize?: number } = {}): Promise<UserBlocksResult> {
  const { pageSize, requestedPage } = resolvePagination(options, 12)

  try {
    const total = await countUserBlocks(userId)
    const pagination = resolvePagedResult(total, pageSize, requestedPage)
    const blocks = await findUserBlocksById(userId, { page: pagination.page, pageSize })

    return {
      items: blocks.map((block) => ({
        id: block.blocked.id,
        username: block.blocked.username,
        displayName: getUserDisplayName(block.blocked),
        bio: block.blocked.bio?.trim() || "这个用户还没有留下简介。",
        avatarPath: block.blocked.avatarPath,
        status: block.blocked.status,
        level: block.blocked.level,
        postCount: block.blocked.postCount,
        commentCount: block.blocked.commentCount,
        likeReceivedCount: block.blocked.likeReceivedCount,
        followerCount: block.blocked._count.followedByUsers,
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
