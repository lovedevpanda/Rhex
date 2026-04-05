export const userDisplayNameSelect = {
  username: true,
  nickname: true,
} as const

export const userIdentitySelect = {
  id: true,
  ...userDisplayNameSelect,
} as const

export const userIdentityWithAvatarSelect = {
  ...userIdentitySelect,
  avatarPath: true,
} as const
