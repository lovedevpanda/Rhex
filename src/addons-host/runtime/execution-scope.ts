import "server-only"

import { AsyncLocalStorage } from "node:async_hooks"

import type { LoadedAddonRuntime } from "@/addons-host/types"
import { createAddonLifecycleLog } from "@/db/addon-registry-queries"
import { addonHasPermission } from "@/addons-host/runtime/permissions"

interface AddonExecutionScopeState {
  addon: LoadedAddonRuntime
  action: string
  permissions: ReadonlySet<string>
  requestOrigin: string | null
}

const addonExecutionScopeStorage = new AsyncLocalStorage<AddonExecutionScopeState>()
const originalFetch = globalThis.fetch.bind(globalThis)
let addonFetchGuardInstalled = false

function normalizeRequestOrigin(request?: Request) {
  if (!request) {
    return null
  }

  try {
    return new URL(request.url).origin
  } catch {
    return null
  }
}

function resolveFetchUrl(input: RequestInfo | URL) {
  if (input instanceof URL) {
    return input
  }

  if (typeof input === "string") {
    try {
      return new URL(input)
    } catch {
      return null
    }
  }

  if ("url" in input && typeof input.url === "string") {
    try {
      return new URL(input.url)
    } catch {
      return null
    }
  }

  return null
}

function isRelativeRequest(input: RequestInfo | URL) {
  return typeof input === "string" && !/^[a-z][a-z0-9+.-]*:/i.test(input)
}

function shouldAllowNetworkRequest(
  scope: AddonExecutionScopeState,
  input: RequestInfo | URL,
) {
  if (isRelativeRequest(input)) {
    return true
  }

  const resolvedUrl = resolveFetchUrl(input)
  if (!resolvedUrl) {
    return true
  }

  if (
    resolvedUrl.protocol !== "http:"
    && resolvedUrl.protocol !== "https:"
  ) {
    return true
  }

  if (
    scope.requestOrigin
    && resolvedUrl.origin === scope.requestOrigin
  ) {
    return true
  }

  if (
    resolvedUrl.hostname === "localhost"
    || resolvedUrl.hostname === "127.0.0.1"
    || resolvedUrl.hostname === "::1"
  ) {
    return true
  }

  return addonHasPermission(scope.permissions, "network:external")
}

export function installAddonFetchGuard() {
  if (addonFetchGuardInstalled) {
    return
  }

  addonFetchGuardInstalled = true

  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const scope = addonExecutionScopeStorage.getStore()

    if (
      scope
      && !shouldAllowNetworkRequest(scope, input)
    ) {
      const addonId = scope.addon.manifest.id
      const resolvedUrl = resolveFetchUrl(input)
      await createAddonLifecycleLog({
        addonId,
        action: "NETWORK_DENIED",
        status: "FAILED",
        message: `addon "${addonId}" is not allowed to access external network resources`,
        metadataJson: {
          action: scope.action,
          url: resolvedUrl?.toString() ?? null,
        },
      })
      throw new Error(
        `addon "${addonId}" is not allowed to access external network resources`,
      )
    }

    return originalFetch(input, init)
  }) as typeof globalThis.fetch
}

export function runWithAddonExecutionScope<T>(
  addon: LoadedAddonRuntime,
  input: {
    action: string
    request?: Request
  },
  task: () => Promise<T>,
) {
  installAddonFetchGuard()

  return addonExecutionScopeStorage.run({
    addon,
    action: input.action,
    permissions: addon.permissionSet,
    requestOrigin: normalizeRequestOrigin(input.request),
  }, task)
}
