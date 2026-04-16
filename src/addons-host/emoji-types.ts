import type {
  AddonExecutionContextBase,
  AddonMaybePromise,
  AddonProviderRegistration,
  LoadedAddonRuntime,
} from "@/addons-host/types"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"

interface AddonEmojiProviderRuntimeBaseInput {
  addon: LoadedAddonRuntime
  provider: AddonProviderRegistration
  context: AddonExecutionContextBase
}

export interface AddonEmojiProviderRuntimeHooks {
  listItems?: (
    input: AddonEmojiProviderRuntimeBaseInput,
  ) => AddonMaybePromise<MarkdownEmojiItem[] | null | undefined>
}

export interface ResolvedAddonEmojiItem extends MarkdownEmojiItem {
  addonId: string
  order: number
  providerCode: string
}
