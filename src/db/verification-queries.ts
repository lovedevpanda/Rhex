import { prisma } from "@/db/client"
import { VerificationChannel } from "@/db/types"

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
