"use client"

import { useCallback } from "react"
import type * as React from "react"
import type { MutableRefObject, RefObject } from "react"

import type { EditorSelectionRange } from "@/components/refined-rich-post-editor/types"
import { inferMediaInsert, inferRemoteImageInsert } from "@/components/refined-rich-post-editor/utils"
import {
  applyAlignment,
  applyCodeFormat,
  applyListFormat,
  buildInlineHighlightMarkdown,
  buildLinkMarkdown,
  buildSizedTableMarkdown,
  getMarkdownEditorKeydownResult,
  insertLinePrefix,
  insertSelection,
  setHeadingLevel,
  wrapSelection,
  type MarkdownAlignment,
  type MarkdownCodeFormat,
  type MarkdownEditorState,
  type MarkdownEditorUpdate,
  type MarkdownListType,
} from "@/lib/markdown-editor-shortcuts"

type UseEditorCommandsOptions = {
  value: string
  disabled: boolean
  markdownImageUploadEnabled: boolean
  uploading: boolean
  uploadResultsCount: number
  fileInputRef: RefObject<HTMLInputElement | null>
  selectionRef: MutableRefObject<EditorSelectionRange>
  getEditorState: (element?: HTMLTextAreaElement | null) => MarkdownEditorState
  applyEditorUpdate: (update: MarkdownEditorUpdate) => void
  insertMarkdownTemplate: (template: string) => void
  syncSelection: () => EditorSelectionRange
  uploadImageFiles: (files: File[]) => Promise<number>
  mediaUrl: string
  remoteImageUrl: string
  remoteImageAlt: string
  linkText: string
  linkUrl: string
  base64Preview: string
  setMessage: (message: string) => void
  toggleLinkPanel: () => void
  toggleTablePanel: () => void
  toggleImagePanel: () => void
  openImagePanel: () => void
  closeImagePanel: () => void
  closeMediaPanel: () => void
  closeLinkPanel: () => void
  closeTablePanel: () => void
  closeBase64Dialog: () => void
}

