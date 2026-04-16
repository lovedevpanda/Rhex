import { redirect } from "next/navigation"

import { executeAddonAsyncWaterfallHook } from "@/addons-host/runtime/hooks"
import type { AddonRenderResult } from "@/addons-host/types"
import { getUserAccountBindingView } from "@/lib/account-binding"
import { getCurrentUser } from "@/lib/auth"
import { getBoardApplicationPageData } from "@/lib/board-applications"
import { describeBadgeRule, getBadgeCenterData } from "@/lib/badges"
import { getUserPointLogs } from "@/lib/points"
import { readSearchParam } from "@/lib/search-params"
import { getSiteSettings } from "@/lib/site-settings"
import { getCurrentUserLevelProgressView } from "@/lib/user-level-view"
import { getUserFavoriteCollectionManageData } from "@/lib/favorite-collections"
import { getUserBlocks, getUserBoardFollows, getUserFavoritePosts, getUserFollowers, getUserLikedPosts, getUserPostFollows, getUserPosts, getUserReplies, getUserTagFollows, getUserUserFollows } from "@/lib/user-panel"
import { getUserAccountSettings, getUserProfile } from "@/lib/users"
import { getCurrentUserVerificationData } from "@/lib/verifications"
import { describeVipTierBilling, resolveVipTierPrice } from "@/lib/vip-tier-pricing"
import { getVipLevel, isVipActive } from "@/lib/vip-status"
import { getZones } from "@/lib/zones"
import type { SessionActor } from "@/lib/auth"

export type SettingsTabKey = "profile" | "invite" | "post-management" | "board-applications" | "level" | "badges" | "verifications" | "points" | "follows"
export type ProfileTabKey = "basic" | "privacy" | "notifications" | "accounts" | "browsing"
export type BuiltInPostManagementTabKey = "posts" | "replies" | "favorites" | "collections" | "likes"
export type PostManagementTabKey = string
export type FollowTabKey = "boards" | "users" | "followers" | "tags" | "posts" | "history" | "blocks"

export interface SettingsPostManagementTabOption {
  key: string
  label: string
}

export interface AddonSettingsPostManagementTab {
  key: string
  label: string
  addonId: string | null
  order: number
  panel: AddonRenderResult
}

const DEFAULT_POST_MANAGEMENT_TAB_KEY = "posts"
const BUILT_IN_POST_MANAGEMENT_TAB_KEYS = new Set<string>([
  "posts",
  "replies",
  "favorites",
  "collections",
  "likes",
])

export const settingsTabs: SettingsTabKey[] = ["profile", "invite", "post-management", "board-applications", "level", "badges", "verifications", "points", "follows"]
export const profileTabs: Array<{ key: ProfileTabKey; label: string }> = [
  { key: "basic", label: "资料设置" },
  { key: "privacy", label: "隐私设置" },
  { key: "notifications", label: "通知设置" },
  { key: "accounts", label: "账号绑定" },
  { key: "browsing", label: "浏览设置" },
]
export const postManagementTabs: Array<{ key: BuiltInPostManagementTabKey; label: string }> = [
  { key: "posts", label: "我的帖子" },
  { key: "replies", label: "我的回复" },
  { key: "favorites", label: "我的收藏" },
  { key: "collections", label: "我的合集" },
  { key: "likes", label: "我的点赞" },
]
export const followTabs: Array<{ key: FollowTabKey; label: string }> = [
  { key: "boards", label: "节点" },
  { key: "users", label: "用户" },
  { key: "followers", label: "粉丝" },
  { key: "tags", label: "标签" },
  { key: "posts", label: "帖子" },
  { key: "history", label: "足迹" },
  { key: "blocks", label: "拉黑" },
]

export const settingsTabTitles: Record<SettingsTabKey, string> = {
  profile: "个人设置",
  invite: "邀请中心",
  "post-management": "帖子管理",
  "board-applications": "节点申请",
  level: "等级中心",
  badges: "勋章中心",
  verifications: "认证中心",
  points: "积分记录",
  follows: "关注管理",
}

