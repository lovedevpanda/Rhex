import { prisma } from "@/db/client"
import { postListInclude } from "@/db/queries"
import type { Prisma } from "@/db/types"
import { decodeTimestampCursor, encodeTimestampCursor } from "@/lib/cursor-pagination"
import { apiError } from "@/lib/api-route"
import { enforceSensitiveText } from "@/lib/content-safety"
import { resolvePagination } from "@/db/helpers"
import { getAnonymousMaskDisplayIdentity } from "@/lib/post-anonymous"
import { mapListPost } from "@/lib/post-map"
import { recordFavoritePostTaskEvent } from "@/lib/task-center-service"
import { getUserDisplayName } from "@/lib/user-display"
import { normalizeBoolean, normalizePositiveInteger, normalizeTrimmedText } from "@/lib/shared/normalizers"

const FAVORITE_COLLECTION_TITLE_MAX_LENGTH = 80
const FAVORITE_COLLECTION_DESCRIPTION_MAX_LENGTH = 600
const FAVORITE_COLLECTION_PUBLIC_PAGE_SIZE = 20
const FAVORITE_COLLECTION_DETAIL_PAGE_SIZE = 20
const FAVORITE_COLLECTION_PENDING_PAGE_SIZE = 10
const FAVORITE_COLLECTION_MODAL_PAGE_SIZE = 6
const FAVORITE_COLLECTION_MODAL_SUGGESTION_SIZE = 3
const FAVORITE_COLLECTION_MANAGE_PAGE_SIZE = 8
const FAVORITE_COLLECTION_USER_PROFILE_PAGE_SIZE = 10

export interface PublicFavoriteCollectionProfileItem {
  id: string
  title: string
  description: string | null
  allowOtherUsersToContribute: boolean
  requireContributionApproval: boolean
  postCount: number
  updatedAt: string
}

export interface PublicFavoriteCollectionProfilePage {
  items: PublicFavoriteCollectionProfileItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
}

function shuffleItems<T>(items: T[]) {
  const next = [...items]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const current = next[index]
    next[index] = next[randomIndex] as T
    next[randomIndex] = current as T
  }

  return next
}

function encodeCollectionCursor(row?: { id: string; updatedAt: Date } | null) {
  return row
    ? encodeTimestampCursor({
        id: row.id,
        createdAt: row.updatedAt.toISOString(),
      })
    : null
}

function createCollectionSummary(collection: {
  id: string
  title: string
  description: string | null
  visibility: "PUBLIC" | "PRIVATE"
  allowOtherUsersToContribute: boolean
  requireContributionApproval: boolean
  ownerId: number
  owner: {
    username: string
    nickname: string | null
  }
  postCount: number
  items: Array<{ id: string }>
  submissions: Array<{ id: string; submittedById: number }>
}, currentUserId: number) {
  const alreadyIncluded = collection.items.length > 0
  const pendingSubmission = collection.submissions[0] ?? null
  const isOwner = collection.ownerId === currentUserId
  const canContribute = isOwner || (collection.visibility === "PUBLIC" && collection.allowOtherUsersToContribute)

  return {
    id: collection.id,
    title: collection.title,
    description: collection.description,
    visibility: collection.visibility,
    allowOtherUsersToContribute: collection.allowOtherUsersToContribute,
    requireContributionApproval: collection.requireContributionApproval,
    ownerId: collection.ownerId,
    ownerName: getUserDisplayName(collection.owner),
    postCount: collection.postCount,
    alreadyIncluded,
    pendingSubmission: Boolean(pendingSubmission),
    pendingOwnedByCurrentUser: pendingSubmission?.submittedById === currentUserId,
    isOwner,
    canContribute,
  }
}

