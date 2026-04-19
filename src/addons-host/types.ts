import type { PrismaClient } from "@prisma/client"
import type { SessionActor } from "@/db/session-actor-queries"
import type { SiteSettingsData } from "@/lib/site-settings.types"

export const ADDON_SLOT_KEYS = [
  "auth.login.captcha",
  "auth.login.form.after",
  "auth.register.captcha",
  "auth.register.form.after",
  "post.create.captcha",
  "layout.head.before",
  "layout.head.after",
  "layout.header.left",
  "layout.header.center",
  "layout.header.right",
  "layout.footer.before",
  "layout.footer.after",
  "layout.body.start",
  "layout.body.end",
  "layout.sidebar.left.top",
  "layout.sidebar.left.bottom",
  "layout.sidebar.right.top",
  "layout.sidebar.right.middle",
  "layout.sidebar.right.bottom",
  "home.right.top",
  "home.right.middle",
  "home.right.bottom",
  "board.right.top",
  "board.right.middle",
  "board.right.bottom",
  "post.header.before",
  "post.header.after",
  "post.author.row.before",
  "post.author.row.after",
  "post.author.meta.before",
  "post.author.meta.after",
  "post.author.verification.before",
  "post.author.verification.after",
  "post.author.name.before",
  "post.author.name.after",
  "post.author.badges.before",
  "post.author.badges.after",
  "post.body.before",
  "post.body.after",
  "post.sidebar.top",
  "post.sidebar.bottom",
  "comment.item.after",
  "settings.page.before",
  "settings.page.after",
  "settings.sidebar.top",
  "settings.sidebar.bottom",
  "settings.content.before",
  "settings.content.after",
  "settings.profile.before",
  "settings.profile.after",
  "settings.invite.before",
  "settings.invite.after",
  "settings.post-management.before",
  "settings.post-management.after",
  "settings.board-applications.before",
  "settings.board-applications.after",
  "settings.level.before",
  "settings.level.after",
  "settings.badges.before",
  "settings.badges.after",
  "settings.verifications.before",
  "settings.verifications.after",
  "settings.points.before",
  "settings.points.after",
  "settings.follows.before",
  "settings.follows.after",
  "topup.page.before",
  "topup.page.after",
  "topup.payment.before",
  "topup.payment.after",
  "topup.redeem.before",
  "topup.redeem.after",
  "vip.page.before",
  "vip.page.after",
  "vip.hero.before",
  "vip.hero.after",
  "vip.actions.before",
  "vip.actions.after",
  "vip.levels.before",
  "vip.levels.after",
  "help.page.before",
  "help.page.after",
  "help.sidebar.before",
  "help.sidebar.after",
  "help.document.before",
  "help.document.after",
  "about.page.before",
  "about.page.after",
  "about.hero.before",
  "about.hero.after",
  "about.highlights.before",
  "about.highlights.after",
  "about.principles.before",
  "about.principles.after",
  "about.sidebar.before",
  "about.sidebar.after",
  "write.page.before",
  "write.page.after",
  "write.header.before",
  "write.header.after",
  "post.create.form.before",
  "post.create.form.after",
  "post.create.tools.before",
  "post.create.tools.after",
  "post.create.editor.before",
  "post.create.editor.after",
  "post.create.enhancements.before",
  "post.create.enhancements.after",
  "post.create.submit.before",
  "post.create.submit.after",
  "faq.page.before",
  "faq.page.after",
  "faq.tabs.before",
  "faq.tabs.after",
  "faq.content.before",
  "faq.content.after",
  "notifications.page.before",
  "notifications.page.after",
  "notifications.toolbar.before",
  "notifications.toolbar.after",
  "notifications.list.before",
  "notifications.list.after",
  "messages.page.before",
  "messages.page.after",
  "messages.header.before",
  "messages.header.after",
  "messages.sidebar.before",
  "messages.sidebar.after",
  "messages.thread.before",
  "messages.thread.after",
  "search.page.before",
  "search.page.after",
  "search.hero.before",
  "search.hero.after",
  "search.results.before",
  "search.results.after",
  "tags.page.before",
  "tags.page.after",
  "tags.hero.before",
  "tags.hero.after",
  "tags.content.before",
  "tags.content.after",
  "tags.sidebar.before",
  "tags.sidebar.after",
  "tag.page.before",
  "tag.page.after",
  "tag.hero.before",
  "tag.hero.after",
  "tag.content.before",
  "tag.content.after",
  "tag.sidebar.before",
  "tag.sidebar.after",
  "user.page.before",
  "user.page.after",
  "user.sidebar.before",
  "user.sidebar.after",
  "user.profile.before",
  "user.profile.after",
  "user.activity.before",
  "user.activity.after",
  "feed.page.before",
  "feed.page.after",
  "feed.main.before",
  "feed.main.after",
  "feed.sidebar.before",
  "feed.sidebar.after",
  "feed.latest.before",
  "feed.latest.after",
  "feed.new.before",
  "feed.new.after",
  "feed.hot.before",
  "feed.hot.after",
  "feed.following.before",
  "feed.following.after",
  "feed.universe.before",
  "feed.universe.after",
  "board.page.before",
  "board.page.after",
  "board.hero.before",
  "board.hero.after",
  "board.content.before",
  "board.content.after",
  "board.sidebar.before",
  "board.sidebar.after",
  "collections.page.before",
  "collections.page.after",
  "collections.hero.before",
  "collections.hero.after",
  "collections.content.before",
  "collections.content.after",
  "collections.sidebar.before",
  "collections.sidebar.after",
  "collection.page.before",
  "collection.page.after",
  "collection.hero.before",
  "collection.hero.after",
  "collection.pending.before",
  "collection.pending.after",
  "collection.content.before",
  "collection.content.after",
  "collection.sidebar.before",
  "collection.sidebar.after",
  "announcements.page.before",
  "announcements.page.after",
  "announcements.hero.before",
  "announcements.hero.after",
  "announcements.content.before",
  "announcements.content.after",
  "announcement.page.before",
  "announcement.page.after",
  "announcement.hero.before",
  "announcement.hero.after",
  "announcement.content.before",
  "announcement.content.after",
  "history.page.before",
  "history.page.after",
  "history.panel.before",
  "history.panel.after",
  "friend-links.page.before",
  "friend-links.page.after",
  "friend-links.hero.before",
  "friend-links.hero.after",
  "friend-links.content.before",
  "friend-links.content.after",
  "funs.page.before",
  "funs.page.after",
  "funs.content.before",
  "funs.content.after",
  "funs.sidebar.before",
  "funs.sidebar.after",
  "badge.page.before",
  "badge.page.after",
  "badge.hero.before",
  "badge.hero.after",
  "badge.sidebar.before",
  "badge.sidebar.after",
  "terms.page.before",
  "terms.page.after",
  "terms.hero.before",
  "terms.hero.after",
  "terms.content.before",
  "terms.content.after",
  "terms.sidebar.before",
  "terms.sidebar.after",
  "prison.page.before",
  "prison.page.after",
  "prison.hero.before",
  "prison.hero.after",
  "prison.content.before",
  "prison.content.after",
  "prison.sidebar.before",
  "prison.sidebar.after",
  "auth.forgot-password.page.before",
  "auth.forgot-password.page.after",
  "auth.forgot-password.panel.before",
  "auth.forgot-password.panel.after",
  "auth.passkey.page.before",
  "auth.passkey.page.after",
  "auth.passkey.panel.before",
  "auth.passkey.panel.after",
  "auth.complete.page.before",
  "auth.complete.page.after",
  "auth.complete.panel.before",
  "auth.complete.panel.after",
  "topup.result.page.before",
  "topup.result.page.after",
  "topup.result.panel.before",
  "topup.result.panel.after",
] as const

