import {
  isRecord,
  normalizeOptionalString,
} from "@/lib/addon-provider-helpers"
import {
  invokeAddonProviderRuntime,
  listAddonProviderRuntimeItems,
} from "@/lib/addon-provider-registry"

export interface AddonExternalAuthEntry {
  addonId: string
  label: string
  provider: string
  loginUrl: string | null
  registerUrl: string | null
  connectUrl: string | null
  description: string | null
  order: number
}

interface AddonExternalAuthProviderRuntimeHooks {
  listEntries?: (input: {
    addon: Awaited<ReturnType<typeof listAddonProviderRuntimeItems>>[number]["addon"]
    provider: Awaited<ReturnType<typeof listAddonProviderRuntimeItems>>[number]["provider"]
    context: Awaited<ReturnType<typeof listAddonProviderRuntimeItems>>[number]["context"]
  }) => unknown
}

function normalizeAddonExternalAuthEntry(
  value: unknown,
  input: {
    addonId: string
    fallbackLabel: string
    fallbackOrder: number
  },
): AddonExternalAuthEntry | null {
  if (!isRecord(value)) {
    return null
  }

  const provider = normalizeOptionalString(value.provider).toLowerCase()
  const label = normalizeOptionalString(value.label) || input.fallbackLabel
  const loginUrl = normalizeOptionalString(value.loginUrl) || null
  const registerUrl = normalizeOptionalString(value.registerUrl) || null
  const connectUrl = normalizeOptionalString(value.connectUrl) || null
  const description = normalizeOptionalString(value.description) || null
  const order =
    typeof value.order === "number" && Number.isFinite(value.order)
      ? value.order
      : input.fallbackOrder

  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(provider) || !label) {
    return null
  }

  return {
    addonId: input.addonId,
    label,
    provider,
    loginUrl,
    registerUrl,
    connectUrl,
    description,
    order,
  }
}

export async function listAddonExternalAuthEntries() {
  const providers = await listAddonProviderRuntimeItems<AddonExternalAuthProviderRuntimeHooks>("external-auth")
  const entries: AddonExternalAuthEntry[] = []

  for (const item of providers) {
    const data = isRecord(item.provider.data) ? item.provider.data : null
    const staticEntries = Array.isArray(data?.entries) ? data.entries : []
    let runtimeEntries: unknown = null

    try {
      runtimeEntries = await invokeAddonProviderRuntime(
        item,
        "listEntries",
        () => ({
          addon: item.addon,
          provider: item.provider,
          context: item.context,
        }),
      )
    } catch (error) {
      console.error(
        "[addon-external-auth-providers] failed to list addon external auth entries",
        item.provider.code,
        error,
      )
    }

    for (const candidate of [
      ...staticEntries,
      ...(Array.isArray(runtimeEntries) ? runtimeEntries : []),
    ]) {
      const normalized = normalizeAddonExternalAuthEntry(candidate, {
        addonId: item.addon.manifest.id,
        fallbackLabel: item.provider.label,
        fallbackOrder: item.order,
      })

      if (!normalized || normalized.provider === "github" || normalized.provider === "google") {
        continue
      }

      entries.push(normalized)
    }
  }

  return entries.sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order
    }

    const byLabel = left.label.localeCompare(right.label, "zh-CN")
    if (byLabel !== 0) {
      return byLabel
    }

    return left.provider.localeCompare(right.provider, "zh-CN")
  })
}
