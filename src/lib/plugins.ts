import { activatePlugin, disablePlugin, getPluginStateRecord, listPluginStateRecords, uninstallPluginWithLifecycle, updatePluginConfigState } from "@/lib/plugin-lifecycle"
import type { PluginInstallRecord } from "@/lib/plugin-types"

export async function listPluginInstallations() {
  return listPluginStateRecords()
}

export async function installPlugin(pluginId: string) {
  return activatePlugin(pluginId)
}

export async function uninstallPlugin(pluginId: string, options: { mode?: "clean-db" | "delete-files" } = {}) {
  return uninstallPluginWithLifecycle(pluginId, options)
}

export async function disableInstalledPlugin(pluginId: string, reason?: string) {
  return disablePlugin(pluginId, reason)
}

export async function updatePluginConfig(pluginId: string, input: Record<string, unknown>) {
  return updatePluginConfigState(pluginId, input)
}

export async function getPluginInstallation(pluginId: string) {
  return getPluginStateRecord(pluginId)
}

export function buildPluginPointReason(pluginName: string, action: "ticket" | "reward", pointName: string, amount: number) {
  return action === "ticket"
    ? `[plugin:${pluginName}] 支付门票 ${amount}${pointName}`
    : `[plugin:${pluginName}] 获胜奖励 ${amount}${pointName}`
}

export type { PluginInstallRecord }
