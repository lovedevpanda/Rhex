import type { AddonManifest } from "@/addons-host/types"

export function normalizeAddonManifest(input: unknown): AddonManifest {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("addon manifest must be an object")
  }

  const record = input as Record<string, unknown>
  const id = typeof record.id === "string" ? record.id.trim() : ""
  const name = typeof record.name === "string" ? record.name.trim() : ""
  const version = typeof record.version === "string" ? record.version.trim() : ""

  if (!id) {
    throw new Error("addon manifest missing id")
  }
  if (!name) {
    throw new Error("addon manifest missing name")
  }
  if (!version) {
    throw new Error("addon manifest missing version")
  }

  return {
    id,
    name,
    version,
    description: typeof record.description === "string" ? record.description.trim() : undefined,
    author: typeof record.author === "string" ? record.author.trim() : undefined,
    homepage: typeof record.homepage === "string" ? record.homepage.trim() : undefined,
    enabled: typeof record.enabled === "boolean" ? record.enabled : undefined,
    engines: record.engines && typeof record.engines === "object" && !Array.isArray(record.engines)
      ? { core: typeof (record.engines as Record<string, unknown>).core === "string" ? String((record.engines as Record<string, unknown>).core).trim() : undefined }
      : undefined,
    entry: record.entry && typeof record.entry === "object" && !Array.isArray(record.entry)
      ? { server: typeof (record.entry as Record<string, unknown>).server === "string" ? String((record.entry as Record<string, unknown>).server).trim() : undefined }
      : undefined,
    permissions: Array.isArray(record.permissions) ? record.permissions.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : undefined,
    provides: record.provides && typeof record.provides === "object" && !Array.isArray(record.provides)
      ? {
          slots: Array.isArray((record.provides as Record<string, unknown>).slots)
            ? ((record.provides as Record<string, unknown>).slots as unknown[]).filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            : undefined,
          surfaces: Array.isArray((record.provides as Record<string, unknown>).surfaces)
            ? ((record.provides as Record<string, unknown>).surfaces as unknown[]).filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            : undefined,
          pages: Array.isArray((record.provides as Record<string, unknown>).pages)
            ? ((record.provides as Record<string, unknown>).pages as unknown[]).filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            : undefined,
          adminPages: Array.isArray((record.provides as Record<string, unknown>).adminPages)
            ? ((record.provides as Record<string, unknown>).adminPages as unknown[]).filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            : undefined,
          publicApis: Array.isArray((record.provides as Record<string, unknown>).publicApis)
            ? ((record.provides as Record<string, unknown>).publicApis as unknown[]).filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            : undefined,
          adminApis: Array.isArray((record.provides as Record<string, unknown>).adminApis)
            ? ((record.provides as Record<string, unknown>).adminApis as unknown[]).filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            : undefined,
          providers: Array.isArray((record.provides as Record<string, unknown>).providers)
            ? ((record.provides as Record<string, unknown>).providers as unknown[]).filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            : undefined,
        }
      : undefined,
    dependencies: record.dependencies && typeof record.dependencies === "object" && !Array.isArray(record.dependencies)
      ? {
          addons: Array.isArray((record.dependencies as Record<string, unknown>).addons)
            ? ((record.dependencies as Record<string, unknown>).addons as unknown[]).filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            : undefined,
          conflicts: Array.isArray((record.dependencies as Record<string, unknown>).conflicts)
            ? ((record.dependencies as Record<string, unknown>).conflicts as unknown[]).filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            : undefined,
        }
      : undefined,
    install: record.install && typeof record.install === "object" && !Array.isArray(record.install)
      ? {
          requiresRestart: typeof (record.install as Record<string, unknown>).requiresRestart === "boolean"
            ? Boolean((record.install as Record<string, unknown>).requiresRestart)
            : undefined,
        }
      : undefined,
  }
}
