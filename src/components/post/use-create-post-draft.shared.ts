"use client"

import type { LocalPostDraft } from "@/lib/post-draft"

export function resolveAvailableRewardPoolMode(
  currentMode: LocalPostDraft["redPacketMode"],
  options: {
    postRedPacketEnabled: boolean
    postJackpotEnabled: boolean
  },
) {
  if (currentMode === "RED_PACKET" && options.postRedPacketEnabled) {
    return "RED_PACKET" as const
  }

  if (currentMode === "JACKPOT" && options.postJackpotEnabled) {
    return "JACKPOT" as const
  }

  if (options.postJackpotEnabled) {
    return "JACKPOT" as const
  }

  return "RED_PACKET" as const
}

export function getEffectiveRewardPoolOptions(
  isAnonymous: boolean,
  options: {
    postRedPacketEnabled: boolean
    postJackpotEnabled: boolean
  },
) {
  return {
    postRedPacketEnabled: !isAnonymous && options.postRedPacketEnabled,
    postJackpotEnabled: options.postJackpotEnabled,
  }
}
