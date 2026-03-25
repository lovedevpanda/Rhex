import { generatedPluginBundleRegistry, type GeneratedPluginBundleEntry } from "@/lib/plugin-bundle-registry.generated"
import { runtimePluginBundleRegistry, type RuntimePluginBundleEntry } from "@/lib/plugin-bundle-runtime"

import type { PluginApiHandlers, PluginPageComponent, PluginServerDefinition, SidebarPluginDefinition } from "@/lib/plugin-types"

export interface PluginBundleEntry {
  server: PluginServerDefinition
  web?: PluginPageComponent
  admin?: PluginPageComponent
  api?: PluginApiHandlers
  adminApi?: PluginApiHandlers
  sidebar?: SidebarPluginDefinition
}

function mergeEntry(generated?: GeneratedPluginBundleEntry, runtime?: RuntimePluginBundleEntry): PluginBundleEntry | undefined {
  if (!generated) {
    return undefined
  }

  return {
    server: generated.server,
    web: generated.web,
    admin: generated.admin,
    api: runtime?.api,
    adminApi: runtime?.adminApi,
    sidebar: runtime?.sidebar
      ? {
          ...runtime.sidebar,
          component: runtime.sidebar.component ?? generated.sidebarComponent,
        }
      : generated.sidebarComponent
        ? {
            slot: "home-right-middle",
            order: 40,
            component: generated.sidebarComponent,
          }
        : undefined,
  }
}

const keys = new Set<string>([
  ...Object.keys(generatedPluginBundleRegistry),
  ...Object.keys(runtimePluginBundleRegistry),
])

export const pluginBundleRegistry: Record<string, PluginBundleEntry> = {}

for (const key of keys) {
  const merged = mergeEntry(generatedPluginBundleRegistry[key], runtimePluginBundleRegistry[key])
  if (merged) {
    pluginBundleRegistry[key] = merged
  }
}
