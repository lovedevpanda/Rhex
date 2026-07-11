import { prisma } from "@/db/client"
import { Prisma as PrismaClient } from "@/db/types"
import type { Prisma } from "@/db/types"

type VerificationQueryClient = Prisma.TransactionClient | typeof prisma

export async function lockUserVerificationState(tx: Prisma.TransactionClient, userId: number) {
  const rows = await tx.$queryRaw<Array<{ id: number; points: number; username: string }>>(PrismaClient.sql`
    SELECT "id", "points", "username"
    FROM "User"
    WHERE "id" = ${userId}
    FOR UPDATE
  `)

  return rows[0] ?? null
}

const verificationApplicationTypeSelect = {
  id: true,
  name: true,
  slug: true,
  iconText: true,
  color: true,
  description: true,
} as const

export function listActiveVerificationTypes() {
  return prisma.verificationType.findMany({
    where: { status: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })
}

export function listUserVerificationApplications(userId: number) {
  return prisma.userVerification.findMany({
    where: { userId },
    orderBy: [{ submittedAt: "desc" }],
    include: {
      type: {
        select: verificationApplicationTypeSelect,
      },
    },
  })
}

export function findApprovedUserVerification(userId: number) {
  return prisma.userVerification.findFirst({
    where: { userId, status: "APPROVED" },
    orderBy: [{ reviewedAt: "desc" }, { submittedAt: "desc" }],
    include: {
      type: {
        select: verificationApplicationTypeSelect,
      },
      user: {
        select: {
          username: true,
        },
      },
    },
  })
}

export function findApprovedUserVerificationByTypeAndUsername(typeId: string, username: string) {
  return prisma.userVerification.findFirst({
    where: {
      typeId,
      status: "APPROVED",
      user: { username },
    },
    orderBy: [{ reviewedAt: "desc" }, { submittedAt: "desc" }],
    select: {
      id: true,
      customIconText: true,
      customDescription: true,
      user: {
        select: {
          id: true,
          username: true,
          nickname: true,
          avatarPath: true,
          status: true,
        },
      },
    },
  })
}

export function findVerificationTypeById(verificationTypeId: string) {
  return prisma.verificationType.findUnique({
    where: { id: verificationTypeId },
  })
}

export function findActiveVerificationTypeBySlug(slug: string) {
  return prisma.verificationType.findFirst({
    where: {
      slug,
      status: true,
    },
    include: {
      _count: {
        select: {
          applications: {
            where: {
              status: "APPROVED",
            },
          },
        },
      },
    },
  })
}

export function findLatestUserVerificationApplication(userId: number, typeId: string) {
  return prisma.userVerification.findFirst({
    where: {
      userId,
      typeId,
    },
    orderBy: [{ submittedAt: "desc" }],
  })
}

export function createUserVerificationApplication(input: {
  userId: number
  verificationTypeId: string
  content: string
  customIconText: string | null
  customDescription: string | null
  formResponseJson: string | null
  client?: VerificationQueryClient
}) {
  const client = input.client ?? prisma
  return client.userVerification.create({
    data: {
      userId: input.userId,
      typeId: input.verificationTypeId,
      content: input.content,
      customIconText: input.customIconText,
      customDescription: input.customDescription,
      formResponseJson: input.formResponseJson,
      status: "PENDING",
    },
    include: {
      type: {
        select: verificationApplicationTypeSelect,
      },
    },
  })
}

export function updateUserVerificationById(id: string, data: {
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  note?: string | null
  reviewedAt?: Date | null
}) {
  return prisma.userVerification.update({
    where: { id },
    data,
  })
}
