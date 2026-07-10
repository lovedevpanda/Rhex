"use client"

import React from "react"
import { createPortal } from "react-dom"
import { ChevronDown, Search, Table2 } from "lucide-react"

import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmojiPicker } from "@/components/emoji-picker"
import { FloatingEditorPanel } from "@/components/refined-rich-post-editor/floating-panels"
import type { FloatingPanelPosition, PrivateReplyRecipient, UploadSummary } from "@/components/refined-rich-post-editor/types"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import type { UploadFileResult } from "@/hooks/use-image-upload"

const FLOATING_EDITOR_PANEL_CLASSNAME = "overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl"

type FloatingPanelBaseProps = {
  open: boolean
  isClient: boolean
  disabled?: boolean
  anchorRef: React.RefObject<HTMLDivElement | null>
  position: FloatingPanelPosition | null
  ready: boolean
  panelRef: React.MutableRefObject<HTMLDivElement | null>
}

type Base64DialogProps = {
  open: boolean
  inFullscreenEditor: boolean
  value: string
  preview: string
  mode: "base64" | "private"
  allowPrivateReply: boolean
  privateReplyPostId?: string
  privateValue: string
  privateRecipient: PrivateReplyRecipient | null
  onChange: (value: string) => void
  onModeChange: (value: "base64" | "private") => void
  onPrivateValueChange: (value: string) => void
  onPrivateRecipientChange: (value: PrivateReplyRecipient | null) => void
  onClose: () => void
  onConfirm: () => void
  onConfirmPrivate: () => void
}

export function Base64Dialog(props: Base64DialogProps) {
  if (!props.open) {
    return null
  }

  return <Base64DialogContent key={props.mode} {...props} />
}

