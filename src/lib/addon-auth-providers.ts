import type {
  AddonAuthFields,
  AddonAuthLoginValidationInput,
  AddonAuthProviderRuntimeHooks,
  AddonAuthRegisterPayload,
  AddonAuthRegisterValidationInput,
  AddonAuthValidationResult,
} from "@/addons-host/auth-types"
import type { AddonProviderRegistration } from "@/addons-host/types"
import { apiError } from "@/lib/api-route"
import {
  invokeAddonProviderRuntime,
  listAddonProviderRuntimeItems,
} from "@/lib/addon-provider-registry"

async function listAddonAuthProviders(request: Request) {
  return listAddonProviderRuntimeItems<AddonAuthProviderRuntimeHooks>("auth", {
    request,
  })
}

function normalizeValidationResult(
  output: void | boolean | string | AddonAuthValidationResult,
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
  output: void | boolean | string | AddonAuthValidationResult,
) {
  const normalized = normalizeValidationResult(output)
  if (normalized.ok) {
    return
  }

  apiError(
    400,
    normalized.message || `${provider.label} ${scopeLabel}校验未通过`,
  )
}

export async function validateLoginWithAddonProviders(input: {
  request: Request
  username: string
  user: {
    id: number
    username: string
  }
  addonFields: AddonAuthFields
}) {
  const providers = await listAddonAuthProviders(input.request)

  for (const item of providers) {
    const output = await invokeAddonProviderRuntime(
      item,
      "validateLogin",
      () => ({
      addon: item.addon,
      provider: item.provider,
      context: item.context,
      request: input.request,
      addonFields: input.addonFields,
      username: input.username,
      user: input.user,
      } satisfies AddonAuthLoginValidationInput),
    )

    if (output === null) {
      continue
    }

    assertValidationPassed(item.provider, "登录", output)
  }
}

export async function validateRegisterWithAddonProviders(input: {
  request: Request
  payload: AddonAuthRegisterPayload
  registerIp: string | null
  addonFields: AddonAuthFields
}) {
  const providers = await listAddonAuthProviders(input.request)

  for (const item of providers) {
    const output = await invokeAddonProviderRuntime(
      item,
      "validateRegister",
      () => ({
      addon: item.addon,
      provider: item.provider,
      context: item.context,
      request: input.request,
      addonFields: input.addonFields,
      payload: input.payload,
      registerIp: input.registerIp,
      } satisfies AddonAuthRegisterValidationInput),
    )

    if (output === null) {
      continue
    }

    assertValidationPassed(item.provider, "注册", output)
  }
}
