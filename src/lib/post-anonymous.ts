import { cache } from "react"

import { findAnonymousMaskUserById, type AnonymousMaskUserRecord } from "@/db/anonymous-post-queries"
import { getSiteSettings } from "@/lib/site-settings"
import { getUserDisplayName } from "@/lib/user-display"
import { getVipLevel, isVipActive } from "@/lib/vip-status"

export interface AnonymousDisplayIdentity {
  id: number
  username: string
  name: string
  avatarPath?: string | null
  status: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  authorIsVip?: boolean
  authorVipLevel?: number
  authorVerification?: {
    id: string
    name: string
    color: string
    iconText?: string | null
    description?: string | null
    customDescription?: string | null
  } | null
  authorDisplayedBadges?: Array<{
    id: string
    code?: string | null
    name: string
    description?: string | null
    color: string
    iconText?: string | null
  }>
}

function mapAnonymousIdentity(user: AnonymousMaskUserRecord): AnonymousDisplayIdentity {
  return {
    id: user.id,
    username: user.username,
    name: getUserDisplayName(user),
    avatarPath: user.avatarPath,
    status: user.status,
    authorIsVip: isVipActive(user),
    authorVipLevel: getVipLevel(user),
    authorVerification: user.verificationApplications?.[0]
      ? {
          id: user.verificationApplications[0].type.id,
          name: user.verificationApplications[0].type.name,
          color: user.verificationApplications[0].type.color,
          iconText: user.verificationApplications[0].type.iconText,
          description: user.verificationApplications[0].type.description,
          customDescription: user.verificationApplications[0].customDescription,
        }
      : null,
    authorDisplayedBadges: (user.userBadges ?? [])
      .filter((item) => Boolean(item.isDisplayed) && item.badge.status)
      .slice(0, 3)
      .map((item) => ({
        id: item.badge.id,
        code: item.badge.code,
        name: item.badge.name,
        description: item.badge.description,
        color: item.badge.color,
        iconText: item.badge.iconText,
      })),
  }
}

export function isAnonymousPost(post: { isAnonymous?: boolean | null }) {
  return Boolean(post.isAnonymous)
}

export function canUseAnonymousIdentityForPostReply(input: {
  post: { isAnonymous?: boolean | null; authorId: number }
  currentUserId: number
}) {
  return isAnonymousPost(input.post) && input.post.authorId === input.currentUserId
}

export function applyAnonymousIdentityToPost<T extends {
  isAnonymous?: boolean
  author: string
  authorUsername?: string
  authorAvatarPath?: string | null
  authorStatus?: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  authorIsVip?: boolean
  authorVipLevel?: number | null
  authorVerification?: {
    id: string
    name: string
    color: string
    iconText?: string | null
    description?: string | null
    customDescription?: string | null
  } | null
  authorDisplayedBadges?: Array<{
    id: string
    code?: string | null
    name: string
    description?: string | null
    color: string
    iconText?: string | null
  }>
}>(post: T, maskIdentity: AnonymousDisplayIdentity | null) {
  if (!post.isAnonymous || !maskIdentity) {
    return post
  }

  return {
    ...post,
    author: maskIdentity.name,
    authorUsername: maskIdentity.username,
    authorAvatarPath: maskIdentity.avatarPath,
    authorStatus: maskIdentity.status,
    authorIsVip: maskIdentity.authorIsVip,
    authorVipLevel: maskIdentity.authorVipLevel,
    authorVerification: maskIdentity.authorVerification,
    authorDisplayedBadges: maskIdentity.authorDisplayedBadges,
  }
}

export const getAnonymousMaskDisplayIdentity = cache(async (): Promise<AnonymousDisplayIdentity | null> => {
  const settings = await getSiteSettings()

  if (!settings.anonymousPostEnabled || !settings.anonymousPostMaskUserId) {
    return null
  }

  const user = await findAnonymousMaskUserById(settings.anonymousPostMaskUserId)
  return user ? mapAnonymousIdentity(user) : null
})