function Base64DialogContent({
  open,
  inFullscreenEditor,
  value,
  preview,
  mode,
  allowPrivateReply,
  privateReplyPostId,
  privateValue,
  privateRecipient,
  onChange,
  onModeChange,
  onPrivateValueChange,
  onPrivateRecipientChange,
  onClose,
  onConfirm,
  onConfirmPrivate,
}: Base64DialogProps) {
  const [query, setQuery] = React.useState("")
  const [users, setUsers] = React.useState<PrivateReplyRecipient[]>([])
  const [loadingUsers, setLoadingUsers] = React.useState(false)
  const [selectorOpen, setSelectorOpen] = React.useState(false)
  const selectorButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const [selectorPosition, setSelectorPosition] = React.useState<React.CSSProperties>({})

  const updateSelectorPosition = React.useCallback(() => {
    const trigger = selectorButtonRef.current
    if (!trigger) {
      return
    }

    const rect = trigger.getBoundingClientRect()
    setSelectorPosition({
      position: "fixed",
      top: rect.bottom + 8,
      left: rect.left,
      width: Math.min(rect.width, 560),
    })
  }, [])

  React.useEffect(() => {
    if (mode !== "private" || !allowPrivateReply) {
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const timeoutId = window.setTimeout(() => {
      setLoadingUsers(true)
      const url = new URL("/api/users/search", window.location.origin)
      if (query.trim()) {
        url.searchParams.set("q", query.trim())
      }
      if (privateReplyPostId) {
        url.searchParams.set("postId", privateReplyPostId)
      }

      fetch(url.toString(), {
        credentials: "same-origin",
        signal: controller.signal,
      })
        .then((response) => response.ok ? response.json() : null)
        .then((result) => {
          if (cancelled) {
            return
          }

          const nextUsers = Array.isArray(result?.data?.users)
            ? result.data.users
                .map((user: { id?: unknown; username?: unknown; displayName?: unknown; roleLabel?: unknown; isPostAuthor?: unknown }) => ({
                  id: Number(user.id),
                  username: typeof user.username === "string" ? user.username : "",
                  displayName: typeof user.displayName === "string" ? user.displayName : "",
                  roleLabel: typeof user.roleLabel === "string" && user.roleLabel.trim() ? user.roleLabel.trim() : null,
                  isPostAuthor: user.isPostAuthor === true,
                }))
                .filter((user: PrivateReplyRecipient) => Number.isInteger(user.id) && user.id > 0 && user.username && user.displayName)
            : []
          setUsers(nextUsers)
        })
        .catch(() => {
          if (!cancelled) {
            setUsers([])
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoadingUsers(false)
          }
        })
    }, 160)

    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [allowPrivateReply, mode, open, privateReplyPostId, query])

  React.useLayoutEffect(() => {
    if (!selectorOpen) {
      return
    }

    updateSelectorPosition()
    window.addEventListener("resize", updateSelectorPosition)
    window.addEventListener("scroll", updateSelectorPosition, true)

    return () => {
      window.removeEventListener("resize", updateSelectorPosition)
      window.removeEventListener("scroll", updateSelectorPosition, true)
    }
  }, [selectorOpen, updateSelectorPosition])

  const primaryDisabled = mode === "base64"
    ? !preview
    : !allowPrivateReply || !privateRecipient || !privateValue.trim()

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="加密内容"
      description="选择加密方式保护你的内容。"
      overlayClassName={inFullscreenEditor ? "z-[240]" : undefined}
      contentClassName={inFullscreenEditor ? "z-[250]" : undefined}
      footer={(
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={mode === "base64" ? onConfirm : onConfirmPrivate}
            disabled={primaryDisabled}
          >
            {mode === "base64" ? "加密并插入" : "确认"}
          </button>
        </div>
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="grid rounded-2xl bg-muted p-1 sm:grid-cols-2">
          <button
            type="button"
            className={mode === "base64" ? "rounded-xl bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm" : "rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"}
            onClick={() => onModeChange("base64")}
          >
            Base64 编码
          </button>
          <button
            type="button"
            className={mode === "private" ? "rounded-xl bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm" : "rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"}
            onClick={() => onModeChange("private")}
          >
            私密回复
          </button>
        </div>

        {mode === "base64" ? (
          <textarea
            id="markdown-base64-input"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="输入 要加密的内容..."
            className="min-h-44 w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-hidden transition focus:border-foreground focus:ring-2 focus:ring-ring/40"
          />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-6 text-muted-foreground">选择可见人后，你输入的回复将以私密方式发送，仅该用户和你本人可见。</p>
            <div className="relative">
              <button
                ref={selectorButtonRef}
                type="button"
                className="flex h-14 w-full items-center justify-between rounded-2xl border border-border bg-background px-4 text-left text-sm transition hover:bg-accent/40"
                onClick={() => {
                  updateSelectorPosition()
                  setSelectorOpen((current) => !current)
                }}
                disabled={!allowPrivateReply}
              >
                <span className={privateRecipient ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {privateRecipient?.displayName ?? "选择可见人"}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
              {selectorOpen && typeof document !== "undefined" ? createPortal((
                <div className="z-[260] overflow-hidden rounded-xl border border-border bg-background shadow-xl" style={selectorPosition}>
                  <div className="p-3">
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3">
                      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="搜索用户 ..."
                        className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-hidden placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-2 pt-0">
                    {loadingUsers ? (
                      <p className="px-3 py-3 text-sm text-muted-foreground">搜索中...</p>
                    ) : users.length > 0 ? (
                      users.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          className={privateRecipient?.id === user.id ? "flex w-full min-w-0 items-center justify-between gap-3 rounded-lg bg-accent px-3 py-2 text-left text-sm font-medium text-accent-foreground" : "flex w-full min-w-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-accent hover:text-accent-foreground"}
                          onClick={() => {
                            onPrivateRecipientChange(user)
                            setSelectorOpen(false)
                            setQuery("")
                          }}
                        >
                          <span className="min-w-0 truncate">{user.displayName}</span>
                          <span className="flex shrink-0 items-center gap-1">
                            {user.isPostAuthor ? <Badge variant="secondary">楼主</Badge> : null}
                            {user.roleLabel ? <Badge variant="outline">{user.roleLabel}</Badge> : null}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-3 text-sm text-muted-foreground">没有找到用户</p>
                    )}
                  </div>
                </div>
              ), document.body) : null}
            </div>
            <textarea
              value={privateValue}
              onChange={(event) => onPrivateValueChange(event.target.value)}
              placeholder="输入私密回复内容..."
              className="min-h-28 w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-hidden transition focus:border-foreground focus:ring-2 focus:ring-ring/40"
            />
          </div>
        )}
      </div>
    </Modal>
  )
}

type MediaInsertPanelProps = FloatingPanelBaseProps & {
  value: string
  hint: string
  onChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}

export function MediaInsertPanel({
  open,
  isClient,
  disabled,
  anchorRef,
  position,
  ready,
  panelRef,
  value,
  hint,
  onChange,
  onClose,
  onConfirm,
}: MediaInsertPanelProps) {
  return (
    <FloatingEditorPanel
      open={open}
      isClient={isClient}
      disabled={disabled}
      anchorRef={anchorRef}
      position={position}
      ready={ready}
      panelRef={panelRef}
      className={`${FLOATING_EDITOR_PANEL_CLASSNAME} p-4`}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
    >
      <div className="mb-3 space-y-1">
        <div className="text-sm font-medium text-foreground">插入媒体</div>
        <p className="text-xs leading-5 text-muted-foreground">粘贴视频或音频地址，编辑器会插入可解析媒体标记，由前台统一解析成正确播放器。</p>
      </div>
      <input
        type="url"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://example.com/video.mp4"
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-hidden ring-0 transition focus:border-foreground"
      />
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          className="rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
          onClick={onClose}
        >
          取消
        </button>
        <button
          type="button"
          className="rounded-full bg-foreground px-3 py-1.5 text-xs text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onConfirm}
          disabled={!value.trim()}
        >
          插入
        </button>
      </div>
    </FloatingEditorPanel>
  )
}

type LinkInsertPanelProps = FloatingPanelBaseProps & {
  text: string
  url: string
  hint: string
  onTextChange: (value: string) => void
  onUrlChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}

export function LinkInsertPanel({
  open,
  isClient,
  disabled,
  anchorRef,
  position,
  ready,
  panelRef,
  text,
  url,
  hint,
  onTextChange,
  onUrlChange,
  onClose,
  onConfirm,
}: LinkInsertPanelProps) {
  return (
    <FloatingEditorPanel
      open={open}
      isClient={isClient}
      disabled={disabled}
      anchorRef={anchorRef}
      position={position}
      ready={ready}
      panelRef={panelRef}
      className={`${FLOATING_EDITOR_PANEL_CLASSNAME} p-4`}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
    >
      <div className="mb-3 space-y-1">
        <div className="text-sm font-medium text-foreground">插入链接</div>
        <p className="text-xs leading-5 text-muted-foreground">填写链接文本和链接地址。</p>
      </div>
      <div className="space-y-3">
        <input
          type="text"
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="链接文本"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-hidden ring-0 transition focus:border-foreground"
        />
        <input
          type="url"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="https://example.com"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-hidden ring-0 transition focus:border-foreground"
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          className="rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
          onClick={onClose}
        >
          取消
        </button>
        <button
          type="button"
          className="rounded-full bg-foreground px-3 py-1.5 text-xs text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onConfirm}
          disabled={!url.trim()}
        >
          插入
        </button>
      </div>
    </FloatingEditorPanel>
  )
}

type TableInsertPanelProps = FloatingPanelBaseProps & {
  onClose: () => void
  onSelect: (rows: number, columns: number) => void
}

export function TableInsertPanel({
  open,
  isClient,
  disabled,
  anchorRef,
  position,
  ready,
  panelRef,
  onClose,
  onSelect,
}: TableInsertPanelProps) {
  const [previewSize, setPreviewSize] = React.useState<{ rows: number; columns: number } | null>(null)

  return (
    <FloatingEditorPanel
      open={open}
      isClient={isClient}
      disabled={disabled}
      anchorRef={anchorRef}
      position={position}
      ready={ready}
      panelRef={panelRef}
      className={`${FLOATING_EDITOR_PANEL_CLASSNAME} p-4`}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setPreviewSize(null)
          onClose()
        }
      }}
    >
      <div className="mb-3 space-y-1">
        <div className="text-sm font-medium text-foreground">插入表格</div>
        <p className="text-xs leading-5 text-muted-foreground">
          {previewSize
            ? `将插入 ${previewSize.rows} 行 ${previewSize.columns} 列表格。`
            : "选择表格尺寸，点击即可插入对应行列的表格。"}
        </p>
      </div>
      <div
        className="grid grid-cols-8 gap-1 rounded-xl border border-border/80 bg-muted/20 p-3"
        onMouseLeave={() => setPreviewSize(null)}
      >
        {Array.from({ length: 6 }, (_, rowIndex) => (
          Array.from({ length: 8 }, (_, columnIndex) => {
            const active = previewSize
              ? rowIndex < previewSize.rows && columnIndex < previewSize.columns
              : false

            return (
              <button
                key={`${rowIndex + 1}-${columnIndex + 1}`}
                type="button"
                className={active
                  ? "h-6 w-6 rounded-[6px] border border-primary/50 bg-accent text-accent-foreground shadow-xs transition-colors"
                  : "h-6 w-6 rounded-[6px] border border-border bg-background transition-colors hover:border-foreground/45 hover:bg-accent focus-visible:border-foreground focus-visible:bg-accent"}
                onMouseEnter={() => setPreviewSize({ rows: rowIndex + 1, columns: columnIndex + 1 })}
                onFocus={() => setPreviewSize({ rows: rowIndex + 1, columns: columnIndex + 1 })}
                onClick={() => {
                  setPreviewSize(null)
                  onSelect(rowIndex + 1, columnIndex + 1)
                }}
                aria-label={`插入 ${rowIndex + 1} 行 ${columnIndex + 1} 列表格`}
                title={`${rowIndex + 1} × ${columnIndex + 1}`}
              >
                <span className="sr-only">{`${rowIndex + 1} × ${columnIndex + 1}`}</span>
              </button>
            )
          })
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Table2 className="h-3.5 w-3.5" />
          <span>{previewSize ? `${previewSize.rows} × ${previewSize.columns}` : "直接点击目标尺寸即可插入表格。"}</span>
        </div>
        <button
          type="button"
          className="rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
          onClick={() => {
            setPreviewSize(null)
            onClose()
          }}
        >
          取消
        </button>
      </div>
    </FloatingEditorPanel>
  )
}

type SpoilerInsertPanelProps = FloatingPanelBaseProps & {
  onClose: () => void
  onInsertSpoiler: () => void
  onInsertScratchMask: () => void
  onItemPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  onItemMouseDown: (event: React.MouseEvent<HTMLElement>) => void
}

export function SpoilerInsertPanel({
  open,
  isClient,
  disabled,
  anchorRef,
  position,
  ready,
  panelRef,
  onClose,
  onInsertSpoiler,
  onInsertScratchMask,
  onItemPointerDown,
  onItemMouseDown,
}: SpoilerInsertPanelProps) {
  return (
    <FloatingEditorPanel
      open={open}
      isClient={isClient}
      disabled={disabled}
      anchorRef={anchorRef}
      position={position}
      ready={ready}
      panelRef={panelRef}
      className={`${FLOATING_EDITOR_PANEL_CLASSNAME} p-3`}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
    >
      <div className="mb-2 flex flex-col gap-1">
        <div className="text-sm font-medium text-foreground">插入剧透</div>
        <p className="text-xs leading-5 text-muted-foreground">选择折叠剧透块，或原位点击显示的遮罩内容。</p>
      </div>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-auto flex-col items-start gap-1 rounded-xl px-3 py-3 text-left"
          onPointerDown={onItemPointerDown}
          onMouseDown={onItemMouseDown}
          onClick={() => {
            onInsertSpoiler()
            onClose()
          }}
        >
          <span>可折叠剧透</span>
          <span className="text-xs font-normal text-muted-foreground">插入 `:::spoiler 标题 ... :::` 结构。</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-auto flex-col items-start gap-1 rounded-xl px-3 py-3 text-left"
          onPointerDown={onItemPointerDown}
          onMouseDown={onItemMouseDown}
          onClick={() => {
            onInsertScratchMask()
            onClose()
          }}
        >
          <span>点击遮罩</span>
          <span className="text-xs font-normal text-muted-foreground">插入 `!!内容!!`，默认遮住文字，点击后原位显示。</span>
        </Button>
      </div>
    </FloatingEditorPanel>
  )
}

type EmojiInsertPanelProps = FloatingPanelBaseProps & {
  markdownEmojiMap: MarkdownEmojiItem[]
  onSelect: (shortcode: string) => void
  onClose: () => void
}

export function EmojiInsertPanel({
  open,
  isClient,
  disabled,
  anchorRef,
  position,
  ready,
  panelRef,
  markdownEmojiMap,
  onSelect,
  onClose,
}: EmojiInsertPanelProps) {
  return (
    <FloatingEditorPanel
      open={open}
      isClient={isClient}
      disabled={disabled}
      anchorRef={anchorRef}
      position={position}
      ready={ready}
      panelRef={panelRef}
      className="overflow-hidden rounded-[14px] border border-border bg-background p-0 shadow-2xl"
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
    >
      <EmojiPicker
        items={markdownEmojiMap.map((emoji) => ({
          key: emoji.shortcode,
          value: emoji.shortcode,
          icon: emoji.icon,
          label: emoji.label,
          group: emoji.group,
        }))}
        columns={8}
        onSelect={onSelect}
      />
    </FloatingEditorPanel>
  )
}

type ImageInsertPanelProps = FloatingPanelBaseProps & {
  markdownImageUploadEnabled: boolean
  uploading: boolean
  uploadSummary: UploadSummary
  uploadResults: UploadFileResult[]
  fileInputRef: React.RefObject<HTMLInputElement | null>
  remoteImageUrl: string
  remoteImageAlt: string
  remoteImageHint: string
  onRemoteImageUrlChange: (value: string) => void
  onRemoteImageAltChange: (value: string) => void
  onClose: () => void
  onContinueUpload: () => void
  onConfirmRemote: () => void
}

export function ImageInsertPanel({
  open,
  isClient,
  disabled,
  anchorRef,
  position,
  ready,
  panelRef,
  markdownImageUploadEnabled,
  uploading,
  uploadSummary,
  uploadResults,
  fileInputRef,
  remoteImageUrl,
  remoteImageAlt,
  remoteImageHint,
  onRemoteImageUrlChange,
  onRemoteImageAltChange,
  onClose,
  onContinueUpload,
  onConfirmRemote,
}: ImageInsertPanelProps) {
  return (
    <FloatingEditorPanel
      open={open}
      isClient={isClient}
      disabled={disabled}
      anchorRef={anchorRef}
      position={position}
      ready={ready}
      panelRef={panelRef}
      className={`${FLOATING_EDITOR_PANEL_CLASSNAME} p-4`}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
    >
      {markdownImageUploadEnabled ? (
        <>
          <div className="mb-3 space-y-1">
            <div className="text-sm font-medium text-foreground">图片上传</div>
            <p className="text-xs leading-5 text-muted-foreground">
              {uploadSummary.totalCount === 0
                ? "选择或粘贴图片后会自动上传，并插入 Markdown 图片语法。"
                : uploading
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
                  onContinueUpload()
                  fileInputRef.current?.click()
                }}
              >
                继续上传
              </button>
              <button
                type="button"
                className="rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
                onClick={onClose}
              >
                关闭
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-3 space-y-1">
            <div className="text-sm font-medium text-foreground">插入远程图片</div>
            <p className="text-xs leading-5 text-muted-foreground">后台已关闭 Markdown 图片上传，请填写可访问的远程图片地址。</p>
          </div>
          <div className="space-y-3">
            <input
              type="url"
              value={remoteImageUrl}
              onChange={(event) => onRemoteImageUrlChange(event.target.value)}
              placeholder="https://example.com/image.webp"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-hidden ring-0 transition focus:border-foreground"
            />
            <input
              type="text"
              value={remoteImageAlt}
              onChange={(event) => onRemoteImageAltChange(event.target.value)}
              placeholder="图片说明（可选）"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-hidden ring-0 transition focus:border-foreground"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{remoteImageHint}</p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              className="rounded-full bg-foreground px-3 py-1.5 text-xs text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onConfirmRemote}
              disabled={!remoteImageUrl.trim()}
            >
              插入
            </button>
          </div>
        </>
      )}
    </FloatingEditorPanel>
  )
}