export type AddonSlotKey = (typeof ADDON_SLOT_KEYS)[number]
export type AddonSurfaceKey = string
export type AddonSlotProps = Record<string, unknown>
export type AddonSurfaceProps = Record<string, unknown>
export type AddonHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD"
export type AddonPageScope = "public" | "admin"
export type AddonApiScope = "public" | "admin"
export type AddonMaybePromise<T> = T | Promise<T>
export const ADDON_ACTION_HOOK_NAMES = [
  "auth.login.before",
  "auth.login.after",
  "auth.register.before",
  "auth.register.after",
  "auth.identity.bind.before",
  "auth.identity.bind.after",
  "auth.identity.unbind.before",
  "auth.identity.unbind.after",
  "auth.password.change.before",
  "auth.password.change.after",
  "auth.password.reset.before",
  "auth.password.reset.after",
  "post.create.before",
  "post.create.after",
  "comment.create.before",
  "comment.create.after",
  "message.send.before",
  "message.send.after",
  "payment.paid.before",
  "payment.paid.after",
  "invite-code.purchase.before",
  "invite-code.purchase.after",
  "redeem-code.redeem.before",
  "redeem-code.redeem.after",
  "user.update.before",
  "user.update.after",
  "user.notification-settings.update.before",
  "user.notification-settings.update.after",
  "addon.config.changed.before",
  "addon.config.changed.after",
  // ─── 以下为 v2 扩展 hook（类型映射见 AddonActionHookPayloadMap） ───
  // 认证
  "auth.logout.before",
  "auth.logout.after",
  // 帖子
  "post.update.before",
  "post.update.after",
  "post.delete.before",
  "post.delete.after",
  "post.status.changed.after",
  "post.like.after",
  "post.favorite.toggle.after",
  // 评论
  "comment.update.before",
  "comment.update.after",
  "comment.delete.before",
  "comment.delete.after",
  "comment.like.after",
  // 用户关系
  "user.follow.toggle.after",
  // 通知
  "notification.create.before",
  "notification.create.after",
  // 积分
  "points.change.after",
  // 上传
  "upload.file.before",
  "upload.file.after",
  // addon 生命周期
  "addon.installed.after",
  "addon.uninstalled.after",
  "addon.enabled.after",
  "addon.disabled.after",
  // 搜索
  "search.query.after",
] as const

export const ADDON_WATERFALL_HOOK_NAMES = [
  "post.slug.value",
  // ─── v2 扩展 ───
  "post.title.value",
  "user.displayName.value",
  "user.avatar.url.value",
  "search.query.normalize",
  "seo.meta.title",
  "seo.meta.description",
  "breadcrumb.items",
] as const

export const ADDON_ASYNC_WATERFALL_HOOK_NAMES = [
  "navigation.primary.items",
  "home.sidebar.hot-topics.items",
  "settings.post-management.tabs",
  // ─── v2 扩展 ───
  "feed.posts.items",
  "search.results.rerank",
  "notification.dispatch.targets",
  "sitemap.entries",
  "post.related.items",
  "post.content.render",
] as const

