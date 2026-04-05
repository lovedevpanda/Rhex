import { prisma } from "@/db/client"
import { PointEffectDirection, PointEffectRuleKind, PointEffectTargetType, Prisma, type BadgeGrantSource } from "@/db/types"


export const badgeWithRulesAndCountInclude = {
  rules: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
  _count: {
    select: {
      users: true,
    },
  },
} satisfies Prisma.BadgeInclude

export interface BadgeEffectRuleRecord {
  id: string
  badgeId: string | null
  badgeName: string | null
  badgeIconText: string | null
  badgeColor: string | null
  name: string
  description: string | null
  targetType: PointEffectTargetType
  scopeKeys: string[]
  ruleKind: PointEffectRuleKind
  direction: PointEffectDirection
  value: number
  extraValue: number | null
  startMinuteOfDay: number | null
  endMinuteOfDay: number | null
  sortOrder: number
  status: boolean
  createdAt: Date
  updatedAt: Date
}

function mapBadgeEffectRuleRecord(row: BadgeEffectRuleRecord): BadgeEffectRuleRecord {
  return {
    ...row,
    value: Number(row.value),
    extraValue: row.extraValue === null ? null : Number(row.extraValue),
  }
}

export function findBadgeEligibilityUserSnapshot(userId: number) {
  return Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
        points: true,
        postCount: true,
        commentCount: true,
        likeReceivedCount: true,
        inviteCount: true,
        acceptedAnswerCount: true,
        level: true,
        vipLevel: true,
        _count: {
          select: {
            followedByUsers: true,
          },
        },
      },
    }),
    prisma.userLevelProgress.findUnique({
      where: { userId },
      select: { checkInDays: true },
    }),
    Promise.all([
      prisma.postTip.count({
        where: { senderId: userId },
      }),
      prisma.postGiftEvent.count({
        where: { senderId: userId },
      }),
      prisma.postTip.count({
        where: { receiverId: userId },
      }),
      prisma.postGiftEvent.count({
        where: { receiverId: userId },
      }),
    ]).then(([sentTipCount, sentGiftCount, receivedTipCount, receivedGiftCount]) => ({
      sentTipCount: sentTipCount + sentGiftCount,
      receivedTipCount: receivedTipCount + receivedGiftCount,
    })),
  ])
}

export function findGrantedUserBadge(userId: number, badgeId: string) {
  return prisma.userBadge.findUnique({
    where: {
      userId_badgeId: {
        userId,
        badgeId,
      },
    },
    select: { id: true },
  })
}

export function findAllBadgesWithRules() {
  return prisma.badge.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: badgeWithRulesAndCountInclude,
  })
}

export function findGrantedUserBadgeWithTx(tx: Prisma.TransactionClient, userId: number, badgeId: string) {
  return tx.userBadge.findUnique({
    where: {
      userId_badgeId: {
        userId,
        badgeId,
      },
    },
    select: { id: true },
  })
}

export async function findBadgeEffectRulesByBadgeIds(badgeIds: string[]) {
  if (badgeIds.length === 0) {
    return []
  }

  const rows = await prisma.$queryRaw<BadgeEffectRuleRecord[]>(Prisma.sql`
    SELECT
      effect."id",
      effect."badgeId",
      badge."name" AS "badgeName",
      badge."iconText" AS "badgeIconText",
      badge."color" AS "badgeColor",
      effect."name",
      effect."description",
      effect."targetType",
      effect."scopeKeys",
      effect."ruleKind",
      effect."direction",
      effect."value",
      effect."extraValue",
      effect."startMinuteOfDay",
      effect."endMinuteOfDay",
      effect."sortOrder",
      effect."status",
      effect."createdAt",
      effect."updatedAt"
    FROM "PointEffectRule" effect
    INNER JOIN "Badge" badge ON badge."id" = effect."badgeId"
    WHERE effect."badgeId" IN (${Prisma.join(badgeIds)})
    ORDER BY effect."sortOrder" ASC, effect."createdAt" ASC
  `)

  return rows.map(mapBadgeEffectRuleRecord)
}

export function findGrantedBadgesForUserRecord(userId: number) {
  return prisma.userBadge.findMany({
    where: { userId },
    orderBy: [{ grantedAt: "desc" }],
    include: {
      badge: {
        include: badgeWithRulesAndCountInclude,
      },
    },
  })
}

export function findUserBadgeDisplayStates(userId: number) {
  return prisma.userBadge.findMany({
    where: { userId },
    select: {
      badgeId: true,
      isDisplayed: true,
      displayOrder: true,
    },
  })
}

export function createSelfClaimUserBadge(input: {
  userId: number
  badgeId: string
  grantSource: BadgeGrantSource
  grantSnapshot: string | null
  client?: Prisma.TransactionClient
}) {

  const client = input.client ?? prisma

  return client.userBadge.create({
    data: {
      userId: input.userId,
      badgeId: input.badgeId,
      grantSource: input.grantSource,
      grantSnapshot: input.grantSnapshot,
    },
  })
}

export function findUserBadgeWithBadge(userId: number, badgeId: string) {
  return prisma.userBadge.findUnique({
    where: {
      userId_badgeId: {
        userId,
        badgeId,
      },
    },
    include: {
      badge: true,
    },
  })
}

export function updateUserBadgeDisplayById(id: string, input: { isDisplayed: boolean; displayOrder: number }) {
  return prisma.userBadge.update({
    where: { id },
    data: {
      isDisplayed: input.isDisplayed,
      displayOrder: input.displayOrder,
    },
  })
}

export function findDisplayedUserBadges(userId: number) {
  return prisma.userBadge.findMany({
    where: {
      userId,
      isDisplayed: true,
    },
    orderBy: [{ displayOrder: "asc" }, { grantedAt: "desc" }],
    select: {
      id: true,
      displayOrder: true,
    },
  })
}

export function findBadgeUserPoints(userId: number, client: Prisma.TransactionClient) {
  return client.user.findUnique({
    where: { id: userId },
    select: { id: true, points: true },
  })
}

export function runBadgeTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(callback)
}

export async function findDisplayedBadgeEffectRules(userId: number) {
  const rows = await prisma.$queryRaw<BadgeEffectRuleRecord[]>(Prisma.sql`
    SELECT
      effect."id",
      effect."badgeId",
      badge."name" AS "badgeName",
      badge."iconText" AS "badgeIconText",
      badge."color" AS "badgeColor",
      effect."name",
      effect."description",
      effect."targetType",
      effect."scopeKeys",
      effect."ruleKind",
      effect."direction",
      effect."value",
      effect."extraValue",
      effect."startMinuteOfDay",
      effect."endMinuteOfDay",
      effect."sortOrder",
      effect."status",
      effect."createdAt",
      effect."updatedAt"
    FROM "UserBadge" user_badge
    INNER JOIN "Badge" badge ON badge."id" = user_badge."badgeId"
    INNER JOIN "PointEffectRule" effect ON effect."badgeId" = badge."id"
    WHERE
      user_badge."userId" = ${userId}
      AND user_badge."isDisplayed" = true
      AND badge."status" = true
      AND effect."status" = true
    ORDER BY
      user_badge."displayOrder" ASC,
      effect."sortOrder" ASC,
      effect."createdAt" ASC
  `)

  return rows.map(mapBadgeEffectRuleRecord)
}
