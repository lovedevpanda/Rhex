import type {
  AddonExecutionContextBase,
  AddonMaybePromise,
  AddonProviderRegistration,
  LoadedAddonRuntime,
} from "@/addons-host/types"
import type { AddonAuthFields, AddonAuthRegisterPayload } from "@/addons-host/auth-types"

export interface AddonCaptchaValidationResult {
  ok?: boolean
  message?: string
}

interface AddonCaptchaProviderRuntimeBaseInput {
  addon: LoadedAddonRuntime
  provider: AddonProviderRegistration
  context: AddonExecutionContextBase
  request: Request
  addonFields: AddonAuthFields
}

export interface AddonCreatePostCaptchaPayload {
  title: string
  content: string
  isAnonymous: boolean
  coverPath: string | null
  boardSlug: string
  postType: string
  bountyPoints: number | null
  auctionConfig: Record<string, unknown> | null
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
}

export interface AddonLoginCaptchaValidationInput
  extends AddonCaptchaProviderRuntimeBaseInput {
  username: string
}

export interface AddonRegisterCaptchaValidationInput
  extends AddonCaptchaProviderRuntimeBaseInput {
  payload: AddonAuthRegisterPayload
  registerIp: string | null
}

export interface AddonCreatePostCaptchaValidationInput
  extends AddonCaptchaProviderRuntimeBaseInput {
  payload: AddonCreatePostCaptchaPayload
}

export interface AddonCaptchaProviderRuntimeHooks {
  verifyLoginCaptcha?: (
    input: AddonLoginCaptchaValidationInput,
  ) => AddonMaybePromise<
    void | boolean | string | AddonCaptchaValidationResult
  >
  verifyRegisterCaptcha?: (
    input: AddonRegisterCaptchaValidationInput,
  ) => AddonMaybePromise<
    void | boolean | string | AddonCaptchaValidationResult
  >
  verifyCreatePostCaptcha?: (
    input: AddonCreatePostCaptchaValidationInput,
  ) => AddonMaybePromise<
    void | boolean | string | AddonCaptchaValidationResult
  >
}