export type AddonActionHookName = (typeof ADDON_ACTION_HOOK_NAMES)[number]
export type AddonWaterfallHookName = (typeof ADDON_WATERFALL_HOOK_NAMES)[number]
export type AddonAsyncWaterfallHookName = (typeof ADDON_ASYNC_WATERFALL_HOOK_NAMES)[number]
export type AddonHookKind = "action" | "waterfall" | "asyncWaterfall"
export type AddonHookName =
  | AddonActionHookName
  | AddonWaterfallHookName
  | AddonAsyncWaterfallHookName

export interface AddonManifest {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  homepage?: string
  enabled?: boolean
  engines?: {
    core?: string
  }
  entry?: {
    server?: string
  }
  permissions?: string[]
  provides?: {
    slots?: string[]
    surfaces?: string[]
    pages?: string[]
    adminPages?: string[]
    publicApis?: string[]
    adminApis?: string[]
    backgroundJobs?: string[]
    providers?: string[]
  }
  dependencies?: {
    addons?: string[]
    conflicts?: string[]
  }
  install?: {
    requiresRestart?: boolean
  }
}

export interface AddonStateRecord {
  enabled?: boolean
  installedAt?: string | null
  disabledAt?: string | null
  uninstalledAt?: string | null
  lastErrorAt?: string | null
  lastErrorMessage?: string | null
}

export interface AddonStyleDescriptor {
  href: string
  media?: string
}

export interface AddonScriptDescriptor {
  src: string
  async?: boolean
  defer?: boolean
  type?: "module" | "text/javascript"
  strategy?: "beforeInteractive" | "afterInteractive" | "lazyOnload"
}

export interface AddonRenderResult {
  html?: string
  text?: string
  clientModule?: string
  clientProps?: Record<string, unknown>
  containerTag?: "div" | "section" | "aside"
  containerClassName?: string
  stylesheets?: Array<string | AddonStyleDescriptor>
  scripts?: Array<string | AddonScriptDescriptor>
  inlineScripts?: string[]
}

export interface AddonRedirectResult {
  redirectTo: string
}

export type AddonPageRenderResult =
  | AddonRenderResult
  | AddonRedirectResult

export type AddonApiResult =
  | Response
  | {
      status?: number
      headers?: Record<string, string>
      json?: unknown
      text?: string
      html?: string
    }

export interface AddonRuntimeDescriptor {
  manifest: AddonManifest
  state: AddonStateRecord
  enabled: boolean
  rootDir: string
  assetRootDir: string
  assetBaseUrl: string
  publicBaseUrl: string
  adminBaseUrl: string
  publicApiBaseUrl: string
  adminApiBaseUrl: string
}

export interface AddonDataIndexDefinition {
  name?: string
  fields: string[]
}

export interface AddonDataCollectionDefinition {
  name: string
  indexes?: AddonDataIndexDefinition[]
  ttlDays?: number | null
}

export interface AddonDataRecord<TValue = Record<string, unknown>> {
  id: string
  value: TValue
  createdAt: string
  updatedAt: string
  expiresAt: string | null
}

export interface AddonDataQuerySort {
  field: string
  direction?: "asc" | "desc"
}

export interface AddonDataQueryOptions {
  where?: Record<string, unknown>
  sort?: AddonDataQuerySort[]
  limit?: number
  offset?: number
  cursor?: string | null
  includeTotal?: boolean
}

export interface AddonDataQueryResult<TValue = Record<string, unknown>> {
  items: AddonDataRecord<TValue>[]
  nextCursor: string | null
  total: number | null
}

export interface AddonDataStoreApi {
  ensureCollection: (
    definition: AddonDataCollectionDefinition,
  ) => Promise<AddonDataCollectionDefinition>
  get: <TValue = Record<string, unknown>>(
    collectionName: string,
    recordId: string,
  ) => Promise<AddonDataRecord<TValue> | null>
  put: <TValue = Record<string, unknown>>(
    collectionName: string,
    input: {
      id?: string
      value: TValue
      expiresAt?: string | Date | null
    },
  ) => Promise<AddonDataRecord<TValue>>
  delete: (collectionName: string, recordId: string) => Promise<boolean>
  query: <TValue = Record<string, unknown>>(
    collectionName: string,
    options?: AddonDataQueryOptions,
  ) => Promise<AddonDataQueryResult<TValue>>
  cleanup: (
    collectionName?: string,
  ) => Promise<{ deletedCount: number; scannedCount: number }>
  clear: (
    collectionName?: string,
  ) => Promise<{ clearedCollections: number; clearedRecords: number }>
  getSchemaVersion: () => Promise<number>
}

export interface AddonBackgroundJobEnqueueOptions {
  delayMs?: number
  maxAttempts?: number
}

export interface AddonBackgroundJobHandle<TPayload = unknown> {
  id: string
  key: string
  payload: TPayload
  enqueuedAt: string
  attempt: number
  maxAttempts: number
  availableAt: string | null
}

export type AddonBackgroundJobDeleteLocation =
  | "memory-queue"
  | "stream"
  | "delayed"
  | "dead-letter"

export interface AddonBackgroundJobDeleteResult {
  id: string
  removed: boolean
  removedFrom: AddonBackgroundJobDeleteLocation[]
}

export interface AddonBackgroundJobApi {
  enqueue: <TPayload = unknown>(
    jobKey: string,
    payload: TPayload,
    options?: AddonBackgroundJobEnqueueOptions,
  ) => Promise<AddonBackgroundJobHandle<TPayload>>
  remove: (jobId: string) => Promise<AddonBackgroundJobDeleteResult>
}

export interface AddonScheduledJobState {
  token: string
  jobId: string
  nextRunAt: string | null
}

export interface AddonScheduleStatus {
  state: "scheduled" | "missing" | "stale" | "disabled" | "incomplete"
  message: string
  token: string
  jobId: string
  nextRunAt: string | null
}

