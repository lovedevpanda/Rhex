export type PostDraftMode = "create" | "edit"

export interface LocalPostDraft {
  title: string
  content: string
  coverPath: string
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
  minViewVipLevel: string
  manualTags: string[]
  lotteryStartsAt: string
  lotteryEndsAt: string
  lotteryParticipantGoal: string
  lotteryPrizes: Array<{ title: string; quantity: string; description: string }>
  lotteryConditions: Array<{ type: string; value: string; operator: string; description: string; groupKey: string }>
  redPacketEnabled: boolean
  redPacketGrantMode: "FIXED" | "RANDOM"
  redPacketClaimOrderMode: "FIRST_COME_FIRST_SERVED" | "RANDOM"
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

const STORAGE_KEY_PREFIX = "rhex:post-draft"

export function createEmptyLocalPostDraft(boardSlug = ""): LocalPostDraft {
  return {
    title: "",
    content: "",
    coverPath: "",
    boardSlug,
    postType: "NORMAL",
    bountyPoints: "100",
    pollOptions: ["", ""],
    pollExpiresAt: "",
    commentsVisibleToAuthorOnly: false,
    replyUnlockContent: "",
    purchaseUnlockContent: "",
    purchasePrice: "20",
    minViewLevel: "0",
    minViewVipLevel: "0",
    manualTags: [],
    lotteryStartsAt: "",
    lotteryEndsAt: "",
    lotteryParticipantGoal: "",
    lotteryPrizes: [{ title: "一等奖", quantity: "1", description: "填写奖品描述" }],
    lotteryConditions: [{ type: "REPLY_CONTENT_LENGTH", value: "10", operator: "GTE", description: "回帖内容至少 10 字", groupKey: "default" }],
    redPacketEnabled: false,
    redPacketGrantMode: "FIXED",
    redPacketClaimOrderMode: "FIRST_COME_FIRST_SERVED",
    redPacketTriggerType: "REPLY",
    redPacketUnitPoints: "10",
    redPacketTotalPoints: "10",
    redPacketPacketCount: "1",
  }
}

function hasMeaningfulPostDraftContent(draft: LocalPostDraft, initialDraft: LocalPostDraft) {
  return JSON.stringify(draft) !== JSON.stringify(initialDraft)
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

export function savePostDraftToStorage(mode: PostDraftMode, draft: LocalPostDraft, initialDraft: LocalPostDraft, postId?: string) {
  if (typeof window === "undefined") {
    return null
  }

  const storageKey = buildDraftStorageKey(mode, postId)
  if (!hasMeaningfulPostDraftContent(draft, initialDraft)) {
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

    return {
      ...parsed,
      data: {
        ...createEmptyLocalPostDraft(parsed.data.boardSlug || ""),
        ...parsed.data,
        manualTags: Array.isArray(parsed.data.manualTags) ? parsed.data.manualTags.filter((item): item is string => typeof item === "string") : [],
      },
    }
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
