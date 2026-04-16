import type {
  AddonEditorProviderDescriptor,
  AddonEditorProviderRuntimeHooks,
  AddonEditorToolbarItemDescriptor,
  AddonEditorToolbarItemRegistration,
  AddonEditorTarget,
} from "@/addons-host/editor-types"
import {
  DEFAULT_ADDON_EDITOR_TARGETS,
  ADDON_EDITOR_TARGETS,
} from "@/addons-host/editor-types"
import {
  isRecord,
  normalizeOptionalString,
  normalizeProviderOrder,
  normalizeProviderStringArray,
  resolveAddonClientModuleUrl,
} from "@/lib/addon-provider-helpers"
import {
  invokeAddonProviderRuntime,
  listAddonProviderRuntimeItems,
} from "@/lib/addon-provider-registry"

function isAddonEditorTarget(value: string): value is AddonEditorTarget {
  return ADDON_EDITOR_TARGETS.includes(value as AddonEditorTarget)
}

function normalizeAddonEditorTargets(
  value: unknown,
  fallback = DEFAULT_ADDON_EDITOR_TARGETS,
) {
  const targets = normalizeProviderStringArray(value)
    .map((item) => item.toLowerCase())
    .filter(isAddonEditorTarget)

  return targets.length > 0 ? targets : [...fallback]
}

function normalizeAddonEditorToolbarItemRegistrations(
  value: unknown,
  fallback = DEFAULT_ADDON_EDITOR_TARGETS,
) {
  const items = Array.isArray(value) ? value : []

  return items
    .map((item) => {
      if (!isRecord(item)) {
        return null
      }

      const key = normalizeOptionalString(item.key)
      const clientModule = normalizeOptionalString(
        item.clientModuleUrl ?? item.clientModule,
      )

      if (!key || !clientModule) {
        return null
      }

      const supports = normalizeAddonEditorTargets(
        item.supports ?? item.contexts,
        fallback,
      )

      return {
        key,
        clientModule,
        supports,
        order: normalizeProviderOrder(item.order),
        label: normalizeOptionalString(item.label) || key,
        title: normalizeOptionalString(item.title),
        description: normalizeOptionalString(item.description),
      } satisfies AddonEditorToolbarItemRegistration & {
        supports: AddonEditorTarget[]
        order: number
        label: string
        title: string
        description: string
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
}

export async function listAddonEditorProviderDescriptors(): Promise<
  AddonEditorProviderDescriptor[]
> {
  const providers = await listAddonProviderRuntimeItems<AddonEditorProviderRuntimeHooks>("editor")
  const descriptors: AddonEditorProviderDescriptor[] = []

  for (const item of providers) {
    const data = isRecord(item.provider.data) ? item.provider.data : null
    const staticSupports = normalizeAddonEditorTargets(
      data?.supports ?? data?.contexts,
    )
    let runtimeSupports: AddonEditorTarget[] | null | undefined = null

    try {
      runtimeSupports = await invokeAddonProviderRuntime(
        item,
        "getSupports",
        () => ({
          addon: item.addon,
          provider: item.provider,
          context: item.context,
        }),
      ) as AddonEditorTarget[] | null
    } catch (error) {
      console.error(
        "[addon-editor-providers] failed to read addon editor supports",
        item.provider.code,
        error,
      )
    }
    const supports = normalizeAddonEditorTargets(
      runtimeSupports,
      staticSupports,
    )
    const staticClientModule = normalizeOptionalString(data?.clientModule)
    let runtimeClientModule: string | null | undefined = null

    try {
      runtimeClientModule = await invokeAddonProviderRuntime(
        item,
        "getClientModule",
        () => ({
          addon: item.addon,
          provider: item.provider,
          context: item.context,
        }),
      ) as string | null
    } catch (error) {
      console.error(
        "[addon-editor-providers] failed to resolve addon editor client module",
        item.provider.code,
        error,
      )
    }
    const clientModuleUrl = resolveAddonClientModuleUrl(
      item.addon,
      normalizeOptionalString(runtimeClientModule) || staticClientModule,
    )

    if (!clientModuleUrl) {
      continue
    }

    descriptors.push({
      addonId: item.addon.manifest.id,
      clientModuleUrl,
      description:
        item.provider.description?.trim()
        || item.addon.manifest.description
        || "",
      label: item.provider.label,
      order: item.order,
      providerCode: item.provider.code,
      supports,
    })
  }

  return descriptors
}

export async function listAddonEditorToolbarItemDescriptors(): Promise<
  AddonEditorToolbarItemDescriptor[]
> {
  const providers = await listAddonProviderRuntimeItems<AddonEditorProviderRuntimeHooks>("editor")
  const descriptors: AddonEditorToolbarItemDescriptor[] = []

  for (const item of providers) {
    const data = isRecord(item.provider.data) ? item.provider.data : null
    const staticSupports = normalizeAddonEditorTargets(
      data?.supports ?? data?.contexts,
    )
    const staticToolbarItems = normalizeAddonEditorToolbarItemRegistrations(
      data?.toolbarItems,
      staticSupports,
    )
    let runtimeToolbarItems: AddonEditorToolbarItemRegistration[] | null | undefined = null

    try {
      runtimeToolbarItems = await invokeAddonProviderRuntime(
        item,
        "getToolbarItems",
        () => ({
          addon: item.addon,
          provider: item.provider,
          context: item.context,
        }),
      ) as AddonEditorToolbarItemRegistration[] | null
    } catch (error) {
      console.error(
        "[addon-editor-providers] failed to read addon editor toolbar items",
        item.provider.code,
        error,
      )
    }

    const toolbarItems = runtimeToolbarItems === null || typeof runtimeToolbarItems === "undefined"
      ? staticToolbarItems
      : normalizeAddonEditorToolbarItemRegistrations(
          runtimeToolbarItems,
          staticSupports,
        )

    for (const toolbarItem of toolbarItems) {
      const clientModuleUrl = resolveAddonClientModuleUrl(
        item.addon,
        toolbarItem.clientModule,
      )

      if (!clientModuleUrl) {
        continue
      }

      descriptors.push({
        addonId: item.addon.manifest.id,
        clientModuleUrl,
        description: toolbarItem.description || item.provider.description?.trim() || "",
        key: toolbarItem.key,
        label: toolbarItem.label,
        order: toolbarItem.order,
        providerCode: item.provider.code,
        providerLabel: item.provider.label,
        supports: toolbarItem.supports,
        title: toolbarItem.title || toolbarItem.label,
      })
    }
  }

  return descriptors.sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order
    }

    const byProviderLabel = left.providerLabel.localeCompare(
      right.providerLabel,
      "zh-CN",
    )
    if (byProviderLabel !== 0) {
      return byProviderLabel
    }

    const byProviderCode = left.providerCode.localeCompare(
      right.providerCode,
      "zh-CN",
    )
    if (byProviderCode !== 0) {
      return byProviderCode
    }

    return `${left.addonId}:${left.key}`.localeCompare(
      `${right.addonId}:${right.key}`,
      "zh-CN",
    )
  })
}