export interface AddonScheduleEnsureOptions<TPayload = Record<string, unknown>> {
  enabled: boolean
  configured: boolean
  jobKey: string
  delayMs: number
  token?: string
  refreshToken?: boolean
  payload?: TPayload
}

export interface AddonSchedulerApi {
  inspect: (input: {
    enabled: boolean
    configured: boolean
    state: AddonScheduledJobState | null | undefined
  }) => AddonScheduleStatus
  ensure: <TPayload = Record<string, unknown>>(
    currentState: AddonScheduledJobState | null | undefined,
    options: AddonScheduleEnsureOptions<TPayload>,
  ) => Promise<{
    scheduled: boolean
    state: AddonScheduledJobState
  }>
  cancel: (
    currentState: AddonScheduledJobState | null | undefined,
    options?: { nextToken?: string },
  ) => Promise<AddonScheduledJobState>
}

export type AddonPostStatusMode = "AUTO" | "PUBLISHED" | "PENDING"
export type AddonPostType = "NORMAL" | "BOUNTY" | "POLL" | "LOTTERY" | "AUCTION"
export type AddonReadablePostStatus = "NORMAL" | "PENDING" | "DELETED" | "LOCKED" | "OFFLINE"
export type AddonReadableCommentStatus = "NORMAL" | "HIDDEN" | "DELETED" | "PENDING"
export type AddonSortDirection = "asc" | "desc"

export interface AddonPostCreateInput {
  authorId?: number
  authorUsername?: string
  status?: AddonPostStatusMode
  title: string
  content: string
  boardSlug: string
  postType?: AddonPostType
  isAnonymous?: boolean
  coverPath?: string | null
  bountyPoints?: number | null
  auctionConfig?: Record<string, unknown> | null
  pollOptions?: string[]
  pollExpiresAt?: string | null
  commentsVisibleToAuthorOnly?: boolean
  loginUnlockContent?: string
  replyUnlockContent?: string
  replyThreshold?: number | null
  purchaseUnlockContent?: string
  purchasePrice?: number | null
  minViewLevel?: number | null
  minViewVipLevel?: number | null
  lotteryConfig?: Record<string, unknown> | null
  redPacketConfig?: Record<string, unknown> | null
  manualTags?: string[]
  attachments?: Array<Record<string, unknown>>
}

export interface AddonPostCreateResult {
  id: string
  slug: string
  status: string
  boardId: string
  authorId: number
  shouldPending: boolean
  contentAdjusted: boolean
}

export interface AddonUserSummary {
  id: number
  username: string
  nickname: string | null
  displayName: string
  avatarPath: string | null
  status: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  vipLevel: number
}

export interface AddonZoneSummary {
  id: string | null
  slug: string | null
  name: string | null
}

export interface AddonBoardSummary {
  id: string
  slug: string
  name: string
  iconPath: string | null
  zone: AddonZoneSummary | null
}

export interface AddonPostRecord {
  id: string
  slug: string
  title: string
  summary: string | null
  content: string
  coverPath: string | null
  type: AddonPostType
  status: AddonReadablePostStatus
  reviewNote: string | null
  isAnonymous: boolean
  isPinned: boolean
  pinScope: string | null
  isFeatured: boolean
  commentsVisibleToAuthorOnly: boolean
  minViewLevel: number
  minViewVipLevel: number
  commentCount: number
  viewCount: number
  likeCount: number
  favoriteCount: number
  tipCount: number
  tipTotalPoints: number
  bountyPoints: number | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  lastCommentedAt: string | null
  activityAt: string
  board: AddonBoardSummary
  author: AddonUserSummary
}

export interface AddonPostQuerySort {
  field:
    | "createdAt"
    | "updatedAt"
    | "publishedAt"
    | "lastCommentedAt"
    | "activityAt"
    | "commentCount"
    | "viewCount"
    | "likeCount"
    | "favoriteCount"
    | "tipCount"
    | "tipTotalPoints"
  direction?: AddonSortDirection
}

export interface AddonPostQueryOptions {
  ids?: string[]
  excludeIds?: string[]
  boardIds?: string[]
  boardSlugs?: string[]
  zoneIds?: string[]
  zoneSlugs?: string[]
  authorIds?: number[]
  authorUsernames?: string[]
  statuses?: AddonReadablePostStatus[]
  createdAfter?: string | null
  createdBefore?: string | null
  publishedAfter?: string | null
  publishedBefore?: string | null
  lastCommentedAfter?: string | null
  lastCommentedBefore?: string | null
  activityAfter?: string | null
  activityBefore?: string | null
  minCommentCount?: number
  maxCommentCount?: number
  minViewCount?: number
  maxViewCount?: number
  minLikeCount?: number
  maxLikeCount?: number
  minFavoriteCount?: number
  maxFavoriteCount?: number
  includePinned?: boolean
  includeFeatured?: boolean
  limit?: number
  offset?: number
  includeTotal?: boolean
  sort?: AddonPostQuerySort[]
}

export interface AddonPostQueryResult {
  items: AddonPostRecord[]
  total: number | null
  limit: number
  offset: number
}

export interface AddonPostLikeInput {
  actorId?: number
  actorUsername?: string
  postId: string
}

export interface AddonPostLikeResult {
  postId: string
  liked: true
  changed: boolean
  targetUserId: number | null
}

export interface AddonPostTipInput {
  senderId?: number
  senderUsername?: string
  postId: string
  amount: number
  giftId?: string | null
}

