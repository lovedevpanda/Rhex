import type {
  AddonExecutionContextBase,
  AddonMaybePromise,
  AddonProviderRegistration,
  LoadedAddonRuntime,
} from "@/addons-host/types"

export type AddonAuthFieldValue = string | string[]

export type AddonAuthFields = Record<string, AddonAuthFieldValue>

export interface AddonAuthValidationResult {
  ok?: boolean
  message?: string
}

export interface AddonAuthRegisterPayload {
  username: string
  nickname: string
  inviterUsername: string
  inviteCode: string
  email: string
  emailCode: string
  phone: string
  phoneCode: string
  gender: string
}

interface AddonAuthProviderRuntimeBaseInput {
  addon: LoadedAddonRuntime
  provider: AddonProviderRegistration
  context: AddonExecutionContextBase
  request: Request
  addonFields: AddonAuthFields
}

export interface AddonAuthLoginValidationInput
  extends AddonAuthProviderRuntimeBaseInput {
  username: string
  user: {
    id: number
    username: string
  }
}

export interface AddonAuthRegisterValidationInput
  extends AddonAuthProviderRuntimeBaseInput {
  payload: AddonAuthRegisterPayload
  registerIp: string | null
}

export interface AddonAuthProviderRuntimeHooks {
  validateLogin?: (
    input: AddonAuthLoginValidationInput,
  ) => AddonMaybePromise<void | boolean | string | AddonAuthValidationResult>
  validateRegister?: (
    input: AddonAuthRegisterValidationInput,
  ) => AddonMaybePromise<void | boolean | string | AddonAuthValidationResult>
}
