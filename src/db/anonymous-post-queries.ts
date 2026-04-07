import type { Prisma } from "@/db/types"
import { prisma } from "@/db/client"

const anonymousMaskUserSelect = {
  id: true,
  username: true,
  nickname: true,
  avatarPath: true,
  status: true,
  vipLevel: true,
  vipExpiresAt: true,
  userBadges: {
    where: {
      isDisplayed: true,
      badge: {
        status: true,
      },
    },
    orderBy: [{ displayOrder: "asc" }, { grantedAt: "desc" }],
    take: 3,
    include: {
      badge: true,
    },
  },
  verificationApplications: {
    where: {
      status: "APPROVED",
    },
    orderBy: [{ reviewedAt: "desc" }, { submittedAt: "desc" }] as Prisma.UserVerificationOrderByWithRelationInput[],
    take: 1,
    include: {
      type: true,
    },
  },
} satisfies Prisma.UserSelect

export type AnonymousMaskUserRecord = Prisma.UserGetPayload<{ select: typeof anonymousMaskUserSelect }>

export function findAnonymousMaskUserById(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: anonymousMaskUserSelect,
  })
}

export function countAnonymousPostsByAuthorInRange(params: {
  authorId: number
  start: Date
  end: Date
}) {
  return prisma.post.count({
    where: {
      authorId: params.authorId,
      isAnonymous: true,
      createdAt: {
        gte: params.start,
        lt: params.end,
      },
    },
  })
}
