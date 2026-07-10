"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import type { KeyboardEvent as ReactKeyboardEvent } from "react"
import { createPortal } from "react-dom"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { useAddonEditorToolbarItems } from "@/addons-host/client/addon-runtime-provider"
import type {
  AddonEditorTarget,
  AddonEditorToolbarApi,
} from "@/addons-host/editor-types"
import { MarkdownEditorHelpDialog } from "@/components/post/markdown-editor-help-dialog"
import {
  AiMentionPanel,
  buildMentionInsertText,
  findActiveMentionQuery,
  type MentionChoice,
  type MentionPanelPosition,
} from "@/components/refined-rich-post-editor/ai-mention-panel"
import { TOOLBAR_TIPS } from "@/components/refined-rich-post-editor/constants"
import {
  Base64Dialog,
  EmojiInsertPanel,
  ImageInsertPanel,
  LinkInsertPanel,
  MediaInsertPanel,
  SpoilerInsertPanel,
  TableInsertPanel,
} from "@/components/refined-rich-post-editor/editor-panels"
import { EditorBody, EditorHeader, EditorToolbar, PrivateReplyDraftBanner } from "@/components/refined-rich-post-editor/editor-surface"
import { FloatingSelectionToolbar } from "@/components/refined-rich-post-editor/selection-toolbar"
import type {
  EditorSelectionRange,
  EditorSelectionStore,
  RefinedRichPostEditorProps,
} from "@/components/refined-rich-post-editor/types"
import { useEditorCommands } from "@/components/refined-rich-post-editor/use-editor-commands"
import { useEditorPanels } from "@/components/refined-rich-post-editor/use-editor-panels"
import { useEditorSelection } from "@/components/refined-rich-post-editor/use-editor-selection"
import { useEditorViewState } from "@/components/refined-rich-post-editor/use-editor-view-state"
import { useEditorToolbarSettings, useMarkdownEmojiMap, useMarkdownImageUploadEnabled } from "@/components/site-settings-provider"
import { useImageUpload } from "@/hooks/use-image-upload"
import { getClientPlatform } from "@/lib/client-platform"
import { cn } from "@/lib/utils"
import {
  insertSelection,
  setHeadingLevel,
  wrapSelection,
} from "@/lib/markdown-editor-shortcuts"

function createEditorSelectionStore(initialSelection: EditorSelectionRange): EditorSelectionStore {
  let selection = initialSelection
  const listeners = new Set<() => void>()

  return {
    getSnapshot: () => selection,
    subscribe: (listener) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
    setSelection: (nextSelection) => {
      if (selection.start === nextSelection.start && selection.end === nextSelection.end) {
        return
      }

      selection = nextSelection
      listeners.forEach((listener) => {
        listener()
      })
    },
  }
}

function getTextareaCaretPosition(textarea: HTMLTextAreaElement, position: number): MentionPanelPosition | null {
  const rect = textarea.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    return null
  }

  const computed = window.getComputedStyle(textarea)
  const mirror = document.createElement("div")
  const marker = document.createElement("span")
  const viewportPadding = 12
  const panelWidth = Math.min(320, window.innerWidth - viewportPadding * 2)

  mirror.style.position = "fixed"
  mirror.style.visibility = "hidden"
  mirror.style.pointerEvents = "none"
  mirror.style.top = `${rect.top - textarea.scrollTop}px`
  mirror.style.left = `${rect.left - textarea.scrollLeft}px`
  mirror.style.width = `${rect.width}px`
  mirror.style.boxSizing = computed.boxSizing
  mirror.style.font = computed.font
  mirror.style.letterSpacing = computed.letterSpacing
  mirror.style.lineHeight = computed.lineHeight
  mirror.style.padding = computed.padding
  mirror.style.border = computed.border
  mirror.style.whiteSpace = "pre-wrap"
  mirror.style.overflowWrap = "break-word"
  mirror.style.wordBreak = computed.wordBreak

  mirror.textContent = textarea.value.slice(0, position)
  marker.textContent = "\u200b"
  mirror.appendChild(marker)
  document.body.appendChild(mirror)

  const markerRect = marker.getBoundingClientRect()
  const lineHeight = Number.parseFloat(computed.lineHeight) || 28
  document.body.removeChild(mirror)

  const rawLeft = markerRect.left
  const left = Math.min(Math.max(rawLeft, viewportPadding), Math.max(viewportPadding, window.innerWidth - panelWidth - viewportPadding))
  const availableBelow = window.innerHeight - (markerRect.top + lineHeight) - viewportPadding
  const availableAbove = markerRect.top - viewportPadding
  const maxHeight = Math.max(140, Math.min(280, Math.max(availableBelow, availableAbove)))
  const placeAbove = availableBelow < 180 && availableAbove > availableBelow
  const top = placeAbove
    ? Math.max(viewportPadding, markerRect.top - maxHeight - 8)
    : Math.min(markerRect.top + lineHeight + 8, window.innerHeight - maxHeight - viewportPadding)

  return {
    top,
    left,
    width: panelWidth,
    maxHeight,
  }
}