type SettingsMobileView = "detail"

interface RawSettingsSearchParams {
  tab?: string | string[]
  profileTab?: string | string[]
  postTab?: string | string[]
  followTab?: string | string[]
  mobile?: string | string[]
  collectionPage?: string | string[]
  listAfter?: string | string[]
  listBefore?: string | string[]
  pointsAfter?: string | string[]
  pointsBefore?: string | string[]
  pointsChangeType?: string | string[]
  pointsEventType?: string | string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeAddonRenderResult(value: unknown): AddonRenderResult | null {
  if (!isRecord(value)) {
    return null
  }

  const result: AddonRenderResult = {}
  const html = normalizeOptionalString(value.html)
  const text = normalizeOptionalString(value.text)
  const clientModule = normalizeOptionalString(value.clientModule)
  const containerClassName = normalizeOptionalString(value.containerClassName)

  if (html) {
    result.html = html
  }

  if (text) {
    result.text = text
  }

  if (clientModule) {
    result.clientModule = clientModule
  }

  if (isRecord(value.clientProps)) {
    result.clientProps = value.clientProps
  }

  if (value.containerTag === "div" || value.containerTag === "section" || value.containerTag === "aside") {
    result.containerTag = value.containerTag
  }

  if (containerClassName) {
    result.containerClassName = containerClassName
  }

  return result.html || result.text || result.clientModule ? result : null
}

function normalizeAddonPostManagementTabs(value: unknown): AddonSettingsPostManagementTab[] {
  if (!Array.isArray(value)) {
    return []
  }

  const normalized: AddonSettingsPostManagementTab[] = []
  const seenKeys = new Set<string>()

  for (const item of value) {
    if (!isRecord(item)) {
      continue
    }

    const key = normalizeOptionalString(item.key)
    const label = normalizeOptionalString(item.label)
    const addonId = normalizeOptionalString(item.addonId) || null
    const panel = normalizeAddonRenderResult(item.panel)
    const orderValue = Number(item.order)
    const order = Number.isFinite(orderValue) ? Math.floor(orderValue) : 100

    if (!key || !label || !panel || BUILT_IN_POST_MANAGEMENT_TAB_KEYS.has(key) || seenKeys.has(key)) {
      continue
    }

    seenKeys.add(key)
    normalized.push({
      key,
      label,
      addonId,
      order,
      panel,
    })
  }

  return normalized.sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order
    }

    return `${left.addonId ?? ""}:${left.key}`.localeCompare(`${right.addonId ?? ""}:${right.key}`, "zh-CN")
  })
}

async function listAddonPostManagementTabs() {
  const hooked = await executeAddonAsyncWaterfallHook("settings.post-management.tabs", [])
  return normalizeAddonPostManagementTabs(hooked.value)
}

export interface ResolvedSettingsRoute {
  currentTab: SettingsTabKey
  currentProfileTab: ProfileTabKey
  currentPostTab: PostManagementTabKey
  currentFollowTab: FollowTabKey
  mobileView: SettingsMobileView | null
  collectionPage: number
  listAfter: string | null
  listBefore: string | null
  pointsAfter: string | null
  pointsBefore: string | null
  pointsChangeType: string | null
  pointsEventType: string | null
}

