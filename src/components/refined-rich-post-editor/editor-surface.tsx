"use client"

import React from "react"
import { Bold, CircleHelp, Highlighter, ImageIcon, Link2, Maximize2, Minimize2, Quote, SeparatorHorizontal, Smile, Strikethrough, Table2, Underline, Video } from "lucide-react"

import { EDITOR_LINE_HEIGHT_REM, EDITOR_LINE_NUMBER_GUTTER_WIDTH_CLASS, TOOLBAR_TIPS } from "@/components/refined-rich-post-editor/constants"
import { AlignmentSelect, CodeFormatSelect, HeadingSelect, ListSelect, ToolButton } from "@/components/refined-rich-post-editor/toolbar-controls"
import type { ToolbarTipDefinition } from "@/components/refined-rich-post-editor/types"
import { MarkdownContent } from "@/components/markdown-content"
import type { ClientPlatform } from "@/lib/client-platform"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import { cn } from "@/lib/utils"

type EditorHeaderProps = {
  activeTab: "write" | "preview"
  disabled: boolean
  isFullscreen: boolean
  uploading: boolean
  valueLength: number
  onTabChange: (tab: "write" | "preview") => void
  onEnterFullscreen: () => void
  onExitFullscreen: () => void
}

export function EditorHeader({
  activeTab,
  disabled,
  isFullscreen,
  uploading,
  valueLength,
  onTabChange,
  onEnterFullscreen,
  onExitFullscreen,
}: EditorHeaderProps) {
  return (
    <>
      {isFullscreen ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur sm:px-5">
          <div>
            <p className="text-sm font-medium text-foreground">全屏编辑器</p>
            <p className="text-xs text-muted-foreground">可按 Esc 快速退出全屏</p>
          </div>
          <button
            type="button"
            onClick={onExitFullscreen}
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
              onClick={() => onTabChange("write")}
              className={activeTab === "write" ? "border-b-2 border-foreground pb-2 text-sm font-medium text-foreground transition-colors" : "pb-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"}
            >
              正文
            </button>
            <button
              type="button"
              onClick={() => onTabChange("preview")}
              className={activeTab === "preview" ? "border-b-2 border-foreground pb-2 text-sm font-medium text-foreground transition-colors" : "pb-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"}
            >
              预览
            </button>
          </div>
          <div className="flex items-center gap-3 pb-2">
            <p className="text-xs text-muted-foreground">{valueLength} 字符{uploading ? " · 上传中" : ""}</p>
            {!disabled && !isFullscreen ? (
              <button
                type="button"
                onClick={onEnterFullscreen}
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
    </>
  )
}

type EditorBodyProps = {
  activeTab: "write" | "preview"
  isFullscreen: boolean
  contentMinHeight: number | string
  value: string
  placeholder?: string
  disabled: boolean
  markdownEmojiMap: MarkdownEmojiItem[]
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  lineMeasureContainerRef: React.RefObject<HTMLDivElement | null>
  lineMeasureRefs: React.MutableRefObject<Array<HTMLDivElement | null>>
  logicalLines: string[]
  lineNumbers: number[]
  lineHeights: number[]
  activeLineNumber: number
  editorScrollTop: number
  onChange: (value: string) => void
  onScroll: (event: React.UIEvent<HTMLTextAreaElement>) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onSelect: (event: React.SyntheticEvent<HTMLTextAreaElement>) => void
  onPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => Promise<void>
}

export function EditorBody({
  activeTab,
  isFullscreen,
  contentMinHeight,
  value,
  placeholder,
  disabled,
  markdownEmojiMap,
  textareaRef,
  lineMeasureContainerRef,
  lineMeasureRefs,
  logicalLines,
  lineNumbers,
  lineHeights,
  activeLineNumber,
  editorScrollTop,
  onChange,
  onScroll,
  onKeyDown,
  onSelect,
  onPaste,
}: EditorBodyProps) {
  const writeContainerClassName = isFullscreen
    ? "relative flex min-h-0 flex-1 overflow-hidden rounded-xl bg-transparent"
    : "relative flex overflow-hidden rounded-xl bg-transparent"
  const writeContainerStyle = isFullscreen
    ? { minHeight: 0 }
    : { minHeight: contentMinHeight, maxHeight: contentMinHeight }
  const textareaStyle = isFullscreen
    ? { minHeight: 0, maxHeight: "none" as const }
    : { minHeight: contentMinHeight, maxHeight: contentMinHeight }

  return (
    <div
      className={activeTab === "write"
        ? (isFullscreen ? "flex min-h-0 flex-1 flex-col px-3 pt-3 sm:px-5" : "pl-1 pr-3 pt-3 sm:pl-1 sm:pr-5")
        : (isFullscreen ? "flex min-h-0 flex-1 flex-col px-3 pb-4 pt-3 sm:px-5 sm:pb-8" : "px-3 pb-4 pt-3 sm:px-5")}
    >
      {activeTab === "write" ? (
        <div
          key="write-panel"
          className={writeContainerClassName}
          style={writeContainerStyle}
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
            onScroll={onScroll}
            onKeyDown={onKeyDown}
            onKeyUp={onSelect}
            onClick={onSelect}
            onSelect={onSelect}
            onPaste={onPaste}
            disabled={disabled}
            className="w-full resize-none overflow-y-auto rounded-none border-0 bg-transparent pl-2 pr-0 py-1 font-mono text-sm leading-7 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
            placeholder={placeholder}
            style={textareaStyle}
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
        <div key="preview-panel" className="min-w-0 overflow-y-auto" style={{ minHeight: contentMinHeight, maxHeight: contentMinHeight }}>
          <MarkdownContent content={value} emptyText="暂无预览内容" markdownEmojiMap={markdownEmojiMap} />
        </div>
      )}
    </div>
  )
}

type EditorToolbarProps = {
  visible: boolean
  disabled: boolean
  isFullscreen: boolean
  platform: ClientPlatform
  imageToolbarTip: ToolbarTipDefinition
  markdownImageUploadEnabled: boolean
  uploading: boolean
  showMediaPanel: boolean
  showEmojiPanel: boolean
  showTablePanel: boolean
  showLinkPanel: boolean
  showImagePanel: boolean
  showBase64Dialog: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  mediaButtonRef: React.RefObject<HTMLDivElement | null>
  emojiButtonRef: React.RefObject<HTMLDivElement | null>
  tableButtonRef: React.RefObject<HTMLDivElement | null>
  linkButtonRef: React.RefObject<HTMLDivElement | null>
  imageButtonRef: React.RefObject<HTMLDivElement | null>
  onToolbarMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void
  onToolbarSelectMouseDown: () => void
  onToolbarSelectOpenChange: (open: boolean) => void
  onSetHeadingLevel: (level: 1 | 2 | 3) => void
  onBold: () => void
  onUnderline: () => void
  onStrike: () => void
  onHighlight: () => void
  onCodeFormat: (value: "inline-code" | "code-block") => void
  onQuote: () => void
  onListFormat: (value: "unordered" | "unordered-star" | "ordered" | "task") => void
  onToggleLinkPanel: () => void
  onToggleTablePanel: () => void
  onInsertDivider: () => void
  onAlign: (value: "left" | "center" | "right") => void
  onToggleMediaPanel: () => void
  onToggleEmojiPanel: () => void
  onTriggerImageShortcut: () => void
  onOpenBase64Dialog: () => void
  onOpenHelpDialog: () => void
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>
}

export function EditorToolbar({
  visible,
  disabled,
  isFullscreen,
  platform,
  imageToolbarTip,
  markdownImageUploadEnabled,
  uploading,
  showMediaPanel,
  showEmojiPanel,
  showTablePanel,
  showLinkPanel,
  showImagePanel,
  showBase64Dialog,
  fileInputRef,
  mediaButtonRef,
  emojiButtonRef,
  tableButtonRef,
  linkButtonRef,
  imageButtonRef,
  onToolbarMouseDown,
  onToolbarSelectMouseDown,
  onToolbarSelectOpenChange,
  onSetHeadingLevel,
  onBold,
  onUnderline,
  onStrike,
  onHighlight,
  onCodeFormat,
  onQuote,
  onListFormat,
  onToggleLinkPanel,
  onToggleTablePanel,
  onInsertDivider,
  onAlign,
  onToggleMediaPanel,
  onToggleEmojiPanel,
  onTriggerImageShortcut,
  onOpenBase64Dialog,
  onOpenHelpDialog,
  onUpload,
}: EditorToolbarProps) {
  if (!visible) {
    return null
  }

  return (
    <div className={`relative flex flex-col gap-3 border-t border-border ${isFullscreen ? "" : "mt-2 pt-2"} sm:flex-row sm:items-center sm:justify-between`}>
      <div className="-mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:w-auto sm:px-0 sm:pb-0">
        <HeadingSelect
          disabled={disabled}
          platform={platform}
          onMouseDown={onToolbarSelectMouseDown}
          onOpenChange={onToolbarSelectOpenChange}
          onSelect={onSetHeadingLevel}
        />
        <ToolButton tip={TOOLBAR_TIPS.bold} platform={platform} onMouseDown={onToolbarMouseDown} onClick={onBold} disabled={disabled}>
          <Bold className="h-4 w-4" />
        </ToolButton>
        <ToolButton tip={TOOLBAR_TIPS.underline} platform={platform} onMouseDown={onToolbarMouseDown} onClick={onUnderline} disabled={disabled}>
          <Underline className="h-4 w-4" />
        </ToolButton>
        <ToolButton tip={TOOLBAR_TIPS.strike} platform={platform} onMouseDown={onToolbarMouseDown} onClick={onStrike} disabled={disabled}>
          <Strikethrough className="h-4 w-4" />
        </ToolButton>
        <ToolButton tip={TOOLBAR_TIPS.highlight} platform={platform} onMouseDown={onToolbarMouseDown} onClick={onHighlight} disabled={disabled}>
          <Highlighter className="h-4 w-4" />
        </ToolButton>
        <CodeFormatSelect
          disabled={disabled}
          platform={platform}
          onMouseDown={onToolbarSelectMouseDown}
          onOpenChange={onToolbarSelectOpenChange}
          onSelect={onCodeFormat}
        />
        <ToolButton tip={TOOLBAR_TIPS.quote} platform={platform} onMouseDown={onToolbarMouseDown} onClick={onQuote} disabled={disabled}>
          <Quote className="h-4 w-4" />
        </ToolButton>
        <ListSelect
          disabled={disabled}
          platform={platform}
          onMouseDown={onToolbarSelectMouseDown}
          onOpenChange={onToolbarSelectOpenChange}
          onSelect={onListFormat}
        />
        <div className="relative" ref={linkButtonRef}>
          <ToolButton tip={TOOLBAR_TIPS.link} platform={platform} onMouseDown={onToolbarMouseDown} onClick={onToggleLinkPanel} disabled={disabled} active={showLinkPanel}>
            <Link2 className="h-4 w-4" />
          </ToolButton>
        </div>
        <div className="relative" ref={tableButtonRef}>
          <ToolButton tip={TOOLBAR_TIPS.table} platform={platform} onMouseDown={onToolbarMouseDown} onClick={onToggleTablePanel} disabled={disabled} active={showTablePanel}>
            <Table2 className="h-4 w-4" />
          </ToolButton>
        </div>
        <ToolButton tip={TOOLBAR_TIPS.divider} platform={platform} onMouseDown={onToolbarMouseDown} onClick={onInsertDivider} disabled={disabled}>
          <SeparatorHorizontal className="h-4 w-4" />
        </ToolButton>
        <AlignmentSelect
          disabled={disabled}
          platform={platform}
          onMouseDown={onToolbarSelectMouseDown}
          onOpenChange={onToolbarSelectOpenChange}
          onSelect={onAlign}
        />
        <div className="relative" ref={mediaButtonRef}>
          <ToolButton tip={TOOLBAR_TIPS.media} platform={platform} onMouseDown={onToolbarMouseDown} onClick={onToggleMediaPanel} disabled={disabled} active={showMediaPanel}>
            <Video className="h-4 w-4" />
          </ToolButton>
        </div>
        <div className="relative" ref={emojiButtonRef}>
          <ToolButton tip={TOOLBAR_TIPS.emoji} platform={platform} onMouseDown={onToolbarMouseDown} onClick={onToggleEmojiPanel} disabled={disabled} active={showEmojiPanel}>
            <Smile className="h-4 w-4" />
          </ToolButton>
        </div>
        <div className="relative" ref={imageButtonRef}>
          <ToolButton
            tip={imageToolbarTip}
            platform={platform}
            onMouseDown={onToolbarMouseDown}
            onClick={onTriggerImageShortcut}
            disabled={disabled || (markdownImageUploadEnabled && uploading)}
            active={showImagePanel}
          >
            <ImageIcon className="h-4 w-4" />
          </ToolButton>
          <input ref={fileInputRef} accept="image/*" multiple className="hidden" type="file" onChange={onUpload} disabled={disabled || !markdownImageUploadEnabled || uploading} />
        </div>
        <ToolButton tip={TOOLBAR_TIPS.base64} platform={platform} onMouseDown={onToolbarMouseDown} onClick={onOpenBase64Dialog} disabled={disabled} active={showBase64Dialog}>
          <svg className="h-4 w-4" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
            <path d="M192 608H96v320H192A96.64 96.64 0 0 0 288 832a94.08 94.08 0 0 0-26.88-64 94.08 94.08 0 0 0 26.88-64A96.64 96.64 0 0 0 192 608z m0 256h-32v-64H192a32 32 0 0 1 0 64z m0-128h-32v-64H192a32 32 0 0 1 0 64z m462.08 0c-26.88-13.44-46.08-23.68-46.08-36.48a36.48 36.48 0 0 1 7.68-22.4 31.36 31.36 0 0 1 24.32-5.12h90.88a90.88 90.88 0 0 0-90.88-64 94.08 94.08 0 0 0-71.68 28.16A99.84 99.84 0 0 0 544 704c0 51.84 47.36 74.88 81.92 92.16s46.08 23.68 46.08 36.48a40.96 40.96 0 0 1-8.96 23.68 28.16 28.16 0 0 1-23.04 7.68H549.76a96 96 0 0 0 21.76 37.76 92.8 92.8 0 0 0 68.48 26.24 94.08 94.08 0 0 0 68.48-26.24A104.32 104.32 0 0 0 736 832c0-52.48-47.36-76.16-81.92-93.44z m305.92-64v-64h-192v320h192v-64h-128v-64h64v-64h-64v-64z m-544-64A96.64 96.64 0 0 0 320 704v224h64v-64h64v64h64V704a96.64 96.64 0 0 0-96-96z m32 192H384V704a32 32 0 0 1 64 0zM480 448A96.64 96.64 0 0 0 384 352a104.96 104.96 0 0 0-32 5.76V320a32 32 0 0 1 32-32h90.24A96 96 0 0 0 288 320v128a96 96 0 0 0 192 0z m-128 0a32 32 0 1 1 32 32 32 32 0 0 1-32-32zM640 544h64v-320h-64v128H576v-128H512V384a32 32 0 0 0 32 32H640z" fill="#FF8910" />
            <path d="M192 544V192a32 32 0 0 1 32-32h512V256H832v288h64v-320l-128-128H224A96 96 0 0 0 128 192v352z" fill="#616971" />
          </svg>
        </ToolButton>
        <ToolButton tip={TOOLBAR_TIPS.help} platform={platform} onMouseDown={onToolbarMouseDown} onClick={onOpenHelpDialog} disabled={disabled}>
          <CircleHelp className="h-4 w-4" />
        </ToolButton>
      </div>
    </div>
  )
}
