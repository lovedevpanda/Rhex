import type { AddonDefinition } from "@/addons-host/types"

export function defineAddon<TAddon extends AddonDefinition>(addon: TAddon) {
  return addon
}

export type {
  AddonActionHookContext,
  AddonActionHookName,
  AddonActionHookRegistration,
  AddonApiHandlerContext,
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
  AddonManifest,
  AddonPageRegistration,
  AddonPageRenderContext,
  AddonPageRenderResult,
  AddonProviderRegistration,
  AddonRenderResult,
  AddonSlotProps,
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
