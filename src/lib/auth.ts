import { cache } from "react"

import { findSessionActorByUsername, type SessionActor } from "@/db/session-actor-queries"
import { getRequestIpFromHeaders } from "@/lib/request-ip"
import { getSessionCookieName, parseSessionToken } from "@/lib/session"

export type { SessionActor } from "@/db/session-actor-queries"

export const getCurrentSessionActor = cache(async (): Promise<SessionActor | null> => {
  const { cookies, headers } = await import("next/headers")
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])
  const token = cookieStore.get(getSessionCookieName())?.value
  const session = await parseSessionToken(token, {
    requestIp: getRequestIpFromHeaders(headerStore),
  })

  if (!session) {
    return null
  }

  try {
    const actor = await findSessionActorByUsername(session.username)

    if (!actor) {
      return null
    }

    const invalidBeforeSeconds = actor.sessionInvalidBefore
      ? Math.floor(actor.sessionInvalidBefore.getTime() / 1000)
      : 0

    if (invalidBeforeSeconds > 0 && session.issuedAt <= invalidBeforeSeconds) {
      return null
    }

    return actor
  } catch (error) {
    console.error(error)
    return null
  }
})

export const getCurrentUser = getCurrentSessionActor

export { getSessionCookieName } from "@/lib/session"
