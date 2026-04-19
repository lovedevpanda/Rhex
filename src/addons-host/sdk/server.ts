import type { AddonDefinition } from "@/addons-host/types"

export function defineAddon<TAddon extends AddonDefinition>(addon: TAddon) {
  return addon
}

export type {
  AddonActionHookContext,
  AddonActionHookName,
  AddonActionHookRegistration,
  AddonApiHandlerContext,
  AddonBackgroundJobApi,
  AddonBackgroundJobDeleteLocation,
  AddonBackgroundJobDeleteResult,
  AddonBackgroundJobEnqueueOptions,
  AddonBackgroundJobHandle,
  AddonBackgroundJobHandlerContext,
  AddonBackgroundJobRegistration,
  AddonBoardSummary,
  AddonCommentCreateInput,
  AddonCommentCreateResult,
  AddonCommentLikeInput,
  AddonCommentLikeResult,
  AddonCommentQueryOptions,
  AddonCommentQueryResult,
  AddonCommentQuerySort,
  AddonCommentRecord,
  AddonCommentsApi,
  AddonDataCollectionDefinition,
  AddonDataMigrationRegistration,
  AddonDataQueryOptions,
  AddonDataQueryResult,
  AddonDataRecord,
  AddonApiRegistration,
  AddonApiResult,
  AddonAsyncWaterfallHookName,
  AddonAsyncWaterfallHookRegistration,
  AddonBuildApi,
  AddonDefinition,
  AddonInstallLifecycleContext,
  AddonLifecycleAction,
  AddonLifecycleContextBase,
  AddonLifecycleDatabaseApi,
  AddonLifecycleHooks,
  AddonManifest,
  AddonMessageSendInput,
  AddonMessageSendResult,
  AddonMessagesApi,
  AddonNotificationCreateInput,
  AddonNotificationRecord,
  AddonNotificationRelatedType,
  AddonNotificationsApi,
  AddonUninstallLifecycleContext,
  AddonUpgradeLifecycleContext,
  AddonPageRegistration,
  AddonPageRenderContext,
  AddonPageRenderResult,
  AddonPointAdjustInput,
  AddonPointAdjustResult,
  AddonPointsApi,
  AddonPostLikeInput,
  AddonPostLikeResult,
  AddonPostTipInput,
  AddonPostTipResult,
  AddonScheduledJobState,
  AddonScheduleEnsureOptions,
  AddonSchedulerApi,
  AddonScheduleStatus,
  AddonPostCreateInput,
  AddonPostCreateResult,
  AddonPostQueryOptions,
  AddonPostQueryResult,
  AddonPostQuerySort,
  AddonPostRecord,
  AddonPostStatusMode,
  AddonPostType,
  AddonPostsApi,
  AddonProviderRegistration,
  AddonReadableCommentStatus,
  AddonReadablePostStatus,
  AddonRenderResult,
  AddonSortDirection,
  AddonSlotProps,
  AddonFollowsApi,
  AddonUserFollowInput,
  AddonUserFollowResult,
  AddonUserSummary,
  AddonWaterfallHookContext,
  AddonWaterfallHookName,
  AddonWaterfallHookRegistration,
  AddonSlotKey,
  AddonSlotRegistration,
  AddonSlotRenderContext,
  AddonSurfaceKey,
  AddonSurfaceProps,
  AddonSurfaceRegistration,
  AddonSurfaceRenderContext,
  AddonZoneSummary,
} from "@/addons-host/types"
export type {
  AddonEditorComponentProps,
  AddonEditorProviderDescriptor,
  AddonEditorProviderRuntimeHooks,
  AddonEditorToolbarApi,
  AddonEditorToolbarItemComponentProps,
  AddonEditorToolbarItemDescriptor,
  AddonEditorToolbarItemRegistration,
  AddonEditorTarget,
} from "@/addons-host/editor-types"
export type {
  AddonEmojiProviderRuntimeHooks,
  ResolvedAddonEmojiItem,
} from "@/addons-host/emoji-types"
export type {
  AddonNavigationLink,
  AddonNavigationPlacement,
  AddonNavigationProviderRuntimeHooks,
  ResolvedAddonFooterLink,
  ResolvedAddonHeaderAppLink,
} from "@/addons-host/navigation-types"
export type {
  AddonAuthFieldValue,
  AddonAuthFields,
  AddonAuthLoginValidationInput,
  AddonAuthProviderRuntimeHooks,
  AddonAuthRegisterPayload,
  AddonAuthRegisterValidationInput,
  AddonAuthValidationResult,
} from "@/addons-host/auth-types"
export type {
  AddonCaptchaProviderRuntimeHooks,
  AddonCaptchaValidationResult,
  AddonLoginCaptchaValidationInput,
  AddonRegisterCaptchaValidationInput,
} from "@/addons-host/captcha-types"
export type {
  AddonUploadActor,
  AddonUploadPreparedFile,
  AddonUploadProviderRuntimeHooks,
  AddonUploadProviderSaveResult,
} from "@/addons-host/upload-types"
/**
 * Server-only addon SDK：UI 组件 / 图标 / cn / renderToHtml。
 * 这些值在 addon 的服务端 render（slot/page/surface）中也会通过 ctx.ui / ctx.icons / ctx.cn / ctx.renderToHtml 自动注入；
 * 单独 export 用于：
 *   1) 不在 ctx 作用域内的服务端工具函数；
 *   2) 仅类型场景下的 typeof / 字段名提取。
 *
 * 客户端组件请改用 `import { addonClientUi, addonClientIcons } from "@/addons-host/sdk/client"`。
 */
export {
  addonServerUi,
  addonServerIcons,
  renderToHtml,
  cn,
} from "@/addons-host/sdk/server-ui"
export type {
  AddonServerSdkUi,
  AddonServerSdkIcons,
} from "@/addons-host/sdk/server-ui"