export interface VipStateSource {
  vipLevel?: number | null
  vipExpiresAt?: string | Date | null
}

interface VipNameClassOptions {
  emphasize?: boolean
  medium?: boolean
}

export function isVipActive(source: VipStateSource | null | undefined) {
  if (!source?.vipExpiresAt) {
    return false
  }

  const expiresAt = new Date(source.vipExpiresAt)
  if (Number.isNaN(expiresAt.getTime())) {
    return false
  }

  return expiresAt.getTime() > Date.now()
}

export function getVipLevel(source: VipStateSource | null | undefined) {
  return Math.max(1, source?.vipLevel ?? 1)
}

export function getVipNameClass(isVip?: boolean, level?: number | null, options?: VipNameClassOptions) {
  const fontWeightClassName = options?.emphasize ? "font-semibold" : options?.medium ? "font-medium" : ""
  const baseClassName = [fontWeightClassName, "hover:underline"].filter(Boolean).join(" ")

  if (!isVip || !level || level <= 0) {
    return baseClassName
  }

  if (level >= 3) {
    return `${baseClassName} text-amber-700 dark:text-amber-300`
  }

  if (level === 2) {
    return `${baseClassName} text-rose-700 dark:text-rose-300`
  }

  return `${baseClassName} text-violet-700 dark:text-violet-300`
}
