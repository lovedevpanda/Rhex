import { timingSafeEqual } from "node:crypto"

import { readAddonSecretValue } from "@/addons-host/runtime/secrets"
import type {
  ExternalAuthProvider,
  ExternalAuthOAuthMode,
} from "@/lib/external-auth-types"

export const ADDON_EXTERNAL_AUTH_BRIDGE_SECRET_KEY =
  "external-auth-bridge-secret"
export const ADDON_EXTERNAL_AUTH_SECRET_HEADER = "x-addon-auth-secret"

function normalizeOptionalString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback
}

export function normalizeAddonExternalAuthMode(
  value: unknown,
): ExternalAuthOAuthMode {
  const normalizedValue = normalizeOptionalString(value).toLowerCase()

  if (normalizedValue === "register") {
    return "register"
  }

  if (normalizedValue === "connect") {
    return "connect"
  }

  return "login"
}

export function normalizeAddonExternalAuthProviderCode(
  value: unknown,
): ExternalAuthProvider | null {
  const normalizedValue = normalizeOptionalString(value).toLowerCase()

  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(normalizedValue)
    ? (normalizedValue as ExternalAuthProvider)
    : null
}

export function normalizeAddonExternalAuthRedirectTo(
  value: unknown,
  fallback = "/settings?tab=profile&profileTab=accounts",
) {
  const normalizedValue = normalizeOptionalString(value)
  return normalizedValue.startsWith("/") ? normalizedValue : fallback
}

function compareSecrets(expected: string, received: string) {
  const left = Buffer.from(expected, "utf8")
  const right = Buffer.from(received, "utf8")

  if (left.length === 0 || left.length !== right.length) {
    return false
  }

  return timingSafeEqual(left, right)
}

export async function isAddonExternalAuthBridgeAuthorized(
  addonId: string,
  request: Request,
) {
  const expectedSecret = normalizeOptionalString(
    await readAddonSecretValue<string>(
      addonId,
      ADDON_EXTERNAL_AUTH_BRIDGE_SECRET_KEY,
      "",
    ),
  )
  const providedSecret = normalizeOptionalString(
    request.headers.get(ADDON_EXTERNAL_AUTH_SECRET_HEADER),
  )

  return compareSecrets(expectedSecret, providedSecret)
}