async function normalizeCollectionInput(input: Record<string, unknown>) {
  const title = normalizeTrimmedText(input.title, FAVORITE_COLLECTION_TITLE_MAX_LENGTH)
  if (!title) {
    apiError(400, "合集名称不能为空")
  }

  const description = normalizeTrimmedText(input.description, FAVORITE_COLLECTION_DESCRIPTION_MAX_LENGTH) || null
  const visibility = input.visibility === "PUBLIC" ? "PUBLIC" as const : "PRIVATE" as const
  const allowOtherUsersToContribute = visibility === "PUBLIC" && normalizeBoolean(input.allowOtherUsersToContribute, false)
  const requireContributionApproval = allowOtherUsersToContribute && normalizeBoolean(input.requireContributionApproval, false)
  const [titleSafety, descriptionSafety] = await Promise.all([
    enforceSensitiveText({ scene: "favoriteCollection.title", text: title }),
    description ? enforceSensitiveText({ scene: "favoriteCollection.description", text: description }) : Promise.resolve(null),
  ])

  return {
    title: titleSafety.sanitizedText,
    description: descriptionSafety?.sanitizedText || null,
    visibility,
    allowOtherUsersToContribute,
    requireContributionApproval,
    contentAdjusted: titleSafety.wasReplaced || Boolean(descriptionSafety?.wasReplaced),
  }
}

function resolveCollectionViewerWhere(currentUserId?: number | null): Prisma.FavoriteCollectionWhereInput {
  if (!currentUserId) {
    return {
      visibility: "PUBLIC",
    }
  }

  return {
    OR: [
      { visibility: "PUBLIC" },
      { ownerId: currentUserId },
    ],
  }
}

function canViewCollection(collection: {
  ownerId: number
  visibility: "PUBLIC" | "PRIVATE"
}, currentUserId?: number | null) {
  return collection.visibility === "PUBLIC" || collection.ownerId === currentUserId
}

function canContributeToCollection(collection: {
  ownerId: number
  visibility: "PUBLIC" | "PRIVATE"
  allowOtherUsersToContribute: boolean
}, currentUserId: number) {
  if (collection.ownerId === currentUserId) {
    return true
  }

  return collection.visibility === "PUBLIC" && collection.allowOtherUsersToContribute
}

async function ensureCollectionAccessibleForUser(collectionId: string, currentUserId?: number | null) {
  const collection = await prisma.favoriteCollection.findUnique({
    where: { id: collectionId },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          nickname: true,
        },
      },
      _count: {
        select: {
          items: true,
          submissions: {
            where: {
              status: "PENDING",
            },
          },
        },
      },
    },
  })

  if (!collection || !canViewCollection(collection, currentUserId)) {
    apiError(404, "合集不存在或无权访问")
  }

  return collection
}

async function ensurePostExists(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      title: true,
    },
  })

  if (!post) {
    apiError(404, "帖子不存在")
  }

  return post
}

async function lockFavoriteCollection(tx: Prisma.TransactionClient, collectionId: string) {
  const rows = await tx.$queryRaw<Array<{
    id: string
    ownerId: number
    title: string
    visibility: "PUBLIC" | "PRIVATE"
    allowOtherUsersToContribute: boolean
    requireContributionApproval: boolean
  }>>`
    SELECT
      "id", "ownerId", "title", "visibility",
      "allowOtherUsersToContribute", "requireContributionApproval"
    FROM "favorite_collection"
    WHERE "id" = ${collectionId}
    FOR UPDATE
  `

  return rows[0] ?? null
}

async function createCollectionItemInTransaction(tx: Prisma.TransactionClient, params: {
  collectionId: string
  postId: string
  userId: number
}) {
  const created = await tx.favoriteCollectionItem.createMany({
    data: {
      collectionId: params.collectionId,
      postId: params.postId,
      addedById: params.userId,
    },
    skipDuplicates: true,
  })
  if (created.count !== 1) {
    apiError(409, "This post is already in the collection")
  }

  await tx.favoriteCollection.update({
    where: { id: params.collectionId },
    data: {
      postCount: {
        increment: 1,
      },
    },
  })
}

async function ensureUserFavoriteInTransaction(tx: Prisma.TransactionClient, userId: number, postId: string) {
  const created = await tx.favorite.createMany({
    data: { userId, postId },
    skipDuplicates: true,
  })
  if (created.count !== 1) {
    return false
  }

  await tx.post.update({
    where: { id: postId },
    data: {
      favoriteCount: {
        increment: 1,
      },
    },
  })
  return true
}

