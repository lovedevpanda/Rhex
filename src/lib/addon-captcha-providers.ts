import type {
  AddonCreatePostCaptchaPayload,
  AddonCreatePostCaptchaValidationInput,
  AddonCaptchaProviderRuntimeHooks,
  AddonCaptchaValidationResult,
  AddonLoginCaptchaValidationInput,
  AddonRegisterCaptchaValidationInput,
} from "@/addons-host/captcha-types"
import type { AddonAuthFields, AddonAuthRegisterPayload } from "@/addons-host/auth-types"
import type { AddonProviderRegistration } from "@/addons-host/types"
import { apiError } from "@/lib/api-route"
import {
  invokeAddonProviderRuntime,
  listAddonProviderRuntimeItems,
} from "@/lib/addon-provider-registry"

async function listAddonCaptchaProviders(request: Request) {
  return listAddonProviderRuntimeItems<AddonCaptchaProviderRuntimeHooks>("captcha", {
    request,
  })
}

function normalizeValidationResult(
  output: void | boolean | string | AddonCaptchaValidationResult,
) {
  if (typeof output === "undefined") {
    return {
      ok: true,
      message: "",
    }
  }

  if (typeof output === "boolean") {
    return {
      ok: output,
      message: "",
    }
  }

  if (typeof output === "string") {
    return {
      ok: false,
      message: output.trim(),
    }
  }

  return {
    ok: typeof output.ok === "boolean" ? output.ok : true,
    message: typeof output.message === "string" ? output.message.trim() : "",
  }
}

function assertValidationPassed(
  provider: AddonProviderRegistration,
  scopeLabel: string,
  output: void | boolean | string | AddonCaptchaValidationResult,
) {
  const normalized = normalizeValidationResult(output)
  if (normalized.ok) {
    return
  }

  apiError(
    400,
    normalized.message || `${provider.label} ${scopeLabel}验证码校验未通过`,
  )
}

export async function verifyLoginCaptchaWithAddonProviders(input: {
  request: Request
  username: string
  addonFields: AddonAuthFields
}) {
  const providers = await listAddonCaptchaProviders(input.request)

  for (const item of providers) {
    const output = await invokeAddonProviderRuntime(
      item,
      "verifyLoginCaptcha",
      () => ({
      addon: item.addon,
      provider: item.provider,
      context: item.context,
      request: input.request,
      addonFields: input.addonFields,
      username: input.username,
      } satisfies AddonLoginCaptchaValidationInput),
    )

    if (output === null) {
      continue
    }

    assertValidationPassed(item.provider, "登录", output)
  }
}

export async function verifyRegisterCaptchaWithAddonProviders(input: {
  request: Request
  payload: AddonAuthRegisterPayload
  registerIp: string | null
  addonFields: AddonAuthFields
}) {
  const providers = await listAddonCaptchaProviders(input.request)

  for (const item of providers) {
    const output = await invokeAddonProviderRuntime(
      item,
      "verifyRegisterCaptcha",
      () => ({
      addon: item.addon,
      provider: item.provider,
      context: item.context,
      request: input.request,
      addonFields: input.addonFields,
      payload: input.payload,
      registerIp: input.registerIp,
      } satisfies AddonRegisterCaptchaValidationInput),
    )

    if (output === null) {
      continue
    }

    assertValidationPassed(item.provider, "注册", output)
  }
}

export async function verifyCreatePostCaptchaWithAddonProviders(input: {
  request: Request
  payload: AddonCreatePostCaptchaPayload
  addonFields: AddonAuthFields
}) {
  const providers = await listAddonCaptchaProviders(input.request)

  for (const item of providers) {
    const output = await invokeAddonProviderRuntime(
      item,
      "verifyCreatePostCaptcha",
      () => ({
      addon: item.addon,
      provider: item.provider,
      context: item.context,
      request: input.request,
      addonFields: input.addonFields,
      payload: input.payload,
      } satisfies AddonCreatePostCaptchaValidationInput),
    )

    if (output === null) {
      continue
    }

    assertValidationPassed(item.provider, "发帖", output)
  }
}
