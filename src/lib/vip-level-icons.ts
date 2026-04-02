export interface VipLevelIcons {
  vip1: string
  vip2: string
  vip3: string
}

export const DEFAULT_VIP_LEVEL_ICONS: VipLevelIcons = {
  vip1: "💍",
  vip2: "💎",
  vip3: "👑",
}

function normalizeVipLevelIconValue(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback
  }

  const normalized = value.trim()
  return normalized || fallback
}

export function normalizeVipLevelIcons(input?: Partial<VipLevelIcons> | null): VipLevelIcons {
  return {
    vip1: normalizeVipLevelIconValue(input?.vip1, DEFAULT_VIP_LEVEL_ICONS.vip1),
    vip2: normalizeVipLevelIconValue(input?.vip2, DEFAULT_VIP_LEVEL_ICONS.vip2),
    vip3: normalizeVipLevelIconValue(input?.vip3, DEFAULT_VIP_LEVEL_ICONS.vip3),
  }
}

export function getVipLevelIcon(level: number | null | undefined, icons: VipLevelIcons = DEFAULT_VIP_LEVEL_ICONS) {
  const normalizedIcons = normalizeVipLevelIcons(icons)

  if ((level ?? 0) >= 3) {
    return normalizedIcons.vip3
  }

  if (level === 2) {
    return normalizedIcons.vip2
  }

  return normalizedIcons.vip1
}
