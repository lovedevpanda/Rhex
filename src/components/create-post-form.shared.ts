import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import { createEmptyLocalPostDraft, type LocalPostDraft } from "@/lib/post-draft"
import { normalizeManualTags } from "@/lib/post-tags"
import { DEFAULT_ALLOWED_POST_TYPES, DEFAULT_POST_TYPE, normalizePostType, type LocalPostType } from "@/lib/post-types"
import { multiplyPositiveSafeIntegers, parsePositiveSafeInteger } from "@/lib/shared/safe-integer"

export const LOTTERY_NUMERIC_CONDITION_TYPES = new Set(["REPLY_CONTENT_LENGTH", "REGISTER_DAYS", "USER_LEVEL", "VIP_LEVEL", "USER_POINTS"])
export const LOTTERY_TEXT_CONDITION_TYPES = new Set(["REPLY_KEYWORD"])

export const POST_TYPE_OPTIONS = [
  { value: "NORMAL", label: "普通帖", hint: "直接讨论" },
  { value: "BOUNTY", label: "悬赏帖", hint: "设置积分悬赏" },
  { value: "POLL", label: "投票帖", hint: "发起投票" },
  { value: "LOTTERY", label: "抽奖帖", hint: "配置奖项与参与条件" },
] as const satisfies Array<{ value: LocalPostType; label: string; hint: string }>

export interface CreatePostFormBoardItem {
  value: string
  label: string
  allowedPostTypes?: string[]
  requirePostReview?: boolean
  minPostPoints?: number
  minPostLevel?: number
  minPostVipLevel?: number
}

export interface CreatePostFormBoardGroup {
  zone: string
  items: CreatePostFormBoardItem[]
}

export interface CreatePostFormInitialValues {
  title: string
  content: string
  coverPath?: string | null
  boardSlug: string
  postType: LocalPostType
  bountyPoints?: number | null
  pollOptions?: string[]
  pollExpiresAt?: string | null
  commentsVisibleToAuthorOnly?: boolean
  replyUnlockContent?: string
  replyThreshold?: number | null
  purchaseUnlockContent?: string
  purchasePrice?: number | null
  minViewLevel?: number | null
  minViewVipLevel?: number | null
  tags?: string[]
  lotteryConfig?: {
    startsAt?: string | null
    endsAt?: string | null
    participantGoal?: number | null
    prizes?: Array<{ title: string; quantity: number; description: string }>
    conditions?: Array<{ type: string; value: string; operator?: string; description?: string; groupKey?: string }>
  }
  redPacketConfig?: {
    enabled?: boolean
    grantMode?: "FIXED" | "RANDOM"
    claimOrderMode?: "FIRST_COME_FIRST_SERVED" | "RANDOM"
    triggerType?: "REPLY" | "LIKE" | "FAVORITE"
    totalPoints?: number | null
    unitPoints?: number | null
    packetCount?: number | null
  }
}

export interface CreatePostFormProps {
  boardOptions: CreatePostFormBoardGroup[]
  pointName: string
  postRedPacketEnabled?: boolean
  markdownEmojiMap?: MarkdownEmojiItem[]
  currentUser: {
    username: string
    nickname: string | null
    level: number
    points: number
    vipLevel?: number
    vipExpiresAt?: string | null
  }
  mode?: "create" | "edit"
  postId?: string
  successSlug?: string
  initialValues?: CreatePostFormInitialValues
}

export type HiddenModalType = "reply" | "purchase" | "view-level" | null

export type LotteryPrizeDraft = LocalPostDraft["lotteryPrizes"][number]
export type LotteryConditionDraft = LocalPostDraft["lotteryConditions"][number]
type InitialLotteryConfig = NonNullable<CreatePostFormInitialValues["lotteryConfig"]>

export function getLotteryConditionPlaceholder(type: string, pointName: string) {
  switch (type) {
    case "REPLY_CONTENT_LENGTH":
      return "最少回帖字数，如 10"
    case "REPLY_KEYWORD":
      return "指定回帖内容或关键词"
    case "REGISTER_DAYS":
      return "注册天数，如 30"
    case "USER_LEVEL":
      return "最低用户等级，如 3"
    case "VIP_LEVEL":
      return "最低 VIP 等级，如 1"
    case "USER_POINTS":
      return `最低${pointName}，如 100`
    default:
      return "无需填写"
  }
}

function getLotteryConditionDefaultValue(type: string) {
  switch (type) {
    case "REPLY_CONTENT_LENGTH":
      return "10"
    case "REPLY_KEYWORD":
      return "恭喜发财"
    case "REGISTER_DAYS":
      return "7"
    case "USER_LEVEL":
      return "1"
    case "VIP_LEVEL":
      return "1"
    case "USER_POINTS":
      return "100"
    default:
      return "1"
  }
}

