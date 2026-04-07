import type { Prisma } from "@/db/types"

import { prisma } from "@/db/client"
import { postListInclude } from "@/db/queries"
import type { TimestampCursorPayload } from "@/lib/cursor-pagination"

export const FOLLOW_TARGET_TYPES = ["board", "user", "tag", "post"] as const

export type FollowTargetType = (typeof FOLLOW_TARGET_TYPES)[number]

function isKnownPrismaError(error: unknown, code: string) {
  return error instanceof Error && "code" in error && (error as { code?: string }).code === code
}

function normalizeUserTargetId(targetId: string) {
  const userId = Number(targetId)
  return Number.isInteger(userId) && userId > 0 ? userId : null
}

export async function findFollowRecord(params: {
  userId: number
  targetType: FollowTargetType
  targetId: string | number
}) {
  switch (params.targetType) {
    case "board":
      return prisma.boardFollow.findUnique({
        where: {
          userId_boardId: {
            userId: params.userId,
            boardId: String(params.targetId),
          },
        },
        select: { id: true },
      })
    case "user": {
      const followingId = typeof params.targetId === "number" ? params.targetId : normalizeUserTargetId(String(params.targetId))
      if (!followingId) {
        return null
      }

      return prisma.userFollow.findUnique({
        where: {
          followerId_followingId: {
            followerId: params.userId,
            followingId,
          },
        },
        select: { id: true },
      })
    }
    case "tag":
      return prisma.tagFollow.findUnique({
        where: {
          userId_tagId: {
            userId: params.userId,
            tagId: String(params.targetId),
          },
        },
        select: { id: true },
      })
    case "post":
      return prisma.postFollow.findUnique({
        where: {
          userId_postId: {
            userId: params.userId,
            postId: String(params.targetId),
          },
        },
        select: { id: true },
      })
  }
}