export interface SettingsPageData {
  route: ResolvedSettingsRoute
  settings: Awaited<ReturnType<typeof getSiteSettings>>
  currentUser: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
  profile: NonNullable<Awaited<ReturnType<typeof getUserProfile>>>
  dbUser: Awaited<ReturnType<typeof getUserAccountSettings>>
  invitePath: string
  inviteCodePrice: number
  inviteCodePriceDescription: string
  nicknameChangePointCost: number
  nicknameChangePriceDescription: string
  introductionChangePointCost: number
  introductionChangePriceDescription: string
  avatarChangePointCost: number
  avatarChangePriceDescription: string
  userPosts: Awaited<ReturnType<typeof getUserPosts>> | null
  replies: Awaited<ReturnType<typeof getUserReplies>> | null
  favoritePosts: Awaited<ReturnType<typeof getUserFavoritePosts>> | null
  favoriteCollections: Awaited<ReturnType<typeof getUserFavoriteCollectionManageData>> | null
  likedPosts: Awaited<ReturnType<typeof getUserLikedPosts>> | null
  postManagementTabs: SettingsPostManagementTabOption[]
  activePostManagementAddonTab: AddonSettingsPostManagementTab | null
  followedBoards: Awaited<ReturnType<typeof getUserBoardFollows>> | null
  followedUsers: Awaited<ReturnType<typeof getUserUserFollows>> | null
  followers: Awaited<ReturnType<typeof getUserFollowers>> | null
  followedTags: Awaited<ReturnType<typeof getUserTagFollows>> | null
  followedPosts: Awaited<ReturnType<typeof getUserPostFollows>> | null
  blockedUsers: Awaited<ReturnType<typeof getUserBlocks>> | null
  levelView: Awaited<ReturnType<typeof getCurrentUserLevelProgressView>>
  badges: Awaited<ReturnType<typeof getBadgeCenterData>>
  badgeDisplayItems: Array<{
    id: string
    name: string
    code: string
    description: string | null | undefined
    iconPath: string | null | undefined
    iconText: string | null | undefined
    color: string
    imageUrl: string | null | undefined
    category: string | null | undefined
    pointsCost: number
    grantedUserCount: number | undefined
    rules: Array<{
      id: string
      ruleType: string
      operator: string
      value: string
      extraValue: null
      sortOrder: number
    }>
    eligibility: Awaited<ReturnType<typeof getBadgeCenterData>>[number]["eligibility"]
    display: Awaited<ReturnType<typeof getBadgeCenterData>>[number]["display"]
  }>
  boardApplicationData: Awaited<ReturnType<typeof getBoardApplicationPageData>>
  boardApplicationZones: Awaited<ReturnType<typeof getZones>>
  verificationData: Awaited<ReturnType<typeof getCurrentUserVerificationData>>
  pointLogs: Awaited<ReturnType<typeof getUserPointLogs>> | null
  accountBindings: Awaited<ReturnType<typeof getUserAccountBindingView>> | null
}

function resolveTabKey<T extends string>(value: string | undefined, candidates: readonly T[], fallback: T) {
  return candidates.includes((value ?? fallback) as T) ? ((value ?? fallback) as T) : fallback
}

export function resolveSettingsRoute(
  searchParams?: RawSettingsSearchParams,
  options?: {
    postManagementTabs?: SettingsPostManagementTabOption[]
  },
): ResolvedSettingsRoute {
  const currentTab = resolveTabKey(readSearchParam(searchParams?.tab), settingsTabs, "profile")
  const currentProfileTab = resolveTabKey(readSearchParam(searchParams?.profileTab), profileTabs.map((tab) => tab.key), "basic")
  const resolvedPostManagementTabs = options?.postManagementTabs?.length
    ? options.postManagementTabs
    : postManagementTabs
  const currentPostTab = resolveTabKey(
    readSearchParam(searchParams?.postTab),
    resolvedPostManagementTabs.map((tab) => tab.key),
    resolvedPostManagementTabs[0]?.key ?? DEFAULT_POST_MANAGEMENT_TAB_KEY,
  )
  const currentFollowTab = resolveTabKey(readSearchParam(searchParams?.followTab), followTabs.map((tab) => tab.key), "boards")
  const mobileView = readSearchParam(searchParams?.mobile) === "detail" ? "detail" : null
  const collectionPageValue = Number(readSearchParam(searchParams?.collectionPage) ?? "1")
  const listAfter = readSearchParam(searchParams?.listAfter) ?? null
  const listBefore = readSearchParam(searchParams?.listBefore) ?? null
  const pointsAfter = readSearchParam(searchParams?.pointsAfter) ?? null
  const pointsBefore = readSearchParam(searchParams?.pointsBefore) ?? null
  const pointsChangeType = readSearchParam(searchParams?.pointsChangeType) ?? null
  const pointsEventType = readSearchParam(searchParams?.pointsEventType) ?? null

  return {
    currentTab,
    currentProfileTab,
    currentPostTab,
    currentFollowTab,
    mobileView,
    collectionPage: Number.isFinite(collectionPageValue) && collectionPageValue > 0 ? Math.floor(collectionPageValue) : 1,
    listAfter,
    listBefore,
    pointsAfter,
    pointsBefore,
    pointsChangeType,
    pointsEventType,
  }
}

