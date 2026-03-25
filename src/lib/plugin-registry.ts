import { discoverPlugins, type DiscoveredPlugin } from "@/lib/plugin-loader"

export async function getPluginRegistry(): Promise<DiscoveredPlugin[]> {
  return discoverPlugins()
}