function getLotteryConditionDefaultDescription(type: string, pointName: string) {
  switch (type) {
    case "REPLY_CONTENT_LENGTH":
      return "回帖内容至少 10 字"
    case "REPLY_KEYWORD":
      return "回帖需包含指定内容"
    case "LIKE_POST":
      return "需点赞本帖"
    case "FAVORITE_POST":
      return "需收藏本帖"
    case "REGISTER_DAYS":
      return "注册时间达到指定天数"
    case "USER_LEVEL":
      return "用户等级达到要求"
    case "VIP_LEVEL":
      return "VIP 等级达到要求"
    case "USER_POINTS":
      return `${pointName}达到要求`
    default:
      return ""
  }
}

export function buildLotteryConditionItem(type: string, pointName: string, groupKey = "default"): LotteryConditionDraft {
  return {
    type,
    value: LOTTERY_NUMERIC_CONDITION_TYPES.has(type) || LOTTERY_TEXT_CONDITION_TYPES.has(type) ? getLotteryConditionDefaultValue(type) : "1",
    operator: LOTTERY_NUMERIC_CONDITION_TYPES.has(type) ? "GTE" : "EQ",
    description: getLotteryConditionDefaultDescription(type, pointName),
    groupKey,
  }
}

function normalizeLotteryPrizes(prizes?: InitialLotteryConfig["prizes"] | LocalPostDraft["lotteryPrizes"]) {
  if (!Array.isArray(prizes) || prizes.length === 0) {
    return [{ title: "一等奖", quantity: "1", description: "填写奖品描述" }]
  }

  return prizes.map((item) => ({
    title: item.title,
    quantity: String(item.quantity),
    description: item.description,
  }))
}

function normalizeLotteryConditions(
  conditions: InitialLotteryConfig["conditions"] | LocalPostDraft["lotteryConditions"] | undefined,
  pointName: string,
) {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return [buildLotteryConditionItem("REPLY_CONTENT_LENGTH", pointName)]
  }

  return conditions.map((item) => ({
    type: item.type,
    value: item.value,
    operator: item.operator ?? "GTE",
    description: item.description ?? "",
    groupKey: item.groupKey ?? "default",
  }))
}

export function buildInitialPostDraft(
  initialValues: CreatePostFormInitialValues | undefined,
  boardOptions: CreatePostFormBoardGroup[],
  pointName: string,
) {
  const fallbackBoardSlug = boardOptions[0]?.items[0]?.value ?? ""

  if (!initialValues) {
    return createEmptyLocalPostDraft(fallbackBoardSlug)
  }

  return {
    title: initialValues.title,
    content: initialValues.content,
    coverPath: initialValues.coverPath ?? "",
    boardSlug: initialValues.boardSlug,
    postType: normalizePostType(initialValues.postType, DEFAULT_POST_TYPE),
    bountyPoints: String(initialValues.bountyPoints ?? 100),
    pollOptions: initialValues.pollOptions && initialValues.pollOptions.length > 0 ? initialValues.pollOptions : ["", ""],
    pollExpiresAt: initialValues.pollExpiresAt ?? "",
    commentsVisibleToAuthorOnly: Boolean(initialValues.commentsVisibleToAuthorOnly),
    replyUnlockContent: initialValues.replyUnlockContent ?? "",
    purchaseUnlockContent: initialValues.purchaseUnlockContent ?? "",
    purchasePrice: String(initialValues.purchasePrice ?? 20),
    minViewLevel: String(initialValues.minViewLevel ?? 0),
    minViewVipLevel: String(initialValues.minViewVipLevel ?? 0),
    manualTags: normalizeManualTags(initialValues.tags),
    lotteryStartsAt: initialValues.lotteryConfig?.startsAt ?? "",
    lotteryEndsAt: initialValues.lotteryConfig?.endsAt ?? "",
    lotteryParticipantGoal: String(initialValues.lotteryConfig?.participantGoal ?? ""),
    lotteryPrizes: normalizeLotteryPrizes(initialValues.lotteryConfig?.prizes),
    lotteryConditions: normalizeLotteryConditions(initialValues.lotteryConfig?.conditions, pointName),
    redPacketEnabled: Boolean(initialValues.redPacketConfig?.enabled),
    redPacketGrantMode: initialValues.redPacketConfig?.grantMode ?? "FIXED",
    redPacketClaimOrderMode: initialValues.redPacketConfig?.claimOrderMode ?? "FIRST_COME_FIRST_SERVED",
    redPacketTriggerType: initialValues.redPacketConfig?.triggerType ?? "REPLY",
    redPacketUnitPoints: String(initialValues.redPacketConfig?.unitPoints ?? initialValues.redPacketConfig?.totalPoints ?? 10),
    redPacketTotalPoints: String(initialValues.redPacketConfig?.totalPoints ?? 10),
    redPacketPacketCount: String(initialValues.redPacketConfig?.packetCount ?? 1),
  } satisfies LocalPostDraft
}

