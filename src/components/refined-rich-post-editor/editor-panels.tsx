"use client"

import React from "react"

import { AdminModal } from "@/components/admin-modal"
import { EmojiPicker } from "@/components/emoji-picker"
import { FloatingEditorPanel } from "@/components/refined-rich-post-editor/floating-panels"
import type { FloatingPanelPosition } from "@/components/refined-rich-post-editor/types"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import { cn } from "@/lib/utils"
import type { UploadFileResult } from "@/hooks/use-image-upload"

type FloatingPanelBaseProps = {
  open: boolean
  isClient: boolean
  disabled?: boolean
  position: FloatingPanelPosition | null
  ready: boolean
  panelRef: React.MutableRefObject<HTMLDivElement | null>
}

type UploadSummary = {
  totalCount: number
  queuedCount: number
  activeCount: number
  successCount: number
  errorCount: number
  completedCount: number
}

type Base64DialogProps = {
  open: boolean
  value: string
  preview: string
  onChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}

export function Base64Dialog({
  open,
  value,
  preview,
  onChange,
  onClose,
  onConfirm,
}: Base64DialogProps) {
  return (
    <AdminModal
      open={open}
      onClose={onClose}
      size="lg"
      title="Base64 快捷工具"
      description="输入文本后会按 UTF-8 编码为 Base64，并插入到当前光标或选区位置。"
      footer={(
        <div className="flex items-center justify-end gap-2">
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
            disabled={!preview}
          >
            插入编码
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="markdown-base64-input" className="text-sm font-medium text-foreground">
            原始文本
          </label>
          <textarea
            id="markdown-base64-input"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="输入需要编码的文本"
            className="min-h-32 w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-foreground"
          />
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">编码结果预览</div>
          <div className="max-h-40 overflow-y-auto rounded-2xl border border-border bg-muted/20 px-4 py-3 font-mono text-xs leading-6 text-muted-foreground">
            {preview || "输入文本后将在这里显示 Base64 结果"}
          </div>
        </div>
      </div>
    </AdminModal>
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
      position={position}
      ready={ready}
      panelRef={panelRef}
      className="fixed z-[90] overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-2xl"
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
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-foreground"
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
      position={position}
      ready={ready}
      panelRef={panelRef}
      className="fixed z-[90] overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-2xl"
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
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-foreground"
        />
        <input
          type="url"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="https://example.com"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-foreground"
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
  hoverSize: { rows: number; columns: number }
  hint: string
  onHoverChange: (size: { rows: number; columns: number }) => void
  onClose: () => void
  onSelect: (rows: number, columns: number) => void
}

export function TableInsertPanel({
  open,
  isClient,
  disabled,
  position,
  ready,
  panelRef,
  hoverSize,
  hint,
  onHoverChange,
  onClose,
  onSelect,
}: TableInsertPanelProps) {
  return (
    <FloatingEditorPanel
      open={open}
      isClient={isClient}
      disabled={disabled}
      position={position}
      ready={ready}
      panelRef={panelRef}
      className="fixed z-[90] overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-2xl"
    >
      <div className="mb-3 space-y-1">
        <div className="text-sm font-medium text-foreground">插入表格</div>
        <p className="text-xs leading-5 text-muted-foreground">选择表格尺寸，点击即可插入对应行列的表格。</p>
      </div>
      <div className="grid grid-cols-8 gap-1 rounded-xl border border-border/80 bg-muted/20 p-3">
        {Array.from({ length: 6 }, (_, rowIndex) => (
          Array.from({ length: 8 }, (_, columnIndex) => {
            const active = rowIndex < hoverSize.rows && columnIndex < hoverSize.columns
            return (
              <button
                key={`${rowIndex + 1}-${columnIndex + 1}`}
                type="button"
                className={cn(
                  "h-6 w-6 rounded-[6px] border transition-colors",
                  active ? "border-foreground bg-foreground/80" : "border-border bg-background hover:border-foreground/40 hover:bg-accent",
                )}
                onMouseEnter={() => onHoverChange({ rows: rowIndex + 1, columns: columnIndex + 1 })}
                onMouseLeave={() => onHoverChange({ rows: 0, columns: 0 })}
                onFocus={() => onHoverChange({ rows: rowIndex + 1, columns: columnIndex + 1 })}
                onBlur={() => onHoverChange({ rows: 0, columns: 0 })}
                onClick={() => onSelect(rowIndex + 1, columnIndex + 1)}
                aria-label={`插入 ${rowIndex + 1} 行 ${columnIndex + 1} 列表格`}
              />
            )
          })
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{hint}</p>
        <button
          type="button"
          className="rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
          onClick={onClose}
        >
          取消
        </button>
      </div>
    </FloatingEditorPanel>
  )
}

type EmojiInsertPanelProps = FloatingPanelBaseProps & {
  markdownEmojiMap: MarkdownEmojiItem[]
  onSelect: (shortcode: string) => void
}

export function EmojiInsertPanel({
  open,
  isClient,
  disabled,
  position,
  ready,
  panelRef,
  markdownEmojiMap,
  onSelect,
}: EmojiInsertPanelProps) {
  return (
    <FloatingEditorPanel
      open={open}
      isClient={isClient}
      disabled={disabled}
      position={position}
      ready={ready}
      panelRef={panelRef}
      className="fixed z-[90] overflow-y-auto rounded-2xl border border-border bg-background p-3 shadow-2xl"
    >
      <EmojiPicker
        items={markdownEmojiMap.map((emoji) => ({
          key: emoji.shortcode,
          value: emoji.shortcode,
          icon: emoji.icon,
          label: emoji.label,
        }))}
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
      position={position}
      ready={ready}
      panelRef={panelRef}
      className="fixed z-[90] overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-2xl"
    >
      {markdownImageUploadEnabled ? (
        <>
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
                  onContinueUpload()
                  requestAnimationFrame(() => fileInputRef.current?.click())
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
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-foreground"
            />
            <input
              type="text"
              value={remoteImageAlt}
              onChange={(event) => onRemoteImageAltChange(event.target.value)}
              placeholder="图片说明（可选）"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-foreground"
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