async function findFavoriteCollectionItemPostIds(collectionId: string) {
  const items = await prisma.favoriteCollectionItem.findMany({
    where: { collectionId },
    select: {
      postId: true,
    },
  })

  return items.map((item) => item.postId)
}

export async function ensureUserFavorite(userId: number, postId: string) {
  const favoriteCreated = await prisma.$transaction((tx) => ensureUserFavoriteInTransaction(tx, userId, postId))

  if (favoriteCreated) {
    void recordFavoritePostTaskEvent({
      type: "FAVORITE_POST",
      userId,
      postId,
    }).catch((error) => {
      console.error("[favorite-collections] record favorite task event failed", error)
    })
  }

  return favoriteCreated
}

export async function getFavoriteCollectionModalData(params: {
  userId: number
  postId: string
  page?: number
  q?: string | null
}) {
  await ensurePostExists(params.postId)
  const keyword = normalizeTrimmedText(params.q, 100) || ""
  const baseCollectionWhere: Prisma.FavoriteCollectionWhereInput = {
    OR: [
      { ownerId: params.userId },
      {
        visibility: "PUBLIC",
        allowOtherUsersToContribute: true,
      },
    ],
  }

  const [favorite] = await Promise.all([
    prisma.favorite.findUnique({
      where: {
        userId_postId: {
          userId: params.userId,
          postId: params.postId,
        },
      },
      select: {
        id: true,
      },
    }),
  ])

  if (!keyword) {
    const [ownedCollections, contributedCollections] = await Promise.all([
      prisma.favoriteCollection.findMany({
        where: {
          ownerId: params.userId,
        },
        include: {
          owner: {
            select: {
              username: true,
              nickname: true,
            },
          },
          items: {
            where: { postId: params.postId },
            select: {
              id: true,
            },
          },
          submissions: {
            where: {
              postId: params.postId,
              status: "PENDING",
            },
            select: {
              id: true,
              submittedById: true,
            },
          },
        },
      }),
      prisma.favoriteCollection.findMany({
        where: {
          visibility: "PUBLIC",
          allowOtherUsersToContribute: true,
          ownerId: {
            not: params.userId,
          },
        },
        include: {
          owner: {
            select: {
              username: true,
              nickname: true,
            },
          },
          items: {
            where: { postId: params.postId },
            select: {
              id: true,
            },
          },
          submissions: {
            where: {
              postId: params.postId,
              status: "PENDING",
            },
            select: {
              id: true,
              submittedById: true,
            },
          },
        },
      }),
    ])

    const suggestedCollections = [
      ...shuffleItems(ownedCollections),
      ...shuffleItems(contributedCollections),
    ].slice(0, FAVORITE_COLLECTION_MODAL_SUGGESTION_SIZE)

    return {
      favored: Boolean(favorite),
      keyword,
      pagination: {
        page: 1,
        pageSize: FAVORITE_COLLECTION_MODAL_SUGGESTION_SIZE,
        total: suggestedCollections.length,
        totalPages: 1,
        hasPrevPage: false,
        hasNextPage: false,
      },
      collections: suggestedCollections.map((collection) => createCollectionSummary(collection, params.userId)),
    }
  }

  const collectionWhere: Prisma.FavoriteCollectionWhereInput = {
    ...baseCollectionWhere,
    AND: [{
      OR: [
        {
          title: {
            contains: keyword,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: keyword,
            mode: "insensitive",
          },
        },
      ],
    }],
  }

  const total = await prisma.favoriteCollection.count({
    where: collectionWhere,
  })

  const pagination = resolvePagination(
    { page: params.page, pageSize: FAVORITE_COLLECTION_MODAL_PAGE_SIZE },
    total,
    [FAVORITE_COLLECTION_MODAL_PAGE_SIZE],
    FAVORITE_COLLECTION_MODAL_PAGE_SIZE,
  )

  const collections = await prisma.favoriteCollection.findMany({
    where: collectionWhere,
    orderBy: [
      { ownerId: "asc" },
      { createdAt: "desc" },
    ],
    skip: pagination.skip,
    take: pagination.pageSize,
    include: {
      owner: {
        select: {
          username: true,
          nickname: true,
        },
      },
      items: {
        where: { postId: params.postId },
        select: {
          id: true,
        },
      },
      submissions: {
        where: {
          postId: params.postId,
          status: "PENDING",
        },
        select: {
          id: true,
          submittedById: true,
        },
      },
    },
  })

  return {
    favored: Boolean(favorite),
    keyword,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages: pagination.totalPages,
      hasPrevPage: pagination.hasPrevPage,
      hasNextPage: pagination.hasNextPage,
    },
    collections: collections.map((collection) => createCollectionSummary(collection, params.userId)),
  }
}