export interface AddonPostTipResult {
  postId: string
  amount: number
  pointName: string
  recipientUserId: number
  gift: {
    id: string
    name: string
    price: number
  } | null
}

export interface AddonPostsApi {
  create: (input: AddonPostCreateInput) => Promise<AddonPostCreateResult>
  query: (options?: AddonPostQueryOptions) => Promise<AddonPostQueryResult>
  like: (input: AddonPostLikeInput) => Promise<AddonPostLikeResult>
  tip: (input: AddonPostTipInput) => Promise<AddonPostTipResult>
}

export interface AddonCommentCreateInput {
  authorId?: number
  authorUsername?: string
  postId: string
  content: string
  parentId?: string
  replyToUserName?: string
  replyToCommentId?: string
  useAnonymousIdentity?: boolean
  commentView?: "tree" | "flat"
}

export interface AddonCommentCreateResult {
  id: string
  postId: string
  status: AddonReadableCommentStatus
  parentId: string | null
  replyToCommentId: string | null
  replyToUserId: number | null
  reviewRequired: boolean
  contentAdjusted: boolean
  targetPage: number
  commentView: "tree" | "flat"
}

export interface AddonCommentRecord {
  id: string
  postId: string
  parentId: string | null
  replyToUserId: number | null
  replyToCommentId: string | null
  useAnonymousIdentity: boolean
  content: string
  status: AddonReadableCommentStatus
  reviewNote: string | null
  likeCount: number
  createdAt: string
  updatedAt: string
  author: AddonUserSummary
}

export interface AddonCommentQuerySort {
  field: "createdAt" | "updatedAt" | "likeCount"
  direction?: AddonSortDirection
}

export interface AddonCommentQueryOptions {
  ids?: string[]
  postId?: string
  postIds?: string[]
  authorIds?: number[]
  authorUsernames?: string[]
  statuses?: AddonReadableCommentStatus[]
  parentId?: string | null
  createdAfter?: string | null
  createdBefore?: string | null
  updatedAfter?: string | null
  updatedBefore?: string | null
  minLikeCount?: number
  maxLikeCount?: number
  limit?: number
  offset?: number
  includeTotal?: boolean
  sort?: AddonCommentQuerySort[]
}

export interface AddonCommentQueryResult {
  items: AddonCommentRecord[]
  total: number | null
  limit: number
  offset: number
}

export interface AddonCommentLikeInput {
  actorId?: number
  actorUsername?: string
  commentId: string
}

export interface AddonCommentLikeResult {
  commentId: string
  liked: true
  changed: boolean
  targetUserId: number | null
}

export interface AddonCommentsApi {
  create: (input: AddonCommentCreateInput) => Promise<AddonCommentCreateResult>
  query: (options?: AddonCommentQueryOptions) => Promise<AddonCommentQueryResult>
  like: (input: AddonCommentLikeInput) => Promise<AddonCommentLikeResult>
}

export interface AddonMessageSendInput {
  senderId?: number
  senderUsername?: string
  recipientId?: number
  recipientUsername?: string
  body: string
}

export interface AddonMessageSendResult {
  id: string
  conversationId: string
  content: string
  createdAt: string
  occurredAt: string
  contentAdjusted: boolean
}

export interface AddonMessagesApi {
  send: (input: AddonMessageSendInput) => Promise<AddonMessageSendResult>
}

export type AddonNotificationRelatedType =
  | "POST"
  | "COMMENT"
  | "USER"
  | "REPORT"
  | "ANNOUNCEMENT"
  | "YINYANG_CHALLENGE"

export interface AddonNotificationCreateInput {
  recipientId?: number
  recipientUsername?: string
  relatedId: string
  title: string
  content: string
  relatedType?: AddonNotificationRelatedType
  senderId?: number | null
}

export interface AddonNotificationRecord {
  id: string
  userId: number
  type: "SYSTEM"
  senderId: number | null
  relatedType: AddonNotificationRelatedType
  relatedId: string
  title: string
  content: string
  createdAt: string
}

export interface AddonNotificationsApi {
  create: (input: AddonNotificationCreateInput) => Promise<AddonNotificationRecord>
  createMany: (
    inputs: AddonNotificationCreateInput[],
  ) => Promise<AddonNotificationRecord[]>
}

export interface AddonUserFollowInput {
  followerId?: number
  followerUsername?: string
  targetUserId?: number
  targetUsername?: string
}

export interface AddonUserFollowResult {
  targetType: "user"
  targetUserId: number
  followed: true
  changed: boolean
}

export interface AddonFollowsApi {
  followUser: (input: AddonUserFollowInput) => Promise<AddonUserFollowResult>
}

export interface AddonPointAdjustInput {
  targetUserId?: number
  targetUsername?: string
  delta: number
  reason: string
  scopeKey?: string
  relatedType?: AddonNotificationRelatedType
  relatedId?: string | null
  insufficientMessage?: string
}

export interface AddonPointAdjustResult {
  userId: number
  pointName: string
  finalDelta: number
  afterBalance: number
  scopeKey: string | null
  effectsApplied: boolean
}

export interface AddonPointsApi {
  adjust: (input: AddonPointAdjustInput) => Promise<AddonPointAdjustResult>
}

export interface AddonBoardSelectItem {
  value: string
  label: string
}

export interface AddonBoardSelectGroup {
  zone: string
  items: AddonBoardSelectItem[]
}

export interface AddonLifecycleDatabaseApi {
  prisma: PrismaClient
  queryRaw: <TRow = Record<string, unknown>>(
    sql: string,
    values?: unknown[],
  ) => Promise<TRow[]>
  executeRaw: (sql: string, values?: unknown[]) => Promise<number>
  transaction: <TResult>(
    task: (database: AddonLifecycleDatabaseApi) => Promise<TResult>,
  ) => Promise<TResult>
}

