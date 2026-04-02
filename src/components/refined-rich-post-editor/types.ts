import type { PlatformShortcutMap } from "@/lib/client-platform"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"

export interface RefinedRichPostEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: number
  disabled?: boolean
  uploadFolder?: string
  markdownEmojiMap?: MarkdownEmojiItem[]
  markdownImageUploadEnabled?: boolean
}

export type MediaInsertResult = {
  template: string
  message: string
}

export type FloatingPanelPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
}

export type ToolbarTipDefinition = {
  label: string
  shortcuts?: PlatformShortcutMap
  description?: string
}