export function useEditorCommands({
  value,
  disabled,
  markdownImageUploadEnabled,
  uploading,
  uploadResultsCount,
  fileInputRef,
  selectionRef,
  getEditorState,
  applyEditorUpdate,
  insertMarkdownTemplate,
  syncSelection,
  uploadImageFiles,
  mediaUrl,
  remoteImageUrl,
  remoteImageAlt,
  linkText,
  linkUrl,
  base64Preview,
  setMessage,
  toggleLinkPanel,
  toggleTablePanel,
  toggleImagePanel,
  openImagePanel,
  closeImagePanel,
  closeMediaPanel,
  closeLinkPanel,
  closeTablePanel,
  closeBase64Dialog,
}: UseEditorCommandsOptions) {
  const applyWrap = useCallback((before: string, after = "") => {
    applyEditorUpdate(wrapSelection(getEditorState(), before, after))
  }, [applyEditorUpdate, getEditorState])

  const applySelectionTransform = useCallback((transform: (selectedText: string) => string) => {
    applyEditorUpdate(insertSelection(getEditorState(), transform))
  }, [applyEditorUpdate, getEditorState])

  const applyLinePrefix = useCallback((prefix: string) => {
    applyEditorUpdate(insertLinePrefix(getEditorState(), prefix))
  }, [applyEditorUpdate, getEditorState])

  const applyListFormatByType = useCallback((listType: MarkdownListType) => {
    applyEditorUpdate(applyListFormat(getEditorState(), listType))
  }, [applyEditorUpdate, getEditorState])

  const applyCodeFormatByType = useCallback((codeType: MarkdownCodeFormat) => {
    applyEditorUpdate(applyCodeFormat(getEditorState(), codeType))
  }, [applyEditorUpdate, getEditorState])

  const triggerImageShortcut = useCallback(() => {
    if (!markdownImageUploadEnabled) {
      toggleImagePanel()
      return
    }

    if (uploadResultsCount > 0 && !uploading) {
      toggleImagePanel()
      return
    }

    fileInputRef.current?.click()
  }, [fileInputRef, markdownImageUploadEnabled, toggleImagePanel, uploadResultsCount, uploading])

  const handleToolbarMouseDown = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (disabled) {
      return
    }

    syncSelection()
    event.preventDefault()
  }, [disabled, syncSelection])

  const handleToolbarSelectMouseDown = useCallback(() => {
    if (!disabled) {
      syncSelection()
    }
  }, [disabled, syncSelection])

  const handleToolbarSelectOpenChange = useCallback((open: boolean) => {
    if (open) {
      handleToolbarSelectMouseDown()
    }
  }, [handleToolbarSelectMouseDown])

  const handleTextareaKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled) {
      return
    }

    const result = getMarkdownEditorKeydownResult(event, getEditorState(event.currentTarget))
    if (!result) {
      return
    }

    event.preventDefault()
    if (result.kind === "update") {
      applyEditorUpdate(result.update)
      return
    }

    if (result.action === "open-link-panel") {
      toggleLinkPanel()
      return
    }

    if (result.action === "toggle-table-panel") {
      toggleTablePanel()
      return
    }

    triggerImageShortcut()
  }, [applyEditorUpdate, disabled, getEditorState, toggleLinkPanel, toggleTablePanel, triggerImageShortcut])

  const handleInsertRemoteImage = useCallback(() => {
    const result = inferRemoteImageInsert(remoteImageUrl, remoteImageAlt)
    if (!result) {
      setMessage("请输入有效的远程图片地址")
      return
    }

    insertMarkdownTemplate(result.template)
    closeImagePanel()
  }, [closeImagePanel, insertMarkdownTemplate, remoteImageAlt, remoteImageUrl, setMessage])

  const handleInsertMedia = useCallback(() => {
    const result = inferMediaInsert(mediaUrl)
    if (!result) {
      setMessage("请输入有效的音频或视频地址")
      return
    }

    insertMarkdownTemplate(result.template)
    setMessage(result.message)
    closeMediaPanel()
  }, [closeMediaPanel, insertMarkdownTemplate, mediaUrl, setMessage])

  const handleInsertLink = useCallback(() => {
    if (!linkUrl.trim()) {
      setMessage("请输入有效的链接地址")
      return
    }

    applySelectionTransform(() => buildLinkMarkdown(linkText, linkUrl))
    closeLinkPanel()
  }, [applySelectionTransform, closeLinkPanel, linkText, linkUrl, setMessage])

  const handleInsertTable = useCallback((rows: number, columns: number) => {
    insertMarkdownTemplate(buildSizedTableMarkdown(rows, columns))
    closeTablePanel()
  }, [closeTablePanel, insertMarkdownTemplate])

  const handleInsertBase64 = useCallback(() => {
    if (!base64Preview) {
      setMessage("请输入需要编码的文本")
      return
    }

    const { start, end } = selectionRef.current
    setMessage("")
    applyEditorUpdate(insertSelection({
      value,
      selectionStart: start,
      selectionEnd: end,
    }, () => base64Preview))
    setMessage("已插入 Base64 编码内容")
    closeBase64Dialog()
  }, [applyEditorUpdate, base64Preview, closeBase64Dialog, selectionRef, setMessage, value])

  const handleUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!markdownImageUploadEnabled) {
      event.target.value = ""
      return
    }

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
    openImagePanel()
    await uploadImageFiles(files)
    event.target.value = ""
  }, [markdownImageUploadEnabled, openImagePanel, setMessage, uploadImageFiles])

  const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null)

    if (imageFiles.length === 0) {
      return
    }

    if (!markdownImageUploadEnabled) {
      event.preventDefault()
      setMessage("后台已关闭 Markdown 图片上传，请使用图片按钮插入远程图片地址")
      openImagePanel()
      return
    }

    event.preventDefault()
    setMessage("")
    openImagePanel()
    await uploadImageFiles(imageFiles)
  }, [markdownImageUploadEnabled, openImagePanel, setMessage, uploadImageFiles])

  const handleEmojiSelect = useCallback((shortcode: string) => {
    applyWrap(`:${shortcode}: `)
  }, [applyWrap])

  return {
    handleToolbarMouseDown,
    handleToolbarSelectMouseDown,
    handleToolbarSelectOpenChange,
    handleTextareaKeyDown,
    triggerImageShortcut,
    handleUpload,
    handlePaste,
    handleEmojiSelect,
    handleInsertRemoteImage,
    handleInsertMedia,
    handleInsertLink,
    handleInsertTable,
    handleInsertBase64,
    toolbarActions: {
      setHeadingLevel: (level: 1 | 2 | 3) => applyEditorUpdate(setHeadingLevel(getEditorState(), level)),
      bold: () => applyWrap("**", "**"),
      underline: () => applyWrap("<u>", "</u>"),
      strike: () => applyWrap("~~", "~~"),
      highlight: () => applySelectionTransform(buildInlineHighlightMarkdown),
      codeFormat: applyCodeFormatByType,
      quote: () => applyLinePrefix("> "),
      listFormat: applyListFormatByType,
      insertDivider: () => insertMarkdownTemplate("---"),
      align: (alignment: MarkdownAlignment) => applyEditorUpdate(applyAlignment(getEditorState(), alignment)),
    },
  }
}
