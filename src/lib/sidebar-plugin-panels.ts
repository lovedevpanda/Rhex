import type { ComponentType } from "react"

import { pluginBundleRegistry } from "@/lib/plugin-bundle-registry"
import { listPluginInstallations } from "@/lib/plugins"
import { loadPluginPage } from "@/lib/plugin-loader"
import type { SidebarPluginSlot } from "@/lib/plugin-types"

export interface SidebarPluginPanelItem {
  pluginId: string
  slot: SidebarPluginSlot
  order: number
  component: ComponentType<{ pluginId: string; config: Record<string, boolean | number | string>; panelData: unknown }>
  config: Record<string, boolean | number | string>
  panelData: unknown
}

export async function getSidebarPluginPanels(slot: SidebarPluginSlot): Promise<SidebarPluginPanelItem[]> {
  const installed = await listPluginInstallations()
  const enabledPlugins = installed.filter((item) => item.enabled)

  const panels = await Promise.all(enabledPlugins.map(async (plugin): Promise<SidebarPluginPanelItem | null> => {
    const bundle = pluginBundleRegistry[plugin.pluginId] ?? pluginBundleRegistry[plugin.slug]
    const sidebar = bundle?.sidebar
    if (!sidebar) {
      return null
    }

    const resolvedSlot = typeof plugin.config.sidebarSlot === "string" ? plugin.config.sidebarSlot : sidebar.slot
    const resolvedOrder = Number(plugin.config.sidebarOrder ?? sidebar.order) || sidebar.order
    if (resolvedSlot !== slot) {
      return null
    }

    const component = sidebar.component ?? (await loadPluginPage(plugin.pluginId, "web"))?.component



    if (!component) {
      return null
    }



    const panelData = await sidebar.resolveData?.({ pluginId: plugin.pluginId, config: plugin.config })
    if (!panelData) {
      return null
    }

    return {
      pluginId: plugin.pluginId,
      slot: resolvedSlot as SidebarPluginSlot,
      order: Math.max(0, resolvedOrder),

      component: component as ComponentType<{ pluginId: string; config: Record<string, boolean | number | string>; panelData: unknown }>,

      config: plugin.config,
      panelData,
    }
  }))

  return panels.filter((item): item is SidebarPluginPanelItem => item !== null).sort((left, right) => left.order - right.order)
}

export async function getHomeSidebarPluginPanels() {
  const [top, middle, bottom] = await Promise.all([
    getSidebarPluginPanels("home-right-top"),
    getSidebarPluginPanels("home-right-middle"),
    getSidebarPluginPanels("home-right-bottom"),
  ])

  const result = {
    top,
    middle,
    bottom,
  }



  return result
}