export interface AddonExecutionContextBase extends AddonRuntimeDescriptor {
  request?: Request
  pathname?: string
  searchParams?: URLSearchParams
  permissions: string[]
  hasPermission: (permission: string) => boolean
  assertPermission: (permission: string, message?: string) => void
  /**
   * Server-only shadcn UI 组件集合（与 client.tsx 的 addonClientUi 同名清单，custom 字段除外）。
   * 仅供 addon 在服务端 render（slot/page/surface）时通过 createElement 组合 UI；
   * 客户端组件请直接 `import { addonClientUi } from "@/addons-host/sdk/client"`。
   */
  ui: import("./sdk/server-ui").AddonServerSdkUi
  /** Server-only Lucide 图标集合，与 client.tsx 的 addonClientIcons 同清单。 */
  icons: import("./sdk/server-ui").AddonServerSdkIcons
  /** Tailwind class 合并工具（即 `@/lib/utils` 的 `cn`）。 */
  cn: typeof import("@/lib/utils").cn
  /**
   * 将 React 元素渲染为静态 HTML 字符串（基于 react-dom/server `renderToStaticMarkup`）。
   * 用于 slot/page/surface 等需返回 HTML 字符串的场景；不写入 hydration 标记，
   * 客户端交互需 addon 自行提供 client-entry。
   */
  renderToHtml: (element: import("react").ReactNode) => string
  getCurrentUser: () => Promise<SessionActor | null>
  getSiteSettings: () => Promise<SiteSettingsData>
  getBoardSelectOptions: () => Promise<AddonBoardSelectGroup[]>
  asset: (path?: string) => string
  publicPage: (path?: string) => string
  adminPage: (path?: string) => string
  publicApi: (path?: string) => string
  adminApi: (path?: string) => string
  readAssetText: (path: string) => Promise<string>
  readAssetJson: <T = unknown>(path: string) => Promise<T>
  readConfig: <T = unknown>(configKey: string, fallback?: T) => Promise<T>
  writeConfig: <T = unknown>(configKey: string, value: T) => Promise<void>
  readSecret: <T = unknown>(secretKey: string, fallback?: T) => Promise<T>
  writeSecret: <T = unknown>(secretKey: string, value: T) => Promise<void>
  data: AddonDataStoreApi
  backgroundJobs: AddonBackgroundJobApi
  scheduler: AddonSchedulerApi
  posts: AddonPostsApi
  comments: AddonCommentsApi
  messages: AddonMessagesApi
  notifications: AddonNotificationsApi
  follows: AddonFollowsApi
  points: AddonPointsApi
}

export type AddonLifecycleAction = "install" | "upgrade" | "uninstall"

export interface AddonLifecycleContextBase extends AddonExecutionContextBase {
  action: AddonLifecycleAction
  readFileText: (path: string) => Promise<string>
  readFileJson: <T = unknown>(path: string) => Promise<T>
  database: AddonLifecycleDatabaseApi
}

export interface AddonInstallLifecycleContext extends AddonLifecycleContextBase {
  action: "install"
}

export interface AddonUpgradeLifecycleContext extends AddonLifecycleContextBase {
  action: "upgrade"
  previousManifest: AddonManifest
  previousVersion: string
  nextVersion: string
  previousRootDir: string
}

export interface AddonUninstallLifecycleContext extends AddonLifecycleContextBase {
  action: "uninstall"
  currentVersion: string
}

export interface AddonLifecycleHooks {
  install?: (
    context: AddonInstallLifecycleContext,
  ) => AddonMaybePromise<void>
  upgrade?: (
    context: AddonUpgradeLifecycleContext,
  ) => AddonMaybePromise<void>
  uninstall?: (
    context: AddonUninstallLifecycleContext,
  ) => AddonMaybePromise<void>
}

export interface AddonSlotRenderContext<
  TProps extends AddonSlotProps = AddonSlotProps,
> extends AddonExecutionContextBase {
  slot: AddonSlotKey
  props: TProps
}

export interface AddonSurfaceRenderContext<
  TProps extends AddonSurfaceProps = AddonSurfaceProps,
> extends AddonExecutionContextBase {
  surface: AddonSurfaceKey
  props: TProps
}

export interface AddonPageRenderContext extends AddonExecutionContextBase {
  scope: AddonPageScope
  routePath: string
  routeSegments: string[]
}

export interface AddonApiHandlerContext extends AddonExecutionContextBase {
  scope: AddonApiScope
  routePath: string
  routeSegments: string[]
  method: AddonHttpMethod
}

/**
 * ───────────────────────────────────────────────────────────────────────────
 * Hook 类型映射表（v2 引入）
 *
 * 设计说明：
 * 1. 三张 Map 分别登记 Action / Waterfall / AsyncWaterfall 三类 hook 的
 *    payload / value 类型；仅登记**新增的 v2 hook**，历史老 hook 不登记，
 *    由查表 helper 回落为 `unknown`——这保证**现有插件代码 100% 向后兼容**。
 * 2. 三张 Map 均为 `interface`，插件作者可通过
 *    [declaration merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html)
 *    在自己的 `*.d.ts` 中扩展未登记的 hook，以获得端到端类型安全。
 * 3. `AddonActionHookContext` / `AddonWaterfallHookContext` 与
 *    `AddonActionHookRegistration` / `AddonWaterfallHookRegistration` /
 *    `AddonAsyncWaterfallHookRegistration` 的**第二个泛型参数**改为"按 hook 名
 *    查表"：对已登记的 hook 精确推断 payload/value 类型，未登记则仍为 unknown。
 * ───────────────────────────────────────────────────────────────────────────
 */
