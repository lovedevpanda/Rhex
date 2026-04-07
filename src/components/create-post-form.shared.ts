import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import type { AccessThresholdOption } from "@/lib/access-threshold-options"
import { createEmptyLocalPostDraft, type LocalPostDraft } from "@/lib/post-draft"
import { normalizeManualTags } from "@/lib/post-tags"
import { DEFAULT_ALLOWED_POST_TYPES, DEFAULT_POST_TYPE, normalizePostType, type LocalPostType } from "@/lib/post-types"
import { multiplyPositiveSafeIntegers, parsePositiveSafeInteger } from "@/lib/shared/safe-integer"

export type LotteryConditionCategory = "INTERACTION" | "THRESHOLD"
type LotteryConditionValueMode = "none" | "number" | "text" | "user-level" | "vip-level"

interface LotteryConditionTypeConfig {
  label: string
  category: LotteryConditionCategory
  helperText: string
  valueMode: LotteryConditionValueMode
  defaultValue: string
  defaultOperator: "GTE" | "EQ"
  placeholder: (pointName: string) => string
  defaultDescription: (pointName: string) => string
}

const LOTTERY_CONDITION_TYPE_CONFIG = {
  LIKE_POST: {
    label: "点赞帖子",
    category: "INTERACTION",
    helperText: "参与前需先点赞当前帖子。",
    valueMode: "none",
    defaultValue: "1",
    defaultOperator: "EQ",
    placeholder: () => "无需填写",
    defaultDescription: () => "需点赞本帖",
  },
  FAVORITE_POST: {
    label: "收藏帖子",
    category: "INTERACTION",
    helperText: "参与前需先收藏当前帖子。",
    valueMode: "none",
    defaultValue: "1",
    defaultOperator: "EQ",
    placeholder: () => "无需填写",
    defaultDescription: () => "需收藏本帖",
  },
  REPLY_CONTENT_LENGTH: {
    label: "回帖字数",
    category: "INTERACTION",
    helperText: "要求回复内容达到指定字数。",
    valueMode: "number",
    defaultValue: "10",
    defaultOperator: "GTE",
    placeholder: () => "最少回帖字数，如 10",
    defaultDescription: () => "回帖内容至少 10 字",
  },
  REPLY_KEYWORD: {
    label: "回帖关键词",
    category: "INTERACTION",
    helperText: "要求回复中包含指定关键词。",
    valueMode: "text",
    defaultValue: "恭喜发财",
    defaultOperator: "EQ",
    placeholder: () => "指定回帖内容或关键词",
    defaultDescription: () => "回帖需包含指定内容",
  },
  REGISTER_DAYS: {
    label: "注册天数",
    category: "THRESHOLD",
    helperText: "限制仅注册满一定天数的用户可参与。",
    valueMode: "number",
    defaultValue: "7",
    defaultOperator: "GTE",
    placeholder: () => "注册天数，如 30",
    defaultDescription: () => "注册时间达到指定天数",
  },
  USER_LEVEL: {
    label: "用户等级",
    category: "THRESHOLD",
    helperText: "限制最低用户等级。",
    valueMode: "user-level",
    defaultValue: "1",
    defaultOperator: "GTE",
    placeholder: () => "最低用户等级，如 3",
    defaultDescription: () => "用户等级达到要求",
  },
  VIP_LEVEL: {
    label: "VIP 等级",
    category: "THRESHOLD",
    helperText: "限制最低 VIP 等级。",
    valueMode: "vip-level",
    defaultValue: "1",
    defaultOperator: "GTE",
    placeholder: () => "最低 VIP 等级，如 1",
    defaultDescription: () => "VIP 等级达到要求",
  },
  USER_POINTS: {
    label: "用户积分",
    category: "THRESHOLD",
    helperText: "限制账户积分达到指定值。",
    valueMode: "number",
    defaultValue: "100",
    defaultOperator: "GTE",
    placeholder: (pointName: string) => `最低${pointName}，如 100`,
    defaultDescription: (pointName: string) => `${pointName}达到要求`,
  },
} as const satisfies Record<string, LotteryConditionTypeConfig>

