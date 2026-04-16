import {
  buildAddonExecutionContext,
  findLoadedAddonById,
  loadAddonsRegistry,
} from "@/addons-host/runtime/loader"
import { normalizeMountedAddonPath } from "@/addons-host/runtime/fs"
import type {
  AddonApiRegistration,
  AddonHttpMethod,
  AddonPageRegistration,
  AddonPageScope,
  AddonApiScope,
} from "@/addons-host/types"

function normalizeRouteSegments(value?: string[]) {
  return (value ?? []).map((item) => item.trim()).filter(Boolean)
}

function buildRoutePathFromSegments(segments?: string[]) {
  return normalizeRouteSegments(segments).join("/")
}

export async function findAddonPageRoute(scope: AddonPageScope, addonId: string, routeSegments?: string[]) {
  const addon = await findLoadedAddonById(addonId)
  if (!addon || !addon.enabled || addon.loadError) {
    return null
  }

  const registry = await loadAddonsRegistry()
  const mountedPath = buildRoutePathFromSegments(routeSegments)
  const routesByAddonId = scope === "admin"
    ? registry.adminPageRoutesByAddonId
    : registry.publicPageRoutesByAddonId
  const registration = routesByAddonId.get(addonId)?.get(mountedPath) ?? null
  if (!registration) {
    return null
  }

  return {
    addon,
    registration,
    context: buildAddonExecutionContext(addon, {
      pathname: scope === "admin"
        ? addon.adminBaseUrl
        : addon.publicBaseUrl,
    }),
  }
}

export async function findAddonApiRoute(scope: AddonApiScope, addonId: string, routeSegments: string[] | undefined, method: AddonHttpMethod) {
  const addon = await findLoadedAddonById(addonId)
  if (!addon || !addon.enabled || addon.loadError) {
    return null
  }

  const normalizedSegments = normalizeRouteSegments(routeSegments)
  const registry = await loadAddonsRegistry()
  const mountedPath = buildRoutePathFromSegments(normalizedSegments)
  const routesByAddonId = scope === "admin"
    ? registry.adminApiRoutesByAddonId
    : registry.publicApiRoutesByAddonId
  const registration = routesByAddonId.get(addonId)?.get(mountedPath)?.get(method) ?? null

  if (!registration) {
    return null
  }

  return {
    addon,
    registration,
    normalizedSegments,
  }
}

export async function listAddonPublicPages() {
  const addons = await loadAddonsRegistry().then((registry) => registry.addons)

  return addons
    .filter((addon) => addon.enabled && !addon.loadError)
    .map((addon) => ({
      addon,
      pages: addon.publicPages,
    }))
    .filter((item) => item.pages.length > 0)
}

export async function listAddonAdminPages() {
  const addons = await loadAddonsRegistry().then((registry) => registry.addons)

  return addons
    .filter((addon) => addon.enabled)
    .map((addon) => ({
      addon,
      pages: addon.adminPages,
      apis: addon.adminApis,
      providers: addon.providers,
    }))
}

export function getAddonMountedPath(registration: AddonPageRegistration | AddonApiRegistration) {
  return normalizeMountedAddonPath(registration.path)
}