export async function addPostToFavoriteCollection(params: {
  userId: number
  postId: string
  collectionId: string
}) {
  await ensurePostExists(params.postId)

  const result = await prisma.$transaction(async (tx) => {
    // Lock the collection before checking its contribution policy or queue. This
    // makes policy changes, duplicate submissions, and post counts atomic.
    const collection = await lockFavoriteCollection(tx, params.collectionId)
    if (!collection) {
      apiError(404, "Collection does not exist")
    }
    if (!canContributeToCollection(collection, params.userId)) {
      apiError(403, "You cannot add posts to this collection")
    }

    const favoriteCreated = await ensureUserFavoriteInTransaction(tx, params.userId, params.postId)
    if (collection.ownerId === params.userId || !collection.requireContributionApproval) {
      await createCollectionItemInTransaction(tx, params)
      await tx.favoriteCollectionSubmission.deleteMany({
        where: {
          collectionId: params.collectionId,
          postId: params.postId,
          status: "PENDING",
        },
      })
      return {
        status: "APPROVED" as const,
        message: "Post added to collection",
        collectionTitle: collection.title,
        postId: params.postId,
        favoriteCreated,
        affectedPostIds: [params.postId],
      }
    }

    const existingPending = await tx.favoriteCollectionSubmission.findFirst({
      where: {
        collectionId: params.collectionId,
        postId: params.postId,
        status: "PENDING",
      },
      select: { id: true },
    })
    if (existingPending) {
      apiError(409, "This post is already pending review")
    }

    await tx.favoriteCollectionSubmission.create({
      data: {
        collectionId: params.collectionId,
        postId: params.postId,
        submittedById: params.userId,
        status: "PENDING",
      },
    })
    return {
      status: "PENDING" as const,
      message: "Submission is pending review",
      collectionTitle: collection.title,
      postId: params.postId,
      favoriteCreated,
      affectedPostIds: [],
    }
  })

  if (result.favoriteCreated) {
    void recordFavoritePostTaskEvent({
      type: "FAVORITE_POST",
      userId: params.userId,
      postId: params.postId,
    }).catch((error) => {
      console.error("[favorite-collections] record favorite task event failed", error)
    })
  }

  return result
}

export async function createFavoriteCollection(params: {
  userId: number
  input: Record<string, unknown>
  postId?: string
}) {
  const normalized = await normalizeCollectionInput(params.input)

  const created = await prisma.favoriteCollection.create({
    data: {
      ownerId: params.userId,
      title: normalized.title,
      description: normalized.description,
      visibility: normalized.visibility,
      allowOtherUsersToContribute: normalized.allowOtherUsersToContribute,
      requireContributionApproval: normalized.requireContributionApproval,
    },
    select: {
      id: true,
      title: true,
    },
  })

  const addResult = params.postId
    ? await addPostToFavoriteCollection({
      userId: params.userId,
      postId: params.postId,
      collectionId: created.id,
    })
    : null

  return {
    ...created,
    contentAdjusted: normalized.contentAdjusted,
    postId: addResult?.postId,
    favoriteCreated: addResult?.favoriteCreated ?? false,
    affectedPostIds: addResult?.affectedPostIds ?? [],
  }
}

