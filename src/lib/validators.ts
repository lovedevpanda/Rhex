import { normalizePostType, type LocalPostType } from "@/lib/post-types"
import { parseNonNegativeSafeInteger, parsePositiveSafeInteger } from "@/lib/shared/safe-integer"


export interface ValidationResult<T> {
  success: boolean
  data?: T
  message?: string
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

function isValidPhone(value: string) {
  return /^1\d{10}$/.test(value)
}

export function validateAuthPayload(body: unknown): ValidationResult<{
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
  const nickname = normalizeString(getField(body, "nickname"))
  const inviterUsername = normalizeString(getField(body, "inviterUsername"))
  const inviteCode = normalizeString(getField(body, "inviteCode")).toUpperCase()
  const email = normalizeString(getField(body, "email"))
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

  if (nickname.length > 20) {
    return { success: false, message: "昵称长度不能超过 20 个字符" }
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

export function validatePostPayload(body: unknown): ValidationResult<{
  title: string
  content: string
  coverPath: string | null
  boardSlug: string
  postType: LocalPostType
  bountyPoints: number | null
  pollOptions: string[]
  commentsVisibleToAuthorOnly: boolean
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
  const coverPath = normalizeString(getField(body, "coverPath"))
  const boardSlug = normalizeString(getField(body, "boardSlug"))
  const postType = normalizePostType(getField(body, "postType"))

  const rawBountyPoints = parsePositiveSafeInteger(getField(body, "bountyPoints") ?? 0) ?? 0
  const commentsVisibleToAuthorOnly = Boolean(getField(body, "commentsVisibleToAuthorOnly"))
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




  if (!title || !content || !boardSlug) {
    return { success: false, message: "缺少必要参数" }
  }

  if (title.length < 5 || title.length > 100) {
    return { success: false, message: "标题长度需为 5-100 个字符" }
  }

  if (content.length < 10 || content.length > 50000) {
    return { success: false, message: "正文字数需为 10-50000 个字符" }
  }

  if (boardSlug.length > 50) {
    return { success: false, message: "节点标识不合法" }
  }

  if (coverPath.length > 500) {
    return { success: false, message: "封面地址不能超过 500 个字符" }
  }

  if (replyUnlockContent.length > 20000 || purchaseUnlockContent.length > 20000) {
    return { success: false, message: "隐藏内容不能超过 20000 个字符" }
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

  if (postType === "LOTTERY" && !lotteryConfig) {
    return { success: false, message: "抽奖帖缺少必要配置" }
  }

  return {

    success: true,
    data: {
      title,
      content,
      coverPath: coverPath || null,
      boardSlug,
      postType,
      bountyPoints: postType === "BOUNTY" ? rawBountyPoints : null,
      pollOptions: postType === "POLL" ? pollOptions : [],
      commentsVisibleToAuthorOnly,
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


export function validateCommentPayload(body: unknown): ValidationResult<{ postId: string; content: string; parentId: string; replyToUserName: string }> {
  const postId = normalizeString(getField(body, "postId"))
  const content = normalizeString(getField(body, "content"))
  const parentId = normalizeString(getField(body, "parentId"))
  const replyToUserName = normalizeString(getField(body, "replyToUserName"))

  if (!postId || !content) {
    return { success: false, message: "缺少必要参数" }
  }

  if (content.length < 2 || content.length > 2000) {
    return { success: false, message: "评论长度需为 2-2000 个字符" }
  }

  return {
    success: true,
    data: {
      postId,
      content,
      parentId,
      replyToUserName,
    },
  }
}

export function validateProfilePayload(body: unknown): ValidationResult<{ nickname: string; bio: string; email: string; gender: string }> {
  const nickname = normalizeString(getField(body, "nickname"))
  const bio = normalizeString(getField(body, "bio"))
  const email = normalizeString(getField(body, "email"))
  const gender = normalizeString(getField(body, "gender"))

  if (!nickname) {
    return { success: false, message: "昵称不能为空" }
  }

  if (nickname.length > 20) {
    return { success: false, message: "昵称长度不能超过 20 个字符" }
  }

  if (bio.length > 200) {
    return { success: false, message: "个人简介长度不能超过 200 个字符" }
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
      email,
      gender,
    },
  }
}
