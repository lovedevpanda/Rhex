

import type { PluginApiModule, PluginPageComponent, PluginServerDefinition, SidebarPluginComponent } from "@/lib/plugin-types"

export interface GeneratedPluginBundleEntry {
  server: PluginServerDefinition
  web?: PluginPageComponent
  admin?: PluginPageComponent
  sidebarComponent?: SidebarPluginComponent
  apiModule?: PluginApiModule
}

export const generatedPluginBundleRegistry: Record<string, GeneratedPluginBundleEntry> = {

}
