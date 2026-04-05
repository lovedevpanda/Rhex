import type { PlatformShortcutMap } from "@/lib/client-platform"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"

export type EditorTab = "write" | "live-preview" | "preview"

export type EditorSelectionRange = {
  start: number
  end: number
}

export type EditorRestoreViewState = {
  scrollTop: number
  scrollLeft: number
  pageXOffset: number
  pageYOffset: number
}

export type EditorWriteViewState = {
  scrollTop: number
  scrollLeft: number
  selectionStart: number
  selectionEnd: number
}

export type UploadSummary = {
  totalCount: number
  queuedCount: number
  activeCount: number
  successCount: number
  errorCount: number
  completedCount: number
}

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