export function normalizeDraftData(draft: LocalPostDraft, pointName: string, fallbackBoardSlug = ""): LocalPostDraft {
  const emptyDraft = createEmptyLocalPostDraft(fallbackBoardSlug)

  return {
    ...emptyDraft,
    ...draft,
    boardSlug: draft.boardSlug || fallbackBoardSlug,
    postType: normalizePostType(draft.postType, DEFAULT_POST_TYPE),
    pollOptions: Array.isArray(draft.pollOptions) && draft.pollOptions.length > 0 ? draft.pollOptions : emptyDraft.pollOptions,
    manualTags: normalizeManualTags(draft.manualTags),
    lotteryPrizes: normalizeLotteryPrizes(draft.lotteryPrizes),
    lotteryConditions: normalizeLotteryConditions(draft.lotteryConditions, pointName),
  }
}

export function buildSubmitRequest({
  mode,
  postId,
  draft,
}: {
  mode: "create" | "edit"
  postId?: string
  draft: LocalPostDraft
}) {
  const normalizedPollOptions = draft.pollOptions.map((item) => item.trim()).filter(Boolean)
  const normalizedRedPacketUnitPoints = parsePositiveSafeInteger(draft.redPacketUnitPoints)
  const normalizedRedPacketPacketCount = parsePositiveSafeInteger(draft.redPacketPacketCount)
  const fixedRedPacketTotalPoints = multiplyPositiveSafeIntegers(normalizedRedPacketUnitPoints, normalizedRedPacketPacketCount)
  const normalizedLotteryPrizes = draft.lotteryPrizes
    .map((item) => ({ title: item.title.trim(), quantity: Number(item.quantity), description: item.description.trim() }))
    .filter((item) => item.title || item.description || item.quantity > 0)
  const normalizedLotteryConditions = draft.lotteryConditions
    .map((item) => ({
      type: item.type,
      value: item.value.trim(),
      operator: item.operator,
      description: item.description.trim(),
      groupKey: item.groupKey.trim() || "default",
    }))
    .filter((item) => item.type && item.value)
  const lotteryConfig = draft.postType === "LOTTERY"
    ? {
        startsAt: draft.lotteryStartsAt || undefined,
        endsAt: draft.lotteryEndsAt || undefined,
        participantGoal: draft.lotteryParticipantGoal.trim() ? Number(draft.lotteryParticipantGoal) : undefined,
        prizes: normalizedLotteryPrizes,
        conditions: normalizedLotteryConditions,
      }
    : undefined
  const redPacketConfig = draft.redPacketEnabled
    ? {
        enabled: true,
        grantMode: draft.redPacketGrantMode,
        claimOrderMode: draft.redPacketClaimOrderMode,
        triggerType: draft.redPacketTriggerType,
        totalPoints: draft.redPacketGrantMode === "RANDOM" ? parsePositiveSafeInteger(draft.redPacketTotalPoints) ?? 0 : fixedRedPacketTotalPoints ?? 0,
        unitPoints: normalizedRedPacketUnitPoints ?? 0,
        packetCount: normalizedRedPacketPacketCount ?? 0,
      }
    : undefined

  const commonPayload = {
    title: draft.title,
    content: draft.content,
    coverPath: draft.coverPath.trim() || undefined,
    commentsVisibleToAuthorOnly: draft.commentsVisibleToAuthorOnly,
    replyUnlockContent: draft.replyUnlockContent,
    replyThreshold: draft.replyUnlockContent.trim() ? 1 : undefined,
    purchaseUnlockContent: draft.purchaseUnlockContent,
    purchasePrice: draft.purchaseUnlockContent.trim() ? Number(draft.purchasePrice) : undefined,
    minViewLevel: Number(draft.minViewLevel),
    minViewVipLevel: Number(draft.minViewVipLevel),
    boardSlug: draft.boardSlug,
    postType: draft.postType,
    bountyPoints: draft.postType === "BOUNTY" ? Number(draft.bountyPoints) : undefined,
    pollOptions: draft.postType === "POLL" ? normalizedPollOptions : undefined,
    lotteryConfig,
    manualTags: draft.manualTags,
  }

  if (mode === "edit") {
    return {
      endpoint: "/api/posts/update",
      payload: {
        ...commonPayload,
        postId,
      },
    }
  }

  return {
    endpoint: "/api/posts/create",
    payload: {
      ...commonPayload,
      pollExpiresAt: draft.pollExpiresAt,
      redPacketConfig,
    },
  }
}

export function getAvailablePostTypes(allowedPostTypes: LocalPostType[], pointName: string) {
  return POST_TYPE_OPTIONS.map((item) => ({
    ...item,
    hint: item.value === "BOUNTY" ? `设置${pointName}悬赏` : item.hint,
  })).filter((item) => allowedPostTypes.includes(item.value))
}

export function resolveAllowedPostTypes(board?: CreatePostFormBoardItem) {
  return (board?.allowedPostTypes ?? DEFAULT_ALLOWED_POST_TYPES) as LocalPostType[]
}
