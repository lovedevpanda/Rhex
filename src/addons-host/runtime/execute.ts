import {
  buildAddonExecutionContext,
  loadAddonsRegistry,
  type IndexedAddonSurfaceCandidate,
} from "@/addons-host/runtime/loader"
import { runWithAddonExecutionScope } from "@/addons-host/runtime/execution-scope"
import { findAddonApiRoute, findAddonPageRoute } from "@/addons-host/runtime/routes"
import { createAddonLifecycleLog, upsertAddonRegistryRecord } from "@/db/addon-registry-queries"
import type {
  AddonApiResult,
  AddonApiScope,
  AddonHttpMethod,
  AddonPageRenderResult,
  AddonPageScope,
  AddonRenderResult,
  AddonSlotProps,
  AddonSurfaceProps,
  AddonSurfaceRegistration,
  AddonSlotKey,
  LoadedAddonRuntime,
} from "@/addons-host/types"

export interface ExecutedAddonSlotResult {
  addon: LoadedAddonRuntime
  key: string
  order: number
  result: AddonRenderResult
}

export interface ExecutedAddonSurfaceResult<
  TProps extends AddonSurfaceProps = AddonSurfaceProps,
> {
  addon: LoadedAddonRuntime
  registration: AddonSurfaceRegistration<TProps>
  priority: number
  result: AddonRenderResult
}

interface AddonRenderExecutionInput {
  request?: Request
  pathname?: string
  searchParams?: URLSearchParams
}

function resolveAddonSurfaceClientModuleUrl(addon: LoadedAddonRuntime, input?: string) {
  const target = typeof input === "string" ? input.trim() : ""
  if (!target) {
    return ""
  }

  if (/^(https?:)?\/\//i.test(target) || target.startsWith("/")) {
    return target
  }

  return buildAddonExecutionContext(addon).asset(target)
}

async function logSurfaceFailure(input: {
  addon: LoadedAddonRuntime
  surface: string
  key: string
  error: unknown
}) {
  try {
    await createAddonLifecycleLog({
      addonId: input.addon.manifest.id,
      action: "SURFACE_RENDER",
      status: "FAILED",
      message:
        input.error instanceof Error
          ? input.error.message
          : `addon surface "${input.surface}" failed`,
      metadataJson: {
        surface: input.surface,
        key: input.key,
      },
    })
  } catch (logError) {
    console.error(
      `[addons-host:surface:${input.surface}] failed to persist lifecycle log`,
      input.addon.manifest.id,
      input.key,
      logError,
    )
  }
}

async function logSlotFailure(input: {
  addon: LoadedAddonRuntime
  slot: AddonSlotKey
  key: string
  error: unknown
}) {
  try {
    await createAddonLifecycleLog({
      addonId: input.addon.manifest.id,
      action: "SLOT_RENDER",
      status: "FAILED",
      message:
        input.error instanceof Error
          ? input.error.message
          : `addon slot "${input.slot}" failed`,
      metadataJson: {
        slot: input.slot,
        key: input.key,
      },
    })
  } catch (logError) {
    console.error(
      `[addons-host:slot:${input.slot}] failed to persist lifecycle log`,
      input.addon.manifest.id,
      input.key,
      logError,
    )
  }
}

function parseOptionalIsoDate(value?: string | null) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function buildAddonRegistryState(addon: LoadedAddonRuntime, lastErrorMessage: string) {
  if (addon.state.uninstalledAt) {
    return "UNINSTALLED" as const
  }

  if (lastErrorMessage) {
    return "ERROR" as const
  }

  return addon.enabled ? "ENABLED" as const : "DISABLED" as const
}

