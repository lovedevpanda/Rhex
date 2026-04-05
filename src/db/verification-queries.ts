import { prisma } from "@/db/client"
import { VerificationChannel } from "@/db/types"

const verificationApplicationTypeSelect = {
  id: true,
  name: true,
  iconText: true,
  color: true,
  description: true,
} as const

export function expireActiveVerificationCodes(channel: VerificationChannel, target: string, purpose: string, consumedAt: Date) {
  return prisma.verificationCode.updateMany({
    where: {
      channel,
      target,
      purpose,
      consumedAt: null,
    },
    data: {
      consumedAt,
    },
  })
}

export function createVerificationCodeRecord(data: {
  channel: VerificationChannel
  target: string
  codeHash: string
  purpose: string
  expiresAt: Date
  sentByIp?: string | null
  userAgent?: string | null
  userId?: number | null
}) {
  return prisma.verificationCode.create({
    data: {
      channel: data.channel,
      target: data.target,
      codeHash: data.codeHash,
      purpose: data.purpose,
      expiresAt: data.expiresAt,
      sentByIp: data.sentByIp ?? null,
      userAgent: data.userAgent ?? null,
      userId: data.userId ?? null,
    },
  })
}

export function findLatestPendingVerificationCode(channel: VerificationChannel, target: string, purpose: string) {
  return prisma.verificationCode.findFirst({
    where: {
      channel,
      target,
      purpose,
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  })
}

export function updateVerificationAttempts(recordId: string, attempts: number) {
  return prisma.verificationCode.update({
    where: { id: recordId },
    data: {
      attempts,
    },
  })
}

export function consumeVerificationCode(recordId: string, attempts: number, consumedAt: Date) {
  return prisma.verificationCode.update({
    where: { id: recordId },
    data: {
      attempts,
      consumedAt,
    },
  })
}

export function findRecentConsumedVerificationCode(channel: VerificationChannel, target: string, purpose: string, since: Date) {
  return prisma.verificationCode.findFirst({
    where: {
      channel,
      target,
      purpose,
      consumedAt: {
        gte: since,
      },
    },
    orderBy: { consumedAt: "desc" },
  })
}

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
    },
  })
}

export function findVerificationTypeById(verificationTypeId: string) {
  return prisma.verificationType.findUnique({
    where: { id: verificationTypeId },
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
  formResponseJson: string | null
}) {
  return prisma.userVerification.create({
    data: {
      userId: input.userId,
      typeId: input.verificationTypeId,
      content: input.content,
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
