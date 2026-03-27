import { cache } from "react"

import { prisma } from "@/db/client"
import type { Prisma } from "@/db/types"
import { getSessionCookieName, parseSessionToken } from "@/lib/session"

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
} satisfies Prisma.UserSelect

export type SessionActor = Prisma.UserGetPayload<{ select: typeof sessionActorSelect }>

export const getCurrentSessionActor = cache(async (): Promise<SessionActor | null> => {
  const { cookies } = await import("next/headers")
  const cookieStore = cookies()
  const token = cookieStore.get(getSessionCookieName())?.value
  const session = await parseSessionToken(token)

  if (!session) {
    return null
  }

  try {
    return await prisma.user.findUnique({
      where: { username: session.username },
      select: sessionActorSelect,
    })
  } catch (error) {
    console.error(error)
    return null
  }
})

export const getCurrentUser = getCurrentSessionActor

export { getSessionCookieName } from "@/lib/session"

