import { randomBytes } from "node:crypto"

import { findUsersByUsernames } from "@/db/external-auth-user-queries"
import { getExternalAuthProviderLabel } from "@/lib/auth-provider-config"
import { normalizeOptionalEmailAddress } from "@/lib/email"
import type { ExternalAuthIdentity, ExternalOAuthProfile, PendingExternalAuthState } from "@/lib/external-auth-types"

function normalizeAsciiValue(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "")
}

function fitUsernameLength(base: string, suffix = "") {
  const maxBaseLength = Math.max(3, 20 - suffix.length)
  const normalizedBase = base.slice(0, maxBaseLength).replace(/^_+|_+$/g, "") || "user"
  const combined = `${normalizedBase}${suffix}`.slice(0, 20)
  return combined.length >= 3 ? combined : `${combined}${"0".repeat(3 - combined.length)}`
}

export function isValidExternalUsername(value: string) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(value)
}

export function trimNormalizedEmail(email?: string | null) {
  return normalizeOptionalEmailAddress(email)
}

export function buildRandomPassword() {
  return randomBytes(24).toString("base64url")
}

export function normalizeExternalUsernameCandidate(value: string) {
  const ascii = normalizeAsciiValue(value)
  const normalized = ascii
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")

  if (!normalized) {
    return ""
  }

  return fitUsernameLength(normalized)
}

export async function buildUsernameSuggestions(base: string, minimumCount = 4) {
  const normalizedBase = normalizeExternalUsernameCandidate(base) || "user"
  const candidatePool = new Set<string>()

  for (let index = 0; candidatePool.size < 16 && index < 64; index += 1) {
    const suffix = index === 0 ? "" : `_${Math.floor(100 + Math.random() * 900)}`
    candidatePool.add(fitUsernameLength(normalizedBase, suffix))
  }

  const candidates = Array.from(candidatePool)
  const existingUsers = await findUsersByUsernames(candidates)
  const taken = new Set(existingUsers.map((item) => item.username))
  const available = candidates.filter((item) => !taken.has(item))

  while (available.length < minimumCount) {
    const fallback = fitUsernameLength("user", `_${Math.floor(1000 + Math.random() * 9000)}`)
    if (!available.includes(fallback) && !taken.has(fallback)) {
      available.push(fallback)
    }
  }

  return available.slice(0, minimumCount)
}

export function resolveExternalUsernameBase(identity: Pick<ExternalAuthIdentity, "providerUsername" | "displayName" | "providerEmail">) {
  const emailLocalPart = identity.providerEmail?.split("@")[0]?.trim() ?? ""
  return identity.providerUsername?.trim()
    || identity.displayName?.trim()
    || emailLocalPart
    || "user"
}

export async function buildPendingExternalAuthState(identity: ExternalAuthIdentity, options?: {
  emailConflictUserId?: number
  inviteCodeRequired?: boolean
}) {
  const usernameCandidate = normalizeExternalUsernameCandidate(resolveExternalUsernameBase(identity))
  const usernameSuggestions = await buildUsernameSuggestions(usernameCandidate || "user")

  if (options?.emailConflictUserId && identity.providerEmail) {
    return {
      kind: "email_bind_required",
      ...identity,
      conflictUserId: options.emailConflictUserId,
      conflictEmail: identity.providerEmail,
      usernameCandidate: usernameCandidate || usernameSuggestions[0] || "user001",
      usernameSuggestions,
    } satisfies PendingExternalAuthState
  }

  return {
    kind: "username_required",
    ...identity,
    usernameCandidate: usernameCandidate || usernameSuggestions[0] || "user001",
    usernameSuggestions,
    inviteCodeRequired: Boolean(options?.inviteCodeRequired),
  } satisfies PendingExternalAuthState
}

export function buildExternalAuthMetadataJson(identity: Pick<ExternalAuthIdentity, "displayName" | "avatarUrl" | "emailVerified" | "providerLabel">) {
  return JSON.stringify({
    providerLabel: identity.providerLabel ?? null,
    displayName: identity.displayName ?? null,
    avatarUrl: identity.avatarUrl ?? null,
    emailVerified: Boolean(identity.emailVerified),
  })
}

export function createOAuthIdentity(profile: ExternalOAuthProfile): ExternalAuthIdentity {
  return {
    method: "oauth",
    provider: profile.provider,
    providerLabel: getExternalAuthProviderLabel(profile.provider),
    providerAccountId: profile.providerAccountId,
    providerUsername: profile.providerUsername ?? null,
    providerEmail: trimNormalizedEmail(profile.providerEmail),
    emailVerified: profile.emailVerified,
    displayName: profile.displayName ?? null,
    avatarUrl: profile.avatarUrl ?? null,
  }
}

export function createPasskeyIdentity(input: {
  email?: string | null
  displayName?: string | null
  usernameCandidate: string
  credential: ExternalAuthIdentity["passkeyCredential"]
}): ExternalAuthIdentity {
  return {
    method: "passkey",
    providerLabel: "Passkey",
    providerEmail: trimNormalizedEmail(input.email),
    emailVerified: false,
    displayName: input.displayName ?? null,
    providerUsername: input.usernameCandidate,
    passkeyCredential: input.credential ?? undefined,
  }
}
