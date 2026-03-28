import { prisma } from "@/db/client"

export function purgeExpiredRequestControls(now: Date) {
  return prisma.requestControl.deleteMany({
    where: {
      expiresAt: {
        lte: now,
      },
    },
  })
}

export function createRequestControl(data: {
  scope: string
  identity: string
  kind: string
  fingerprint: string | null
  expiresAt: Date
}) {
  return prisma.requestControl.create({
    data,
  })
}