export function buildSettingsHref(
  route: Pick<ResolvedSettingsRoute, "mobileView">,
  searchParams: Record<string, string | null | undefined>,
) {
  const nextSearchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string" && value.length > 0) {
      nextSearchParams.set(key, value)
    }
  }

  if (route.mobileView === "detail") {
    nextSearchParams.set("mobile", "detail")
  }

  const queryString = nextSearchParams.toString()
  return queryString ? `/settings?${queryString}` : "/settings"
}

async function loadSettingsTabData(
  currentUser: SessionActor,
  route: ResolvedSettingsRoute,
  settings: Awaited<ReturnType<typeof getSiteSettings>>,
) {
  const userId = currentUser.id
  const { currentFollowTab, currentPostTab, currentTab, listAfter, listBefore } = route

  const [
    userPosts,
    replies,
    favoritePosts,
    favoriteCollections,
    likedPosts,
    followedBoards,
    followedUsers,
    followers,
    followedTags,
    followedPosts,
    blockedUsers,
    levelView,
    badges,
    boardApplicationData,
    boardApplicationZones,
    verificationData,
    pointLogs,
    accountBindings,
  ] = await Promise.all([
    currentTab === "post-management" && currentPostTab === "posts"
      ? getUserPosts(userId, { pageSize: 10, after: listAfter, before: listBefore })
      : Promise.resolve<Awaited<ReturnType<typeof getUserPosts>> | null>(null),
    currentTab === "post-management" && currentPostTab === "replies"
      ? getUserReplies(userId, { pageSize: 10, after: listAfter, before: listBefore })
      : Promise.resolve<Awaited<ReturnType<typeof getUserReplies>> | null>(null),
    currentTab === "post-management" && currentPostTab === "favorites"
      ? getUserFavoritePosts(userId, { pageSize: 10, after: listAfter, before: listBefore })
      : Promise.resolve<Awaited<ReturnType<typeof getUserFavoritePosts>> | null>(null),
    currentTab === "post-management" && currentPostTab === "collections"
      ? getUserFavoriteCollectionManageData(userId, { page: route.collectionPage })
      : Promise.resolve<Awaited<ReturnType<typeof getUserFavoriteCollectionManageData>> | null>(null),
    currentTab === "post-management" && currentPostTab === "likes"
      ? getUserLikedPosts(userId, { pageSize: 10, after: listAfter, before: listBefore })
      : Promise.resolve<Awaited<ReturnType<typeof getUserLikedPosts>> | null>(null),
    currentTab === "follows" && currentFollowTab === "boards"
      ? getUserBoardFollows(userId, { pageSize: 12, after: listAfter, before: listBefore })
      : Promise.resolve<Awaited<ReturnType<typeof getUserBoardFollows>> | null>(null),
    currentTab === "follows" && currentFollowTab === "users"
      ? getUserUserFollows(userId, { pageSize: 12, after: listAfter, before: listBefore })
      : Promise.resolve<Awaited<ReturnType<typeof getUserUserFollows>> | null>(null),
    currentTab === "follows" && currentFollowTab === "followers"
      ? getUserFollowers(userId, { pageSize: 12, after: listAfter, before: listBefore })
      : Promise.resolve<Awaited<ReturnType<typeof getUserFollowers>> | null>(null),
    currentTab === "follows" && currentFollowTab === "tags"
      ? getUserTagFollows(userId, { pageSize: 18, after: listAfter, before: listBefore })
      : Promise.resolve<Awaited<ReturnType<typeof getUserTagFollows>> | null>(null),
    currentTab === "follows" && currentFollowTab === "posts"
      ? getUserPostFollows(userId, { pageSize: 10, after: listAfter, before: listBefore })
      : Promise.resolve<Awaited<ReturnType<typeof getUserPostFollows>> | null>(null),
    currentTab === "follows" && currentFollowTab === "blocks"
      ? getUserBlocks(userId, { pageSize: 12, after: listAfter, before: listBefore })
      : Promise.resolve<Awaited<ReturnType<typeof getUserBlocks>> | null>(null),
    currentTab === "level" ? getCurrentUserLevelProgressView() : Promise.resolve(null),
    currentTab === "badges" ? getBadgeCenterData(userId) : Promise.resolve([]),
    currentTab === "board-applications" ? getBoardApplicationPageData(userId, currentUser) : Promise.resolve({ pendingCount: 0, items: [] }),
    currentTab === "board-applications" ? getZones() : Promise.resolve([]),
    currentTab === "verifications" ? getCurrentUserVerificationData() : Promise.resolve({ currentUserId: userId, types: [], approvedVerification: null }),
    currentTab === "points"
      ? getUserPointLogs(userId, {
          pageSize: 10,
          after: route.pointsAfter,
          before: route.pointsBefore,
          changeType: route.pointsChangeType,
          eventType: route.pointsEventType,
        })
      : Promise.resolve(null),
    currentTab === "profile" && route.currentProfileTab === "accounts"
      ? getUserAccountBindingView(userId, {
          authGithubEnabled: settings.authGithubEnabled,
          authGoogleEnabled: settings.authGoogleEnabled,
          authPasskeyEnabled: settings.authPasskeyEnabled,
        })
      : Promise.resolve(null),
  ])

  return {
    userPosts,
    replies,
    favoritePosts,
    favoriteCollections,
    likedPosts,
    followedBoards,
    followedUsers,
    followers,
    followedTags,
    followedPosts,
    blockedUsers,
    levelView,
    badges,
    boardApplicationData,
    boardApplicationZones,
    verificationData,
    pointLogs,
    accountBindings,
  }
}

