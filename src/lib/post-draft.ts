export type PostDraftMode = "create" | "edit"

export interface LocalPostDraft {
  title: string
  content: string
  boardSlug: string
  postType: string
  bountyPoints: string
  pollOptions: string[]
  pollExpiresAt: string
  commentsVisibleToAuthorOnly: boolean
  replyUnlockContent: string
  purchaseUnlockContent: string
  purchasePrice: string
  minViewLevel: string
  lotteryStartsAt: string
  lotteryEndsAt: string
  lotteryParticipantGoal: string
  lotteryPrizes: Array<{ title: string; quantity: string; description: string }>
  lotteryConditions: Array<{ type: string; value: string; operator: string; description: string; groupKey: string }>
  redPacketEnabled: boolean
  redPacketGrantMode: "FIXED" | "RANDOM"
  redPacketTriggerType: "REPLY" | "LIKE" | "FAVORITE"
  redPacketUnitPoints: string
  redPacketTotalPoints: string
  redPacketPacketCount: string
}

export interface StoredLocalPostDraft {
  version: 1
  updatedAt: string
  mode: PostDraftMode
  postId: string | null
  data: LocalPostDraft
}

const STORAGE_KEY_PREFIX = "bbs:post-draft"

function hasMeaningfulPostDraftContent(draft: LocalPostDraft) {
  if (draft.title.trim() || draft.content.trim()) {
    return true
  }

  if (draft.replyUnlockContent.trim() || draft.purchaseUnlockContent.trim()) {
    return true
  }

  if (draft.commentsVisibleToAuthorOnly || draft.redPacketEnabled) {
    return true
  }

  if (draft.postType !== "NORMAL") {
    return true
  }

  if (draft.pollOptions.some((item) => item.trim()) || draft.pollExpiresAt.trim()) {
    return true
  }

  if (Number(draft.minViewLevel) > 0 || draft.lotteryStartsAt.trim() || draft.lotteryEndsAt.trim() || draft.lotteryParticipantGoal.trim()) {
    return true
  }

  if (draft.lotteryPrizes.some((item) => item.title.trim() || item.description.trim() || item.quantity.trim() !== "1")) {
    return true
  }

  if (draft.lotteryConditions.some((item) => item.type !== "REPLY_CONTENT_LENGTH" || item.value.trim() !== "10" || item.operator !== "GTE" || item.description.trim() !== "回帖内容至少 10 字" || item.groupKey.trim() !== "default")) {
    return true
  }

  if (draft.redPacketGrantMode !== "FIXED" || draft.redPacketTriggerType !== "REPLY") {
    return true
  }

  if (draft.redPacketUnitPoints.trim() !== "10" || draft.redPacketTotalPoints.trim() !== "10" || draft.redPacketPacketCount.trim() !== "1") {
    return true
  }

  return false
}

function buildDraftStorageKey(mode: PostDraftMode, postId?: string) {
  if (mode === "edit" && postId) {
    return `${STORAGE_KEY_PREFIX}:edit:${postId}`
  }

  return `${STORAGE_KEY_PREFIX}:create`
}

export function getPostDraftStorageKey(mode: PostDraftMode, postId?: string) {
  return buildDraftStorageKey(mode, postId)
}

export function savePostDraftToStorage(mode: PostDraftMode, draft: LocalPostDraft, postId?: string) {
  if (typeof window === "undefined") {
    return null
  }

  const storageKey = buildDraftStorageKey(mode, postId)
  if (!hasMeaningfulPostDraftContent(draft)) {
    window.localStorage.removeItem(storageKey)
    return null
  }

  const payload: StoredLocalPostDraft = {
    version: 1,
    updatedAt: new Date().toISOString(),
    mode,
    postId: mode === "edit" ? postId ?? null : null,
    data: draft,
  }
  window.localStorage.setItem(storageKey, JSON.stringify(payload))
  return payload
}

export function loadPostDraftFromStorage(mode: PostDraftMode, postId?: string) {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.localStorage.getItem(buildDraftStorageKey(mode, postId))
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as StoredLocalPostDraft
    if (parsed?.version !== 1 || !parsed.data) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function clearPostDraftFromStorage(mode: PostDraftMode, postId?: string) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(buildDraftStorageKey(mode, postId))
}