const LOTTERY_CONDITION_TYPE_ORDER = [
  "LIKE_POST",
  "FAVORITE_POST",
  "REPLY_CONTENT_LENGTH",
  "REPLY_KEYWORD",
  "REGISTER_DAYS",
  "USER_LEVEL",
  "VIP_LEVEL",
  "USER_POINTS",
] as const

const LOTTERY_CONDITION_VALUE_MODES_WITH_INPUT = new Set<LotteryConditionValueMode>(["number", "text", "user-level", "vip-level"])
const LOTTERY_CONDITION_VALUE_MODES_WITH_OPERATOR = new Set<LotteryConditionValueMode>(["number", "user-level", "vip-level"])

export const LOTTERY_CONDITION_OPERATOR_OPTIONS = [
  { value: "GTE", label: "至少达到" },
  { value: "EQ", label: "必须等于" },
] as const

export const LOTTERY_CONDITION_CATEGORY_ORDER = ["INTERACTION", "THRESHOLD"] as const satisfies readonly LotteryConditionCategory[]
export const LOTTERY_NUMERIC_CONDITION_TYPES = new Set(
  LOTTERY_CONDITION_TYPE_ORDER.filter((type) => ["number", "user-level", "vip-level"].includes(LOTTERY_CONDITION_TYPE_CONFIG[type].valueMode)),
)
export const LOTTERY_TEXT_CONDITION_TYPES = new Set(
  LOTTERY_CONDITION_TYPE_ORDER.filter((type) => LOTTERY_CONDITION_TYPE_CONFIG[type].valueMode === "text"),
)

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
  isAnonymous?: boolean
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
    mode?: "RED_PACKET" | "JACKPOT"
    grantMode?: "FIXED" | "RANDOM"
    claimOrderMode?: "FIRST_COME_FIRST_SERVED" | "RANDOM"
    triggerType?: "REPLY" | "LIKE" | "FAVORITE"
    initialPoints?: number | null
    replyIncrementPoints?: number | null
    hitProbability?: number | null
    totalPoints?: number | null
    unitPoints?: number | null
    packetCount?: number | null
  }
}

export interface CreatePostFormProps {
  boardOptions: CreatePostFormBoardGroup[]
  pointName: string
  anonymousPostEnabled?: boolean
  anonymousPostPrice?: number
  postRedPacketEnabled?: boolean
  postRedPacketMaxPoints?: number
  postJackpotEnabled?: boolean
  postJackpotMinInitialPoints?: number
  postJackpotMaxInitialPoints?: number
  postJackpotReplyIncrementPoints?: number
  postJackpotHitProbability?: number
  markdownEmojiMap?: MarkdownEmojiItem[]
  currentUser: {
    username: string
    nickname: string | null
    level: number
    points: number
    vipLevel?: number
    vipExpiresAt?: string | null
  }
  viewLevelOptions: AccessThresholdOption[]
  viewVipLevelOptions: AccessThresholdOption[]
  mode?: "create" | "edit"
  postId?: string
  successSlug?: string
  initialValues?: CreatePostFormInitialValues
}

export type HiddenModalType = "reply" | "purchase" | "view-level" | null

export type LotteryPrizeDraft = LocalPostDraft["lotteryPrizes"][number]
export type LotteryConditionDraft = LocalPostDraft["lotteryConditions"][number]
type InitialLotteryConfig = NonNullable<CreatePostFormInitialValues["lotteryConfig"]>

export function normalizeLotteryConditionGroupKey(groupKey?: string | null) {
  return groupKey?.trim() || "default"
}