function resolveVipPricing(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  settings: Awaited<ReturnType<typeof getSiteSettings>>,
) {
  const vipActive = isVipActive(user)
  const vipLevel = vipActive ? getVipLevel(user) : 0

  const inviteCodePrice = vipActive
    ? vipLevel >= 3
      ? settings.inviteCodeVip3Price
      : vipLevel === 2
        ? settings.inviteCodeVip2Price
        : settings.inviteCodeVip1Price
    : settings.inviteCodePrice

  const inviteCodePriceDescription = vipActive
    ? vipLevel >= 3
      ? "你当前按 VIP3 价购买邀请码"
      : vipLevel === 2
        ? "你当前按 VIP2 价购买邀请码"
        : "你当前按 VIP1 价购买邀请码"
    : "你当前按普通用户价格购买邀请码"

  const nicknameChangePointCost = resolveVipTierPrice(user, {
    normal: settings.nicknameChangePointCost,
    vip1: settings.nicknameChangeVip1PointCost,
    vip2: settings.nicknameChangeVip2PointCost,
    vip3: settings.nicknameChangeVip3PointCost,
  })
  const introductionChangePointCost = resolveVipTierPrice(user, {
    normal: settings.introductionChangePointCost,
    vip1: settings.introductionChangeVip1PointCost,
    vip2: settings.introductionChangeVip2PointCost,
    vip3: settings.introductionChangeVip3PointCost,
  })
  const avatarChangePointCost = resolveVipTierPrice(user, {
    normal: settings.avatarChangePointCost,
    vip1: settings.avatarChangeVip1PointCost,
    vip2: settings.avatarChangeVip2PointCost,
    vip3: settings.avatarChangeVip3PointCost,
  })
  const billingDescription = describeVipTierBilling(user)

  return {
    inviteCodePrice,
    inviteCodePriceDescription,
    nicknameChangePointCost,
    nicknameChangePriceDescription: billingDescription,
    introductionChangePointCost,
    introductionChangePriceDescription: billingDescription,
    avatarChangePointCost,
    avatarChangePriceDescription: billingDescription,
  }
}