export interface AddonActionHookPayloadMap {
  // ─── 认证 ───
  "auth.logout.before": {
    userId: string
    username: string
    sessionId?: string
  }
  "auth.logout.after": {
    userId: string
    username: string
    sessionId?: string
  }
  // ─── 帖子 ───
  "post.update.before": {
    postId: string
    editorId: string
    changes: Record<string, unknown>
  }
  "post.update.after": {
    postId: string
    editorId: string
    changes: Record<string, unknown>
    post?: AddonPostRecord
  }
  "post.delete.before": {
    postId: string
    editorId: string
    reason?: string
  }
  "post.delete.after": {
    postId: string
    editorId: string
    reason?: string
  }
  "post.status.changed.after": {
    postId: string
    editorId: string
    previousStatus: AddonReadablePostStatus
    nextStatus: AddonReadablePostStatus
  }
  "post.like.after": {
    postId: string
    userId: string
    liked: boolean
    likeCount?: number
  }
  "post.favorite.toggle.after": {
    postId: string
    userId: string
    favorited: boolean
  }
  // ─── 评论 ───
  "comment.update.before": {
    commentId: string
    editorId: string
    changes: Record<string, unknown>
  }
  "comment.update.after": {
    commentId: string
    editorId: string
    changes: Record<string, unknown>
    comment?: AddonCommentRecord
  }
  "comment.delete.before": {
    commentId: string
    editorId: string
    reason?: string
  }
  "comment.delete.after": {
    commentId: string
    editorId: string
    reason?: string
  }
  "comment.like.after": {
    commentId: string
    userId: string
    liked: boolean
    likeCount?: number
  }
  // ─── 用户关系 ───
  "user.follow.toggle.after": {
    followerId: string
    followeeId: string
    following: boolean
  }
  // ─── 通知 ───
  "notification.create.before": {
    recipientId: string
    type: string
    payload: Record<string, unknown>
  }
  "notification.create.after": {
    notification?: AddonNotificationRecord
  }
  // ─── 积分 ───
  "points.change.after": {
    userId: string
    delta: number
    balance: number
    reason: string
  }
  // ─── 上传 ───
  "upload.file.before": {
    uploaderId: string
    filename: string
    mime: string
    size: number
  }
  "upload.file.after": {
    uploaderId: string
    fileId: string
    filename: string
    mime: string
    size: number
    url?: string
  }
  // ─── addon 生命周期 ───
  "addon.installed.after": {
    addonId: string
    version: string
  }
  "addon.uninstalled.after": {
    addonId: string
    version: string
  }
  "addon.enabled.after": {
    addonId: string
    version: string
  }
  "addon.disabled.after": {
    addonId: string
    version: string
  }
  // ─── 搜索 ───
  "search.query.after": {
    userId?: string
    query: string
    scope: string
    resultCount: number
  }
}

export interface AddonWaterfallHookValueMap {
  "post.title.value": string
  "user.displayName.value": string
  "user.avatar.url.value": string
  "search.query.normalize": string
  "seo.meta.title": string
  "seo.meta.description": string
  "breadcrumb.items": Array<{
    label: string
    href?: string
  }>
}

export interface AddonAsyncWaterfallHookValueMap {
  "feed.posts.items": AddonPostRecord[]
  "search.results.rerank": Array<{
    id: string
    score: number
    kind: "post" | "comment" | "user"
    [key: string]: unknown
  }>
  "notification.dispatch.targets": Array<{
    userId: string
    channel: "inapp" | "email" | "webhook" | string
  }>
  "sitemap.entries": Array<{
    loc: string
    lastmod?: string
    changefreq?: string
    priority?: number
  }>
  "post.related.items": AddonPostRecord[]
  "post.content.render": string
}

/** 按 hook 名查 payload 类型；未登记则回落 unknown（向后兼容）。 */
export type LookupAddonActionHookPayload<H extends AddonActionHookName> =
  H extends keyof AddonActionHookPayloadMap ? AddonActionHookPayloadMap[H] : unknown

/** 按 hook 名查 waterfall value 类型；未登记则回落 unknown。 */
export type LookupAddonWaterfallHookValue<H extends AddonWaterfallHookName> =
  H extends keyof AddonWaterfallHookValueMap ? AddonWaterfallHookValueMap[H] : unknown

/** 按 hook 名查 asyncWaterfall value 类型；未登记则回落 unknown。 */
export type LookupAddonAsyncWaterfallHookValue<H extends AddonAsyncWaterfallHookName> =
  H extends keyof AddonAsyncWaterfallHookValueMap ? AddonAsyncWaterfallHookValueMap[H] : unknown

export interface AddonActionHookContext<
  THook extends AddonActionHookName = AddonActionHookName,
  TPayload = LookupAddonActionHookPayload<THook>,
> extends AddonExecutionContextBase {
  hook: THook
  payload: TPayload
}

export interface AddonWaterfallHookContext<
  THook extends AddonHookName = AddonHookName,
  TValue = unknown,
> extends AddonExecutionContextBase {
  hook: THook
  value: TValue
}

export interface AddonSlotRegistration<
  TProps extends AddonSlotProps = AddonSlotProps,
> {
  key: string
  slot: AddonSlotKey
  order?: number
  title?: string
  render: (
    context: AddonSlotRenderContext<TProps>,
  ) => AddonMaybePromise<AddonRenderResult | null | undefined>
}