export function RefinedRichPostEditor({
  value,
  onChange,
  placeholder,
  minHeight = 240,
  disabled = false,
  uploadFolder = "posts",
  markdownEmojiMap: externalMarkdownEmojiMap,
  markdownImageUploadEnabled: externalMarkdownImageUploadEnabled,
  shellClassName,
  renderFullscreenInDialogPortal = false,
  privateReplyPostId,
  privateReplyRecipient,
  onPrivateReplyInsert,
  onClearPrivateReply,
  context = "generic",
}: RefinedRichPostEditorProps & {
  context?: AddonEditorTarget
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const selectionRef = useRef<EditorSelectionRange>({ start: 0, end: 0 })
  const selectionStore = useMemo(
    () => createEditorSelectionStore({ start: 0, end: 0 }),
    [],
  )
  const updateSelection = useCallback((nextSelection: EditorSelectionRange) => {
    selectionRef.current = nextSelection
    selectionStore.setSelection(nextSelection)
  }, [selectionStore])

  const isClient = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  )
  const editorSelection = useSyncExternalStore(
    selectionStore.subscribe,
    selectionStore.getSnapshot,
    selectionStore.getSnapshot,
  )
  const [mentionPanelPosition, setMentionPanelPosition] = useState<MentionPanelPosition | null>(null)
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0)
  const [mentionChoices, setMentionChoices] = useState<MentionChoice[]>([])
  const [dismissedMentionSignature, setDismissedMentionSignature] = useState<string | null>(null)
  const shortcutPlatform = useMemo(() => (isClient ? getClientPlatform() : "other"), [isClient])
  const markdownEmojiMap = useMarkdownEmojiMap(externalMarkdownEmojiMap)
  const markdownImageUploadEnabled = useMarkdownImageUploadEnabled(externalMarkdownImageUploadEnabled)
  const toolbarSettings = useEditorToolbarSettings()
  const toolbarItems = useAddonEditorToolbarItems(context)
  const imageToolbarTip = markdownImageUploadEnabled ? TOOLBAR_TIPS.imageUpload : TOOLBAR_TIPS.imageRemote

  const viewState = useEditorViewState({
    value,
    minHeight,
    textareaRef,
    updateSelection,
  })

  const selectionState = useEditorSelection({
    value,
    onChange,
    textareaRef,
    selectionRef,
    updateSelection,
    onRestoreScrollTop: viewState.setEditorScrollTop,
  })

  const {
    uploading,
    uploadResults,
    uploadImageFilesForMarkdown,
    uploadImageFiles,
    clearUploadResults,
  } = useImageUpload({
    uploadFolder,
    onInsert: selectionState.insertMarkdownTemplate,
  })

  const panels = useEditorPanels({
    value,
    markdownImageUploadEnabled,
    selectionRef,
    uploadResults,
    clearUploadResults,
  })

  const commands = useEditorCommands({
    value,
    disabled,
    markdownImageUploadEnabled,
    uploading,
    uploadFolder,
    fileInputRef,
    selectionRef,
    getEditorState: selectionState.getEditorState,
    applyEditorUpdate: selectionState.applyEditorUpdate,
    insertMarkdownTemplate: selectionState.insertMarkdownTemplate,
    syncSelection: selectionState.syncSelection,
    uploadImageFilesForMarkdown: uploadImageFilesForMarkdown,
    uploadImageFiles,
    mediaUrl: panels.mediaPanel.value,
    remoteImageUrl: panels.imagePanel.remoteImageUrl,
    remoteImageAlt: panels.imagePanel.remoteImageAlt,
    linkText: panels.linkPanel.text,
    linkUrl: panels.linkPanel.url,
    base64Preview: panels.base64Dialog.preview,
    privateReplyText: panels.base64Dialog.privateValue,
    privateReplyRecipient: panels.base64Dialog.privateRecipient,
    onPrivateReplyInsert,
    setMessage: panels.setMessage,
    toggleLinkPanel: panels.linkPanel.toggle,
    toggleTablePanel: panels.tablePanel.toggle,
    toggleImagePanel: panels.imagePanel.toggle,
    openImagePanel: panels.imagePanel.openPanel,
    closeImagePanel: panels.imagePanel.close,
    closeMediaPanel: panels.mediaPanel.close,
    closeLinkPanel: panels.linkPanel.close,
    closeTablePanel: panels.tablePanel.close,
    closeBase64Dialog: panels.base64Dialog.closeDialog,
  })

  const mentionPanelEnabled = !disabled && (viewState.activeTab === "write" || viewState.activeTab === "live-preview")
  const detectedMention = useMemo(() => (
    mentionPanelEnabled
      ? findActiveMentionQuery(value, editorSelection.start, editorSelection.end)
      : null
  ), [editorSelection.end, editorSelection.start, mentionPanelEnabled, value])
  const mentionSignature = detectedMention
    ? `${detectedMention.start}:${detectedMention.end}:${detectedMention.query}`
    : null
  const visibleMention = mentionSignature === dismissedMentionSignature ? null : detectedMention

  const closeMentionPanel = useCallback(() => {
    setDismissedMentionSignature(mentionSignature)
    setMentionPanelPosition(null)
    setMentionActiveIndex(0)
    setMentionChoices([])
  }, [mentionSignature])

  const handleEditorChange = useCallback((nextValue: string, nextSelection?: EditorSelectionRange) => {
    if (nextSelection) {
      updateSelection(nextSelection)
    }
    onChange(nextValue)
  }, [onChange, updateSelection])

  const insertMentionChoice = useCallback((choice: MentionChoice) => {
    if (!visibleMention) {
      return
    }

    const insertText = buildMentionInsertText(choice)
    const nextValue = `${value.slice(0, visibleMention.start)}${insertText}${value.slice(visibleMention.end)}`
    const nextSelection = visibleMention.start + insertText.length
    selectionState.applyEditorUpdate({
      value: nextValue,
      selectionStart: nextSelection,
      selectionEnd: nextSelection,
    })
    closeMentionPanel()
  }, [closeMentionPanel, selectionState, value, visibleMention])

  const handleEditorKeyDown = useCallback((event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (visibleMention && !event.nativeEvent.isComposing) {
      if (event.key === "Escape") {
        event.preventDefault()
        closeMentionPanel()
        return
      }

      if (event.key === "ArrowDown") {
        event.preventDefault()
        setMentionActiveIndex((current) => (mentionChoices.length > 0 ? (current + 1) % mentionChoices.length : 0))
        return
      }

      if (event.key === "ArrowUp") {
        event.preventDefault()
        setMentionActiveIndex((current) => (mentionChoices.length > 0 ? (current - 1 + mentionChoices.length) % mentionChoices.length : 0))
        return
      }

      if ((event.key === "Enter" || event.key === "Tab") && mentionChoices[mentionActiveIndex]) {
        event.preventDefault()
        insertMentionChoice(mentionChoices[mentionActiveIndex])
        return
      }
    }

    commands.handleTextareaKeyDown(event)
  }, [closeMentionPanel, commands, insertMentionChoice, mentionActiveIndex, mentionChoices, visibleMention])

  const syncMentionPanelPosition = useCallback(() => {
    const textarea = textareaRef.current
    if (!visibleMention || !textarea) {
      setMentionPanelPosition(null)
      return
    }

    setMentionPanelPosition(getTextareaCaretPosition(textarea, visibleMention.end))
  }, [visibleMention])

  useLayoutEffect(() => {
    if (!visibleMention) {
      return
    }

    syncMentionPanelPosition()
    const frameId = window.requestAnimationFrame(syncMentionPanelPosition)
    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [syncMentionPanelPosition, value, visibleMention])

  useEffect(() => {
    if (!visibleMention) {
      return
    }

    function handleViewportChange() {
      syncMentionPanelPosition()
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }

      if (textareaRef.current?.contains(target) || target.closest("[data-mention-panel='true']")) {
        return
      }

      closeMentionPanel()
    }

    window.addEventListener("resize", handleViewportChange)
    window.addEventListener("scroll", handleViewportChange, true)
    document.addEventListener("pointerdown", handlePointerDown)

    return () => {
      window.removeEventListener("resize", handleViewportChange)
      window.removeEventListener("scroll", handleViewportChange, true)
      document.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [closeMentionPanel, syncMentionPanelPosition, textareaRef, visibleMention])

  const toolbarApi = useMemo<AddonEditorToolbarApi>(() => ({
    focus: () => {
      textareaRef.current?.focus()
    },
    preserveSelection: () => selectionState.syncSelection(),
    getSelection: () => ({
      start: selectionRef.current.start,
      end: selectionRef.current.end,
    }),
    getValue: () => value,
    setValue: (nextValue: string) => {
      onChange(nextValue)
    },
    insertTemplate: (template: string) => {
      selectionState.insertMarkdownTemplate(template)
    },
    replaceSelection: (nextValue: string) => {
      selectionState.applyEditorUpdate(
        insertSelection(selectionState.getEditorState(), () => nextValue),
      )
    },
    wrapSelection: (before: string, after = "") => {
      selectionState.applyEditorUpdate(
        wrapSelection(selectionState.getEditorState(), before, after),
      )
    },
    setHeadingLevel: (level: 1 | 2 | 3) => {
      selectionState.applyEditorUpdate(
        setHeadingLevel(selectionState.getEditorState(), level),
      )
    },
    toggleBold: commands.toolbarActions.bold,
    toggleUnderline: commands.toolbarActions.underline,
    toggleStrike: commands.toolbarActions.strike,
    toggleHighlight: commands.toolbarActions.highlight,
    formatCode: commands.toolbarActions.codeFormat,
    toggleQuote: commands.toolbarActions.quote,
    insertSpoiler: commands.toolbarActions.insertSpoiler,
    formatList: commands.toolbarActions.listFormat,
    insertDivider: commands.toolbarActions.insertDivider,
    align: commands.toolbarActions.align,
  }), [commands.toolbarActions, onChange, selectionState, value])

  const editorShell = (
    <div data-markdown-editor-fullscreen={viewState.isFullscreen ? "true" : undefined} className={viewState.isFullscreen ? "fixed inset-0 z-[215] bg-black/45 p-4 md:p-6" : ""}>
      <div className={viewState.isFullscreen ? "flex h-full w-full items-center justify-center" : ""}>
        <div
          className={cn(
            viewState.isFullscreen
              ? "flex h-full min-w-0 max-h-[96vh] w-full max-w-6xl flex-col overflow-x-hidden overflow-y-visible rounded-xl border border-border bg-background shadow-2xl"
              : "min-w-0 max-w-full overflow-x-hidden overflow-y-visible rounded-xl border border-border bg-card shadow-xs",
            !viewState.isFullscreen && shellClassName,
          )}
        >
          <EditorHeader
            activeTab={viewState.activeTab}
            disabled={disabled}
            isFullscreen={viewState.isFullscreen}
            uploading={uploading}
            valueLength={value.length}
            onTabChange={viewState.handleTabChange}
            onEnterFullscreen={() => viewState.setIsFullscreen(true)}
            onExitFullscreen={() => viewState.setIsFullscreen(false)}
          />
          <PrivateReplyDraftBanner
            recipient={privateReplyRecipient}
            onClear={onClearPrivateReply}
          />
          <EditorBody
            activeTab={viewState.activeTab}
            isFullscreen={viewState.isFullscreen}
            contentMinHeight={viewState.contentMinHeight}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            markdownEmojiMap={markdownEmojiMap}
            textareaRef={textareaRef}
            lineMeasureContainerRef={viewState.lineMeasureContainerRef}
            lineMeasureRefs={viewState.lineMeasureRefs}
            logicalLines={viewState.logicalLines}
            lineNumbers={viewState.lineNumbers}
            lineHeights={viewState.lineHeights}
            activeLineNumber={viewState.activeLineNumber}
            editorScrollTop={viewState.editorScrollTop}
            onChange={handleEditorChange}
            onEditorScrollSync={viewState.setEditorScrollTop}
            onScroll={viewState.handleTextareaScroll}
            onKeyDown={handleEditorKeyDown}
            onSelect={viewState.handleTextareaSelect}
            onPaste={commands.handlePaste}
          />
          <div className={viewState.activeTab === "write" || viewState.activeTab === "live-preview" ? (viewState.isFullscreen ? "px-3 pb-4 sm:px-5 sm:pb-8" : "px-3 pb-4 sm:px-5") : "px-3 pb-4 sm:px-5"}>
            <EditorToolbar
              context={context}
              visible={viewState.activeTab === "write" || viewState.activeTab === "live-preview"}
              disabled={disabled}
              toolbarSettings={toolbarSettings}
              toolbarItems={toolbarItems}
              toolbarApi={toolbarApi}
              selectionStore={selectionStore}
              value={value}
              isFullscreen={viewState.isFullscreen}
              platform={shortcutPlatform}
              imageToolbarTip={imageToolbarTip}
              markdownImageUploadEnabled={markdownImageUploadEnabled}
              uploading={uploading}
              showMediaPanel={panels.mediaPanel.open}
              showEmojiPanel={panels.emojiPanel.open}
              showTablePanel={panels.tablePanel.open}
              showLinkPanel={panels.linkPanel.open}
              showImagePanel={panels.imagePanel.open}
              showSpoilerPanel={panels.spoilerPanel.open}
              showBase64Dialog={panels.base64Dialog.open}
              fileInputRef={fileInputRef}
              mediaButtonRef={panels.mediaPanel.buttonRef}
              emojiButtonRef={panels.emojiPanel.buttonRef}
              tableButtonRef={panels.tablePanel.buttonRef}
              linkButtonRef={panels.linkPanel.buttonRef}
              imageButtonRef={panels.imagePanel.buttonRef}
              spoilerButtonRef={panels.spoilerPanel.buttonRef}
              onToolbarPointerDown={commands.handleToolbarPointerDown}
              onToolbarMouseDown={commands.handleToolbarMouseDown}
              onToolbarSelectMouseDown={commands.handleToolbarSelectMouseDown}
              onToolbarSelectOpenChange={commands.handleToolbarSelectOpenChange}
              onSetHeadingLevel={commands.toolbarActions.setHeadingLevel}
              onBold={commands.toolbarActions.bold}
              onUnderline={commands.toolbarActions.underline}
              onStrike={commands.toolbarActions.strike}
              onHighlight={commands.toolbarActions.highlight}
              onCodeFormat={commands.toolbarActions.codeFormat}
              onQuote={commands.toolbarActions.quote}
              onListFormat={commands.toolbarActions.listFormat}
              onToggleLinkPanel={panels.linkPanel.toggle}
              onToggleTablePanel={panels.tablePanel.toggle}
              onToggleSpoilerPanel={panels.spoilerPanel.toggle}
              onInsertDivider={commands.toolbarActions.insertDivider}
              onAlign={commands.toolbarActions.align}
              onToggleMediaPanel={panels.mediaPanel.toggle}
              onToggleEmojiPanel={panels.emojiPanel.toggle}
              onTriggerImageShortcut={commands.triggerImageShortcut}
              onOpenBase64Dialog={panels.base64Dialog.openDialog}
              onOpenHelpDialog={panels.helpDialog.openDialog}
            onUpload={commands.handleUpload}
            privateReplyRecipient={privateReplyRecipient}
          />
            {panels.message ? <p className="mt-2 text-xs text-muted-foreground">{panels.message}</p> : null}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {viewState.isFullscreen && isClient
        ? renderFullscreenInDialogPortal
          ? createPortal(
              <DialogPrimitive.Portal>
                {editorShell}
              </DialogPrimitive.Portal>,
              document.body,
            )
          : createPortal(editorShell, document.body)
        : editorShell}
      <MarkdownEditorHelpDialog
        open={panels.helpDialog.open}
        onClose={panels.helpDialog.closeDialog}
        platform={shortcutPlatform}
        markdownEmojiMap={markdownEmojiMap}
        inFullscreenEditor={viewState.isFullscreen}
      />
      {isClient ? createPortal(
        <AiMentionPanel
          open={Boolean(visibleMention)}
          query={visibleMention?.query ?? ""}
          position={mentionPanelPosition}
          activeIndex={mentionActiveIndex}
          onActiveIndexChange={setMentionActiveIndex}
          onChoicesChange={setMentionChoices}
          onSelect={insertMentionChoice}
          onClose={closeMentionPanel}
        />,
        document.body,
      ) : null}
      <Base64Dialog
        open={panels.base64Dialog.open}
        inFullscreenEditor={viewState.isFullscreen}
        value={panels.base64Dialog.value}
        preview={panels.base64Dialog.preview}
        mode={panels.base64Dialog.mode}
        allowPrivateReply={context === "comment" && Boolean(onPrivateReplyInsert)}
        privateReplyPostId={privateReplyPostId}
        privateValue={panels.base64Dialog.privateValue}
        privateRecipient={panels.base64Dialog.privateRecipient}
        onChange={panels.base64Dialog.setValue}
        onModeChange={panels.base64Dialog.setMode}
        onPrivateValueChange={panels.base64Dialog.setPrivateValue}
        onPrivateRecipientChange={panels.base64Dialog.setPrivateRecipient}
        onClose={panels.base64Dialog.dismissDialog}
        onConfirm={commands.handleInsertBase64}
        onConfirmPrivate={commands.handleInsertPrivateReply}
      />
      <FloatingSelectionToolbar
        visible={!disabled && (viewState.activeTab === "write" || viewState.activeTab === "live-preview")}
        isClient={isClient}
        isFullscreen={viewState.isFullscreen}
        textareaRef={textareaRef}
        selectionStore={selectionStore}
        platform={shortcutPlatform}
        onPointerDown={commands.handleToolbarPointerDown}
        onMouseDown={commands.handleToolbarMouseDown}
        onBold={commands.toolbarActions.bold}
        onUnderline={commands.toolbarActions.underline}
        onStrike={commands.toolbarActions.strike}
        onHighlight={commands.toolbarActions.highlight}
        onInlineCode={() => commands.toolbarActions.codeFormat("inline-code")}
        onImageLink={commands.toolbarActions.convertSelectionToImageMarkdown}
        onQuote={commands.toolbarActions.quote}
      />
      <MediaInsertPanel
        open={panels.mediaPanel.open}
        isClient={isClient}
        disabled={disabled}
        anchorRef={panels.mediaPanel.buttonRef}
        position={panels.mediaPanel.position}
        ready={panels.mediaPanel.ready}
        panelRef={panels.mediaPanel.panelRef}
        value={panels.mediaPanel.value}
        hint={panels.mediaPanel.hint}
        onChange={panels.mediaPanel.setValue}
        onClose={panels.mediaPanel.close}
        onConfirm={commands.handleInsertMedia}
      />
      <LinkInsertPanel
        open={panels.linkPanel.open}
        isClient={isClient}
        disabled={disabled}
        anchorRef={panels.linkPanel.buttonRef}
        position={panels.linkPanel.position}
        ready={panels.linkPanel.ready}
        panelRef={panels.linkPanel.panelRef}
        text={panels.linkPanel.text}
        url={panels.linkPanel.url}
        hint={panels.linkPanel.hint}
        onTextChange={panels.linkPanel.setText}
        onUrlChange={panels.linkPanel.setUrl}
        onClose={panels.linkPanel.close}
        onConfirm={commands.handleInsertLink}
      />
      <TableInsertPanel
        open={panels.tablePanel.open}
        isClient={isClient}
        disabled={disabled}
        anchorRef={panels.tablePanel.buttonRef}
        position={panels.tablePanel.position}
        ready={panels.tablePanel.ready}
        panelRef={panels.tablePanel.panelRef}
        onClose={panels.tablePanel.close}
        onSelect={commands.handleInsertTable}
      />
      <SpoilerInsertPanel
        open={panels.spoilerPanel.open}
        isClient={isClient}
        disabled={disabled}
        anchorRef={panels.spoilerPanel.buttonRef}
        position={panels.spoilerPanel.position}
        ready={panels.spoilerPanel.ready}
        panelRef={panels.spoilerPanel.panelRef}
        onClose={panels.spoilerPanel.close}
        onInsertSpoiler={commands.toolbarActions.insertSpoiler}
        onInsertScratchMask={commands.toolbarActions.insertScratchMask}
        onItemPointerDown={commands.handleToolbarPointerDown}
        onItemMouseDown={commands.handleToolbarMouseDown}
      />
      <EmojiInsertPanel
        open={panels.emojiPanel.open}
        isClient={isClient}
        disabled={disabled}
        anchorRef={panels.emojiPanel.buttonRef}
        position={panels.emojiPanel.position}
        ready={panels.emojiPanel.ready}
        panelRef={panels.emojiPanel.panelRef}
        markdownEmojiMap={markdownEmojiMap}
        onClose={panels.emojiPanel.close}
        onSelect={commands.handleEmojiSelect}
      />
      <ImageInsertPanel
        open={panels.imagePanel.open}
        isClient={isClient}
        disabled={disabled}
        anchorRef={panels.imagePanel.buttonRef}
        position={panels.imagePanel.position}
        ready={panels.imagePanel.ready}
        panelRef={panels.imagePanel.panelRef}
        markdownImageUploadEnabled={markdownImageUploadEnabled}
        uploading={uploading}
        uploadSummary={panels.imagePanel.uploadSummary}
        uploadResults={uploadResults}
        fileInputRef={fileInputRef}
        remoteImageUrl={panels.imagePanel.remoteImageUrl}
        remoteImageAlt={panels.imagePanel.remoteImageAlt}
        remoteImageHint={panels.imagePanel.remoteImageHint}
        onRemoteImageUrlChange={panels.imagePanel.setRemoteImageUrl}
        onRemoteImageAltChange={panels.imagePanel.setRemoteImageAlt}
        onClose={panels.imagePanel.close}
        onContinueUpload={panels.imagePanel.continueUpload}
        onConfirmRemote={commands.handleInsertRemoteImage}
      />
    </>
  )
}
