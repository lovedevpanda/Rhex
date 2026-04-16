import { findLoadedAddonById, loadAddonsRuntime } from "../src/addons-host/runtime/loader"
import { runAddonManagementAction } from "../src/addons-host/management"

async function listAddons() {
  const addons = await loadAddonsRuntime()

  if (addons.length === 0) {
    console.log("No addons found in ./addons")
    return
  }

  console.table(
    addons.map((addon) => ({
      id: addon.manifest.id,
      name: addon.manifest.name,
      version: addon.manifest.version,
      enabled: addon.enabled,
      loadError: addon.loadError ?? "",
      slots: addon.slots.length,
      surfaces: addon.surfaces.length,
      publicPages: addon.publicPages.length,
      adminPages: addon.adminPages.length,
      publicApis: addon.publicApis.length,
      adminApis: addon.adminApis.length,
      providers: addon.providers.length,
    })),
  )
}

async function printStatus(addonId: string) {
  const addon = await findLoadedAddonById(addonId)

  if (!addon) {
    console.error(`Addon not found: ${addonId}`)
    process.exitCode = 1
    return
  }

  console.log(JSON.stringify({
    id: addon.manifest.id,
    name: addon.manifest.name,
    version: addon.manifest.version,
    enabled: addon.enabled,
    loadError: addon.loadError,
    warnings: addon.warnings,
    slots: addon.slots.map((item) => ({ key: item.key, slot: item.slot, order: item.order ?? 0 })),
    surfaces: addon.surfaces.map((item) => ({ key: item.key, surface: item.surface, priority: item.priority ?? 0 })),
    publicPages: addon.publicPages.map((item) => ({ key: item.key, path: item.path ?? "" })),
    adminPages: addon.adminPages.map((item) => ({ key: item.key, path: item.path ?? "" })),
    publicApis: addon.publicApis.map((item) => ({ key: item.key, path: item.path ?? "", methods: item.methods ?? ["GET"] })),
    adminApis: addon.adminApis.map((item) => ({ key: item.key, path: item.path ?? "", methods: item.methods ?? ["GET"] })),
    providers: addon.providers,
  }, null, 2))
}

async function setAddonEnabled(addonId: string, enabled: boolean) {
  const result = await runAddonManagementAction(enabled ? "enable" : "disable", addonId)
  console.log(result.message)
}

async function syncAddons() {
  const result = await runAddonManagementAction("sync")
  console.log(result.message)
}

async function clearAddonsCache() {
  const result = await runAddonManagementAction("clear-cache")
  console.log(result.message)
}

async function removeAddon(addonId: string) {
  const result = await runAddonManagementAction("remove", addonId)
  console.log(result.message)
}

async function main() {
  const [, , command = "list", addonId] = process.argv

  switch (command) {
    case "list":
      await listAddons()
      break
    case "status":
      if (!addonId) {
        throw new Error("Usage: tsx scripts/addons.ts status <addonId>")
      }
      await printStatus(addonId)
      break
    case "sync":
      await syncAddons()
      break
    case "clear-cache":
      await clearAddonsCache()
      break
    case "enable":
      if (!addonId) {
        throw new Error("Usage: tsx scripts/addons.ts enable <addonId>")
      }
      await setAddonEnabled(addonId, true)
      break
    case "disable":
      if (!addonId) {
        throw new Error("Usage: tsx scripts/addons.ts disable <addonId>")
      }
      await setAddonEnabled(addonId, false)
      break
    case "remove":
      if (!addonId) {
        throw new Error("Usage: tsx scripts/addons.ts remove <addonId>")
      }
      await removeAddon(addonId)
      break
    default:
      throw new Error(`Unknown addons command: ${command}`)
  }
}

main().catch((error) => {
  console.error("[addons] command failed", error)
  process.exitCode = 1
})