export async function updateFavoriteCollection(params: {
  userId: number
  collectionId: string
  input: Record<string, unknown>
}) {
  const normalized = await normalizeCollectionInput(params.input)
  const existing = await prisma.favoriteCollection.findUnique({
    where: { id: params.collectionId },
    select: {
      id: true,
      ownerId: true,
      items: {
        select: {
          postId: true,
        },
      },
    },
  })

  if (!existing || existing.ownerId !== params.userId) {
    apiError(404, "合集不存在或无权修改")
  }

  const affectedPostIds = existing.items.map((item) => item.postId)

  const updated = await prisma.favoriteCollection.update({
    where: { id: params.collectionId },
    data: {
      title: normalized.title,
      description: normalized.description,
      visibility: normalized.visibility,
      allowOtherUsersToContribute: normalized.allowOtherUsersToContribute,
      requireContributionApproval: normalized.requireContributionApproval,
    },
    select: {
      id: true,
      title: true,
    },
  })

  return {
    ...updated,
    contentAdjusted: normalized.contentAdjusted,
    affectedPostIds,
  }
}

export async function deleteFavoriteCollection(params: {
  userId: number
  collectionId: string
}) {
  const existing = await prisma.favoriteCollection.findUnique({
    where: { id: params.collectionId },
    select: {
      id: true,
      ownerId: true,
      title: true,
    },
  })

  if (!existing || existing.ownerId !== params.userId) {
    apiError(404, "合集不存在或无权删除")
  }

  const affectedPostIds = await findFavoriteCollectionItemPostIds(params.collectionId)

  await prisma.favoriteCollection.delete({
    where: { id: params.collectionId },
  })

  return {
    ...existing,
    affectedPostIds,
  }
}

export async function removePostFromFavoriteCollection(params: {
  userId: number
  collectionId: string
  postId: string
}) {
  const collection = await prisma.$transaction(async (tx) => {
    const locked = await lockFavoriteCollection(tx, params.collectionId)
    if (!locked || locked.ownerId !== params.userId) {
      apiError(404, "Collection does not exist or cannot be modified")
    }

    const deleted = await tx.favoriteCollectionItem.deleteMany({
      where: {
        collectionId: params.collectionId,
        postId: params.postId,
      },
    })
    if (deleted.count !== 1) {
      apiError(404, "Post is not in this collection")
    }

    await tx.favoriteCollection.update({
      where: { id: params.collectionId },
      data: { postCount: { decrement: 1 } },
    })
    return locked
  })

  return {
    collectionTitle: collection.title,
    postId: params.postId,
    affectedPostIds: [params.postId],
  }
}

export async function reviewFavoriteCollectionSubmission(params: {
  userId: number
  submissionId: string
  decision: "APPROVE" | "REJECT"
  reviewNote?: string
}) {
  const candidate = await prisma.favoriteCollectionSubmission.findUnique({
    where: { id: params.submissionId },
    select: { collectionId: true },
  })
  if (!candidate) {
    apiError(404, "Submission does not exist")
  }

  const normalizedReviewNote = normalizeTrimmedText(params.reviewNote, 300) || null
  return prisma.$transaction(async (tx) => {
    const collection = await lockFavoriteCollection(tx, candidate.collectionId)
    if (!collection || collection.ownerId !== params.userId) {
      apiError(404, "Submission does not exist or cannot be reviewed")
    }

    const submission = await tx.favoriteCollectionSubmission.findUnique({
      where: { id: params.submissionId },
      select: { id: true, collectionId: true, postId: true, submittedById: true, status: true },
    })
    if (!submission || submission.collectionId !== collection.id) {
      apiError(404, "Submission does not exist")
    }
    if (submission.status !== "PENDING") {
      apiError(409, "Submission state changed; refresh and retry")
    }

    const claimed = await tx.favoriteCollectionSubmission.updateMany({
      where: { id: submission.id, status: "PENDING" },
      data: {
        status: params.decision === "APPROVE" ? "APPROVED" : "REJECTED",
        reviewNote: normalizedReviewNote,
        reviewedById: params.userId,
        reviewedAt: new Date(),
      },
    })
    if (claimed.count !== 1) {
      apiError(409, "Submission state changed; refresh and retry")
    }

    if (params.decision === "APPROVE") {
      await createCollectionItemInTransaction(tx, {
        collectionId: submission.collectionId,
        postId: submission.postId,
        userId: submission.submittedById,
      })
    }

    return {
      status: params.decision === "APPROVE" ? "APPROVED" as const : "REJECTED" as const,
      collectionTitle: collection.title,
      postId: submission.postId,
      affectedPostIds: params.decision === "APPROVE" ? [submission.postId] : [],
    }
  })
}

