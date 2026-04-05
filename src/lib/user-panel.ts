import {
  countUserBoardFollows,
  countUserFollowers,
  countUserPostFollows,
  countUserTagFollows,
  countUserUserFollows,
  findUserBoardFollowsByIdCursor,
  findUserFollowersByIdCursor,
  findUserPostFollowsByIdCursor,
  findUserTagFollowsByIdCursor,
  findUserUserFollowsByIdCursor,
} from "@/db/follow-queries"
import { countUserBlocks, findUserBlocksByIdCursor } from "@/db/block-queries"
import {
  countUserFavorites,
  countUserLikedPosts,
  countUserPosts,
  countUserReplies,
  findUserFavoritePostsByIdCursor,
  findUserLikedPostsByIdCursor,
  findUserPostsByIdCursor,
  findUserRepliesByIdCursor,
} from "@/db/user-queries"
import { decodeTimestampCursor, encodeTimestampCursor } from "@/lib/cursor-pagination"
import { mapListPost } from "@/lib/post-map"
import { normalizePositiveInteger } from "@/lib/shared/normalizers"
import { getUserDisplayName } from "@/lib/users"

interface CursorPageResultBase {
  pageSize: number
  total: number
  hasPrevPage: boolean
  hasNextPage: boolean
  prevCursor: string | null
  nextCursor: string | null
}

export interface UserFavoritePostsResult extends CursorPageResultBase {
  items: ReturnType<typeof mapListPost>[]
}

export interface UserPostsResult extends CursorPageResultBase {
  items: ReturnType<typeof mapListPost>[]
}

export interface UserRepliesResult extends CursorPageResultBase {
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
}

export interface UserLikedPostsResult extends CursorPageResultBase {
  items: ReturnType<typeof mapListPost>[]
}

export interface UserBoardFollowsResult extends CursorPageResultBase {
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
}

export interface UserUserFollowsResult extends CursorPageResultBase {
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
}

export interface UserFollowersResult extends CursorPageResultBase {
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
}

export interface UserTagFollowsResult extends CursorPageResultBase {
  items: Array<{
    id: string
    name: string
    slug: string
    postCount: number
    followerCount: number
  }>
}

export interface UserPostFollowsResult extends CursorPageResultBase {
  items: ReturnType<typeof mapListPost>[]
}

export interface UserBlocksResult extends CursorPageResultBase {
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
}

function resolvePageSize(options: { pageSize?: number }, defaultPageSize: number) {
  return Math.min(50, Math.max(1, normalizePositiveInteger(options.pageSize, defaultPageSize)))
}

function createCursorPageResult(total: number, pageSize: number, meta?: Partial<CursorPageResultBase>): CursorPageResultBase {
  return {
    pageSize,
    total,
    hasPrevPage: meta?.hasPrevPage ?? false,
    hasNextPage: meta?.hasNextPage ?? false,
    prevCursor: meta?.prevCursor ?? null,
    nextCursor: meta?.nextCursor ?? null,
  }
}

function encodeRowCursor(row?: { id: string; createdAt: Date } | null) {
  return row ? encodeTimestampCursor({ id: row.id, createdAt: row.createdAt.toISOString() }) : null
}

export async function getUserPosts(userId: number, options: { pageSize?: number; after?: string | null; before?: string | null } = {}): Promise<UserPostsResult> {
  const pageSize = resolvePageSize(options, 10)

  try {
    const afterCursor = decodeTimestampCursor(options.after)
    const beforeCursor = decodeTimestampCursor(options.before)
    const total = await countUserPosts(userId)
    const { items: posts, hasPrevPage, hasNextPage } = await findUserPostsByIdCursor({
      userId,
      pageSize,
      after: beforeCursor ? null : afterCursor,
      before: beforeCursor,
    })

    return {
      items: posts.map(mapListPost),
      ...createCursorPageResult(total, pageSize, {
        hasPrevPage,
        hasNextPage,
        prevCursor: encodeRowCursor(posts[0]),
        nextCursor: encodeRowCursor(posts.at(-1)),
      }),
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      ...createCursorPageResult(0, pageSize),
    }
  }
}

