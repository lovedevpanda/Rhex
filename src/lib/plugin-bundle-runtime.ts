import { generatedPluginBundleRegistry, type GeneratedPluginBundleEntry } from "@/lib/plugin-bundle-registry.generated"

import type { PluginApiHandlers, SidebarPluginDefinition } from "@/lib/plugin-types"

export interface RuntimePluginBundleEntry {
  api?: PluginApiHandlers
  adminApi?: PluginApiHandlers
  sidebar?: SidebarPluginDefinition
}

function buildRuntimeEntry(generated: GeneratedPluginBundleEntry): RuntimePluginBundleEntry {
  const apiModule = generated.apiModule
  const api: PluginApiHandlers | undefined = apiModule && (apiModule.handleGet || apiModule.handlePost)
    ? {
        GET: apiModule.handleGet,
        POST: apiModule.handlePost,
      }
    : undefined

  const adminApi: PluginApiHandlers | undefined = apiModule && (apiModule.handleAdminGet || apiModule.handleAdminPost)
    ? {
        GET: apiModule.handleAdminGet,
        POST: apiModule.handleAdminPost,
      }
    : undefined

  const sidebar = generated.sidebarComponent || apiModule?.resolveSidebarData
    ? {
        slot: "home-right-middle" as const,
        order: 40,
        component: undefined,
        resolveData: apiModule?.resolveSidebarData,
      }
    : undefined

  return {
    api,
    adminApi,
    sidebar,
  }
}

export const runtimePluginBundleRegistry: Record<string, RuntimePluginBundleEntry> = Object.fromEntries(
  Object.entries(generatedPluginBundleRegistry).map(([key, entry]) => [key, buildRuntimeEntry(entry)]),
)
