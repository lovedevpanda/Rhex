"use client"

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"


import { createPortal } from "react-dom"

import { AlignCenter, AlignLeft, AlignRight, Bold, Code2, Highlighter, ImageIcon, Link2, List, ListOrdered, ListTodo, Maximize2, Minimize2, Quote, SeparatorHorizontal, Smile, Strikethrough, Table2, Video } from "lucide-react"



import { EmojiPicker } from "@/components/emoji-picker"
import { MarkdownContent } from "@/components/markdown-content"
import { useMarkdownEmojiMap } from "@/components/site-settings-provider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { useImageUpload } from "@/hooks/use-image-upload"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import { cn } from "@/lib/utils"




interface RefinedRichPostEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: number
  disabled?: boolean
  uploadFolder?: string
  markdownEmojiMap?: MarkdownEmojiItem[]
}


type MediaInsertResult = {
  template: string
  message: string
}

type FloatingPanelPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
}

function useFloatingPanel() {
  const [position, setPosition] = useState<FloatingPanelPosition | null>(null)
  const [isReady, setIsReady] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  return [position, setPosition, isReady, setIsReady, ref] as const
}

const EDITOR_LINE_HEIGHT_REM = 1.75
const EDITOR_LINE_NUMBER_GUTTER_WIDTH_CLASS = "w-7"
const EDITOR_FALLBACK_LINE_HEIGHT_PX = 28

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov", ".m3u8"]

const AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"]
const COMMON_EMBED_HOSTS = new Set(["player.bilibili.com", "www.bilibili.com", "music.163.com", "www.youtube.com", "youtube.com", "youtu.be", "v.qq.com"])

function insertText(source: string, selectionStart: number, selectionEnd: number, before: string, after = "") {
  return `${source.slice(0, selectionStart)}${before}${source.slice(selectionStart, selectionEnd)}${after}${source.slice(selectionEnd)}`
}

function getBlockInsertPrefix(source: string, position: number) {
  if (position <= 0) {
    return ""
  }

  const previousChar = source[position - 1]
  if (previousChar === "\n") {
    return source[position - 2] === "\n" ? "" : "\n"
  }

  return "\n\n"
}

function isBlankSelection(value: string) {
  return value.trim().length === 0
}

function buildLinkMarkdown(linkText: string, url: string) {
  const normalizedText = linkText.trim() || "链接文字"
  const normalizedUrl = url.trim() || "https://example.com"
  return `[${normalizedText}](${normalizedUrl})`
}

function buildInlineCodeMarkdown(selectedText: string) {
  return isBlankSelection(selectedText) ? "`代码`" : `\`${selectedText}\``
}

function buildInlineHighlightMarkdown(selectedText: string) {
  return isBlankSelection(selectedText) ? "==高亮内容==" : `==${selectedText}==`
}

function buildCodeBlockMarkdown(selectedText: string) {
  const normalized = selectedText.trimEnd()
  const body = normalized || "// 在这里输入代码"
  return `\`\`\`ts\n${body}\n\`\`\``
}

function buildSizedTableMarkdown(rows: number, columns: number) {
  const safeRows = Math.max(1, rows)
  const safeColumns = Math.max(1, columns)
  const header = Array.from({ length: safeColumns }, (_, index) => `列 ${index + 1}`)
  const separator = Array.from({ length: safeColumns }, () => "---")
  const body = Array.from({ length: safeRows }, (_, rowIndex) => (
    Array.from({ length: safeColumns }, (_, columnIndex) => `内容 ${rowIndex + 1}-${columnIndex + 1}`)
  ))

  return [header, separator, ...body].map((row) => `| ${row.join(" | ")} |`).join("\n")
}

function buildAlignmentHtml(alignment: "left" | "center" | "right", selectedText: string) {
  const body = selectedText.trim() || "输入内容"
  if (alignment === "center") {
    return `<center>${body}</center>`
  }

  return `<p align="${alignment}">${body}</p>`
}


function normalizeMediaUrl(input: string) {

  const value = input.trim()
  if (!value) {
    return null
  }

  const normalized = value.startsWith("//") ? `https:${value}` : value

  try {
    return new URL(normalized)
  } catch {
    return null
  }
}

function inferMediaInsert(input: string): MediaInsertResult | null {
  const url = normalizeMediaUrl(input)
  if (!url) {
    return null
  }

  const pathname = url.pathname.toLowerCase()
  const originalSrc = input.trim().startsWith("//") ? `//${url.host}${url.pathname}${url.search}${url.hash}` : url.toString()

  if (VIDEO_EXTENSIONS.some((ext) => pathname.endsWith(ext))) {
    return {
      template: `MEDIA::video::${originalSrc}`,
      message: "已识别为视频地址，将按 video 标签渲染",
    }
  }

  if (AUDIO_EXTENSIONS.some((ext) => pathname.endsWith(ext))) {
    return {
      template: `MEDIA::audio::${originalSrc}`,
      message: "已识别为音频地址，将按 audio 标签渲染",
    }
  }

  if (COMMON_EMBED_HOSTS.has(url.hostname)) {
    return {
      template: `MEDIA::iframe::${originalSrc}`,
      message: "已识别为站点媒体链接，将按 iframe 渲染",
    }
  }

  return {
    template: `MEDIA::iframe::${originalSrc}`,
    message: "无法判断直链格式，将按 iframe 渲染",
  }
}

