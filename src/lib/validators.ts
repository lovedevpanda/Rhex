import { normalizePostAuctionMode, normalizePostAuctionPricingRule, type LocalPostAuctionMode, type LocalPostAuctionPricingRule } from "@/lib/post-auction-types"
import { normalizePostType, type LocalPostType } from "@/lib/post-types"
import { normalizeEmailAddress } from "@/lib/email"
import { nicknameContainsWhitespace, normalizeNickname } from "@/lib/nickname"
import { parseNonNegativeSafeInteger, parsePositiveSafeInteger } from "@/lib/shared/safe-integer"


export interface ValidationResult<T> {
  success: boolean
  data?: T
  message?: string
}

interface PostPayloadValidationOptions {
  titleMinLength?: number
  titleMaxLength?: number
  contentMinLength?: number
  contentMaxLength?: number
}

interface CommentPayloadValidationOptions {
  contentMinLength?: number
  contentMaxLength?: number
}

interface NicknameValidationOptions {
  nicknameMinLength?: number
  nicknameMaxLength?: number
}

function getField(body: unknown, key: string): unknown {
  if (body !== null && typeof body === "object" && !Array.isArray(body)) {
    return (body as Record<string, unknown>)[key]
  }
  return undefined
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function isValidUsername(value: string) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(value)
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function isValidPhone(value: string) {
  return /^1\d{10}$/.test(value)
}

function validateNotificationWebhookUrl(notificationWebhookUrl: string) {
  if (notificationWebhookUrl.length > 1000) {
    return "Webhook URL 长度不能超过 1000 个字符"
  }

  if (notificationWebhookUrl && !isValidHttpUrl(notificationWebhookUrl)) {
    return "Webhook URL 仅支持 http 或 https 地址"
  }

  return null
}

function resolveNicknameLengthRange(options: NicknameValidationOptions = {}) {
  const nicknameMinLength = Math.min(50, Math.max(1, options.nicknameMinLength ?? 1))

  return {
    nicknameMinLength,
    nicknameMaxLength: Math.min(50, Math.max(nicknameMinLength, options.nicknameMaxLength ?? 20)),
  }
}

export function validateAuthPayload(body: unknown, options: NicknameValidationOptions = {}): ValidationResult<{
  username: string
  password: string
  nickname: string
  inviterUsername: string
  inviteCode: string
  email: string
  emailCode: string
  phone: string
  phoneCode: string
  gender: string
}> {
  const username = normalizeString(getField(body, "username"))
  const password = normalizeString(getField(body, "password"))
  const rawNickname = getField(body, "nickname")
  const nickname = normalizeNickname(rawNickname)
  const inviterUsername = normalizeString(getField(body, "inviterUsername"))
  const inviteCode = normalizeString(getField(body, "inviteCode")).toUpperCase()
  const email = normalizeEmailAddress(normalizeString(getField(body, "email")))
  const emailCode = normalizeString(getField(body, "emailCode"))
  const phone = normalizeString(getField(body, "phone"))
  const phoneCode = normalizeString(getField(body, "phoneCode"))
  const gender = normalizeString(getField(body, "gender"))

  if (!username || !password) {
    return { success: false, message: "缺少用户名或密码" }
  }

  if (!isValidUsername(username)) {
    return { success: false, message: "用户名需为 3-20 位字母、数字或下划线" }
  }

  if (inviterUsername && !isValidUsername(inviterUsername)) {
    return { success: false, message: "邀请人用户名需为 3-20 位字母、数字或下划线" }
  }

  if (password.length < 6 || password.length > 64) {
    return { success: false, message: "密码长度需为 6-64 位" }
  }

  const { nicknameMinLength, nicknameMaxLength } = resolveNicknameLengthRange(options)

  if (nicknameContainsWhitespace(rawNickname)) {
    return { success: false, message: "昵称不能包含空格" }
  }

  if (nickname && nickname.length < nicknameMinLength) {
    return { success: false, message: `昵称长度不能少于 ${nicknameMinLength} 个字符` }
  }

  if (nickname.length > nicknameMaxLength) {
    return { success: false, message: `昵称长度不能超过 ${nicknameMaxLength} 个字符` }
  }

  if (email && !isValidEmail(email)) {
    return { success: false, message: "邮箱格式不正确" }
  }

  if (phone && !isValidPhone(phone)) {
    return { success: false, message: "手机号格式不正确" }
  }

  if (gender && !["male", "female", "unknown"].includes(gender)) {
    return { success: false, message: "性别参数不正确" }
  }

  if (inviteCode && (inviteCode.length < 6 || inviteCode.length > 32)) {
    return { success: false, message: "邀请码格式不正确" }
  }

  if (emailCode && !/^\d{6}$/.test(emailCode)) {
    return { success: false, message: "邮箱验证码格式不正确" }
  }

  if (phoneCode && !/^\d{6}$/.test(phoneCode)) {
    return { success: false, message: "手机验证码格式不正确" }
  }

  return {
    success: true,
    data: {
      username,
      password,
      nickname,
      inviterUsername,
      inviteCode,
      email,
      emailCode,
      phone,
      phoneCode,
      gender,
    },
  }
}

export function validateLoginPayload(body: unknown): ValidationResult<{
  login: string
  password: string
}> {
  const rawLogin = normalizeString(getField(body, "login")) || normalizeString(getField(body, "username"))
  const password = normalizeString(getField(body, "password"))
  const normalizedEmail = normalizeEmailAddress(rawLogin)
  const login = isValidEmail(normalizedEmail) ? normalizedEmail : rawLogin

  if (!login || !password) {
    return { success: false, message: "缺少邮箱/用户名或密码" }
  }

  if (password.length < 6 || password.length > 64) {
    return { success: false, message: "密码长度需为 6-64 位" }
  }

  return {
    success: true,
    data: {
      login,
      password,
    },
  }
}

export function validatePostPayload(body: unknown, options: PostPayloadValidationOptions = {}): ValidationResult<{
  title: string
  content: string
  isAnonymous: boolean
  coverPath: string | null
  boardSlug: string
  postType: LocalPostType
  bountyPoints: number | null
  auctionConfig: {
    mode: LocalPostAuctionMode
    pricingRule: LocalPostAuctionPricingRule
    startPrice: number
    incrementStep: number
    startsAt: string | null
    endsAt: string
    winnerOnlyContent: string
    winnerOnlyContentPreview: string | null
  } | null
  pollOptions: string[]
  commentsVisibleToAuthorOnly: boolean
  loginUnlockContent: string
  replyUnlockContent: string
  replyThreshold: number | null
  purchaseUnlockContent: string
  purchasePrice: number | null
  minViewLevel: number
  minViewVipLevel: number
  lotteryConfig: Record<string, unknown> | null
}> {

  const title = normalizeString(getField(body, "title"))
  const content = normalizeString(getField(body, "content"))
  const isAnonymous = Boolean(getField(body, "isAnonymous"))
  const coverPath = normalizeString(getField(body, "coverPath"))
  const boardSlug = normalizeString(getField(body, "boardSlug"))
  const postType = normalizePostType(getField(body, "postType"))

  const rawBountyPoints = parsePositiveSafeInteger(getField(body, "bountyPoints") ?? 0) ?? 0
  const rawAuctionConfig = getField(body, "auctionConfig")
  const auctionConfig = rawAuctionConfig && typeof rawAuctionConfig === "object" && !Array.isArray(rawAuctionConfig)
    ? (rawAuctionConfig as Record<string, unknown>)
    : null
  const commentsVisibleToAuthorOnly = Boolean(getField(body, "commentsVisibleToAuthorOnly"))
  const loginUnlockContent = normalizeString(getField(body, "loginUnlockContent"))
  const replyUnlockContent = normalizeString(getField(body, "replyUnlockContent"))
  const rawReplyThreshold = parsePositiveSafeInteger(getField(body, "replyThreshold") ?? 1) ?? 1
  const purchaseUnlockContent = normalizeString(getField(body, "purchaseUnlockContent"))
  const rawPurchasePrice = parsePositiveSafeInteger(getField(body, "purchasePrice") ?? 0) ?? 0
  const rawMinViewLevel = parseNonNegativeSafeInteger(getField(body, "minViewLevel") ?? 0) ?? 0
  const rawMinViewVipLevel = parseNonNegativeSafeInteger(getField(body, "minViewVipLevel") ?? 0) ?? 0

  const pollOptionsRaw = getField(body, "pollOptions")
  const pollOptions = Array.isArray(pollOptionsRaw)
    ? (pollOptionsRaw as unknown[]).map((item) => normalizeString(item)).filter(Boolean)
    : []
  const rawLotteryConfig = getField(body, "lotteryConfig")
  const lotteryConfig = rawLotteryConfig && typeof rawLotteryConfig === "object" && !Array.isArray(rawLotteryConfig)
    ? (rawLotteryConfig as Record<string, unknown>)
    : null
  const auctionWinnerOnlyContent = normalizeString(auctionConfig?.winnerOnlyContent)
  const auctionWinnerOnlyContentPreview = normalizeString(auctionConfig?.winnerOnlyContentPreview)
  const auctionEndsAt = normalizeString(auctionConfig?.endsAt)
  const auctionStartsAt = normalizeString(auctionConfig?.startsAt)
  const auctionMode = normalizePostAuctionMode(auctionConfig?.mode)
  const auctionPricingRule = normalizePostAuctionPricingRule(auctionConfig?.pricingRule)
  const rawAuctionStartPrice = parsePositiveSafeInteger(auctionConfig?.startPrice ?? 0) ?? 0
  const rawAuctionIncrementStep = parsePositiveSafeInteger(auctionConfig?.incrementStep ?? 0) ?? 0




  if (!title || !content || !boardSlug) {
    return { success: false, message: "缺少必要参数" }
  }

  const titleMinLength = Math.max(1, Math.min(100, options.titleMinLength ?? 5))
  const titleMaxLength = Math.max(titleMinLength, Math.min(500, options.titleMaxLength ?? 100))
  const contentMinLength = Math.max(1, Math.min(1000, options.contentMinLength ?? 10))
  const contentMaxLength = Math.max(contentMinLength, Math.min(100000, options.contentMaxLength ?? 50000))

  if (title.length < titleMinLength || title.length > titleMaxLength) {
    return { success: false, message: `标题长度需为 ${titleMinLength}-${titleMaxLength} 个字符` }
  }

  if (content.length < contentMinLength || content.length > contentMaxLength) {
    return { success: false, message: `正文字数需为 ${contentMinLength}-${contentMaxLength} 个字符` }
  }

  if (boardSlug.length > 50) {
    return { success: false, message: "节点标识不合法" }
  }

  if (coverPath.length > 500) {
    return { success: false, message: "封面地址不能超过 500 个字符" }
  }

  if (loginUnlockContent.length > 20000 || replyUnlockContent.length > 20000 || purchaseUnlockContent.length > 20000 || auctionWinnerOnlyContent.length > 20000) {
    return { success: false, message: "隐藏内容不能超过 20000 个字符" }
  }

  if (auctionWinnerOnlyContentPreview.length > 200) {
    return { success: false, message: "赢家内容预告不能超过 200 个字符" }
  }

  if (replyUnlockContent && (!Number.isInteger(rawReplyThreshold) || rawReplyThreshold < 1 || rawReplyThreshold > 999)) {
    return { success: false, message: "回复解锁次数需为 1-999 的整数" }
  }

  if (purchaseUnlockContent && (!Number.isInteger(rawPurchasePrice) || rawPurchasePrice < 1 || rawPurchasePrice > 100000)) {
    return { success: false, message: "购买金额需为 1-100000 的整数" }
  }

  if (!Number.isInteger(rawMinViewLevel) || rawMinViewLevel < 0 || rawMinViewLevel > 999) {
    return { success: false, message: "帖子最低浏览等级需为 0-999 的整数" }
  }

  if (!Number.isInteger(rawMinViewVipLevel) || rawMinViewVipLevel < 0 || rawMinViewVipLevel > 999) {
    return { success: false, message: "帖子最低 VIP 浏览等级需为 0-999 的整数" }
  }

  if (postType === "BOUNTY") {
    if (!Number.isInteger(rawBountyPoints) || rawBountyPoints < 1) {
      return { success: false, message: "悬赏数值必须是大于 0 的整数" }
    }

    if (rawBountyPoints > 100000) {
      return { success: false, message: "悬赏数值不能超过 100000" }
    }
  }

  if (postType === "POLL") {
    if (pollOptions.length < 2 || pollOptions.length > 8) {
      return { success: false, message: "投票选项需为 2-8 项" }
    }

    if (new Set(pollOptions).size !== pollOptions.length) {
      return { success: false, message: "投票选项不能重复" }
    }

    if (pollOptions.some((item) => item.length > 50)) {
      return { success: false, message: "单个投票选项不能超过 50 个字符" }
    }
  }

  if (postType === "AUCTION") {
    if (!auctionConfig) {
      return { success: false, message: "拍卖帖缺少必要配置" }
    }

    if (!Number.isInteger(rawAuctionStartPrice) || rawAuctionStartPrice < 1 || rawAuctionStartPrice > 100000) {
      return { success: false, message: "起拍价需为 1-100000 的整数" }
    }

    if (!Number.isInteger(rawAuctionIncrementStep) || rawAuctionIncrementStep < 1 || rawAuctionIncrementStep > 100000) {
      return { success: false, message: "加价幅度需为 1-100000 的整数" }
    }

    if (!auctionEndsAt) {
      return { success: false, message: "请设置拍卖结束时间" }
    }

    if (!auctionWinnerOnlyContent) {
      return { success: false, message: "请填写赢家专属内容" }
    }
  }

  if (postType === "LOTTERY" && !lotteryConfig) {
    return { success: false, message: "抽奖帖缺少必要配置" }
  }

  return {

    success: true,
    data: {
      title,
      content,
      isAnonymous,
      coverPath: coverPath || null,
      boardSlug,
      postType,
      bountyPoints: postType === "BOUNTY" ? rawBountyPoints : null,
      auctionConfig: postType === "AUCTION"
        ? {
            mode: auctionMode,
            pricingRule: auctionPricingRule,
            startPrice: rawAuctionStartPrice,
            incrementStep: rawAuctionIncrementStep,
            startsAt: auctionStartsAt || null,
            endsAt: auctionEndsAt,
            winnerOnlyContent: auctionWinnerOnlyContent,
            winnerOnlyContentPreview: auctionWinnerOnlyContentPreview || null,
          }
        : null,
      pollOptions: postType === "POLL" ? pollOptions : [],
      commentsVisibleToAuthorOnly,
      loginUnlockContent,
      replyUnlockContent,
      replyThreshold: replyUnlockContent ? rawReplyThreshold : null,
      purchaseUnlockContent,
      purchasePrice: purchaseUnlockContent ? rawPurchasePrice : null,
      minViewLevel: rawMinViewLevel,
      minViewVipLevel: rawMinViewVipLevel,
      lotteryConfig,
    },
  }
}


export function validateCommentPayload(body: unknown, options: CommentPayloadValidationOptions = {}): ValidationResult<{ postId: string; content: string; parentId: string; replyToUserName: string; replyToCommentId: string; useAnonymousIdentity: boolean; commentView: "tree" | "flat" }> {
  const postId = normalizeString(getField(body, "postId"))
  const content = normalizeString(getField(body, "content"))
  const parentId = normalizeString(getField(body, "parentId"))
  const replyToUserName = normalizeString(getField(body, "replyToUserName"))
  const replyToCommentId = normalizeString(getField(body, "replyToCommentId"))
  const useAnonymousIdentity = Boolean(getField(body, "useAnonymousIdentity"))
  const commentView = getField(body, "commentView") === "flat" ? "flat" : "tree"

  if (!postId || !content) {
    return { success: false, message: "缺少必要参数" }
  }

  const contentMinLength = Math.max(1, Math.min(500, options.contentMinLength ?? 2))
  const contentMaxLength = Math.max(contentMinLength, Math.min(20000, options.contentMaxLength ?? 2000))

  if (content.length < contentMinLength || content.length > contentMaxLength) {
    return { success: false, message: `评论长度需为 ${contentMinLength}-${contentMaxLength} 个字符` }
  }

  return {
    success: true,
    data: {
      postId,
      content,
      parentId,
      replyToUserName,
      replyToCommentId,
      useAnonymousIdentity,
      commentView,
    },
  }
}

export function validateNotificationSettingsPayload(body: unknown, options?: {
  requireUrlWhenEnabled?: boolean
  requireUrl?: boolean
}): ValidationResult<{
  externalNotificationEnabled: boolean
  notificationWebhookUrl: string
}> {
  const externalNotificationEnabled = Boolean(getField(body, "externalNotificationEnabled"))
  const notificationWebhookUrl = normalizeString(getField(body, "notificationWebhookUrl"))
  const webhookUrlError = validateNotificationWebhookUrl(notificationWebhookUrl)

  if (webhookUrlError) {
    return { success: false, message: webhookUrlError }
  }

  if ((options?.requireUrlWhenEnabled ?? true) && externalNotificationEnabled && !notificationWebhookUrl) {
    return { success: false, message: "开启站外通知前请先填写 Webhook URL" }
  }

  if ((options?.requireUrl ?? false) && !notificationWebhookUrl) {
    return { success: false, message: "请先填写 Webhook URL" }
  }

  return {
    success: true,
    data: {
      externalNotificationEnabled,
      notificationWebhookUrl,
    },
  }
}

export function validateProfilePayload(body: unknown, options: NicknameValidationOptions = {}): ValidationResult<{
  nickname: string
  bio: string
  introduction: string
  email: string
  gender: string
}> {
  const rawNickname = getField(body, "nickname")
  const nickname = normalizeNickname(rawNickname)
  const bio = normalizeString(getField(body, "bio"))
  const introduction = normalizeString(getField(body, "introduction"))
  const email = normalizeEmailAddress(normalizeString(getField(body, "email")))
  const gender = normalizeString(getField(body, "gender"))

  if (!nickname) {
    return { success: false, message: "昵称不能为空" }
  }

  const { nicknameMinLength, nicknameMaxLength } = resolveNicknameLengthRange(options)

  if (nicknameContainsWhitespace(rawNickname)) {
    return { success: false, message: "昵称不能包含空格" }
  }

  if (nickname.length < nicknameMinLength) {
    return { success: false, message: `昵称长度不能少于 ${nicknameMinLength} 个字符` }
  }

  if (nickname.length > nicknameMaxLength) {
    return { success: false, message: `昵称长度不能超过 ${nicknameMaxLength} 个字符` }
  }

  if (bio.length > 200) {
    return { success: false, message: "个人简介长度不能超过 200 个字符" }
  }

  if (introduction.length > 20000) {
    return { success: false, message: "个人介绍长度不能超过 20000 个字符" }
  }

  if (email && !isValidEmail(email)) {
    return { success: false, message: "邮箱格式不正确" }
  }

  if (gender && !["male", "female", "unknown"].includes(gender)) {
    return { success: false, message: "性别参数不正确" }
  }

  return {
    success: true,
    data: {
      nickname,
      bio,
      introduction,
      email,
      gender,
    },
  }
}
