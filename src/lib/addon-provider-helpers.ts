import "server-only"

import {
  buildAddonExecutionContext,
  loadAddonsRegistry,
} from "@/addons-host/runtime/loader"
import type {
  AddonExecutionContextBase,
  AddonProviderRegistration,
  LoadedAddonRuntime,
} from "@/addons-host/types"

export interface LoadedAddonProviderBase {
  addon: LoadedAddonRuntime
  provider: AddonProviderRegistration
  context: AddonExecutionContextBase
  order: number
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function normalizeOptionalString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback
}

export function normalizeProviderOrder(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

export function normalizeProviderStringArray(value: unknown) {
  const items = Array.isArray(value) ? value : []

  return items
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
}

export function resolveAddonClientModuleUrl(
  addon: LoadedAddonRuntime,
  input: string,
) {
  const target = normalizeOptionalString(input)
  if (!target) {
    return ""
  }

  if (/^(https?:)?\/\//i.test(target) || target.startsWith("/")) {
    return target
  }

  return buildAddonExecutionContext(addon).asset(target)
}

export async function listLoadedAddonProvidersByKind(
  kind: string,
  input?: {
    request?: Request
  },
): Promise<LoadedAddonProviderBase[]> {
  const normalizedKind = normalizeOptionalString(kind)
  if (!normalizedKind) {
    return []
  }

  const registry = await loadAddonsRegistry()
  const requestUrl = input?.request ? new URL(input.request.url) : null
  const providers: LoadedAddonProviderBase[] = []

  for (const candidate of registry.providerCandidatesByKind.get(normalizedKind) ?? []) {
    providers.push({
      addon: candidate.addon,
      provider: candidate.provider,
      context: buildAddonExecutionContext(candidate.addon, input?.request
        ? {
            request: input.request,
            pathname: requestUrl?.pathname,
            searchParams: requestUrl?.searchParams,
          }
        : undefined),
      order: candidate.order,
    })
  }

  return providers
}
