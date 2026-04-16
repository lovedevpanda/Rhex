import "server-only"

import { buildAddonExecutionContext, loadAddonsRegistry } from "@/addons-host/runtime/loader"
import { runWithAddonExecutionScope } from "@/addons-host/runtime/execution-scope"
import { createAddonLifecycleLog } from "@/db/addon-registry-queries"
import type {
  AddonActionHookName,
  AddonAsyncWaterfallHookName,
  AddonWaterfallHookName,
  LoadedAddonRuntime,
} from "@/addons-host/types"

interface AddonHookExecutionInput {
  request?: Request
  pathname?: string
  searchParams?: URLSearchParams
  throwOnError?: boolean
}

interface ActionHookCandidate {
  addon: LoadedAddonRuntime
  key: string
  hook: AddonActionHookName
  order: number
  handle: (payload: unknown) => Promise<void>
}

interface WaterfallHookCandidate<TValue> {
  addon: LoadedAddonRuntime
  key: string
  hook: AddonWaterfallHookName | AddonAsyncWaterfallHookName
  order: number
  transform: (value: TValue) => Promise<TValue | undefined>
}

export interface ExecutedAddonActionHookResult {
  addon: LoadedAddonRuntime
  key: string
  hook: AddonActionHookName
  order: number
}

export interface ExecutedAddonWaterfallHookResult<TValue> {
  addon: LoadedAddonRuntime
  key: string
  hook: AddonWaterfallHookName | AddonAsyncWaterfallHookName
  order: number
  value: TValue
}

async function logHookFailure(input: {
  addon: LoadedAddonRuntime
  kind: "action" | "waterfall" | "asyncWaterfall"
  hook: string
  key: string
  error: unknown
}) {
  await createAddonLifecycleLog({
    addonId: input.addon.manifest.id,
    action: `HOOK_${input.kind.toUpperCase()}`,
    status: "FAILED",
    message:
      input.error instanceof Error
        ? input.error.message
        : `addon hook "${input.hook}" failed`,
    metadataJson: {
      kind: input.kind,
      hook: input.hook,
      key: input.key,
    },
  })
}

async function buildActionHookCandidates(
  hook: AddonActionHookName,
  input?: AddonHookExecutionInput,
) {
  const registry = await loadAddonsRegistry()
  const candidates: ActionHookCandidate[] = []

  for (const candidate of registry.actionHookCandidatesByHook.get(hook) ?? []) {
    const { addon, registration } = candidate

    candidates.push({
      addon,
      key: registration.key,
      hook: registration.hook,
      order: candidate.order,
      handle: async (payload: unknown) => {
        const context = {
          ...buildAddonExecutionContext(addon, {
            request: input?.request,
            pathname: input?.pathname,
            searchParams: input?.searchParams,
          }),
          hook: registration.hook,
          payload,
        }

        await runWithAddonExecutionScope(addon, {
          action: `hook:action:${registration.hook}:${registration.key}`,
          request: input?.request,
        }, () => Promise.resolve(registration.handle(context)))
      },
    })
  }

  return candidates
}

async function buildWaterfallHookCandidates<TValue>(
  kind: "waterfall" | "asyncWaterfall",
  hook: AddonWaterfallHookName | AddonAsyncWaterfallHookName,
  input?: AddonHookExecutionInput,
) {
  const candidates: WaterfallHookCandidate<TValue>[] = []
  const registry = await loadAddonsRegistry()

  if (kind === "waterfall") {
    for (const candidate of registry.waterfallHookCandidatesByHook.get(hook) ?? []) {
      const { addon, registration } = candidate
      candidates.push({
        addon,
        key: registration.key,
        hook: registration.hook,
        order: candidate.order,
        transform: async (value: TValue) => {
          const context = {
            ...buildAddonExecutionContext(addon, {
              request: input?.request,
              pathname: input?.pathname,
              searchParams: input?.searchParams,
            }),
            hook: registration.hook,
            value,
          }

          return runWithAddonExecutionScope(addon, {
            action: `hook:${kind}:${registration.hook}:${registration.key}`,
            request: input?.request,
          }, () => Promise.resolve(registration.transform(context) as TValue | undefined))
        },
      })
    }

    return candidates
  }

  for (const candidate of registry.asyncWaterfallHookCandidatesByHook.get(hook) ?? []) {
    const { addon, registration } = candidate
    candidates.push({
      addon,
      key: registration.key,
      hook: registration.hook,
      order: candidate.order,
      transform: async (value: TValue) => {
        const context = {
          ...buildAddonExecutionContext(addon, {
            request: input?.request,
            pathname: input?.pathname,
            searchParams: input?.searchParams,
          }),
          hook: registration.hook,
          value,
        }

        return runWithAddonExecutionScope(addon, {
          action: `hook:${kind}:${registration.hook}:${registration.key}`,
          request: input?.request,
        }, () => Promise.resolve(registration.transform(context) as TValue | undefined))
      },
    })
  }

  return candidates
}

