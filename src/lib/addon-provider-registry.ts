import "server-only"

import { runWithAddonExecutionScope } from "@/addons-host/runtime/execution-scope"
import type { AddonProviderRegistration } from "@/addons-host/types"
import {
  isRecord,
  listLoadedAddonProvidersByKind,
} from "@/lib/addon-provider-helpers"

type LoadedAddonProviderBase =
  Awaited<ReturnType<typeof listLoadedAddonProvidersByKind>>[number]

export interface LoadedAddonProviderRuntimeItem<
  TRuntime = unknown,
> extends LoadedAddonProviderBase {
  data: Record<string, unknown> | null
  runtime: TRuntime | null
}

export function readAddonProviderRuntimeHooks<
  TRuntime,
>(
  providerData: unknown,
) {
  if (!isRecord(providerData) || !isRecord(providerData.runtime)) {
    return null
  }

  return providerData.runtime as TRuntime
}

export async function listAddonProviderRuntimeItems<
  TRuntime,
>(
  kind: string,
  input?: {
    request?: Request
  },
) {
  const providers = await listLoadedAddonProvidersByKind(kind, input)

  return providers.map((item) => {
    const data = isRecord(item.provider.data) ? item.provider.data : null

    return {
      ...item,
      data,
      runtime: readAddonProviderRuntimeHooks<TRuntime>(data),
    } satisfies LoadedAddonProviderRuntimeItem<TRuntime>
  })
}

export async function invokeAddonProviderRuntime<
  TRuntime,
  TMethod extends string,
>(
  item: LoadedAddonProviderRuntimeItem<TRuntime>,
  methodName: TMethod,
  inputFactory: () => unknown,
) {
  const runtimeRecord = item.runtime as Record<string, unknown> | null
  const method = runtimeRecord?.[methodName]

  if (typeof method !== "function") {
    return null
  }

  return runWithAddonExecutionScope(item.addon, {
    action: `provider:${item.provider.kind}:${item.provider.code}:${methodName}`,
    request: item.context.request,
  }, async () => (method as (...args: unknown[]) => unknown)(inputFactory()))
}

export function compareLoadedAddonProviderRuntimeItems(
  left: Pick<LoadedAddonProviderRuntimeItem, "order" | "provider">,
  right: Pick<LoadedAddonProviderRuntimeItem, "order" | "provider">,
) {
  if (left.order !== right.order) {
    return left.order - right.order
  }

  const byLabel = left.provider.label.localeCompare(
    right.provider.label,
    "zh-CN",
  )
  if (byLabel !== 0) {
    return byLabel
  }

  return left.provider.code.localeCompare(right.provider.code, "zh-CN")
}

export function sortLoadedAddonProviderRegistrations<
  TProvider extends Pick<AddonProviderRegistration, "label" | "code"> & {
    order?: number | null
  },
>(
  providers: TProvider[],
) {
  return [...providers].sort((left, right) => {
    const leftOrder =
      typeof left.order === "number" && Number.isFinite(left.order)
        ? left.order
        : 0
    const rightOrder =
      typeof right.order === "number" && Number.isFinite(right.order)
        ? right.order
        : 0

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    const byLabel = left.label.localeCompare(right.label, "zh-CN")
    if (byLabel !== 0) {
      return byLabel
    }

    return left.code.localeCompare(right.code, "zh-CN")
  })
}