export interface AddonSurfaceRegistration<
  TProps extends AddonSurfaceProps = AddonSurfaceProps,
> {
  key: string
  surface: AddonSurfaceKey
  priority?: number
  title?: string
  description?: string
  clientModule?: string
  render?: (
    context: AddonSurfaceRenderContext<TProps>,
  ) => AddonMaybePromise<AddonRenderResult | null | undefined>
}

export interface AddonSurfaceOverrideDescriptor {
  addonId: string
  clientModuleUrl: string
  description?: string
  key: string
  priority: number
  surface: AddonSurfaceKey
  title?: string
}

export function pickPreferredAddonSurfaceOverride(
  items: AddonSurfaceOverrideDescriptor[],
  surface: AddonSurfaceKey,
) {
  return items.find((item) => item.surface === surface) ?? null
}

export interface AddonPageRegistration {
  key: string
  path?: string
  title?: string
  description?: string
  render: (context: AddonPageRenderContext) => AddonMaybePromise<AddonPageRenderResult | null | undefined>
}

export interface AddonApiRegistration {
  key: string
  path?: string
  methods?: AddonHttpMethod[]
  handle: (context: AddonApiHandlerContext) => AddonMaybePromise<AddonApiResult>
}

export interface AddonProviderRegistration {
  kind: string
  code: string
  label: string
  order?: number
  description?: string
  data?: Record<string, unknown>
}

export interface AddonActionHookRegistration<
  THook extends AddonActionHookName = AddonActionHookName,
  TPayload = LookupAddonActionHookPayload<THook>,
> {
  key: string
  hook: THook
  order?: number
  title?: string
  description?: string
  handle: (
    context: AddonActionHookContext<THook, TPayload>,
  ) => AddonMaybePromise<void>
}

export interface AddonWaterfallHookRegistration<
  THook extends AddonWaterfallHookName = AddonWaterfallHookName,
  TValue = LookupAddonWaterfallHookValue<THook>,
> {
  key: string
  hook: THook
  order?: number
  title?: string
  description?: string
  transform: (
    context: AddonWaterfallHookContext<THook, TValue>,
  ) => TValue | undefined
}

export interface AddonAsyncWaterfallHookRegistration<
  THook extends AddonAsyncWaterfallHookName = AddonAsyncWaterfallHookName,
  TValue = LookupAddonAsyncWaterfallHookValue<THook>,
> {
  key: string
  hook: THook
  order?: number
  title?: string
  description?: string
  transform: (
    context: AddonWaterfallHookContext<THook, TValue>,
  ) => AddonMaybePromise<TValue | undefined>
}

export interface AddonBackgroundJobHandlerContext<
  TPayload = unknown,
> extends AddonExecutionContextBase {
  job: AddonBackgroundJobHandle<TPayload>
  payload: TPayload
}

export interface AddonBackgroundJobRegistration<
  TPayload = unknown,
> {
  key: string
  title?: string
  description?: string
  handle: (
    context: AddonBackgroundJobHandlerContext<TPayload>,
  ) => AddonMaybePromise<void>
}

export interface AddonDataMigrationRegistration {
  version: number
  title?: string
  migrate: (context: AddonExecutionContextBase) => AddonMaybePromise<void>
}

export interface AddonBuildApi {
  registerSlot: <TProps extends AddonSlotProps = AddonSlotProps>(
    registration: AddonSlotRegistration<TProps>,
  ) => void
  registerSurface: <TProps extends AddonSurfaceProps = AddonSurfaceProps>(
    registration: AddonSurfaceRegistration<TProps>,
  ) => void
  registerPublicPage: (registration: AddonPageRegistration) => void
  registerAdminPage: (registration: AddonPageRegistration) => void
  registerPublicApi: (registration: AddonApiRegistration) => void
  registerAdminApi: (registration: AddonApiRegistration) => void
  registerBackgroundJob: <TPayload = unknown>(
    registration: AddonBackgroundJobRegistration<TPayload>,
  ) => void
  registerProvider: (registration: AddonProviderRegistration) => void
  registerActionHook: (
    registration: AddonActionHookRegistration,
  ) => void
  registerWaterfallHook: (
    registration: AddonWaterfallHookRegistration,
  ) => void
  registerAsyncWaterfallHook: (
    registration: AddonAsyncWaterfallHookRegistration,
  ) => void
  registerDataMigration: (
    registration: AddonDataMigrationRegistration,
  ) => void
}

export interface AddonDefinition {
  setup: (api: AddonBuildApi) => AddonMaybePromise<void>
  lifecycle?: AddonLifecycleHooks
}

export interface LoadedAddonRuntime extends AddonRuntimeDescriptor {
  entryServerPath: string | null
  warnings: string[]
  permissionSet: ReadonlySet<string>
  resolvedPermissions: readonly string[]
  slots: AddonSlotRegistration[]
  surfaces: AddonSurfaceRegistration[]
  publicPages: AddonPageRegistration[]
  adminPages: AddonPageRegistration[]
  publicApis: AddonApiRegistration[]
  adminApis: AddonApiRegistration[]
  backgroundJobs: AddonBackgroundJobRegistration[]
  providers: AddonProviderRegistration[]
  actionHooks: AddonActionHookRegistration[]
  waterfallHooks: AddonWaterfallHookRegistration[]
  asyncWaterfallHooks: AddonAsyncWaterfallHookRegistration[]
  dataMigrations: AddonDataMigrationRegistration[]
  loadError: string | null
}