async function persistAddonRenderFailure(addon: LoadedAddonRuntime, error: unknown) {
  const message = error instanceof Error
    ? error.message
    : `addon "${addon.manifest.id}" render failed`

  if (addon.state.lastErrorMessage === message && addon.state.lastErrorAt) {
    return
  }

  const failedAt = new Date()

  try {
    await upsertAddonRegistryRecord({
      addonId: addon.manifest.id,
      name: addon.manifest.name,
      version: addon.manifest.version,
      description: addon.manifest.description ?? null,
      sourceDir: addon.rootDir,
      state: buildAddonRegistryState(addon, message),
      enabled: addon.enabled,
      manifestJson: addon.manifest,
      permissionsJson: addon.manifest.permissions ?? [],
      installedAt: parseOptionalIsoDate(addon.state.installedAt),
      disabledAt: parseOptionalIsoDate(addon.state.disabledAt),
      uninstalledAt: parseOptionalIsoDate(addon.state.uninstalledAt),
      lastErrorAt: failedAt,
      lastErrorMessage: message,
    })
  } catch {
    // Ignore persistence failures so addon crashes remain isolated from the page request.
  }
}

async function collectAddonSurfaceCandidates<
  TProps extends AddonSurfaceProps = AddonSurfaceProps,
>(surface: string) {
  const registry = await loadAddonsRegistry()
  return (registry.surfaceCandidatesBySurface.get(surface) ??
    []) as Array<IndexedAddonSurfaceCandidate<TProps>>
}

export async function executeAddonSlot<
  TProps extends AddonSlotProps = AddonSlotProps,
>(
  slot: AddonSlotKey,
  props?: TProps,
  input?: AddonRenderExecutionInput,
) {
  const registry = await loadAddonsRegistry()
  const results: ExecutedAddonSlotResult[] = []

  for (const candidate of registry.slotCandidatesBySlot.get(slot) ?? []) {
    try {
      const result = await runWithAddonExecutionScope(candidate.addon, {
        action: `slot:${slot}:${candidate.registration.key}`,
        request: input?.request,
      }, async () => candidate.registration.render({
        ...buildAddonExecutionContext(candidate.addon, {
          request: input?.request,
          pathname: input?.pathname,
          searchParams: input?.searchParams,
        }),
        slot,
        props: (props ?? {}) as TProps,
      }))

      if (!result) {
        continue
      }

      results.push({
        addon: candidate.addon,
        key: candidate.registration.key,
        order: candidate.order,
        result,
      })
    } catch (error) {
      await logSlotFailure({
        addon: candidate.addon,
        slot,
        key: candidate.registration.key,
        error,
      })
      await persistAddonRenderFailure(candidate.addon, error)
    }
  }

  return results
}

export async function executeAddonSurface<
  TProps extends AddonSurfaceProps = AddonSurfaceProps,
>(
  surface: string,
  props: TProps,
  input?: AddonRenderExecutionInput,
) {
  const candidates = await collectAddonSurfaceCandidates<TProps>(surface)

  for (const candidate of candidates) {
    try {
      const result = candidate.registration.render
        ? await runWithAddonExecutionScope(candidate.addon, {
            action: `surface:${surface}:${candidate.registration.key}`,
            request: input?.request,
          }, async () => candidate.registration.render?.({
            ...buildAddonExecutionContext(candidate.addon, {
              request: input?.request,
              pathname: input?.pathname,
              searchParams: input?.searchParams,
            }),
            surface,
            props,
          }))
        : {
            clientModule: resolveAddonSurfaceClientModuleUrl(
              candidate.addon,
              candidate.registration.clientModule,
            ),
            clientProps: props,
          }

      if (!result) {
        continue
      }

      return {
        addon: candidate.addon,
        registration: candidate.registration,
        priority: candidate.priority,
        result,
      } satisfies ExecutedAddonSurfaceResult<TProps>
    } catch (error) {
      await logSurfaceFailure({
        addon: candidate.addon,
        surface,
        key: candidate.registration.key,
        error,
      })
      await persistAddonRenderFailure(candidate.addon, error)
    }
  }

  return null
}