export async function loadSettingsPageData(searchParams?: RawSettingsSearchParams): Promise<SettingsPageData> {
  const initialRoute = resolveSettingsRoute(searchParams)
  const [currentUser, settings, addonPostManagementTabs] = await Promise.all([
    getCurrentUser(),
    getSiteSettings(),
    initialRoute.currentTab === "post-management"
      ? listAddonPostManagementTabs()
      : Promise.resolve([]),
  ])
  const resolvedPostManagementTabs: SettingsPostManagementTabOption[] = [
    ...postManagementTabs,
    ...addonPostManagementTabs.map((tab) => ({
      key: tab.key,
      label: tab.label,
    })),
  ]
  const route = resolveSettingsRoute(searchParams, {
    postManagementTabs: resolvedPostManagementTabs,
  })

  if (!currentUser) {
    redirect("/login?redirect=/settings")
  }

  if (!settings.boardApplicationEnabled && route.currentTab === "board-applications") {
    redirect("/settings?tab=profile")
  }

  const [profile, dbUser, tabData] = await Promise.all([
    getUserProfile(currentUser.username),
    getUserAccountSettings(currentUser.id),
    loadSettingsTabData(currentUser, route, settings),
  ])

  if (!profile) {
    redirect("/")
  }

  const activePostManagementAddonTab = route.currentTab === "post-management"
    ? addonPostManagementTabs.find((tab) => tab.key === route.currentPostTab) ?? null
    : null
  const invitePath = `/register?invite=${encodeURIComponent(profile.username)}`
  const pricing = resolveVipPricing(currentUser, settings)
  const badgeDisplayItems = tabData.badges.map((badge) => ({
    id: badge.id,
    name: badge.name,
    code: badge.code,
    description: badge.description ?? null,
    iconPath: badge.iconPath ?? null,
    iconText: badge.iconText ?? null,
    color: badge.color || "#64748b",
    imageUrl: badge.imageUrl ?? null,
    category: badge.category ?? null,
    pointsCost: badge.pointsCost,
    grantedUserCount: badge.grantedUserCount,
    rules: badge.rules.map((rule) => ({
      id: rule.id,
      ruleType: describeBadgeRule(rule),
      operator: rule.operator,
      value: describeBadgeRule(rule),
      extraValue: null,
      sortOrder: rule.sortOrder,
    })),
    eligibility: badge.eligibility,
    display: badge.display,
  }))

  return {
    route,
    settings,
    currentUser,
    profile,
    dbUser,
    invitePath,
    inviteCodePrice: pricing.inviteCodePrice,
    inviteCodePriceDescription: pricing.inviteCodePriceDescription,
    nicknameChangePointCost: pricing.nicknameChangePointCost,
    nicknameChangePriceDescription: pricing.nicknameChangePriceDescription,
    introductionChangePointCost: pricing.introductionChangePointCost,
    introductionChangePriceDescription: pricing.introductionChangePriceDescription,
    avatarChangePointCost: pricing.avatarChangePointCost,
    avatarChangePriceDescription: pricing.avatarChangePriceDescription,
    postManagementTabs: resolvedPostManagementTabs,
    activePostManagementAddonTab,
    badgeDisplayItems,
    ...tabData,
  }
}