export async function executeAddonActionHook<TPayload = unknown>(
  hook: AddonActionHookName,
  payload: TPayload,
  input?: AddonHookExecutionInput,
) {
  const candidates = await buildActionHookCandidates(hook, input)
  const results: ExecutedAddonActionHookResult[] = []

  for (const candidate of candidates) {
    try {
      await candidate.handle(payload)
    } catch (error) {
      await logHookFailure({
        addon: candidate.addon,
        kind: "action",
        hook,
        key: candidate.key,
        error,
      })

      if (input?.throwOnError) {
        throw error
      }

      console.error(
        `[addons-host:hook:action:${hook}] handler failed`,
        candidate.addon.manifest.id,
        candidate.key,
        error,
      )
      continue
    }

    results.push({
      addon: candidate.addon,
      key: candidate.key,
      hook,
      order: candidate.order,
    })
  }

  return results
}

export async function executeAddonWaterfallHook<TValue>(
  hook: AddonWaterfallHookName,
  initialValue: TValue,
  input?: AddonHookExecutionInput,
) {
  const candidates = await buildWaterfallHookCandidates<TValue>("waterfall", hook, input)
  const results: ExecutedAddonWaterfallHookResult<TValue>[] = []
  let currentValue = initialValue

  for (const candidate of candidates) {
    try {
      const nextValue = await candidate.transform(currentValue)
      if (typeof nextValue !== "undefined") {
        currentValue = nextValue
      }
    } catch (error) {
      await logHookFailure({
        addon: candidate.addon,
        kind: "waterfall",
        hook,
        key: candidate.key,
        error,
      })

      if (input?.throwOnError) {
        throw error
      }

      console.error(
        `[addons-host:hook:waterfall:${hook}] transform failed`,
        candidate.addon.manifest.id,
        candidate.key,
        error,
      )
      continue
    }

    results.push({
      addon: candidate.addon,
      key: candidate.key,
      hook,
      order: candidate.order,
      value: currentValue,
    })
  }

  return {
    value: currentValue,
    executions: results,
  }
}

export async function executeAddonAsyncWaterfallHook<TValue>(
  hook: AddonAsyncWaterfallHookName,
  initialValue: TValue,
  input?: AddonHookExecutionInput,
) {
  const candidates = await buildWaterfallHookCandidates<TValue>("asyncWaterfall", hook, input)
  const results: ExecutedAddonWaterfallHookResult<TValue>[] = []
  let currentValue = initialValue

  for (const candidate of candidates) {
    try {
      const nextValue = await candidate.transform(currentValue)
      if (typeof nextValue !== "undefined") {
        currentValue = nextValue
      }
    } catch (error) {
      await logHookFailure({
        addon: candidate.addon,
        kind: "asyncWaterfall",
        hook,
        key: candidate.key,
        error,
      })

      if (input?.throwOnError) {
        throw error
      }

      console.error(
        `[addons-host:hook:asyncWaterfall:${hook}] transform failed`,
        candidate.addon.manifest.id,
        candidate.key,
        error,
      )
      continue
    }

    results.push({
      addon: candidate.addon,
      key: candidate.key,
      hook,
      order: candidate.order,
      value: currentValue,
    })
  }

  return {
    value: currentValue,
    executions: results,
  }
}