export async function executeAddonSurfaceRender<
  TProps extends AddonSurfaceProps = AddonSurfaceProps,
>(
  surface: string,
  props: TProps,
  input?: AddonRenderExecutionInput,
) {
  const candidates = await collectAddonSurfaceCandidates<TProps>(surface)

  for (const candidate of candidates) {
    const hasClientModule = Boolean(candidate.registration.clientModule?.trim())

    if (!candidate.registration.render) {
      return null
    }

    try {
      const result = await runWithAddonExecutionScope(candidate.addon, {
        action: `surface:${surface}:${candidate.registration.key}`,
        request: input?.request,
      }, async () => candidate.registration.render?.({
        ...buildAddonExecutionContext(candidate.addon, {
          request: input?.request,
          pathname: input?.pathname,
          searchParams: input?.searchParams,
        }),
        surface,
        props,
      }))

      if (result) {
        return {
          addon: candidate.addon,
          registration: candidate.registration,
          priority: candidate.priority,
          result,
        } satisfies ExecutedAddonSurfaceResult<TProps>
      }

      if (hasClientModule) {
        return null
      }
    } catch (error) {
      await logSurfaceFailure({
        addon: candidate.addon,
        surface,
        key: candidate.registration.key,
        error,
      })
      await persistAddonRenderFailure(candidate.addon, error)

      if (hasClientModule) {
        return null
      }
    }
  }

  return null
}

export async function executeAddonPage(scope: AddonPageScope, addonId: string, routeSegments?: string[]) {
  const matched = await findAddonPageRoute(scope, addonId, routeSegments)
  if (!matched) {
    return null
  }

  const routePath = routeSegments?.filter(Boolean).join("/") ?? ""
  const result = await runWithAddonExecutionScope(matched.addon, {
    action: `page:${scope}:${matched.registration.key}`,
  }, async () => matched.registration.render({
    ...buildAddonExecutionContext(matched.addon),
    scope,
    routePath,
    routeSegments: routeSegments ?? [],
  }))

  if (!result) {
    return null
  }

  return {
    addon: matched.addon,
    registration: matched.registration,
    result,
  }
}

export async function executeAddonApi(
  scope: AddonApiScope,
  addonId: string,
  routeSegments: string[] | undefined,
  method: AddonHttpMethod,
  request: Request,
) {
  const matched = await findAddonApiRoute(scope, addonId, routeSegments, method)
  if (!matched) {
    return null
  }

  const routePath = routeSegments?.filter(Boolean).join("/") ?? ""
  const requestUrl = new URL(request.url)
  const result = await runWithAddonExecutionScope(matched.addon, {
    action: `api:${scope}:${matched.registration.key}`,
    request,
  }, async () => matched.registration.handle({
    ...buildAddonExecutionContext(matched.addon, {
      request,
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
    }),
    request,
    scope,
    routePath,
    routeSegments: matched.normalizedSegments,
    method,
  }))

  return {
    addon: matched.addon,
    registration: matched.registration,
    result,
  }
}

export function isAddonRedirectResult(result: AddonPageRenderResult): result is { redirectTo: string } {
  return typeof result === "object" && result !== null && "redirectTo" in result && typeof result.redirectTo === "string"
}

export function normalizeAddonApiResult(result: AddonApiResult) {
  if (result instanceof Response) {
    return result
  }

  const headers = new Headers(result.headers)
  const status = result.status ?? 200

  if (typeof result.text === "string") {
    headers.set("content-type", headers.get("content-type") ?? "text/plain; charset=utf-8")
    return new Response(result.text, { status, headers })
  }

  if (typeof result.html === "string") {
    headers.set("content-type", headers.get("content-type") ?? "text/html; charset=utf-8")
    return new Response(result.html, { status, headers })
  }

  headers.set("content-type", headers.get("content-type") ?? "application/json; charset=utf-8")
  return new Response(JSON.stringify(result.json ?? null), { status, headers })
}