export async function toggleFollowTarget(params: {
  userId: number
  targetType: FollowTargetType
  targetId: string
  desiredFollowed?: boolean
}) {
  switch (params.targetType) {
    case "board":
      return prisma.$transaction(async (tx) => {
        const board = await tx.board.findUnique({
          where: { id: params.targetId },
          select: { id: true },
        })

        if (!board) {
          return { status: "missing" as const }
        }

        const existing = await tx.boardFollow.findUnique({
          where: {
            userId_boardId: {
              userId: params.userId,
              boardId: params.targetId,
            },
          },
          select: { id: true },
        })

        if (existing) {
          if (params.desiredFollowed === true) {
            return { status: "ok" as const, followed: true, changed: false }
          }

          await tx.boardFollow.delete({
            where: {
              userId_boardId: {
                userId: params.userId,
                boardId: params.targetId,
              },
            },
          })
          await tx.board.update({
            where: { id: params.targetId },
            data: {
              followerCount: {
                decrement: 1,
              },
            },
          })

          return { status: "ok" as const, followed: false, changed: true }
        }

        if (params.desiredFollowed === false) {
          return { status: "ok" as const, followed: false, changed: false }
        }

        try {
          await tx.boardFollow.create({
            data: {
              userId: params.userId,
              boardId: params.targetId,
            },
          })
          await tx.board.update({
            where: { id: params.targetId },
            data: {
              followerCount: {
                increment: 1,
              },
            },
          })
        } catch (error) {
          if (!isKnownPrismaError(error, "P2002")) {
            throw error
          }
        }

        return { status: "ok" as const, followed: true, changed: true }
      })
    case "user": {
      const followingId = normalizeUserTargetId(params.targetId)

      if (!followingId) {
        return { status: "invalid" as const }
      }

      if (followingId === params.userId) {
        return { status: "self" as const }
      }

      return prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: followingId },
          select: { id: true },
        })

        if (!user) {
          return { status: "missing" as const }
        }

        const existing = await tx.userFollow.findUnique({
          where: {
            followerId_followingId: {
              followerId: params.userId,
              followingId,
            },
          },
          select: { id: true },
        })

        if (existing) {
          if (params.desiredFollowed === true) {
            return { status: "ok" as const, followed: true, changed: false }
          }

          await tx.userFollow.delete({
            where: {
              followerId_followingId: {
                followerId: params.userId,
                followingId,
              },
            },
          })

          return { status: "ok" as const, followed: false, changed: true }
        }

        if (params.desiredFollowed === false) {
          return { status: "ok" as const, followed: false, changed: false }
        }

        try {
          await tx.userFollow.create({
            data: {
              followerId: params.userId,
              followingId,
            },
          })
        } catch (error) {
          if (!isKnownPrismaError(error, "P2002")) {
            throw error
          }
        }

        return { status: "ok" as const, followed: true, changed: true }
      })
    }
    case "tag":
      return prisma.$transaction(async (tx) => {
        const tag = await tx.tag.findUnique({
          where: { id: params.targetId },
          select: { id: true },
        })

        if (!tag) {
          return { status: "missing" as const }
        }

        const existing = await tx.tagFollow.findUnique({
          where: {
            userId_tagId: {
              userId: params.userId,
              tagId: params.targetId,
            },
          },
          select: { id: true },
        })

        if (existing) {
          if (params.desiredFollowed === true) {
            return { status: "ok" as const, followed: true, changed: false }
          }

          await tx.tagFollow.delete({
            where: {
              userId_tagId: {
                userId: params.userId,
                tagId: params.targetId,
              },
            },
          })

          return { status: "ok" as const, followed: false, changed: true }
        }

        if (params.desiredFollowed === false) {
          return { status: "ok" as const, followed: false, changed: false }
        }

        try {
          await tx.tagFollow.create({
            data: {
              userId: params.userId,
              tagId: params.targetId,
            },
          })
        } catch (error) {
          if (!isKnownPrismaError(error, "P2002")) {
            throw error
          }
        }

        return { status: "ok" as const, followed: true, changed: true }
      })
    case "post":
      return prisma.$transaction(async (tx) => {
        const post = await tx.post.findUnique({
          where: { id: params.targetId },
          select: {
            id: true,
            authorId: true,
          },
        })

        if (!post) {
          return { status: "missing" as const }
        }

        const existing = await tx.postFollow.findUnique({
          where: {
            userId_postId: {
              userId: params.userId,
              postId: params.targetId,
            },
          },
          select: { id: true },
        })

        if (post.authorId === params.userId && !existing && params.desiredFollowed !== false) {
          return { status: "self" as const }
        }

        if (existing) {
          if (params.desiredFollowed === true) {
            return { status: "ok" as const, followed: true, changed: false }
          }

          await tx.postFollow.delete({
            where: {
              userId_postId: {
                userId: params.userId,
                postId: params.targetId,
              },
            },
          })

          return { status: "ok" as const, followed: false, changed: true }
        }

        if (params.desiredFollowed === false) {
          return { status: "ok" as const, followed: false, changed: false }
        }

        try {
          await tx.postFollow.create({
            data: {
              userId: params.userId,
              postId: params.targetId,
            },
          })
        } catch (error) {
          if (!isKnownPrismaError(error, "P2002")) {
            throw error
          }
        }

        return { status: "ok" as const, followed: true, changed: true }
      })
  }
}

export function countUserBoardFollows(userId: number) {
  return prisma.boardFollow.count({
    where: { userId },
  })
}

function buildTimestampCursorWhere(cursor: TimestampCursorPayload, direction: "after" | "before") {
  const createdAt = new Date(cursor.createdAt)

  return {
    OR: direction === "after"
      ? [
          { createdAt: { lt: createdAt } },
          { createdAt, id: { lt: cursor.id } },
        ]
      : [
          { createdAt: { gt: createdAt } },
          { createdAt, id: { gt: cursor.id } },
        ],
  }
}

