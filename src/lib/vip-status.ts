export interface VipStateSource {
  vipLevel?: number | null
  vipExpiresAt?: string | Date | null
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