function ToolButton({ title, onClick, children, disabled = false, active = false, onMouseDown }: { title: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; active?: boolean; onMouseDown?: (event: React.MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={onMouseDown}
      onClick={onClick}
      disabled={disabled}
      className={active ? "shrink-0 rounded-lg bg-accent p-2 text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50" : "shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"}
    >
      {children}
    </button>
  )
}

function ToolbarSelectTrigger({ ariaLabel, children }: { ariaLabel: string; children: React.ReactNode }) {
  return (
    <SelectTrigger
      aria-label={ariaLabel}
      className="h-9 w-9 shrink-0 justify-center gap-0.5 rounded-xl border-0 bg-transparent px-0 text-sm font-semibold text-muted-foreground shadow-none hover:bg-accent hover:text-foreground focus:ring-0 focus:ring-offset-0 [&>span]:flex [&>span]:w-auto [&>span]:items-center [&>span]:justify-center [&>span]:text-center [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-55"
    >
      {children}
    </SelectTrigger>
  )
}

function HeadingSelect({ disabled, onOpenChange, onSelect, onMouseDown }: { disabled?: boolean; onOpenChange?: (open: boolean) => void; onSelect: (level: 1 | 2 | 3) => void; onMouseDown?: () => void }) {
  const [value, setValue] = useState("")

  return (
    <Select
      value={value}
      onOpenChange={(open) => {
        if (open) {
          onMouseDown?.()
        }
        onOpenChange?.(open)
      }}
      onValueChange={(nextValue) => {
        setValue(nextValue)
        const level = Number(nextValue)
        if (level === 1 || level === 2 || level === 3) {
          onSelect(level)
        }
        requestAnimationFrame(() => {
          setValue("")
        })
      }}
      disabled={disabled}
    >
      <ToolbarSelectTrigger ariaLabel="标题层级">
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 1047 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1574" width="200" height="200"><path d="M472.296727 930.909091v-372.363636H116.363636v372.363636h-93.090909V93.090909h93.090909v372.363636h355.886546V93.090909h93.090909v837.818182z" p-id="1575"></path><path d="M874.170182 930.955636v-0.418909h-120.413091v-69.818182h120.413091v-364.171636a283.927273 283.927273 0 0 1-120.413091 67.072V483.141818a301.335273 301.335273 0 0 0 74.146909-31.278545 304.500364 304.500364 0 0 0 66.187636-52.922182h60.183273v461.730909h93.090909v69.818182h-93.090909V930.909091z" p-id="1576"></path></svg>
      </ToolbarSelectTrigger>
      <SelectContent className="bg-background/100">
        <SelectItem value="1" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 1047 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1574" width="200" height="200"><path d="M472.296727 930.909091v-372.363636H116.363636v372.363636h-93.090909V93.090909h93.090909v372.363636h355.886546V93.090909h93.090909v837.818182z" p-id="1575"></path><path d="M874.170182 930.955636v-0.418909h-120.413091v-69.818182h120.413091v-364.171636a283.927273 283.927273 0 0 1-120.413091 67.072V483.141818a301.335273 301.335273 0 0 0 74.146909-31.278545 304.500364 304.500364 0 0 0 66.187636-52.922182h60.183273v461.730909h93.090909v69.818182h-93.090909V930.909091z" p-id="1576"></path></svg>
          一级标题
        </SelectItem>
        <SelectItem value="2" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1574" width="200" height="200"><path d="M662.667636 930.909091a203.776 203.776 0 0 1 52.130909-139.310546 667.787636 667.787636 0 0 1 118.225455-96.954181 547.467636 547.467636 0 0 0 74.891636-61.021091 130.653091 130.653091 0 0 0 35.979637-87.179637 86.946909 86.946909 0 0 0-24.250182-67.025454 102.4 102.4 0 0 0-71.214546-22.341818 86.853818 86.853818 0 0 0-74.938181 34.257454 163.607273 163.607273 0 0 0-27.927273 97.745455h-80.058182a206.196364 206.196364 0 0 1 50.688-143.034182 170.402909 170.402909 0 0 1 134.981818-57.344 176.267636 176.267636 0 0 1 124.136728 43.938909 150.807273 150.807273 0 0 1 47.662545 114.734545 185.530182 185.530182 0 0 1-51.2 125.952 740.864 740.864 0 0 1-108.683636 85.690182 258.513455 258.513455 0 0 0-101.329455 100.538182H1024V930.909091z m-216.482909 0v-372.363636H93.090909v372.363636H0V93.090909h93.090909v372.363636h353.047273V93.090909h93.090909v837.818182z" p-id="1575"></path></svg>
          二级标题
        </SelectItem>
        <SelectItem value="3" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1724" width="200" height="200"><path d="M707.490909 894.417455a188.509091 188.509091 0 0 1-61.719273-136.331637h80.802909a110.033455 110.033455 0 0 0 34.490182 82.711273 105.006545 105.006545 0 0 0 74.845091 26.810182 114.641455 114.641455 0 0 0 81.547637-29.789091 90.670545 90.670545 0 0 0 27.22909-66.327273 82.199273 82.199273 0 0 0-28.672-69.259636 119.202909 119.202909 0 0 0-78.568727-22.434909h-38.167273v-61.067637h37.515637a107.799273 107.799273 0 0 0 72.657454-21.643636 78.382545 78.382545 0 0 0 24.994909-61.812364 80.709818 80.709818 0 0 0-22.807272-61.067636 102.4 102.4 0 0 0-71.261091-21.643636 104.866909 104.866909 0 0 0-74.146909 24.66909 110.312727 110.312727 0 0 0-31.604364 73.681455h-78.568727a174.638545 174.638545 0 0 1 58.042182-123.671273 177.524364 177.524364 0 0 1 125.672727-43.938909 194.699636 194.699636 0 0 1 127.022545 38.772364 133.352727 133.352727 0 0 1 47.010909 107.054545 115.246545 115.246545 0 0 1-86.667636 117.015273 146.338909 146.338909 0 0 1 70.516364 43.892364 113.943273 113.943273 0 0 1 26.391272 77.544727 158.999273 158.999273 0 0 1-49.943272 120.645818 200.471273 200.471273 0 0 1-137.309091 47.662546 193.117091 193.117091 0 0 1-129.303273-41.472z m-261.306182 41.890909v-382.976H93.090909v372.363636H0v-837.818182h93.090909v372.363637h353.093818V98.304h93.090909v837.818182z" p-id="1725"></path></svg>
          三级标题
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

function AlignmentSelect({ disabled, onOpenChange, onSelect, onMouseDown }: { disabled?: boolean; onOpenChange?: (open: boolean) => void; onSelect: (alignment: "left" | "center" | "right") => void; onMouseDown?: () => void }) {
  const [value, setValue] = useState("")

  return (
    <Select
      value={value}
      onOpenChange={(open) => {
        if (open) {
          onMouseDown?.()
        }
        onOpenChange?.(open)
      }}
      onValueChange={(nextValue) => {
        setValue(nextValue)
        if (nextValue === "left" || nextValue === "center" || nextValue === "right") {
          onSelect(nextValue)
        }
        requestAnimationFrame(() => {
          setValue("")
        })
      }}
      disabled={disabled}
    >
      <ToolbarSelectTrigger ariaLabel="内容对齐">
        <AlignLeft className="h-4 w-4 shrink-0" />
      </ToolbarSelectTrigger>
      <SelectContent className="bg-background/100">
        <SelectItem value="left" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <AlignLeft className="h-4 w-4 shrink-0" />
          左对齐
        </SelectItem>
        <SelectItem value="center" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <AlignCenter className="h-4 w-4 shrink-0" />
          居中
        </SelectItem>
        <SelectItem value="right" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <AlignRight className="h-4 w-4 shrink-0" />
          右对齐
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

function ListSelect({ disabled, onOpenChange, onSelect, onMouseDown }: { disabled?: boolean; onOpenChange?: (open: boolean) => void; onSelect: (value: "unordered" | "unordered-star" | "ordered" | "task") => void; onMouseDown?: () => void }) {
  const [value, setValue] = useState("")

  return (
    <Select
      value={value}
      onOpenChange={(open) => {
        if (open) {
          onMouseDown?.()
        }
        onOpenChange?.(open)
      }}
      onValueChange={(nextValue) => {
        setValue(nextValue)
        if (nextValue === "unordered" || nextValue === "unordered-star" || nextValue === "ordered" || nextValue === "task") {
          onSelect(nextValue)
        }
        requestAnimationFrame(() => {
          setValue("")
        })
      }}
      disabled={disabled}
    >
      <ToolbarSelectTrigger ariaLabel="列表格式">
        <List className="h-4 w-4 shrink-0" />
      </ToolbarSelectTrigger>
      <SelectContent className="bg-background/100">
        <SelectItem value="unordered" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <List className="h-4 w-4 shrink-0" />
          无序列表
        </SelectItem>
        <SelectItem value="unordered-star" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <List className="h-4 w-4 shrink-0" />
          星号列表
        </SelectItem>
        <SelectItem value="ordered" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <ListOrdered className="h-4 w-4 shrink-0" />
          有序列表
        </SelectItem>
        <SelectItem value="task" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <ListTodo className="h-4 w-4 shrink-0" />
          待办列表
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

function CodeFormatSelect({ disabled, onOpenChange, onSelect, onMouseDown }: { disabled?: boolean; onOpenChange?: (open: boolean) => void; onSelect: (value: "inline-code" | "code-block") => void; onMouseDown?: () => void }) {
  const [value, setValue] = useState("")

  return (
    <Select
      value={value}
      onOpenChange={(open) => {
        if (open) {
          onMouseDown?.()
        }
        onOpenChange?.(open)
      }}
      onValueChange={(nextValue) => {
        setValue(nextValue)
        if (nextValue === "inline-code" || nextValue === "code-block") {
          onSelect(nextValue)
        }
        requestAnimationFrame(() => {
          setValue("")
        })
      }}
      disabled={disabled}
    >
      <ToolbarSelectTrigger ariaLabel="行内代码与代码块">
        <Code2 className="h-4 w-4 shrink-0" />
      </ToolbarSelectTrigger>
      <SelectContent className="bg-background/100">
        <SelectItem value="inline-code" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <Code2 className="h-4 w-4 shrink-0" />
          行内代码
        </SelectItem>
        <SelectItem value="code-block" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <Code2 className="h-4 w-4 shrink-0" />
          代码块
        </SelectItem>
      </SelectContent>
    </Select>
  )
}



export function RefinedRichPostEditor({
  value,
  onChange,
  placeholder,
  minHeight = 240,
  disabled = false,
  uploadFolder = "posts",
  markdownEmojiMap: externalMarkdownEmojiMap,
}: RefinedRichPostEditorProps) {

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [mediaPanelPosition, setMediaPanelPosition, mediaPanelReady, setMediaPanelReady, mediaPanelRef] = useFloatingPanel()
  const [emojiPanelPosition, setEmojiPanelPosition, emojiPanelReady, setEmojiPanelReady, emojiPanelRef] = useFloatingPanel()
  const [tablePanelPosition, setTablePanelPosition, tablePanelReady, setTablePanelReady, tablePanelRef] = useFloatingPanel()
  const [linkPanelPosition, setLinkPanelPosition, linkPanelReady, setLinkPanelReady, linkPanelRef] = useFloatingPanel()
  const [uploadPanelPosition, setUploadPanelPosition, uploadPanelReady, setUploadPanelReady, uploadPanelRef] = useFloatingPanel()
  const mediaButtonRef = useRef<HTMLDivElement | null>(null)
  const emojiButtonRef = useRef<HTMLDivElement | null>(null)
  const tableButtonRef = useRef<HTMLDivElement | null>(null)
  const linkButtonRef = useRef<HTMLDivElement | null>(null)
  const imageButtonRef = useRef<HTMLDivElement | null>(null)
  const lineMeasureContainerRef = useRef<HTMLDivElement | null>(null)
  const lineMeasureRefs = useRef<Array<HTMLDivElement | null>>([])
  const selectionRef = useRef({ start: 0, end: 0 })

  const [activeTab, setActiveTab] = useState<"write" | "preview">("write")

  const [message, setMessage] = useState("")
  const [showEmojiPanel, setShowEmojiPanel] = useState(false)
  const [showMediaPanel, setShowMediaPanel] = useState(false)
  const [showTablePanel, setShowTablePanel] = useState(false)
  const [showLinkPanel, setShowLinkPanel] = useState(false)
  const [showUploadPanel, setShowUploadPanel] = useState(false)
  const [mediaUrl, setMediaUrl] = useState("")
  const [linkText, setLinkText] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [editorScrollTop, setEditorScrollTop] = useState(0)
  const [activeLineNumber, setActiveLineNumber] = useState(1)
  const [lineHeights, setLineHeights] = useState<number[]>([EDITOR_FALLBACK_LINE_HEIGHT_PX])
  const [tableHoverSize, setTableHoverSize] = useState({ rows: 0, columns: 0 })
  const isClient = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  )
  const markdownEmojiMap = useMarkdownEmojiMap(externalMarkdownEmojiMap)
  const { uploading, uploadResults, uploadImageFiles, clearUploadResults } = useImageUpload({
    uploadFolder,
    onInsert: insertTemplate,
  })
  const uploadSummary = useMemo(() => {
    const totalCount = uploadResults.length
    const queuedCount = uploadResults.filter((item) => item.status === "queued").length
    const activeCount = uploadResults.filter((item) => item.status === "uploading").length
    const successCount = uploadResults.filter((item) => item.status === "success").length
    const errorCount = uploadResults.filter((item) => item.status === "error").length
    const completedCount = successCount + errorCount

    return {
      totalCount,
      queuedCount,
      activeCount,
      successCount,
      errorCount,
      completedCount,
    }
  }, [uploadResults])

  const contentMinHeight = isFullscreen ? "calc(100vh - 220px)" : minHeight
  const logicalLines = useMemo(() => value.split("\n"), [value])
  const lineCount = logicalLines.length
  const lineNumbers = useMemo(() => Array.from({ length: lineCount }, (_, index) => index + 1), [lineCount])


  useEffect(() => {
    const element = textareaRef.current
    const nextLineNumber = !element
      ? 1
      : value.slice(0, element.selectionStart ?? 0).split("\n").length
    const frameId = window.requestAnimationFrame(() => {
      setActiveLineNumber(nextLineNumber)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [value])

  const measureLineHeights = useCallback(() => {
    const textarea = textareaRef.current
    const measureContainer = lineMeasureContainerRef.current
    if (!textarea || !measureContainer) {
      return
    }

    const textareaStyle = window.getComputedStyle(textarea)
    const nextFallbackLineHeight = Number.parseFloat(textareaStyle.lineHeight) || EDITOR_FALLBACK_LINE_HEIGHT_PX

    measureContainer.style.width = `${textarea.clientWidth}px`
    measureContainer.style.paddingTop = textareaStyle.paddingTop
    measureContainer.style.paddingRight = textareaStyle.paddingRight
    measureContainer.style.paddingBottom = textareaStyle.paddingBottom
    measureContainer.style.paddingLeft = textareaStyle.paddingLeft
    measureContainer.style.fontFamily = textareaStyle.fontFamily
    measureContainer.style.fontSize = textareaStyle.fontSize
    measureContainer.style.fontWeight = textareaStyle.fontWeight
    measureContainer.style.fontStyle = textareaStyle.fontStyle
    measureContainer.style.lineHeight = textareaStyle.lineHeight
    measureContainer.style.letterSpacing = textareaStyle.letterSpacing
    measureContainer.style.tabSize = textareaStyle.tabSize
    measureContainer.style.textTransform = textareaStyle.textTransform
    measureContainer.style.textIndent = textareaStyle.textIndent

    const nextLineHeights = logicalLines.map((_, index) => {
      const measuredLine = lineMeasureRefs.current[index]
      return Math.max(measuredLine?.getBoundingClientRect().height ?? nextFallbackLineHeight, nextFallbackLineHeight)
    })

    setLineHeights((current) => {
      if (
        current.length === nextLineHeights.length
        && current.every((height, index) => Math.abs(height - nextLineHeights[index]) < 0.5)
      ) {
        return current
      }

      return nextLineHeights
    })
  }, [logicalLines])

  useLayoutEffect(() => {
    measureLineHeights()
  }, [measureLineHeights])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea || typeof ResizeObserver === "undefined") {
      return
    }

    const observer = new ResizeObserver(() => {
      measureLineHeights()
    })
    observer.observe(textarea)
    return () => {
      observer.disconnect()
    }
  }, [measureLineHeights])

  const mediaHint = useMemo(() => {
    if (!mediaUrl.trim()) {
      return "粘贴视频或音频地址，将插入可解析媒体标记。"
    }

    const parsed = inferMediaInsert(mediaUrl)
    return parsed?.message ?? "请输入有效的媒体地址"
  }, [mediaUrl])

  const linkHint = useMemo(() => {
    if (!linkUrl.trim()) {
      return ""
    }

    return /^https?:\/\//i.test(linkUrl.trim()) ? "" : "建议输入完整链接，例如 https://example.com"
  }, [linkUrl])

  const tableHint = useMemo(() => {
    if (!tableHoverSize.rows || !tableHoverSize.columns) {
      return "移动鼠标选择要插入的表格尺寸"
    }

    return `${tableHoverSize.rows} 行 × ${tableHoverSize.columns} 列`
  }, [tableHoverSize.columns, tableHoverSize.rows])

  useEffect(() => {
    if (!isFullscreen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFullscreen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isFullscreen])

  const updateFloatingPanelPosition = useCallback((anchor: HTMLDivElement | null, panel: HTMLDivElement | null, width: number) => {
    if (!anchor) {
      return null
    }

    const rect = anchor.getBoundingClientRect()
    const viewportPadding = 12
    const gap = 12
    const maxWidth = Math.min(width, window.innerWidth - viewportPadding * 2)
    const maxLeft = Math.max(viewportPadding, window.innerWidth - maxWidth - viewportPadding)
    const left = Math.min(Math.max(rect.left, viewportPadding), maxLeft)
    const availableAbove = Math.max(120, rect.top - viewportPadding - gap)
    const availableBelow = Math.max(120, window.innerHeight - rect.bottom - viewportPadding - gap)
    const measuredPanelHeight = panel?.offsetHeight ?? 0
    const preferTop = availableAbove > availableBelow && measuredPanelHeight <= availableAbove
    const placeAbove = preferTop || (availableAbove > availableBelow && availableBelow < 180)
    const maxHeight = Math.max(120, Math.min(placeAbove ? availableAbove : availableBelow, window.innerHeight - viewportPadding * 2))
    const panelHeight = Math.min(measuredPanelHeight || maxHeight, maxHeight)
    const rawTop = placeAbove ? rect.top - gap - panelHeight : rect.bottom + gap
    const top = Math.min(
      Math.max(rawTop, viewportPadding),
      window.innerHeight - panelHeight - viewportPadding,
    )

    return {
      left,
      width: maxWidth,
      top,
      maxHeight,
    }
  }, [])


  const syncFloatingPanel = useCallback((
    show: boolean,
    anchor: HTMLDivElement | null,
    width: number,
    panelRef: React.MutableRefObject<HTMLDivElement | null>,
    setPanelPosition: React.Dispatch<React.SetStateAction<FloatingPanelPosition | null>>,
    setPanelReady: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    if (!show) {
      setPanelPosition(null)
      setPanelReady(false)
      return
    }

    const nextPosition = updateFloatingPanelPosition(anchor, panelRef.current, width)
    setPanelPosition(nextPosition)
    setPanelReady(Boolean(nextPosition && panelRef.current?.offsetHeight))
  }, [updateFloatingPanelPosition])

  const syncFloatingPanels = useCallback(() => {
    syncFloatingPanel(showMediaPanel, mediaButtonRef.current, 320, mediaPanelRef, setMediaPanelPosition, setMediaPanelReady)
    syncFloatingPanel(showEmojiPanel, emojiButtonRef.current, 260, emojiPanelRef, setEmojiPanelPosition, setEmojiPanelReady)
    syncFloatingPanel(showTablePanel, tableButtonRef.current, 292, tablePanelRef, setTablePanelPosition, setTablePanelReady)
    syncFloatingPanel(showLinkPanel, linkButtonRef.current, 320, linkPanelRef, setLinkPanelPosition, setLinkPanelReady)
    syncFloatingPanel(showUploadPanel, imageButtonRef.current, 320, uploadPanelRef, setUploadPanelPosition, setUploadPanelReady)
  }, [emojiPanelRef, linkPanelRef, mediaPanelRef, setEmojiPanelPosition, setEmojiPanelReady, setLinkPanelPosition, setLinkPanelReady, setMediaPanelPosition, setMediaPanelReady, setTablePanelPosition, setTablePanelReady, setUploadPanelPosition, setUploadPanelReady, showEmojiPanel, showLinkPanel, showMediaPanel, showTablePanel, showUploadPanel, syncFloatingPanel, tablePanelRef, uploadPanelRef])

  useLayoutEffect(() => {
    if (!showMediaPanel && !showEmojiPanel && !showTablePanel && !showLinkPanel && !showUploadPanel) {
      return
    }

    syncFloatingPanels()

    const frameId = window.requestAnimationFrame(() => {
      syncFloatingPanels()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [emojiPanelRef, linkPanelRef, mediaPanelRef, showEmojiPanel, showLinkPanel, showMediaPanel, showTablePanel, showUploadPanel, syncFloatingPanels, tablePanelRef, uploadPanelRef])



  useEffect(() => {
    if (!showMediaPanel && !showEmojiPanel && !showTablePanel && !showLinkPanel && !showUploadPanel) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (showMediaPanel) {
        const clickedMediaButton = mediaButtonRef.current?.contains(target)
        const clickedMediaPanel = mediaPanelRef.current?.contains(target)
        if (!clickedMediaButton && !clickedMediaPanel) {
          setShowMediaPanel(false)
        }
      }

      if (showEmojiPanel) {
        const clickedEmojiButton = emojiButtonRef.current?.contains(target)
        const clickedEmojiPanel = emojiPanelRef.current?.contains(target)
        if (!clickedEmojiButton && !clickedEmojiPanel) {
          setShowEmojiPanel(false)
        }
      }

      if (showTablePanel) {
        const clickedTableButton = tableButtonRef.current?.contains(target)
        const clickedTablePanel = tablePanelRef.current?.contains(target)
        if (!clickedTableButton && !clickedTablePanel) {
          setShowTablePanel(false)
          setTableHoverSize({ rows: 0, columns: 0 })
        }
      }

      if (showLinkPanel) {
        const clickedLinkButton = linkButtonRef.current?.contains(target)
        const clickedLinkPanel = linkPanelRef.current?.contains(target)
        if (!clickedLinkButton && !clickedLinkPanel) {
          setShowLinkPanel(false)
        }
      }

      if (showUploadPanel) {
        const clickedImageButton = imageButtonRef.current?.contains(target)
        const clickedUploadPanel = uploadPanelRef.current?.contains(target)
        if (!clickedImageButton && !clickedUploadPanel) {
          setShowUploadPanel(false)
        }
      }
    }

    function handleViewportChange() {
      syncFloatingPanels()
    }

    window.addEventListener("resize", handleViewportChange)
    window.addEventListener("scroll", handleViewportChange, true)
    document.addEventListener("mousedown", handlePointerDown)
    return () => {
      window.removeEventListener("resize", handleViewportChange)
      window.removeEventListener("scroll", handleViewportChange, true)
      document.removeEventListener("mousedown", handlePointerDown)
    }
  }, [emojiPanelRef, linkPanelRef, mediaPanelRef, showEmojiPanel, showLinkPanel, showMediaPanel, showTablePanel, showUploadPanel, syncFloatingPanels, tablePanelRef, uploadPanelRef])


  const syncSelection = useCallback(() => {
    const element = textareaRef.current
    if (!element) {
      return selectionRef.current
    }

    const nextSelection = {
      start: element.selectionStart,
      end: element.selectionEnd,
    }
    selectionRef.current = nextSelection
    return nextSelection
  }, [])

  const restoreSelection = useCallback((start: number, end: number = start) => {
    requestAnimationFrame(() => {
      const element = textareaRef.current
      if (!element) {
        return
      }

      element.focus()
      element.setSelectionRange(start, end)
      selectionRef.current = { start, end }
    })
  }, [])

  const handleToolbarMouseDown = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      return
    }

    syncSelection()
    event.preventDefault()
  }, [disabled, syncSelection])

  const handleToolbarSelectMouseDown = useCallback(() => {
    if (disabled) {
      return
    }

    syncSelection()
  }, [disabled, syncSelection])

  const handleToolbarSelectOpenChange = useCallback((open: boolean) => {
    if (!open) {
      return
    }

    handleToolbarSelectMouseDown()
  }, [handleToolbarSelectMouseDown])



  const toggleMediaPanel = useCallback(() => {
    setShowEmojiPanel(false)
    setShowTablePanel(false)
    setShowLinkPanel(false)
    setShowUploadPanel(false)
    setShowMediaPanel((current) => !current)
  }, [])

  const toggleEmojiPanel = useCallback(() => {
    setShowMediaPanel(false)
    setShowTablePanel(false)
    setShowLinkPanel(false)
    setShowUploadPanel(false)
    setShowEmojiPanel((current) => !current)
  }, [])

  const toggleTablePanel = useCallback(() => {
    setShowMediaPanel(false)
    setShowEmojiPanel(false)
    setShowLinkPanel(false)
    setShowUploadPanel(false)
    setTableHoverSize({ rows: 0, columns: 0 })
    setShowTablePanel((current) => !current)
  }, [])

  const toggleLinkPanel = useCallback(() => {
    setShowMediaPanel(false)
    setShowEmojiPanel(false)
    setShowTablePanel(false)
    setShowUploadPanel(false)
    setShowLinkPanel((current) => {
      const nextOpen = !current
      if (nextOpen) {
        const { start, end } = selectionRef.current
        const selectedText = value.slice(start, end).trim()
        setLinkText(selectedText && !/^https?:\/\//i.test(selectedText) ? selectedText : "")
        setLinkUrl(/^https?:\/\//i.test(selectedText) ? selectedText : "")
      }
      return nextOpen
    })
  }, [value])

  const toggleUploadPanel = useCallback(() => {
    setShowMediaPanel(false)
    setShowEmojiPanel(false)
    setShowTablePanel(false)
    setShowLinkPanel(false)
    setShowUploadPanel((current) => !current)
  }, [])

  const updateActiveLineNumber = useCallback((element: HTMLTextAreaElement | null) => {
    if (!element) {
      setActiveLineNumber(1)
      return
    }

    const caretPosition = element.selectionStart ?? 0
    const nextLineNumber = value.slice(0, caretPosition).split("\n").length
    setActiveLineNumber(nextLineNumber)
  }, [value])

  const handleTextareaScroll = useCallback((event: React.UIEvent<HTMLTextAreaElement>) => {
    setEditorScrollTop(event.currentTarget.scrollTop)
    updateActiveLineNumber(event.currentTarget)
  }, [updateActiveLineNumber])

  const handleTextareaSelect = useCallback((event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    updateActiveLineNumber(event.currentTarget)
  }, [updateActiveLineNumber])


  function applyWrap(before: string, after = "") {

    const element = textareaRef.current
    if (!element) {
      onChange(`${value}${before}${after}`)
      return
    }

    const { start, end } = syncSelection()
    const nextValue = insertText(value, start, end, before, after)
    onChange(nextValue)
    restoreSelection(start + before.length, end + before.length)
  }

  function insertSelection(transform: (selectedText: string) => string) {
    const element = textareaRef.current
    if (!element) {
      const nextContent = transform("")
      const prefix = getBlockInsertPrefix(value, value.length)
      onChange(`${value}${prefix}${nextContent}`)
      return
    }

    const { start, end } = syncSelection()
    const selectedText = value.slice(start, end)
    const nextText = transform(selectedText)
    const nextValue = `${value.slice(0, start)}${nextText}${value.slice(end)}`
    onChange(nextValue)
    restoreSelection(start, start + nextText.length)
  }


  function insertLinePrefix(prefix: string) {

    const element = textareaRef.current
    if (!element) {
      const nextValue = value ? `${value}\n${prefix}` : prefix
      onChange(nextValue)
      return
    }

    const { start, end } = syncSelection()
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1
    const selectedText = value.slice(lineStart, end)
    const lines = selectedText.split("\n")
    const nextBlock = lines.map((line) => `${prefix}${line}`).join("\n")
    const nextValue = `${value.slice(0, lineStart)}${nextBlock}${value.slice(end)}`

    onChange(nextValue)
    restoreSelection(lineStart, lineStart + nextBlock.length)
  }

  function insertOrderedList() {
    const element = textareaRef.current
    if (!element) {
      const nextValue = value ? `${value}\n1. ` : "1. "
      onChange(nextValue)
      return
    }

    const { start, end } = syncSelection()
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1
    const selectedText = value.slice(lineStart, end)
    const lines = selectedText.split("\n")
    const nextBlock = lines.map((line, index) => `${index + 1}. ${line}`).join("\n")
    const nextValue = `${value.slice(0, lineStart)}${nextBlock}${value.slice(end)}`

    onChange(nextValue)
    restoreSelection(lineStart, lineStart + nextBlock.length)
  }

  function applyListFormat(listType: "unordered" | "unordered-star" | "ordered" | "task") {
    if (listType === "ordered") {
      insertOrderedList()
      return
    }

    if (listType === "task") {
      insertLinePrefix("- [ ] ")
      return
    }

    insertLinePrefix(listType === "unordered-star" ? "* " : "- ")
  }

  function applyCodeFormat(codeType: "inline-code" | "code-block") {
    if (codeType === "code-block") {
      insertSelection(buildCodeBlockMarkdown)
      return
    }

    insertSelection(buildInlineCodeMarkdown)
  }

  function insertTemplate(template: string) {
    const element = textareaRef.current
    if (!element) {
      const prefix = getBlockInsertPrefix(value, value.length)
      onChange(`${value}${prefix}${template}`)
      return
    }

    const { start, end } = syncSelection()
    const prefix = getBlockInsertPrefix(value, start)
    const insertedText = prefix + template
    const nextValue = insertText(value, start, end, insertedText)
    onChange(nextValue)
    const caretPosition = start + insertedText.length
    restoreSelection(caretPosition, caretPosition)
  }



  function handleInsertMedia() {
    const result = inferMediaInsert(mediaUrl)
    if (!result) {
      setMessage("请输入有效的音频或视频地址")
      return
    }

    insertTemplate(result.template)
    setMessage(result.message)
    setMediaUrl("")
    setShowMediaPanel(false)
  }

  function handleInsertLink() {
    if (!linkUrl.trim()) {
      setMessage("请输入有效的链接地址")
      return
    }

    const nextLinkMarkdown = buildLinkMarkdown(linkText, linkUrl)
    insertSelection(() => nextLinkMarkdown)
    setLinkText("")
    setLinkUrl("")
    setShowLinkPanel(false)
  }

  function handleInsertTable(rows: number, columns: number) {
    insertTemplate(buildSizedTableMarkdown(rows, columns))
    setShowTablePanel(false)
    setTableHoverSize({ rows: 0, columns: 0 })
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    const invalidFile = files.find((file) => !file.type.startsWith("image/"))
    if (invalidFile) {
      setMessage(`仅支持上传图片文件，${invalidFile.name} 不符合要求`)
      event.target.value = ""
      return
    }

    setMessage("")
    setShowUploadPanel(true)
    await uploadImageFiles(files)

    event.target.value = ""
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null)

    if (imageFiles.length === 0) {
      return
    }

    event.preventDefault()
    setMessage("")
    setShowUploadPanel(true)
    const insertedCount = await uploadImageFiles(imageFiles)

  }


  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-black/45 p-4 md:p-6" : ""}>
      <div className={isFullscreen ? "flex h-full w-full items-center justify-center" : ""}>
        <div className={isFullscreen ? "flex h-full max-h-[96vh] w-full max-w-6xl flex-col overflow-x-hidden overflow-y-visible rounded-[28px] border border-border bg-background shadow-2xl" : "overflow-x-hidden overflow-y-visible rounded-[22px] border border-border bg-card shadow-sm"}>

          {isFullscreen ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur sm:px-5">

              <div>
                <p className="text-sm font-medium text-foreground">全屏编辑器</p>
                <p className="text-xs text-muted-foreground">可按 Esc 快速退出全屏</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Minimize2 className="h-4 w-4" />
                退出全屏
              </button>
            </div>
          ) : null}
          <div className="border-b border-border px-5 pt-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("write")}
                  className={activeTab === "write" ? "border-b-2 border-foreground pb-2 text-sm font-medium text-foreground transition-colors" : "pb-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"}
                >
                  正文
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={activeTab === "preview" ? "border-b-2 border-foreground pb-2 text-sm font-medium text-foreground transition-colors" : "pb-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"}
                >
                  预览
                </button>
              </div>


              
              <div className="flex items-center gap-3 pb-2">
                <p className="text-xs text-muted-foreground">{value.length} 字符{uploading ? " · 上传中" : ""}</p>
                {!disabled && !isFullscreen ? (
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(true)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="进入全屏"
                    title="进入全屏"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>


          <div className={activeTab === "write"
            ? (isFullscreen ? "flex min-h-0 flex-1 flex-col pl-2 pr-3 pb-4 pt-3 sm:pl-4 sm:pr-5 sm:pb-8" : "pl-1 pr-3 pb-4 pt-3 sm:pl-1 sm:pr-5")
            : (isFullscreen ? "flex min-h-0 flex-1 flex-col px-3 pb-4 pt-3 sm:px-5 sm:pb-8" : "px-3 pb-4 pt-3 sm:px-5")}>


            {activeTab === "write" ? (
              <div
                className="relative flex overflow-hidden rounded-xl bg-transparent"
                style={{ minHeight: contentMinHeight, maxHeight: contentMinHeight }}
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    "hidden flex-none select-none overflow-hidden pr-1 pt-1 text-right font-mono text-[10px] text-muted-foreground/45 sm:block",
                    EDITOR_LINE_NUMBER_GUTTER_WIDTH_CLASS,
                  )}
                >
                  <div style={{ transform: `translateY(-${editorScrollTop}px)` }}>
                    {lineNumbers.map((lineNumber) => (
                      <div
                        key={lineNumber}
                        className={lineNumber === activeLineNumber ? "leading-7 text-foreground/85" : "leading-7 text-muted-foreground/45"}
                        style={{ height: lineHeights[lineNumber - 1] ?? `${EDITOR_LINE_HEIGHT_REM}rem` }}
                      >
                        {lineNumber}
                      </div>
                    ))}
                  </div>
                </div>
                <textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(event) => onChange(event.target.value)}
                  onScroll={handleTextareaScroll}
                  onKeyUp={handleTextareaSelect}
                  onClick={handleTextareaSelect}
                  onSelect={handleTextareaSelect}
                  onPaste={handlePaste}
                  disabled={disabled}
                  className="w-full resize-none overflow-y-auto rounded-none border-0 bg-transparent pl-2 pr-0 py-1 font-mono text-sm leading-7 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder={placeholder}
                  style={{ minHeight: contentMinHeight, maxHeight: contentMinHeight }}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-0 -z-10 overflow-hidden opacity-0"
                >
                  <div
                    ref={lineMeasureContainerRef}
                    className="box-border whitespace-pre-wrap break-words"
                  >
                    {logicalLines.map((line, index) => (
                      <div
                        key={`line-measure-${index}`}
                        ref={(node) => {
                          lineMeasureRefs.current[index] = node
                        }}
                        style={{ minHeight: `${EDITOR_LINE_HEIGHT_REM}rem` }}
                      >
                        {line.length > 0 ? line : " "}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="min-w-0 overflow-y-auto" style={{ minHeight: contentMinHeight, maxHeight: contentMinHeight }}>


                <MarkdownContent content={value} emptyText="暂无预览内容" markdownEmojiMap={markdownEmojiMap} />

              </div>
            )}

            {activeTab === "write" ? (
              <div className={`relative mt-2 flex flex-col gap-3 border-t border-border ${isFullscreen ? "" : "pt-2"} sm:flex-row sm:items-center sm:justify-between`}>
                <div className="-mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:w-auto sm:px-0 sm:pb-0">
                 <HeadingSelect
                    disabled={disabled}
                    onMouseDown={handleToolbarSelectMouseDown}
                    onOpenChange={handleToolbarSelectOpenChange}
                    onSelect={(level) => insertLinePrefix(`${"#".repeat(level)} `)}
                  />

                  <ToolButton title="加粗" onMouseDown={handleToolbarMouseDown} onClick={() => applyWrap("**", "**")} disabled={disabled}>
                    <Bold className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton title="删除线" onMouseDown={handleToolbarMouseDown} onClick={() => applyWrap("~~", "~~")} disabled={disabled}>
                    <Strikethrough className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton title="高亮" onMouseDown={handleToolbarMouseDown} onClick={() => insertSelection(buildInlineHighlightMarkdown)} disabled={disabled}>
                    <Highlighter className="h-4 w-4" />
                  </ToolButton>
                  <CodeFormatSelect
                    disabled={disabled}
                    onMouseDown={handleToolbarSelectMouseDown}
                    onOpenChange={handleToolbarSelectOpenChange}
                    onSelect={applyCodeFormat}
                  />
                  <ToolButton title="引用" onMouseDown={handleToolbarMouseDown} onClick={() => insertLinePrefix("> ")} disabled={disabled}>
                    <Quote className="h-4 w-4" />
                  </ToolButton>
                  <ListSelect
                    disabled={disabled}
                    onMouseDown={handleToolbarSelectMouseDown}
                    onOpenChange={handleToolbarSelectOpenChange}
                    onSelect={applyListFormat}
                  />
            
                  <div className="relative" ref={linkButtonRef}>
                    <ToolButton title="插入链接" onMouseDown={handleToolbarMouseDown} onClick={toggleLinkPanel} disabled={disabled} active={showLinkPanel}>
                      <Link2 className="h-4 w-4" />
                    </ToolButton>
                  </div>
                  <div className="relative" ref={tableButtonRef}>
                    <ToolButton title="插入表格" onMouseDown={handleToolbarMouseDown} onClick={toggleTablePanel} disabled={disabled} active={showTablePanel}>
                      <Table2 className="h-4 w-4" />
                    </ToolButton>
                  </div>
                  <ToolButton title="分割线" onMouseDown={handleToolbarMouseDown} onClick={() => insertTemplate("---")} disabled={disabled}>
                    <SeparatorHorizontal className="h-4 w-4" />
                  </ToolButton>
                  <AlignmentSelect
                    disabled={disabled}
                    onMouseDown={handleToolbarSelectMouseDown}
                    onOpenChange={handleToolbarSelectOpenChange}
                    onSelect={(alignment) => insertSelection((selectedText) => buildAlignmentHtml(alignment, selectedText))}
                  />

                  <div className="relative" ref={mediaButtonRef}>

                    <ToolButton title="插入媒体" onMouseDown={handleToolbarMouseDown} onClick={toggleMediaPanel} disabled={disabled} active={showMediaPanel}>
                      <Video className="h-4 w-4" />
                    </ToolButton>
                  </div>

                  <div className="relative" ref={emojiButtonRef}>
                    <ToolButton title="表情" onMouseDown={handleToolbarMouseDown} onClick={toggleEmojiPanel} disabled={disabled} active={showEmojiPanel}>
                      <Smile className="h-4 w-4" />
                    </ToolButton>
                  </div>


                  <div className="relative" ref={imageButtonRef}>
                    <ToolButton
                      title="添加图片"
                      onMouseDown={handleToolbarMouseDown}
                      onClick={() => {
                        if (uploadResults.length > 0 && !uploading) {
                          toggleUploadPanel()
                        } else {
                          fileInputRef.current?.click()
                        }
                      }}
                      disabled={disabled || uploading}
                      active={showUploadPanel}
                    >
                      <ImageIcon className="h-4 w-4" />
                    </ToolButton>
                    <input ref={fileInputRef} accept="image/*" multiple className="hidden" type="file" onChange={handleUpload} disabled={disabled || uploading} />
                  </div>

                </div>

              </div>
            ) : null}

            {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}

          </div>
        </div>
      </div>
      {isClient && showMediaPanel && mediaPanelPosition && !disabled ? createPortal(
        <div
          ref={mediaPanelRef}
          className="fixed z-[90] overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-2xl"
          style={{
            left: mediaPanelPosition.left,
            top: mediaPanelPosition.top,
            width: mediaPanelPosition.width,
            maxHeight: mediaPanelPosition.maxHeight,
            opacity: mediaPanelReady ? 1 : 0,
            pointerEvents: mediaPanelReady ? "auto" : "none",
          }}
          aria-hidden={!mediaPanelReady}
        >


          <div className="mb-3 space-y-1">
            <div className="text-sm font-medium text-foreground">插入媒体</div>
            <p className="text-xs leading-5 text-muted-foreground">粘贴视频或音频地址，编辑器会插入可解析媒体标记，由前台统一解析成正确播放器。</p>
          </div>
          <input
            type="url"
            value={mediaUrl}
            onChange={(event) => setMediaUrl(event.target.value)}
            placeholder="https://example.com/video.mp4"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-foreground"
          />
          <p className="mt-2 text-xs text-muted-foreground">{mediaHint}</p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
              onClick={() => {
                setShowMediaPanel(false)
                setMediaUrl("")
              }}
            >
              取消
            </button>
            <button
              type="button"
              className="rounded-full bg-foreground px-3 py-1.5 text-xs text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleInsertMedia}
              disabled={!mediaUrl.trim()}
            >
              插入
            </button>
          </div>
        </div>,
        document.body,
      ) : null}
      {isClient && showLinkPanel && linkPanelPosition && !disabled ? createPortal(
        <div
          ref={linkPanelRef}
          className="fixed z-[90] overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-2xl"
          style={{
            left: linkPanelPosition.left,
            top: linkPanelPosition.top,
            width: linkPanelPosition.width,
            maxHeight: linkPanelPosition.maxHeight,
            opacity: linkPanelReady ? 1 : 0,
            pointerEvents: linkPanelReady ? "auto" : "none",
          }}
          aria-hidden={!linkPanelReady}
        >
          <div className="mb-3 space-y-1">
            <div className="text-sm font-medium text-foreground">插入链接</div>
            <p className="text-xs leading-5 text-muted-foreground">填写链接文本和链接地址。</p>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              value={linkText}
              onChange={(event) => setLinkText(event.target.value)}
              placeholder="链接文本"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-foreground"
            />
            <input
              type="url"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://example.com"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-foreground"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{linkHint}</p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
              onClick={() => {
                setShowLinkPanel(false)
                setLinkText("")
                setLinkUrl("")
              }}
            >
              取消
            </button>
            <button
              type="button"
              className="rounded-full bg-foreground px-3 py-1.5 text-xs text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleInsertLink}
              disabled={!linkUrl.trim()}
            >
              插入
            </button>
          </div>
        </div>,
        document.body,
      ) : null}
      {isClient && showTablePanel && tablePanelPosition && !disabled ? createPortal(
        <div
          ref={tablePanelRef}
          className="fixed z-[90] overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-2xl"
          style={{
            left: tablePanelPosition.left,
            top: tablePanelPosition.top,
            width: tablePanelPosition.width,
            maxHeight: tablePanelPosition.maxHeight,
            opacity: tablePanelReady ? 1 : 0,
            pointerEvents: tablePanelReady ? "auto" : "none",
          }}
          aria-hidden={!tablePanelReady}
        >
          <div className="mb-3 space-y-1">
            <div className="text-sm font-medium text-foreground">插入表格</div>
            <p className="text-xs leading-5 text-muted-foreground">选择表格尺寸，点击即可插入对应行列的表格。</p>
          </div>
          <div className="grid grid-cols-8 gap-1 rounded-xl border border-border/80 bg-muted/20 p-3">
            {Array.from({ length: 6 }, (_, rowIndex) => (
              Array.from({ length: 8 }, (_, columnIndex) => {
                const active = rowIndex < tableHoverSize.rows && columnIndex < tableHoverSize.columns
                return (
                  <button
                    key={`${rowIndex + 1}-${columnIndex + 1}`}
                    type="button"
                    className={cn(
                      "h-6 w-6 rounded-[6px] border transition-colors",
                      active ? "border-foreground bg-foreground/80" : "border-border bg-background hover:border-foreground/40 hover:bg-accent",
                    )}
                      onMouseEnter={() => setTableHoverSize({ rows: rowIndex + 1, columns: columnIndex + 1 })}
                      onMouseLeave={() => setTableHoverSize({ rows: 0, columns: 0 })}
                      onFocus={() => setTableHoverSize({ rows: rowIndex + 1, columns: columnIndex + 1 })}
                      onBlur={() => setTableHoverSize({ rows: 0, columns: 0 })}
                      onClick={() => handleInsertTable(rowIndex + 1, columnIndex + 1)}
                    aria-label={`插入 ${rowIndex + 1} 行 ${columnIndex + 1} 列表格`}
                  />
                )
              })
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{tableHint}</p>
            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
              onClick={() => {
                setShowTablePanel(false)
                setTableHoverSize({ rows: 0, columns: 0 })
              }}
            >
              取消
            </button>
          </div>
        </div>,
        document.body,
      ) : null}
      {isClient && showEmojiPanel && emojiPanelPosition && !disabled ? createPortal(
        <div
          ref={emojiPanelRef}
          className="fixed z-[90] overflow-y-auto rounded-2xl border border-border bg-background p-3 shadow-2xl"
          style={{
            left: emojiPanelPosition.left,
            top: emojiPanelPosition.top,
            width: emojiPanelPosition.width,
            maxHeight: emojiPanelPosition.maxHeight,
            opacity: emojiPanelReady ? 1 : 0,
            pointerEvents: emojiPanelReady ? "auto" : "none",
          }}
          aria-hidden={!emojiPanelReady}
        >


          <EmojiPicker
            items={markdownEmojiMap.map((emoji) => ({
              key: emoji.shortcode,
              value: emoji.shortcode,
              icon: emoji.icon,
              label: emoji.label,
            }))}
            onSelect={(shortcode) => {
              applyWrap(`:${shortcode}: `)
              setShowEmojiPanel(false)
            }}
          />

        </div>,
        document.body,
      ) : null}
      {isClient && showUploadPanel && uploadPanelPosition ? createPortal(
        <div
          ref={uploadPanelRef}
          className="fixed z-[90] overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-2xl"
          style={{
            left: uploadPanelPosition.left,
            top: uploadPanelPosition.top,
            width: uploadPanelPosition.width,
            maxHeight: uploadPanelPosition.maxHeight,
            opacity: uploadPanelReady ? 1 : 0,
            pointerEvents: uploadPanelReady ? "auto" : "none",
          }}
          aria-hidden={!uploadPanelReady}
        >
          <div className="mb-3 space-y-1">
            <div className="text-sm font-medium text-foreground">图片上传</div>
            <p className="text-xs leading-5 text-muted-foreground">
              {uploading
                ? `队列处理中：正在上传 ${uploadSummary.activeCount} 张，等待 ${uploadSummary.queuedCount} 张，已完成 ${uploadSummary.completedCount}/${uploadSummary.totalCount}。`
                : `本次上传完成：成功 ${uploadSummary.successCount} 张，失败 ${uploadSummary.errorCount} 张。`}
            </p>
          </div>
          <ul className="space-y-2">
            {uploadResults.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-xs">
                <span
                  className={[
                    "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    item.status === "success" && "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
                    item.status === "error" && "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
                    item.status === "uploading" && "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
                    item.status === "queued" && "bg-muted text-muted-foreground",
                  ].filter(Boolean).join(" ")}
                >
                  {item.status === "success" && "✓"}
                  {item.status === "error" && "✗"}
                  {item.status === "uploading" && "↑"}
                  {item.status === "queued" && "…"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{item.name}</span>
                  {item.status === "queued" && (
                    <span className="block text-muted-foreground">排队中，等待前面的任务完成</span>
                  )}
                  {item.status === "uploading" && (
                    <span className="block text-sky-700 dark:text-sky-400">上传中…</span>
                  )}
                  {item.status === "error" && item.errorMessage && (
                    <span className="block text-red-600 dark:text-red-400">{item.errorMessage}</span>
                  )}
                  {item.status === "success" && item.urlPath && (
                    <span className="block truncate text-muted-foreground">{item.urlPath}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {!uploading && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                className="rounded-full px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                onClick={() => {
                  clearUploadResults()
                  setShowUploadPanel(false)
                  requestAnimationFrame(() => fileInputRef.current?.click())
                }}
              >
                继续上传
              </button>
              <button
                type="button"
                className="rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
                onClick={() => setShowUploadPanel(false)}
              >
                关闭
              </button>
            </div>
          )}
        </div>,
        document.body,
      ) : null}
    </div>
  )
}