export async function findUserBoardFollowsByIdCursor(params: { userId: number; pageSize: number; after?: TimestampCursorPayload | null; before?: TimestampCursorPayload | null }) {
  const normalizedPageSize = Math.min(Math.max(1, params.pageSize), 50)
  const pagingDirection = params.before ? "before" : "after"
  const cursor = params.before ?? params.after

  const rows = await prisma.boardFollow.findMany({
    where: {
      userId: params.userId,
      ...(cursor ? buildTimestampCursorWhere(cursor, pagingDirection) : {}),
    },
    include: {
      board: {
        include: {
          zone: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
    },
    orderBy: pagingDirection === "before" ? [{ createdAt: "asc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "desc" }],
    take: normalizedPageSize + 1,
  })

  const hasExtra = rows.length > normalizedPageSize
  const slicedRows = hasExtra ? rows.slice(0, normalizedPageSize) : rows
  const items = pagingDirection === "before" ? [...slicedRows].reverse() : slicedRows

  return {
    items,
    hasPrevPage: params.before ? hasExtra : Boolean(params.after),
    hasNextPage: params.before ? true : hasExtra,
  }
}

const userFollowTargetSelect = {
  id: true,
  username: true,
  nickname: true,
  bio: true,
  avatarPath: true,
  status: true,
  level: true,
  postCount: true,
  commentCount: true,
  likeReceivedCount: true,
  _count: {
    select: {
      followedByUsers: true,
    },
  },
} satisfies Prisma.UserSelect

export function countUserUserFollows(userId: number) {
  return prisma.userFollow.count({
    where: { followerId: userId },
  })
}

export function countUserFollowers(userId: number) {
  return prisma.userFollow.count({
    where: { followingId: userId },
  })
}

export async function findUserUserFollowsByIdCursor(params: { userId: number; pageSize: number; after?: TimestampCursorPayload | null; before?: TimestampCursorPayload | null }) {
  const normalizedPageSize = Math.min(Math.max(1, params.pageSize), 50)
  const pagingDirection = params.before ? "before" : "after"
  const cursor = params.before ?? params.after

  const rows = await prisma.userFollow.findMany({
    where: {
      followerId: params.userId,
      ...(cursor ? buildTimestampCursorWhere(cursor, pagingDirection) : {}),
    },
    include: {
      following: {
        select: userFollowTargetSelect,
      },
    },
    orderBy: pagingDirection === "before" ? [{ createdAt: "asc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "desc" }],
    take: normalizedPageSize + 1,
  })

  const hasExtra = rows.length > normalizedPageSize
  const slicedRows = hasExtra ? rows.slice(0, normalizedPageSize) : rows
  const items = pagingDirection === "before" ? [...slicedRows].reverse() : slicedRows

  return {
    items,
    hasPrevPage: params.before ? hasExtra : Boolean(params.after),
    hasNextPage: params.before ? true : hasExtra,
  }
}

export async function findUserFollowersByIdCursor(params: { userId: number; pageSize: number; after?: TimestampCursorPayload | null; before?: TimestampCursorPayload | null }) {
  const normalizedPageSize = Math.min(Math.max(1, params.pageSize), 50)
  const pagingDirection = params.before ? "before" : "after"
  const cursor = params.before ?? params.after

  const rows = await prisma.userFollow.findMany({
    where: {
      followingId: params.userId,
      ...(cursor ? buildTimestampCursorWhere(cursor, pagingDirection) : {}),
    },
    include: {
      follower: {
        select: userFollowTargetSelect,
      },
    },
    orderBy: pagingDirection === "before" ? [{ createdAt: "asc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "desc" }],
    take: normalizedPageSize + 1,
  })

  const hasExtra = rows.length > normalizedPageSize
  const slicedRows = hasExtra ? rows.slice(0, normalizedPageSize) : rows
  const items = pagingDirection === "before" ? [...slicedRows].reverse() : slicedRows

  return {
    items,
    hasPrevPage: params.before ? hasExtra : Boolean(params.after),
    hasNextPage: params.before ? true : hasExtra,
  }
}

export async function findFollowFeedTargetIds(userId: number) {
  const [boardFollows, userFollows] = await Promise.all([
    prisma.boardFollow.findMany({
      where: { userId },
      select: {
        boardId: true,
      },
    }),
    prisma.userFollow.findMany({
      where: { followerId: userId },
      select: {
        followingId: true,
      },
    }),
  ])

  return {
    boardIds: boardFollows.map((follow) => follow.boardId),
    authorIds: userFollows.map((follow) => follow.followingId),
  }
}

export function countUserTagFollows(userId: number) {
  return prisma.tagFollow.count({
    where: { userId },
  })
}

export async function findUserTagFollowsByIdCursor(params: { userId: number; pageSize: number; after?: TimestampCursorPayload | null; before?: TimestampCursorPayload | null }) {
  const normalizedPageSize = Math.min(Math.max(1, params.pageSize), 50)
  const pagingDirection = params.before ? "before" : "after"
  const cursor = params.before ?? params.after

  const rows = await prisma.tagFollow.findMany({
    where: {
      userId: params.userId,
      ...(cursor ? buildTimestampCursorWhere(cursor, pagingDirection) : {}),
    },
    include: {
      tag: {
        select: {
          id: true,
          name: true,
          slug: true,
          postCount: true,
          _count: {
            select: {
              followers: true,
            },
          },
        },
      },
    },
    orderBy: pagingDirection === "before" ? [{ createdAt: "asc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "desc" }],
    take: normalizedPageSize + 1,
  })

  const hasExtra = rows.length > normalizedPageSize
  const slicedRows = hasExtra ? rows.slice(0, normalizedPageSize) : rows
  const items = pagingDirection === "before" ? [...slicedRows].reverse() : slicedRows

  return {
    items,
    hasPrevPage: params.before ? hasExtra : Boolean(params.after),
    hasNextPage: params.before ? true : hasExtra,
  }
}

export function countUserPostFollows(userId: number) {
  return prisma.postFollow.count({
    where: {
      userId,
      post: {
        status: "NORMAL",
      },
    },
  })
}

export async function findUserPostFollowsByIdCursor(params: { userId: number; pageSize: number; after?: TimestampCursorPayload | null; before?: TimestampCursorPayload | null }) {
  const normalizedPageSize = Math.min(Math.max(1, params.pageSize), 50)
  const pagingDirection = params.before ? "before" : "after"
  const cursor = params.before ?? params.after

  const rows = await prisma.postFollow.findMany({
    where: {
      userId: params.userId,
      post: {
        status: "NORMAL",
      },
      ...(cursor ? buildTimestampCursorWhere(cursor, pagingDirection) : {}),
    },
    include: {
      post: {
        include: postListInclude,
      },
    },
    orderBy: pagingDirection === "before" ? [{ createdAt: "asc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "desc" }],
    take: normalizedPageSize + 1,
  })

  const hasExtra = rows.length > normalizedPageSize
  const slicedRows = hasExtra ? rows.slice(0, normalizedPageSize) : rows
  const items = pagingDirection === "before" ? [...slicedRows].reverse() : slicedRows

  return {
    items,
    hasPrevPage: params.before ? hasExtra : Boolean(params.after),
    hasNextPage: params.before ? true : hasExtra,
  }
}

export function findBoardFollowerUserIds(boardId: string) {
  return prisma.boardFollow.findMany({
    where: { boardId },
    select: {
      userId: true,
    },
  })
}

export function findUserFollowerUserIds(followingId: number) {
  return prisma.userFollow.findMany({
    where: { followingId },
    select: {
      followerId: true,
    },
  })
}

export function findTagFollowerUserIds(tagIds: string[]) {
  if (tagIds.length === 0) {
    return Promise.resolve([])
  }

  return prisma.tagFollow.findMany({
    where: {
      tagId: {
        in: [...new Set(tagIds)],
      },
    },
    select: {
      userId: true,
      tag: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })
}

export function findPostFollowerUserIds(postId: string) {
  return prisma.postFollow.findMany({
    where: { postId },
    select: {
      userId: true,
    },
  })
}

export function findPostFollowNotificationContext(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      title: true,
      status: true,
      isAnonymous: true,
      board: {
        select: {
          id: true,
          name: true,
        },
      },
      author: {
        select: {
          id: true,
          username: true,
          nickname: true,
        },
      },
      tags: {
        select: {
          tag: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })
}

export function findCommentFollowNotificationContext(commentId: string) {
  return prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      content: true,
      status: true,
      userId: true,
      useAnonymousIdentity: true,
      user: {
        select: {
          username: true,
          nickname: true,
        },
      },
      post: {
        select: {
          id: true,
          title: true,
          status: true,
          isAnonymous: true,
          authorId: true,
        },
      },
    },
  })
}
