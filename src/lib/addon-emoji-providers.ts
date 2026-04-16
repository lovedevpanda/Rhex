import type { AddonEmojiProviderRuntimeHooks } from "@/addons-host/emoji-types"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import {
  normalizeOptionalMarkdownEmojiItems,
} from "@/lib/markdown-emoji"
import { isRecord } from "@/lib/addon-provider-helpers"
import {
  invokeAddonProviderRuntime,
  listAddonProviderRuntimeItems,
} from "@/lib/addon-provider-registry"

export async function listAddonMarkdownEmojiItems() {
  const providers = await listAddonProviderRuntimeItems<AddonEmojiProviderRuntimeHooks>("emoji")
  const items: Array<
    MarkdownEmojiItem & {
      addonId: string
      order: number
      providerCode: string
    }
  > = []

  for (const item of providers) {
    const data = isRecord(item.provider.data) ? item.provider.data : null
    const staticItems = normalizeOptionalMarkdownEmojiItems(data?.items)
    let runtimeItems: MarkdownEmojiItem[] | null | undefined = null

    try {
      runtimeItems = await invokeAddonProviderRuntime(
        item,
        "listItems",
        () => ({
          addon: item.addon,
          provider: item.provider,
          context: item.context,
        }),
      ) as MarkdownEmojiItem[] | null
    } catch (error) {
      console.error(
        "[addon-emoji-providers] failed to list addon emoji items",
        item.provider.code,
        error,
      )
    }
    const normalizedRuntimeItems = normalizeOptionalMarkdownEmojiItems(
      runtimeItems,
    )

    for (const emoji of [...staticItems, ...normalizedRuntimeItems]) {
      items.push({
        ...emoji,
        addonId: item.addon.manifest.id,
        order: item.order,
        providerCode: item.provider.code,
      })
    }
  }

  return items.sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order
    }

    const byShortcode = left.shortcode.localeCompare(
      right.shortcode,
      "zh-CN",
    )
    if (byShortcode !== 0) {
      return byShortcode
    }

    return `${left.addonId}:${left.providerCode}`.localeCompare(
      `${right.addonId}:${right.providerCode}`,
      "zh-CN",
    )
  })
}

export async function mergeMarkdownEmojiItems(baseItems: MarkdownEmojiItem[]) {
  const addonItems = await listAddonMarkdownEmojiItems()
  const merged = new Map(
    baseItems.map((item) => [item.shortcode, item] as const),
  )

  for (const item of addonItems) {
    merged.set(item.shortcode, {
      shortcode: item.shortcode,
      label: item.label,
      icon: item.icon,
    })
  }

  return [...merged.values()]
}
