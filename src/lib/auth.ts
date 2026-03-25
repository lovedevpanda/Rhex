import { cache } from "react"

import { prisma } from "@/db/client"
import { getSessionCookieName, parseSessionToken } from "@/lib/session"

export const getCurrentUser = cache(async () => {
  const { cookies } = await import("next/headers")
  const cookieStore = cookies()
  const token = cookieStore.get(getSessionCookieName())?.value
  const session = await parseSessionToken(token)

  if (!session) {
    return null
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username: session.username },
      select: {
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
      },
    })

    return user
  } catch (error) {
    console.error(error)
    return null
  }
})

export { getSessionCookieName } from "@/lib/session"
