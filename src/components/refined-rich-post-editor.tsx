"use client"

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"


import { createPortal } from "react-dom"

import { Bold, Heading2, Highlighter, ImageIcon, Maximize2, Minimize2, Quote, Smile, Video } from "lucide-react"

import { EmojiPicker } from "@/components/emoji-picker"
import { MarkdownContent } from "@/components/markdown-content"
import { useMarkdownEmojiMap } from "@/components/site-settings-provider"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"



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

      className={active ? "rounded-lg bg-accent p-2 text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50" : "rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"}
    >
      {children}
    </button>
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
  const mediaPanelRef = useRef<HTMLDivElement | null>(null)
  const emojiPanelRef = useRef<HTMLDivElement | null>(null)
  const mediaButtonRef = useRef<HTMLDivElement | null>(null)
  const emojiButtonRef = useRef<HTMLDivElement | null>(null)
  const selectionRef = useRef({ start: 0, end: 0 })

  const [activeTab, setActiveTab] = useState<"write" | "preview">("write")

  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState("")
  const [showEmojiPanel, setShowEmojiPanel] = useState(false)
  const [showMediaPanel, setShowMediaPanel] = useState(false)
  const [mediaUrl, setMediaUrl] = useState("")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mediaPanelPosition, setMediaPanelPosition] = useState<FloatingPanelPosition | null>(null)
  const [emojiPanelPosition, setEmojiPanelPosition] = useState<FloatingPanelPosition | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [isMediaPanelReady, setIsMediaPanelReady] = useState(false)
  const [isEmojiPanelReady, setIsEmojiPanelReady] = useState(false)
  const markdownEmojiMap = useMarkdownEmojiMap(externalMarkdownEmojiMap)


  const contentMinHeight = isFullscreen ? "calc(100vh - 220px)" : minHeight


  const mediaHint = useMemo(() => {

    if (!mediaUrl.trim()) {
      return "粘贴视频或音频地址，将插入可解析媒体标记。"
    }

    const parsed = inferMediaInsert(mediaUrl)
    return parsed?.message ?? "请输入有效的媒体地址"
  }, [mediaUrl])

  useEffect(() => {
    setIsClient(true)
  }, [])






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


  const syncFloatingPanels = useCallback(() => {
    if (showMediaPanel) {
      const nextMediaPosition = updateFloatingPanelPosition(mediaButtonRef.current, mediaPanelRef.current, 320)
      setMediaPanelPosition(nextMediaPosition)
      setIsMediaPanelReady(Boolean(nextMediaPosition && mediaPanelRef.current?.offsetHeight))
    } else {
      setMediaPanelPosition(null)
      setIsMediaPanelReady(false)
    }

    if (showEmojiPanel) {
      const nextEmojiPosition = updateFloatingPanelPosition(emojiButtonRef.current, emojiPanelRef.current, 260)
      setEmojiPanelPosition(nextEmojiPosition)
      setIsEmojiPanelReady(Boolean(nextEmojiPosition && emojiPanelRef.current?.offsetHeight))
    } else {
      setEmojiPanelPosition(null)
      setIsEmojiPanelReady(false)
    }
  }, [showEmojiPanel, showMediaPanel, updateFloatingPanelPosition])

  useLayoutEffect(() => {
    if (!showMediaPanel && !showEmojiPanel) {
      return
    }

    syncFloatingPanels()

    const frameId = window.requestAnimationFrame(() => {
      syncFloatingPanels()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [showEmojiPanel, showMediaPanel, syncFloatingPanels])



  useEffect(() => {
    if (!showMediaPanel && !showEmojiPanel) {
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
  }, [showEmojiPanel, showMediaPanel, syncFloatingPanels])


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

  const toggleMediaPanel = useCallback(() => {
    setShowEmojiPanel(false)
    setShowMediaPanel((current) => !current)
  }, [])

  const toggleEmojiPanel = useCallback(() => {
    setShowMediaPanel(false)
    setShowEmojiPanel((current) => !current)
  }, [])


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

    setUploading(true)
    setMessage("")

    try {
      const uploadedMarkdown: string[] = []
      for (const file of files) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("folder", uploadFolder)

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.message ?? `${file.name} 上传失败`)
        }

        uploadedMarkdown.push(`![${file.name}](${result.data?.urlPath ?? ""})`)
      }

      insertTemplate(uploadedMarkdown.join("\n\n"))
      setMessage(`已插入 ${uploadedMarkdown.length} 张图片`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "图片上传失败")
    } finally {
      setUploading(false)
      event.target.value = ""
    }
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
          </div>

          <div className={isFullscreen ? "flex min-h-0 flex-1 flex-col px-3 pb-4 pt-3 sm:px-5 sm:pb-8" : "px-3 pb-4 pt-3 sm:px-5"}>

            {activeTab === "write" ? (
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                disabled={disabled}
                className="w-full resize-none overflow-y-auto rounded-xl border-0 bg-transparent px-0 py-1 font-mono text-sm leading-7 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
                placeholder={placeholder}
                style={{ minHeight: contentMinHeight, maxHeight: contentMinHeight }}
              />
            ) : (
              <div className="min-w-0 overflow-y-auto" style={{ minHeight: contentMinHeight, maxHeight: contentMinHeight }}>

                <MarkdownContent content={value} emptyText="暂无预览内容" markdownEmojiMap={markdownEmojiMap} />

              </div>
            )}

            <div className={`relative mt-2 flex flex-col gap-3 border-t border-border ${isFullscreen ? "" : "pt-2"} sm:flex-row sm:items-center sm:justify-between`}>
              <div className="-mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:w-auto sm:px-0 sm:pb-0">

                <ToolButton title="加粗" onMouseDown={handleToolbarMouseDown} onClick={() => applyWrap("**", "**")} disabled={disabled}>

                  <Bold className="h-4 w-4" />
                </ToolButton>
                <ToolButton title="一级标题" onClick={() => insertLinePrefix("# ")} disabled={disabled}>
                  <span className="text-xs font-semibold leading-none">H1</span>
                </ToolButton>
                <ToolButton title="二级标题" onClick={() => insertLinePrefix("## ")} disabled={disabled}>
                  <Heading2 className="h-4 w-4" />
                </ToolButton>
                <ToolButton title="三级标题" onClick={() => insertLinePrefix("### ")} disabled={disabled}>
                  <span className="text-xs font-semibold leading-none">H3</span>
                </ToolButton>
                <ToolButton title="高亮" onClick={() => applyWrap("`", "`")} disabled={disabled}>
                  <Highlighter className="h-4 w-4" />
                </ToolButton>
                <ToolButton title="引用" onMouseDown={handleToolbarMouseDown} onClick={() => insertLinePrefix("> ")} disabled={disabled}>

                  <Quote className="h-4 w-4" />
                </ToolButton>


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


                <ToolButton title="添加图片" onMouseDown={handleToolbarMouseDown} onClick={() => fileInputRef.current?.click()} disabled={disabled || uploading}>

                  <ImageIcon className="h-4 w-4" />
                </ToolButton>
                <ToolButton title={isFullscreen ? "退出全屏" : "全屏编辑"} onMouseDown={handleToolbarMouseDown} onClick={() => setIsFullscreen((current) => !current)} disabled={disabled}>

                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </ToolButton>

                <input ref={fileInputRef} accept="image/*" multiple className="hidden" type="file" onChange={handleUpload} disabled={disabled || uploading} />
              </div>
              <p className="text-xs text-muted-foreground">{value.length} 字符{uploading ? " · 上传中" : ""}</p>
            </div>

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
            opacity: isMediaPanelReady ? 1 : 0,
            pointerEvents: isMediaPanelReady ? "auto" : "none",
          }}
          aria-hidden={!isMediaPanelReady}
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
      {isClient && showEmojiPanel && emojiPanelPosition && !disabled ? createPortal(
        <div
          ref={emojiPanelRef}
          className="fixed z-[90] overflow-y-auto rounded-2xl border border-border bg-background p-3 shadow-2xl"
          style={{
            left: emojiPanelPosition.left,
            top: emojiPanelPosition.top,
            width: emojiPanelPosition.width,
            maxHeight: emojiPanelPosition.maxHeight,
            opacity: isEmojiPanelReady ? 1 : 0,
            pointerEvents: isEmojiPanelReady ? "auto" : "none",
          }}
          aria-hidden={!isEmojiPanelReady}
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
    </div>
  )
}

