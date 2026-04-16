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
] as const

export const ADDON_WATERFALL_HOOK_NAMES = [
  "post.slug.value",
] as const

export const ADDON_ASYNC_WATERFALL_HOOK_NAMES = [
  "navigation.primary.items",
  "home.sidebar.hot-topics.items",
  "settings.post-management.tabs",
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
  getSchemaVersion: () => Promise<number>
}

export interface AddonExecutionContextBase extends AddonRuntimeDescriptor {
  request?: Request
  pathname?: string
  searchParams?: URLSearchParams
  permissions: string[]
  hasPermission: (permission: string) => boolean
  assertPermission: (permission: string, message?: string) => void
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

export interface AddonActionHookContext<
  THook extends AddonActionHookName = AddonActionHookName,
  TPayload = unknown,
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
  TPayload = unknown,
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
  TValue = unknown,
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
  TValue = unknown,
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
  providers: AddonProviderRegistration[]
  actionHooks: AddonActionHookRegistration[]
  waterfallHooks: AddonWaterfallHookRegistration[]
  asyncWaterfallHooks: AddonAsyncWaterfallHookRegistration[]
  dataMigrations: AddonDataMigrationRegistration[]
  loadError: string | null
}