export async function getUserFavoriteCollectionManageData(
  userId: number,
  options: { pageSize?: number; after?: string | null; before?: string | null; page?: number } = {},
) {
  const pageSize = Math.min(24, Math.max(1, normalizePositiveInteger(options.pageSize, FAVORITE_COLLECTION_MANAGE_PAGE_SIZE)))

  try {
    if (options.after || options.before) {
      const afterCursor = decodeTimestampCursor(options.after)
      const beforeCursor = decodeTimestampCursor(options.before)
      const cursorDate = beforeCursor?.createdAt ?? afterCursor?.createdAt
      const cursorId = beforeCursor?.id ?? afterCursor?.id

      const where: Prisma.FavoriteCollectionWhereInput = {
        ownerId: userId,
        ...(cursorDate && cursorId
          ? {
              OR: [
                {
                  updatedAt: beforeCursor
                    ? { gt: new Date(cursorDate) }
                    : { lt: new Date(cursorDate) },
                },
                {
                  updatedAt: new Date(cursorDate),
                  id: beforeCursor
                    ? { gt: cursorId }
                    : { lt: cursorId },
                },
              ],
            }
          : {}),
      }

      const [total, rows] = await Promise.all([
        prisma.favoriteCollection.count({
          where: {
            ownerId: userId,
          },
        }),
        prisma.favoriteCollection.findMany({
          where,
          orderBy: [
            { updatedAt: beforeCursor ? "asc" : "desc" },
            { id: beforeCursor ? "asc" : "desc" },
          ],
          take: pageSize + 1,
          include: {
            _count: {
              select: {
                submissions: {
                  where: {
                    status: "PENDING",
                  },
                },
              },
            },
          },
        }),
      ])

      const hasExtra = rows.length > pageSize
      const slicedRows = hasExtra ? rows.slice(0, pageSize) : rows
      const items = beforeCursor ? [...slicedRows].reverse() : slicedRows

      return {
        collections: items.map((collection) => ({
          id: collection.id,
          title: collection.title,
          description: collection.description,
          visibility: collection.visibility,
          allowOtherUsersToContribute: collection.allowOtherUsersToContribute,
          requireContributionApproval: collection.requireContributionApproval,
          postCount: collection.postCount,
          pendingSubmissionCount: collection._count.submissions,
          createdAt: collection.createdAt.toISOString(),
          updatedAt: collection.updatedAt.toISOString(),
        })),
        pagination: {
          page: normalizePositiveInteger(options.page, 1),
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
          hasPrevPage: beforeCursor ? hasExtra : Boolean(options.after),
          hasNextPage: beforeCursor ? Boolean(options.before) : hasExtra,
          prevCursor: encodeCollectionCursor(items[0]),
          nextCursor: encodeCollectionCursor(items.at(-1)),
        },
      }
    }

    const total = await prisma.favoriteCollection.count({
      where: {
        ownerId: userId,
      },
    })
    const pagination = resolvePagination(
      { page: options.page, pageSize },
      total,
      [FAVORITE_COLLECTION_MANAGE_PAGE_SIZE],
      FAVORITE_COLLECTION_MANAGE_PAGE_SIZE,
    )
    const collections = await prisma.favoriteCollection.findMany({
      where: {
        ownerId: userId,
      },
      orderBy: [
        { updatedAt: "desc" },
        { id: "desc" },
      ],
      skip: pagination.skip,
      take: pagination.pageSize,
      include: {
        _count: {
          select: {
            submissions: {
              where: {
                status: "PENDING",
              },
            },
          },
        },
      },
    })

    return {
      collections: collections.map((collection) => ({
        id: collection.id,
        title: collection.title,
        description: collection.description,
        visibility: collection.visibility,
        allowOtherUsersToContribute: collection.allowOtherUsersToContribute,
        requireContributionApproval: collection.requireContributionApproval,
        postCount: collection.postCount,
        pendingSubmissionCount: collection._count.submissions,
        createdAt: collection.createdAt.toISOString(),
        updatedAt: collection.updatedAt.toISOString(),
      })),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages: pagination.totalPages,
        hasPrevPage: pagination.hasPrevPage,
        hasNextPage: pagination.hasNextPage,
        prevCursor: encodeCollectionCursor(collections[0]),
        nextCursor: encodeCollectionCursor(collections.at(-1)),
      },
    }
  } catch (error) {
    console.error(error)
    return {
      collections: [],
      pagination: {
        page: normalizePositiveInteger(options.page, 1),
        pageSize,
        total: 0,
        totalPages: 1,
        hasPrevPage: false,
        hasNextPage: false,
        prevCursor: null,
        nextCursor: null,
      },
    }
  }
}

