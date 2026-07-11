import "server-only"

import { AsyncLocalStorage } from "node:async_hooks"

import type { LoadedAddonRuntime } from "@/addons-host/types"
import {
  ADDON_RUNTIME_LOG_DEDUPE_WINDOW_MS,
  createAddonLifecycleLog,
} from "@/db/addon-registry-queries"
import {
  ADDON_TRUST_BOUNDARY_MESSAGE,
  addonHasPermission,
} from "@/addons-host/runtime/permissions"

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

function shouldAllowNetworkRequest(scope: AddonExecutionScopeState) {
  // Do not make exceptions for localhost, same-origin, or relative paths.
  // Those targets are still privileged from a server process and the manifest
  // must explicitly request the host API capability before using global fetch.
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

    if (scope && !shouldAllowNetworkRequest(scope)) {
      const addonId = scope.addon.manifest.id
      const resolvedUrl = resolveFetchUrl(input)
      const message = `插件 "${addonId}" 未声明 "network:external"，已拒绝通过 globalThis.fetch 发起网络请求。${ADDON_TRUST_BOUNDARY_MESSAGE}`
      await createAddonLifecycleLog({
        addonId,
        action: "SDK_FETCH_DENIED",
        status: "FAILED",
        message,
        dedupeWindowMs: ADDON_RUNTIME_LOG_DEDUPE_WINDOW_MS,
        metadataJson: {
          action: scope.action,
          url: resolvedUrl?.toString() ?? null,
          requestOrigin: scope.requestOrigin,
          requiredPermission: "network:external",
          guardScope: "globalThis.fetch only",
          trustModel: "trusted-server-code",
        },
      })
      throw new Error(message)
    }

    return originalFetch(input, init)
  }) as typeof globalThis.fetch
}

/**
 * This scope protects the Rhex-provided global fetch path and preserves addon
 * attribution for logs. It is intentionally not an isolation boundary: code
 * imported into this Node.js process can use native modules or mutate globals.
 */
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