export async function getUserFavoritePosts(userId: number, options: { pageSize?: number; after?: string | null; before?: string | null } = {}): Promise<UserFavoritePostsResult> {
  const pageSize = resolvePageSize(options, 10)

  try {
    const afterCursor = decodeTimestampCursor(options.after)
    const beforeCursor = decodeTimestampCursor(options.before)
    const total = await countUserFavorites(userId)
    const { items: favorites, hasPrevPage, hasNextPage } = await findUserFavoritePostsByIdCursor({
      userId,
      pageSize,
      after: beforeCursor ? null : afterCursor,
      before: beforeCursor,
    })

    return {
      items: favorites.map((favorite) => mapListPost(favorite.post)),
      ...createCursorPageResult(total, pageSize, {
        hasPrevPage,
        hasNextPage,
        prevCursor: encodeRowCursor(favorites[0]),
        nextCursor: encodeRowCursor(favorites.at(-1)),
      }),
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      ...createCursorPageResult(0, pageSize),
    }
  }
}

export async function getUserReplies(userId: number, options: { pageSize?: number; after?: string | null; before?: string | null } = {}): Promise<UserRepliesResult> {
  const pageSize = resolvePageSize(options, 10)

  try {
    const afterCursor = decodeTimestampCursor(options.after)
    const beforeCursor = decodeTimestampCursor(options.before)
    const total = await countUserReplies(userId)
    const { items: replies, hasPrevPage, hasNextPage } = await findUserRepliesByIdCursor({
      userId,
      pageSize,
      after: beforeCursor ? null : afterCursor,
      before: beforeCursor,
    })

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
      ...createCursorPageResult(total, pageSize, {
        hasPrevPage,
        hasNextPage,
        prevCursor: encodeRowCursor(replies[0]),
        nextCursor: encodeRowCursor(replies.at(-1)),
      }),
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      ...createCursorPageResult(0, pageSize),
    }
  }
}

export async function getUserLikedPosts(userId: number, options: { pageSize?: number; after?: string | null; before?: string | null } = {}): Promise<UserLikedPostsResult> {
  const pageSize = resolvePageSize(options, 10)

  try {
    const afterCursor = decodeTimestampCursor(options.after)
    const beforeCursor = decodeTimestampCursor(options.before)
    const total = await countUserLikedPosts(userId)
    const { items: likes, hasPrevPage, hasNextPage } = await findUserLikedPostsByIdCursor({
      userId,
      pageSize,
      after: beforeCursor ? null : afterCursor,
      before: beforeCursor,
    })

    return {
      items: likes.flatMap((like) => (like.post ? [mapListPost(like.post)] : [])),
      ...createCursorPageResult(total, pageSize, {
        hasPrevPage,
        hasNextPage,
        prevCursor: encodeRowCursor(likes[0]),
        nextCursor: encodeRowCursor(likes.at(-1)),
      }),
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      ...createCursorPageResult(0, pageSize),
    }
  }
}

export async function getUserBoardFollows(userId: number, options: { pageSize?: number; after?: string | null; before?: string | null } = {}): Promise<UserBoardFollowsResult> {
  const pageSize = resolvePageSize(options, 12)

  try {
    const afterCursor = decodeTimestampCursor(options.after)
    const beforeCursor = decodeTimestampCursor(options.before)
    const total = await countUserBoardFollows(userId)
    const { items: follows, hasPrevPage, hasNextPage } = await findUserBoardFollowsByIdCursor({
      userId,
      pageSize,
      after: beforeCursor ? null : afterCursor,
      before: beforeCursor,
    })

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
      ...createCursorPageResult(total, pageSize, {
        hasPrevPage,
        hasNextPage,
        prevCursor: encodeRowCursor(follows[0]),
        nextCursor: encodeRowCursor(follows.at(-1)),
      }),
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      ...createCursorPageResult(0, pageSize),
    }
  }
}

export async function getUserUserFollows(userId: number, options: { pageSize?: number; after?: string | null; before?: string | null } = {}): Promise<UserUserFollowsResult> {
  const pageSize = resolvePageSize(options, 12)

  try {
    const afterCursor = decodeTimestampCursor(options.after)
    const beforeCursor = decodeTimestampCursor(options.before)
    const total = await countUserUserFollows(userId)
    const { items: follows, hasPrevPage, hasNextPage } = await findUserUserFollowsByIdCursor({
      userId,
      pageSize,
      after: beforeCursor ? null : afterCursor,
      before: beforeCursor,
    })

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
      ...createCursorPageResult(total, pageSize, {
        hasPrevPage,
        hasNextPage,
        prevCursor: encodeRowCursor(follows[0]),
        nextCursor: encodeRowCursor(follows.at(-1)),
      }),
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      ...createCursorPageResult(0, pageSize),
    }
  }
}

