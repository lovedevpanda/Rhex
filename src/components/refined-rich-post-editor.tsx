"use client"

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"

import { useAddonEditorToolbarItems } from "@/addons-host/client/addon-runtime-provider"
import type {
  AddonEditorTarget,
  AddonEditorToolbarApi,
} from "@/addons-host/editor-types"
import { MarkdownEditorHelpDialog } from "@/components/post/markdown-editor-help-dialog"
import { TOOLBAR_TIPS } from "@/components/refined-rich-post-editor/constants"
import {
  Base64Dialog,
  EmojiInsertPanel,
  ImageInsertPanel,
  LinkInsertPanel,
  MediaInsertPanel,
  TableInsertPanel,
} from "@/components/refined-rich-post-editor/editor-panels"
import { EditorBody, EditorHeader, EditorToolbar } from "@/components/refined-rich-post-editor/editor-surface"
import type {
  EditorSelectionRange,
  EditorSelectionStore,
  RefinedRichPostEditorProps,
} from "@/components/refined-rich-post-editor/types"
import { useEditorCommands } from "@/components/refined-rich-post-editor/use-editor-commands"
import { useEditorPanels } from "@/components/refined-rich-post-editor/use-editor-panels"
import { useEditorSelection } from "@/components/refined-rich-post-editor/use-editor-selection"
import { useEditorViewState } from "@/components/refined-rich-post-editor/use-editor-view-state"
import { useMarkdownEmojiMap, useMarkdownImageUploadEnabled } from "@/components/site-settings-provider"
import { useImageUpload } from "@/hooks/use-image-upload"
import { getClientPlatform } from "@/lib/client-platform"
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

export function RefinedRichPostEditor({
  value,
  onChange,
  placeholder,
  minHeight = 240,
  disabled = false,
  uploadFolder = "posts",
  markdownEmojiMap: externalMarkdownEmojiMap,
  markdownImageUploadEnabled: externalMarkdownImageUploadEnabled,
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
  const shortcutPlatform = useMemo(() => (isClient ? getClientPlatform() : "other"), [isClient])
  const markdownEmojiMap = useMarkdownEmojiMap(externalMarkdownEmojiMap)
  const markdownImageUploadEnabled = useMarkdownImageUploadEnabled(externalMarkdownImageUploadEnabled)
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

  const { uploading, uploadResults, uploadImageFiles, clearUploadResults } = useImageUpload({
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
    uploadResultsCount: uploadResults.length,
    fileInputRef,
    selectionRef,
    getEditorState: selectionState.getEditorState,
    applyEditorUpdate: selectionState.applyEditorUpdate,
    insertMarkdownTemplate: selectionState.insertMarkdownTemplate,
    syncSelection: selectionState.syncSelection,
    uploadImageFiles,
    mediaUrl: panels.mediaPanel.value,
    remoteImageUrl: panels.imagePanel.remoteImageUrl,
    remoteImageAlt: panels.imagePanel.remoteImageAlt,
    linkText: panels.linkPanel.text,
    linkUrl: panels.linkPanel.url,
    base64Preview: panels.base64Dialog.preview,
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
    formatList: commands.toolbarActions.listFormat,
    insertDivider: commands.toolbarActions.insertDivider,
    align: commands.toolbarActions.align,
  }), [commands.toolbarActions, onChange, selectionState, value])

  const editorShell = (
    <div className={viewState.isFullscreen ? "fixed inset-0 z-[120] bg-black/45 p-4 md:p-6" : ""}>
      <div className={viewState.isFullscreen ? "flex h-full w-full items-center justify-center" : ""}>
        <div className={viewState.isFullscreen ? "flex h-full max-h-[96vh] w-full max-w-6xl flex-col overflow-x-hidden overflow-y-visible rounded-[28px] border border-border bg-background shadow-2xl" : "overflow-x-hidden overflow-y-visible rounded-[22px] border border-border bg-card shadow-xs"}>
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
            onChange={onChange}
            onEditorScrollSync={viewState.setEditorScrollTop}
            onScroll={viewState.handleTextareaScroll}
            onKeyDown={commands.handleTextareaKeyDown}
            onSelect={viewState.handleTextareaSelect}
            onPaste={commands.handlePaste}
          />
          <div className={viewState.activeTab === "write" || viewState.activeTab === "live-preview" ? (viewState.isFullscreen ? "px-3 pb-4 sm:px-5 sm:pb-8" : "px-3 pb-4 sm:px-5") : "px-3 pb-4 sm:px-5"}>
            <EditorToolbar
              context={context}
              visible={viewState.activeTab === "write" || viewState.activeTab === "live-preview"}
              disabled={disabled}
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
              showBase64Dialog={panels.base64Dialog.open}
              fileInputRef={fileInputRef}
              mediaButtonRef={panels.mediaPanel.buttonRef}
              emojiButtonRef={panels.emojiPanel.buttonRef}
              tableButtonRef={panels.tablePanel.buttonRef}
              linkButtonRef={panels.linkPanel.buttonRef}
              imageButtonRef={panels.imagePanel.buttonRef}
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
              onInsertDivider={commands.toolbarActions.insertDivider}
              onAlign={commands.toolbarActions.align}
              onToggleMediaPanel={panels.mediaPanel.toggle}
              onToggleEmojiPanel={panels.emojiPanel.toggle}
              onTriggerImageShortcut={commands.triggerImageShortcut}
              onOpenBase64Dialog={panels.base64Dialog.openDialog}
              onOpenHelpDialog={panels.helpDialog.openDialog}
              onUpload={commands.handleUpload}
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
        ? createPortal(editorShell, document.body)
        : editorShell}
      <MarkdownEditorHelpDialog
        open={panels.helpDialog.open}
        onClose={panels.helpDialog.closeDialog}
        platform={shortcutPlatform}
        markdownEmojiMap={markdownEmojiMap}
      />
      <Base64Dialog
        open={panels.base64Dialog.open}
        value={panels.base64Dialog.value}
        preview={panels.base64Dialog.preview}
        onChange={panels.base64Dialog.setValue}
        onClose={panels.base64Dialog.dismissDialog}
        onConfirm={commands.handleInsertBase64}
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
        onSelect={(shortcode) => {
          commands.handleEmojiSelect(shortcode)
          panels.emojiPanel.close()
        }}
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
