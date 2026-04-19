import "server-only"

import { buildAddonExecutionContext, loadAddonsRegistry } from "@/addons-host/runtime/loader"
import { runWithAddonExecutionScope } from "@/addons-host/runtime/execution-scope"
import { runHookPipeline } from "@/addons-host/runtime/internal/hook-pipeline"
import type {
  AddonActionHookName,
  AddonAsyncWaterfallHookName,
  AddonWaterfallHookName,
  LoadedAddonRuntime,
  LookupAddonActionHookPayload,
  LookupAddonAsyncWaterfallHookValue,
  LookupAddonWaterfallHookValue,
} from "@/addons-host/types"

/**
 * hooks.ts — addons Hook 三类执行入口（action / waterfall / asyncWaterfall）。
 *
 * 重构（Phase C）：for-try-catch-log-continue 的重复骨架已下沉至 internal/hook-pipeline.ts
 * 的泛型 runHookPipeline<T>；本文件只负责：
 *   1. 从 registry 拉取当前 hook 的候选 registrations
 *   2. 把候选包装成带 buildAddonExecutionContext + runWithAddonExecutionScope 的 run 闭包
 *   3. 在 pipeline.onSuccess 里做调用方专属的"结果收集 / 串值"语义
 *
 * 对外签名（executeAddonActionHook / executeAddonWaterfallHook / executeAddonAsyncWaterfallHook）
 * 与返回结构（ExecutedAddonActionHookResult / ExecutedAddonWaterfallHookResult）保持不变。
 */

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

  // 注意：这里刻意按 kind 分支，而非合并 source — 原因是
  // AddonWaterfallHookContext 是以 hook 名字面量为键的泛型；若保持 hook 类型为两者联合，
  // TypeScript 会把 context 的 hook 字段两侧 literal 做交集并收敛为 never，触发 TS2345。
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

export async function executeAddonActionHook<
  THook extends AddonActionHookName,
  TPayload = LookupAddonActionHookPayload<THook>,
>(
  hook: THook,
  payload: TPayload,
  input?: AddonHookExecutionInput,
) {
  const candidates = await buildActionHookCandidates(hook, input)
  const results: ExecutedAddonActionHookResult[] = []

  await runHookPipeline<ActionHookCandidate>({
    candidates,
    kind: "action",
    hook,
    throwOnError: input?.throwOnError,
    getAddon: (c) => c.addon,
    getKey: (c) => c.key,
    run: (c) => c.handle(payload),
    onSuccess: (c) => {
      results.push({
        addon: c.addon,
        key: c.key,
        hook,
        order: c.order,
      })
    },
  })

  return results
}

export async function executeAddonWaterfallHook<
  THook extends AddonWaterfallHookName,
  TValue = LookupAddonWaterfallHookValue<THook>,
>(
  hook: THook,
  initialValue: TValue,
  input?: AddonHookExecutionInput,
) {
  const candidates = await buildWaterfallHookCandidates<TValue>("waterfall", hook, input)
  const results: ExecutedAddonWaterfallHookResult<TValue>[] = []
  let currentValue = initialValue

  await runHookPipeline<WaterfallHookCandidate<TValue>>({
    candidates,
    kind: "waterfall",
    hook,
    throwOnError: input?.throwOnError,
    getAddon: (c) => c.addon,
    getKey: (c) => c.key,
    run: async (c) => {
      const nextValue = await c.transform(currentValue)
      if (typeof nextValue !== "undefined") {
        currentValue = nextValue
      }
    },
    onSuccess: (c) => {
      results.push({
        addon: c.addon,
        key: c.key,
        hook,
        order: c.order,
        value: currentValue,
      })
    },
  })

  return {
    value: currentValue,
    executions: results,
  }
}

export async function executeAddonAsyncWaterfallHook<
  THook extends AddonAsyncWaterfallHookName,
  TValue = LookupAddonAsyncWaterfallHookValue<THook>,
>(
  hook: THook,
  initialValue: TValue,
  input?: AddonHookExecutionInput,
) {
  const candidates = await buildWaterfallHookCandidates<TValue>("asyncWaterfall", hook, input)
  const results: ExecutedAddonWaterfallHookResult<TValue>[] = []
  let currentValue = initialValue

  await runHookPipeline<WaterfallHookCandidate<TValue>>({
    candidates,
    kind: "asyncWaterfall",
    hook,
    throwOnError: input?.throwOnError,
    getAddon: (c) => c.addon,
    getKey: (c) => c.key,
    run: async (c) => {
      const nextValue = await c.transform(currentValue)
      if (typeof nextValue !== "undefined") {
        currentValue = nextValue
      }
    },
    onSuccess: (c) => {
      results.push({
        addon: c.addon,
        key: c.key,
        hook,
        order: c.order,
        value: currentValue,
      })
    },
  })

  return {
    value: currentValue,
    executions: results,
  }
}