export async function getUserFollowers(userId: number, options: { pageSize?: number; after?: string | null; before?: string | null } = {}): Promise<UserFollowersResult> {
  const pageSize = resolvePageSize(options, 12)

  try {
    const afterCursor = decodeTimestampCursor(options.after)
    const beforeCursor = decodeTimestampCursor(options.before)
    const total = await countUserFollowers(userId)
    const { items: follows, hasPrevPage, hasNextPage } = await findUserFollowersByIdCursor({
      userId,
      pageSize,
      after: beforeCursor ? null : afterCursor,
      before: beforeCursor,
    })

    return {
      items: follows.map((follow) => ({
        id: follow.follower.id,
        username: follow.follower.username,
        displayName: getUserDisplayName(follow.follower),
        bio: follow.follower.bio?.trim() || "这个用户还没有留下简介。",
        avatarPath: follow.follower.avatarPath,
        status: follow.follower.status,
        level: follow.follower.level,
        postCount: follow.follower.postCount,
        commentCount: follow.follower.commentCount,
        likeReceivedCount: follow.follower.likeReceivedCount,
        followerCount: follow.follower._count.followedByUsers,
      })),
      ...createCursorPageResult(total, pageSize, {
        hasPrevPage,
        hasNextPage,
        prevCursor: encodeRowCursor(follows[0]),
        nextCursor: encodeRowCursor(follows.at(-1)),
      }),
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      ...createCursorPageResult(0, pageSize),
    }
  }
}

export async function getUserTagFollows(userId: number, options: { pageSize?: number; after?: string | null; before?: string | null } = {}): Promise<UserTagFollowsResult> {
  const pageSize = resolvePageSize(options, 18)

  try {
    const afterCursor = decodeTimestampCursor(options.after)
    const beforeCursor = decodeTimestampCursor(options.before)
    const total = await countUserTagFollows(userId)
    const { items: follows, hasPrevPage, hasNextPage } = await findUserTagFollowsByIdCursor({
      userId,
      pageSize,
      after: beforeCursor ? null : afterCursor,
      before: beforeCursor,
    })

    return {
      items: follows.map((follow) => ({
        id: follow.tag.id,
        name: follow.tag.name,
        slug: follow.tag.slug,
        postCount: follow.tag.postCount,
        followerCount: follow.tag._count.followers,
      })),
      ...createCursorPageResult(total, pageSize, {
        hasPrevPage,
        hasNextPage,
        prevCursor: encodeRowCursor(follows[0]),
        nextCursor: encodeRowCursor(follows.at(-1)),
      }),
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      ...createCursorPageResult(0, pageSize),
    }
  }
}

export async function getUserPostFollows(userId: number, options: { pageSize?: number; after?: string | null; before?: string | null } = {}): Promise<UserPostFollowsResult> {
  const pageSize = resolvePageSize(options, 10)

  try {
    const afterCursor = decodeTimestampCursor(options.after)
    const beforeCursor = decodeTimestampCursor(options.before)
    const total = await countUserPostFollows(userId)
    const { items: follows, hasPrevPage, hasNextPage } = await findUserPostFollowsByIdCursor({
      userId,
      pageSize,
      after: beforeCursor ? null : afterCursor,
      before: beforeCursor,
    })

    return {
      items: follows.map((follow) => mapListPost(follow.post)),
      ...createCursorPageResult(total, pageSize, {
        hasPrevPage,
        hasNextPage,
        prevCursor: encodeRowCursor(follows[0]),
        nextCursor: encodeRowCursor(follows.at(-1)),
      }),
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      ...createCursorPageResult(0, pageSize),
    }
  }
}

export async function getUserBlocks(userId: number, options: { pageSize?: number; after?: string | null; before?: string | null } = {}): Promise<UserBlocksResult> {
  const pageSize = resolvePageSize(options, 12)

  try {
    const afterCursor = decodeTimestampCursor(options.after)
    const beforeCursor = decodeTimestampCursor(options.before)
    const total = await countUserBlocks(userId)
    const { items: blocks, hasPrevPage, hasNextPage } = await findUserBlocksByIdCursor({
      blockerId: userId,
      pageSize,
      after: beforeCursor ? null : afterCursor,
      before: beforeCursor,
    })

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
      ...createCursorPageResult(total, pageSize, {
        hasPrevPage,
        hasNextPage,
        prevCursor: encodeRowCursor(blocks[0]),
        nextCursor: encodeRowCursor(blocks.at(-1)),
      }),
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      ...createCursorPageResult(0, pageSize),
    }
  }
}