export function getLotteryConditionMeta(type: string, pointName: string) {
  const normalizedType = type.toUpperCase()
  const config = LOTTERY_CONDITION_TYPE_CONFIG[normalizedType as keyof typeof LOTTERY_CONDITION_TYPE_CONFIG]

  if (config) {
    return {
      type: normalizedType,
      ...config,
      placeholder: config.placeholder(pointName),
      defaultDescription: config.defaultDescription(pointName),
      valueRequired: LOTTERY_CONDITION_VALUE_MODES_WITH_INPUT.has(config.valueMode),
      operatorEditable: LOTTERY_CONDITION_VALUE_MODES_WITH_OPERATOR.has(config.valueMode),
    }
  }

  return {
    type: normalizedType,
    label: normalizedType,
    category: "THRESHOLD" as LotteryConditionCategory,
    helperText: "自定义条件",
    valueMode: "number" as LotteryConditionValueMode,
    defaultValue: "1",
    defaultOperator: "GTE" as const,
    placeholder: "输入条件值",
    defaultDescription: "",
    valueRequired: true,
    operatorEditable: true,
  }
}

export function getLotteryConditionCategoryLabel(category: LotteryConditionCategory) {
  return category === "INTERACTION" ? "互动任务" : "资格门槛"
}

export function getLotteryConditionTypeOptions(pointName: string) {
  return LOTTERY_CONDITION_TYPE_ORDER.map((type) => {
    const meta = getLotteryConditionMeta(type, pointName)
    return {
      value: type,
      label: meta.label,
      category: meta.category,
      helperText: meta.helperText,
    }
  })
}

export function lotteryConditionRequiresValue(type: string) {
  return getLotteryConditionMeta(type, "").valueRequired
}

export function lotteryConditionAllowsOperator(type: string) {
  return getLotteryConditionMeta(type, "").operatorEditable
}

export function getLotteryConditionPlaceholder(type: string, pointName: string) {
  return getLotteryConditionMeta(type, pointName).placeholder
}

export function buildLotteryConditionItem(type: string, pointName: string, groupKey = "default"): LotteryConditionDraft {
  const meta = getLotteryConditionMeta(type, pointName)

  return {
    type: meta.type,
    value: meta.valueRequired ? meta.defaultValue : "1",
    operator: meta.defaultOperator,
    description: meta.defaultDescription,
    groupKey: normalizeLotteryConditionGroupKey(groupKey),
  }
}

export function buildNextLotteryConditionGroupKey(conditions: LotteryConditionDraft[]) {
  const existingKeys = new Set(conditions.map((item) => normalizeLotteryConditionGroupKey(item.groupKey)))
  let nextIndex = 1

  while (existingKeys.has(`plan-${nextIndex}`)) {
    nextIndex += 1
  }

  return `plan-${nextIndex}`
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
    groupKey: normalizeLotteryConditionGroupKey(item.groupKey),
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
    isAnonymous: Boolean(initialValues.isAnonymous),
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
    redPacketMode: initialValues.redPacketConfig?.mode ?? "RED_PACKET",
    redPacketGrantMode: initialValues.redPacketConfig?.grantMode ?? "FIXED",
    redPacketClaimOrderMode: initialValues.redPacketConfig?.claimOrderMode ?? "FIRST_COME_FIRST_SERVED",
    redPacketTriggerType: initialValues.redPacketConfig?.triggerType ?? "REPLY",
    jackpotInitialPoints: String(initialValues.redPacketConfig?.initialPoints ?? 100),
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
    isAnonymous: Boolean(draft.isAnonymous),
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
      groupKey: normalizeLotteryConditionGroupKey(item.groupKey),
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
    ? draft.redPacketMode === "JACKPOT"
      ? {
          enabled: true,
          mode: "JACKPOT" as const,
          triggerType: "REPLY" as const,
          initialPoints: parsePositiveSafeInteger(draft.jackpotInitialPoints) ?? 0,
        }
      : {
          enabled: true,
          mode: "RED_PACKET" as const,
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
    isAnonymous: draft.isAnonymous,
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
