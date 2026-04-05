import { prisma } from "@/db/client"
import type { Prisma } from "@/db/types"

export const sessionActorSelect = {
  id: true,
  username: true,
  nickname: true,
  avatarPath: true,
  role: true,
  status: true,
  level: true,
  points: true,
  vipLevel: true,
  vipExpiresAt: true,
  sessionInvalidBefore: true,
} satisfies Prisma.UserSelect

export type SessionActor = Prisma.UserGetPayload<{ select: typeof sessionActorSelect }>

export function findSessionActorByUsername(username: string) {
  return prisma.user.findUnique({
    where: { username },
    select: sessionActorSelect,
  })
}
