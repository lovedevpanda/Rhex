"use client"

export type ClientPlatform = "mac" | "windows" | "other"

export interface PlatformShortcutMap {
  mac?: string[]
  windows?: string[]
  other?: string[]
  default?: string[]
}

export function getClientPlatform(): ClientPlatform {
  if (typeof navigator === "undefined") {
    return "other"
  }

  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: {
      platform?: string
    }
  }
  const userAgentDataPlatform = typeof navigatorWithUserAgentData.userAgentData?.platform === "string"
    ? navigatorWithUserAgentData.userAgentData.platform
    : ""
  const fallbackPlatform = typeof navigator.platform === "string" ? navigator.platform : ""
  const fallbackUserAgent = typeof navigator.userAgent === "string" ? navigator.userAgent : ""
  const normalizedPlatform = `${userAgentDataPlatform} ${fallbackPlatform} ${fallbackUserAgent}`.toLowerCase()

  if (/(mac|iphone|ipad|ipod)/.test(normalizedPlatform)) {
    return "mac"
  }

  if (/(win|windows)/.test(normalizedPlatform)) {
    return "windows"
  }

  return "other"
}

export function resolvePlatformShortcuts(shortcuts: PlatformShortcutMap | undefined, platform: ClientPlatform) {
  if (!shortcuts) {
    return []
  }

  return shortcuts[platform] ?? shortcuts.default ?? shortcuts.other ?? []
}
