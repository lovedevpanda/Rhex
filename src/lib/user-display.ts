export interface UserDisplayNameSource {
  username: string
  nickname?: string | null
}

export function getUserDisplayName(user: UserDisplayNameSource | null | undefined, fallback = "") {
  if (!user) {
    return fallback
  }

  const nickname = user.nickname?.trim()
  return nickname || user.username || fallback
}