export async function getFavoriteCollectionDirectoryPage(params: {
  page: number
  currentUserId?: number | null
}) {
  const total = await prisma.favoriteCollection.count({
    where: resolveCollectionViewerWhere(params.currentUserId),
  })
  const pagination = resolvePagination({ page: params.page, pageSize: FAVORITE_COLLECTION_PUBLIC_PAGE_SIZE }, total, [FAVORITE_COLLECTION_PUBLIC_PAGE_SIZE], FAVORITE_COLLECTION_PUBLIC_PAGE_SIZE)
  const collections = await prisma.favoriteCollection.findMany({
    where: resolveCollectionViewerWhere(params.currentUserId),
    orderBy: [
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
    skip: pagination.skip,
    take: pagination.pageSize,
    include: {
      owner: {
        select: {
          username: true,
          nickname: true,
        },
      },
    },
  })

  return {
    items: collections.map((collection) => ({
      id: collection.id,
      title: collection.title,
      description: collection.description,
      visibility: collection.visibility,
      allowOtherUsersToContribute: collection.allowOtherUsersToContribute,
      requireContributionApproval: collection.requireContributionApproval,
      postCount: collection.postCount,
      ownerName: getUserDisplayName(collection.owner),
      createdAt: collection.createdAt.toISOString(),
      updatedAt: collection.updatedAt.toISOString(),
    })),
    pagination,
  }
}

export async function getPublicFavoriteCollectionsByUsername(
  username: string,
  options: { page?: number } = {},
): Promise<PublicFavoriteCollectionProfilePage> {
  const where: Prisma.FavoriteCollectionWhereInput = {
    visibility: "PUBLIC",
    owner: {
      username,
    },
  }

  const total = await prisma.favoriteCollection.count({ where })
  const pagination = resolvePagination(
    { page: options.page, pageSize: FAVORITE_COLLECTION_USER_PROFILE_PAGE_SIZE },
    total,
    [FAVORITE_COLLECTION_USER_PROFILE_PAGE_SIZE],
    FAVORITE_COLLECTION_USER_PROFILE_PAGE_SIZE,
  )

  const collections = await prisma.favoriteCollection.findMany({
    where,
    orderBy: [
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
    skip: pagination.skip,
    take: pagination.pageSize,
    select: {
      id: true,
      title: true,
      description: true,
      allowOtherUsersToContribute: true,
      requireContributionApproval: true,
      postCount: true,
      updatedAt: true,
    },
  })

  return {
    items: collections.map((collection) => ({
      id: collection.id,
      title: collection.title,
      description: collection.description,
      allowOtherUsersToContribute: collection.allowOtherUsersToContribute,
      requireContributionApproval: collection.requireContributionApproval,
      postCount: collection.postCount,
      updatedAt: collection.updatedAt.toISOString(),
    })),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages: pagination.totalPages,
      hasPrevPage: pagination.hasPrevPage,
      hasNextPage: pagination.hasNextPage,
    },
  }
}

export async function getFavoriteCollectionDetailPage(params: {
  collectionId: string
  currentUserId?: number | null
  page?: number
  pendingPage?: number
}) {
  const collection = await ensureCollectionAccessibleForUser(params.collectionId, params.currentUserId)
  const total = await prisma.favoriteCollectionItem.count({
    where: {
      collectionId: params.collectionId,
    },
  })
  const pagination = resolvePagination(
    { page: params.page, pageSize: FAVORITE_COLLECTION_DETAIL_PAGE_SIZE },
    total,
    [FAVORITE_COLLECTION_DETAIL_PAGE_SIZE],
    FAVORITE_COLLECTION_DETAIL_PAGE_SIZE,
  )
  const pendingTotal = collection.ownerId === params.currentUserId
    ? await prisma.favoriteCollectionSubmission.count({
        where: {
          collectionId: params.collectionId,
          status: "PENDING",
        },
      })
    : 0
  const pendingPagination = resolvePagination(
    { page: params.pendingPage, pageSize: FAVORITE_COLLECTION_PENDING_PAGE_SIZE },
    pendingTotal,
    [FAVORITE_COLLECTION_PENDING_PAGE_SIZE],
    FAVORITE_COLLECTION_PENDING_PAGE_SIZE,
  )
  const [items, pendingSubmissions, anonymousMaskIdentity] = await Promise.all([
    prisma.favoriteCollectionItem.findMany({
      where: {
        collectionId: params.collectionId,
      },
      orderBy: [
        { createdAt: "desc" },
      ],
      skip: pagination.skip,
      take: pagination.pageSize,
      include: {
        addedBy: {
          select: {
            username: true,
            nickname: true,
          },
        },
        post: {
          include: postListInclude,
        },
      },
    }),
    collection.ownerId === params.currentUserId
      ? prisma.favoriteCollectionSubmission.findMany({
          where: {
            collectionId: params.collectionId,
            status: "PENDING",
          },
          orderBy: [
            { createdAt: "desc" },
          ],
          skip: pendingPagination.skip,
          take: pendingPagination.pageSize,
          include: {
            submittedBy: {
              select: {
                id: true,
                username: true,
                nickname: true,
              },
            },
            post: {
              select: {
                id: true,
                title: true,
                slug: true,
                createdAt: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    getAnonymousMaskDisplayIdentity(),
  ])

  return {
    id: collection.id,
    title: collection.title,
    description: collection.description,
    visibility: collection.visibility,
    allowOtherUsersToContribute: collection.allowOtherUsersToContribute,
    requireContributionApproval: collection.requireContributionApproval,
    postCount: collection.postCount,
    ownerId: collection.ownerId,
    ownerName: getUserDisplayName(collection.owner),
    createdAt: collection.createdAt.toISOString(),
    updatedAt: collection.updatedAt.toISOString(),
    isOwner: collection.ownerId === params.currentUserId,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages: pagination.totalPages,
      hasPrevPage: pagination.hasPrevPage,
      hasNextPage: pagination.hasNextPage,
    },
    pendingPagination: {
      page: pendingPagination.page,
      pageSize: pendingPagination.pageSize,
      total: pendingPagination.total,
      totalPages: pendingPagination.totalPages,
      hasPrevPage: pendingPagination.hasPrevPage,
      hasNextPage: pendingPagination.hasNextPage,
    },
    items: items.map((item) => ({
      id: item.id,
      postId: item.postId,
      addedAt: item.createdAt.toISOString(),
      addedByName: getUserDisplayName(item.addedBy),
      post: mapListPost(item.post, anonymousMaskIdentity),
    })),
    pendingSubmissions: pendingSubmissions.map((submission) => ({
      id: submission.id,
      postId: submission.postId,
      postTitle: submission.post.title,
      postSlug: submission.post.slug,
      submittedAt: submission.createdAt.toISOString(),
      submittedByName: getUserDisplayName(submission.submittedBy),
    })),
  }
}
