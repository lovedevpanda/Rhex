import type { Board, User, Zone } from "@/db/types"

import { normalizePostTypes, type LocalPostType } from "@/lib/post-types"

export interface EffectiveBoardSettings {
  postPointDelta: number
  replyPointDelta: number
  postIntervalSeconds: number
  replyIntervalSeconds: number
  allowedPostTypes: LocalPostType[]
  requirePostReview: boolean
  minViewPoints: number
  minViewLevel: number
  minPostPoints: number
  minPostLevel: number
  minReplyPoints: number
  minReplyLevel: number
  minViewVipLevel: number
  minPostVipLevel: number
  minReplyVipLevel: number
}


export function resolveBoardSettings(zone?: Partial<Zone> | null, board?: Partial<Board> | null): EffectiveBoardSettings {
  const zoneAdvanced = zone as (Partial<Zone> & {
    postPointDelta?: number | null
    replyPointDelta?: number | null
    postIntervalSeconds?: number | null
    replyIntervalSeconds?: number | null
    allowedPostTypes?: string | null
    minViewPoints?: number | null
    minViewLevel?: number | null
    minPostPoints?: number | null
    minPostLevel?: number | null
    minReplyPoints?: number | null
    minReplyLevel?: number | null
  }) | null | undefined


  return {
    postPointDelta: board?.postPointDelta ?? zoneAdvanced?.postPointDelta ?? 0,
    replyPointDelta: board?.replyPointDelta ?? zoneAdvanced?.replyPointDelta ?? 0,
    postIntervalSeconds: board?.postIntervalSeconds ?? zoneAdvanced?.postIntervalSeconds ?? 120,
    replyIntervalSeconds: board?.replyIntervalSeconds ?? zoneAdvanced?.replyIntervalSeconds ?? 3,
    allowedPostTypes: normalizePostTypes(board?.allowedPostTypes ?? zoneAdvanced?.allowedPostTypes),

    requirePostReview: board?.requirePostReview ?? zone?.requirePostReview ?? false,
    minViewPoints: board?.minViewPoints ?? (zone as { minViewPoints?: number | null } | null | undefined)?.minViewPoints ?? 0,
    minViewLevel: board?.minViewLevel ?? (zone as { minViewLevel?: number | null } | null | undefined)?.minViewLevel ?? 0,
    minPostPoints: board?.minPostPoints ?? (zone as { minPostPoints?: number | null } | null | undefined)?.minPostPoints ?? 0,
    minPostLevel: board?.minPostLevel ?? (zone as { minPostLevel?: number | null } | null | undefined)?.minPostLevel ?? 0,
    minReplyPoints: board?.minReplyPoints ?? (zone as { minReplyPoints?: number | null } | null | undefined)?.minReplyPoints ?? 0,
    minReplyLevel: board?.minReplyLevel ?? (zone as { minReplyLevel?: number | null } | null | undefined)?.minReplyLevel ?? 0,
    minViewVipLevel: board?.minViewVipLevel ?? zone?.minViewVipLevel ?? 0,
    minPostVipLevel: board?.minPostVipLevel ?? zone?.minPostVipLevel ?? 0,
    minReplyVipLevel: board?.minReplyVipLevel ?? zone?.minReplyVipLevel ?? 0,

  }
}

export function canUserAccess(user: Pick<User, "points" | "level" | "vipLevel" | "vipExpiresAt"> | null, settings: EffectiveBoardSettings, action: "view" | "post" | "reply") {
  const minPoints = action === "view" ? settings.minViewPoints : action === "post" ? settings.minPostPoints : settings.minReplyPoints
  const minLevel = action === "view" ? settings.minViewLevel : action === "post" ? settings.minPostLevel : settings.minReplyLevel
  const minVipLevel = action === "view" ? settings.minViewVipLevel : action === "post" ? settings.minPostVipLevel : settings.minReplyVipLevel
  const isVipActive = Boolean(user?.vipExpiresAt && new Date(user.vipExpiresAt).getTime() > Date.now())
  const currentVipLevel = isVipActive ? (user?.vipLevel ?? 0) : 0

  if (minVipLevel > 0 && currentVipLevel < minVipLevel) {

    return { allowed: false, message: `当前需要至少 VIP ${minVipLevel}` }
  }

  if ((user?.points ?? 0) < minPoints) {
    return { allowed: false, message: `当前需要至少 ${minPoints} 点` }
  }


  if ((user?.level ?? 0) < minLevel) {
    return { allowed: false, message: `当前需要至少 Lv.${minLevel}` }
  }

  return { allowed: true, message: "" }
}

