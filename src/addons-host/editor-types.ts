import type {
  EditorSelectionRange,
  RefinedRichPostEditorProps,
} from "@/components/refined-rich-post-editor/types"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import type {
  AddonExecutionContextBase,
  AddonMaybePromise,
  AddonProviderRegistration,
  LoadedAddonRuntime,
} from "@/addons-host/types"

export const ADDON_EDITOR_TARGETS = [
  "post",
  "comment",
  "profile",
  "admin",
  "generic",
] as const

export type AddonEditorTarget = (typeof ADDON_EDITOR_TARGETS)[number]

export const DEFAULT_ADDON_EDITOR_TARGETS: AddonEditorTarget[] = [
  "post",
  "comment",
]

interface AddonEditorProviderRuntimeBaseInput {
  addon: LoadedAddonRuntime
  provider: AddonProviderRegistration
  context: AddonExecutionContextBase
}

export interface AddonEditorToolbarItemRegistration {
  key: string
  clientModule: string
  supports?: AddonEditorTarget[]
  contexts?: AddonEditorTarget[]
  order?: number
  label?: string
  title?: string
  description?: string
}

export interface AddonEditorToolbarItemDescriptor {
  addonId: string
  clientModuleUrl: string
  description?: string
  key: string
  label: string
  order: number
  providerCode: string
  providerLabel: string
  supports: AddonEditorTarget[]
  title?: string
}

export interface AddonEditorToolbarApi {
  focus: () => void
  preserveSelection: () => EditorSelectionRange
  getSelection: () => EditorSelectionRange
  getValue: () => string
  setValue: (value: string) => void
  insertTemplate: (template: string) => void
  replaceSelection: (value: string) => void
  wrapSelection: (before: string, after?: string) => void
  setHeadingLevel: (level: 1 | 2 | 3) => void
  toggleBold: () => void
  toggleUnderline: () => void
  toggleStrike: () => void
  toggleHighlight: () => void
  formatCode: (value: "inline-code" | "code-block") => void
  toggleQuote: () => void
  formatList: (value: "unordered" | "unordered-star" | "ordered" | "task") => void
  insertDivider: () => void
  align: (value: "left" | "center" | "right") => void
}

export interface AddonEditorToolbarItemComponentProps {
  context: AddonEditorTarget
  disabled: boolean
  editor: AddonEditorToolbarApi
  item: AddonEditorToolbarItemDescriptor
  selection: EditorSelectionRange
  value: string
}

export interface AddonEditorProviderRuntimeHooks {
  getClientModule?: (
    input: AddonEditorProviderRuntimeBaseInput,
  ) => AddonMaybePromise<string | null | undefined>
  getSupports?: (
    input: AddonEditorProviderRuntimeBaseInput,
  ) => AddonMaybePromise<AddonEditorTarget[] | null | undefined>
  getToolbarItems?: (
    input: AddonEditorProviderRuntimeBaseInput,
  ) => AddonMaybePromise<AddonEditorToolbarItemRegistration[] | null | undefined>
}

export interface AddonEditorProviderDescriptor {
  addonId: string
  clientModuleUrl: string
  description?: string
  label: string
  order: number
  providerCode: string
  supports: AddonEditorTarget[]
}

export interface AddonEditorComponentProps
  extends Omit<
    RefinedRichPostEditorProps,
    "markdownEmojiMap" | "markdownImageUploadEnabled"
  > {
  context: AddonEditorTarget
  markdownEmojiMap: MarkdownEmojiItem[]
  markdownImageUploadEnabled: boolean
  providerCode: string
  providerLabel: string
}

export function pickPreferredAddonEditorProvider(
  providers: AddonEditorProviderDescriptor[],
  target: AddonEditorTarget,
) {
  const exactMatch = providers.find((item) => item.supports.includes(target))
  if (exactMatch) {
    return exactMatch
  }

  return providers.find((item) => item.supports.includes("generic")) ?? null
}

export function pickAddonEditorToolbarItems(
  items: AddonEditorToolbarItemDescriptor[],
  target: AddonEditorTarget,
) {
  return items
    .filter((item) => item.supports.includes(target) || item.supports.includes("generic"))
    .sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order
      }

      const byLabel = left.label.localeCompare(right.label, "zh-CN")
      if (byLabel !== 0) {
        return byLabel
      }

      return `${left.addonId}:${left.providerCode}:${left.key}`.localeCompare(
        `${right.addonId}:${right.providerCode}:${right.key}`,
        "zh-CN",
      )
    })
}
