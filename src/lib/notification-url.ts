import { getConfiguredSiteOrigin, normalizeSiteOrigin } from "@/lib/site-origin-config"

const NOTIFICATION_URL_BASE = "https://notification.local"
const MAX_NOTIFICATION_URL_LENGTH = 2048

export interface NormalizeNotificationUrlOptions {
  siteOrigin?: string | null
}

function hasUrlScheme(value: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(value)
}

function hasUnsafeControlCharacter(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value)
}

function formatPathUrl(url: URL) {
  return `${url.pathname}${url.search}${url.hash}`
}

function normalizeSiteOriginOption(value: string | null | undefined) {
  if (!value) {
    return null
  }

  try {
    return new URL(normalizeSiteOrigin(value)).origin
  } catch {
    return null
  }
}

export function normalizeNotificationUrl(
  rawValue: unknown,
  options: NormalizeNotificationUrlOptions = {},
) {
  const value = typeof rawValue === "string" ? rawValue.trim() : ""

  if (
    !value
    || value.length > MAX_NOTIFICATION_URL_LENGTH
    || value.includes("\\")
    || hasUnsafeControlCharacter(value)
  ) {
    return null
  }

  if (hasUrlScheme(value)) {
    let parsed: URL
    try {
      parsed = new URL(value)
    } catch {
      return null
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null
    }

    const siteOrigin = normalizeSiteOriginOption(
      "siteOrigin" in options ? options.siteOrigin : getConfiguredSiteOrigin(),
    )

    return siteOrigin && parsed.origin === siteOrigin ? formatPathUrl(parsed) : null
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return null
  }

  try {
    const parsed = new URL(value, `${NOTIFICATION_URL_BASE}/`)
    if (parsed.origin !== NOTIFICATION_URL_BASE) {
      return null
    }

    // 同 auth-redirect：URL 解析会折叠 `/..//` -> `//`，只看输入前缀挡不住，
    // 必须检查解析后的 pathname，否则通知链接能把用户送到站外。
    if (parsed.pathname.startsWith("//")) {
      return null
    }

    return formatPathUrl(parsed)
  } catch {
    return null
  }
}
