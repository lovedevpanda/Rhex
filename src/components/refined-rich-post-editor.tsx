"use client"

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"

import { MarkdownEditorHelpDialog } from "@/components/markdown-editor-help-dialog"
import { TOOLBAR_TIPS, EDITOR_FALLBACK_LINE_HEIGHT_PX } from "@/components/refined-rich-post-editor/constants"
import {
  Base64Dialog,
  EmojiInsertPanel,
  ImageInsertPanel,
  LinkInsertPanel,
  MediaInsertPanel,
  TableInsertPanel,
} from "@/components/refined-rich-post-editor/editor-panels"
import { EditorBody, EditorHeader, EditorToolbar } from "@/components/refined-rich-post-editor/editor-surface"
import { useFloatingPanel } from "@/components/refined-rich-post-editor/floating-panels"
import type { FloatingPanelPosition, RefinedRichPostEditorProps } from "@/components/refined-rich-post-editor/types"
import { encodeBase64, inferMediaInsert, inferRemoteImageInsert, normalizeRemoteUrl } from "@/components/refined-rich-post-editor/utils"
import { useMarkdownEmojiMap, useMarkdownImageUploadEnabled } from "@/components/site-settings-provider"
import { useImageUpload } from "@/hooks/use-image-upload"
import { getClientPlatform } from "@/lib/client-platform"
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
  insertTemplate,
  setHeadingLevel,
  wrapSelection,
  type MarkdownCodeFormat,
  type MarkdownEditorState,
  type MarkdownEditorUpdate,
  type MarkdownListType,
} from "@/lib/markdown-editor-shortcuts"

export function RefinedRichPostEditor({
  value,
  onChange,
  placeholder,
  minHeight = 240,
  disabled = false,
  uploadFolder = "posts",
  markdownEmojiMap: externalMarkdownEmojiMap,
  markdownImageUploadEnabled: externalMarkdownImageUploadEnabled,
}: RefinedRichPostEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const lineMeasureContainerRef = useRef<HTMLDivElement | null>(null)
  const lineMeasureRefs = useRef<Array<HTMLDivElement | null>>([])
  const selectionRef = useRef({ start: 0, end: 0 })
  const restoreViewStateRef = useRef<{ scrollTop: number; scrollLeft: number; pageXOffset: number; pageYOffset: number } | null>(null)
  const writeTabViewStateRef = useRef<{ scrollTop: number; scrollLeft: number; selectionStart: number; selectionEnd: number } | null>(null)

  const [mediaPanelPosition, setMediaPanelPosition, mediaPanelReady, setMediaPanelReady, mediaPanelRef] = useFloatingPanel()
  const [emojiPanelPosition, setEmojiPanelPosition, emojiPanelReady, setEmojiPanelReady, emojiPanelRef] = useFloatingPanel()
  const [tablePanelPosition, setTablePanelPosition, tablePanelReady, setTablePanelReady, tablePanelRef] = useFloatingPanel()
  const [linkPanelPosition, setLinkPanelPosition, linkPanelReady, setLinkPanelReady, linkPanelRef] = useFloatingPanel()
  const [imagePanelPosition, setImagePanelPosition, imagePanelReady, setImagePanelReady, imagePanelRef] = useFloatingPanel()

  const mediaButtonRef = useRef<HTMLDivElement | null>(null)
  const emojiButtonRef = useRef<HTMLDivElement | null>(null)
  const tableButtonRef = useRef<HTMLDivElement | null>(null)
  const linkButtonRef = useRef<HTMLDivElement | null>(null)
  const imageButtonRef = useRef<HTMLDivElement | null>(null)

  const [activeTab, setActiveTab] = useState<"write" | "preview">("write")
  const [message, setMessage] = useState("")
  const [showEmojiPanel, setShowEmojiPanel] = useState(false)
  const [showMediaPanel, setShowMediaPanel] = useState(false)
  const [showTablePanel, setShowTablePanel] = useState(false)
  const [showLinkPanel, setShowLinkPanel] = useState(false)
  const [showImagePanel, setShowImagePanel] = useState(false)
  const [showHelpDialog, setShowHelpDialog] = useState(false)
  const [showBase64Dialog, setShowBase64Dialog] = useState(false)
  const [mediaUrl, setMediaUrl] = useState("")
  const [remoteImageUrl, setRemoteImageUrl] = useState("")
  const [remoteImageAlt, setRemoteImageAlt] = useState("")
  const [linkText, setLinkText] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [base64Text, setBase64Text] = useState("")
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
  const shortcutPlatform = useMemo(() => (isClient ? getClientPlatform() : "other"), [isClient])
  const markdownEmojiMap = useMarkdownEmojiMap(externalMarkdownEmojiMap)
  const markdownImageUploadEnabled = useMarkdownImageUploadEnabled(externalMarkdownImageUploadEnabled)
  const imageToolbarTip = markdownImageUploadEnabled ? TOOLBAR_TIPS.imageUpload : TOOLBAR_TIPS.imageRemote

  const getEditorState = useCallback((element?: HTMLTextAreaElement | null): MarkdownEditorState => {
    const currentElement = element ?? textareaRef.current
    const nextSelection = currentElement
      ? { start: currentElement.selectionStart, end: currentElement.selectionEnd }
      : selectionRef.current
    selectionRef.current = nextSelection
    return {
      value,
      selectionStart: nextSelection.start,
      selectionEnd: nextSelection.end,
    }
  }, [value])

  const restoreSelection = useCallback((start: number, end: number = start) => {
    requestAnimationFrame(() => {
      const element = textareaRef.current
      if (!element) {
        return
      }

      const viewState = restoreViewStateRef.current

      try {
        element.focus({ preventScroll: true })
      } catch {
        element.focus()
      }
      element.setSelectionRange(start, end)
      selectionRef.current = { start, end }

      if (viewState) {
        element.scrollTop = viewState.scrollTop
        element.scrollLeft = viewState.scrollLeft
        setEditorScrollTop(viewState.scrollTop)
        window.scrollTo(viewState.pageXOffset, viewState.pageYOffset)
        restoreViewStateRef.current = null
      }
    })
  }, [])

  const applyEditorUpdate = useCallback((update: MarkdownEditorUpdate) => {
    const element = textareaRef.current
    restoreViewStateRef.current = element
      ? {
          scrollTop: element.scrollTop,
          scrollLeft: element.scrollLeft,
          pageXOffset: window.scrollX,
          pageYOffset: window.scrollY,
        }
      : null
    onChange(update.value)
    restoreSelection(update.selectionStart, update.selectionEnd)
  }, [onChange, restoreSelection])

  const insertMarkdownTemplate = useCallback((template: string) => {
    applyEditorUpdate(insertTemplate(getEditorState(), template))
  }, [applyEditorUpdate, getEditorState])

  const { uploading, uploadResults, uploadImageFiles, clearUploadResults } = useImageUpload({
    uploadFolder,
    onInsert: insertMarkdownTemplate,
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

  const contentMinHeight = isFullscreen ? "100%" : minHeight
  const logicalLines = useMemo(() => value.split("\n"), [value])
  const lineCount = logicalLines.length
  const lineNumbers = useMemo(() => Array.from({ length: lineCount }, (_, index) => index + 1), [lineCount])

  const mediaHint = useMemo(() => {
    if (!mediaUrl.trim()) {
      return "粘贴视频或音频地址，将插入可解析媒体标记。"
    }

    return inferMediaInsert(mediaUrl)?.message ?? "请输入有效的媒体地址"
  }, [mediaUrl])

  const linkHint = useMemo(() => {
    if (!linkUrl.trim()) {
      return ""
    }

    return /^https?:\/\//i.test(linkUrl.trim()) ? "" : "建议输入完整链接，例如 https://example.com"
  }, [linkUrl])

  const remoteImageHint = useMemo(() => {
    if (!remoteImageUrl.trim()) {
      return "填写可公开访问的图片地址，编辑器会插入标准 Markdown 图片语法。"
    }

    return inferRemoteImageInsert(remoteImageUrl, remoteImageAlt)
      ? "将以远程图片地址插入到当前光标位置。"
      : "请输入有效的 HTTP/HTTPS 图片地址"
  }, [remoteImageAlt, remoteImageUrl])

  const tableHint = useMemo(() => {
    if (!tableHoverSize.rows || !tableHoverSize.columns) {
      return "移动鼠标选择要插入的表格尺寸"
    }

    return `${tableHoverSize.rows} 行 × ${tableHoverSize.columns} 列`
  }, [tableHoverSize.columns, tableHoverSize.rows])

  const base64Preview = useMemo(() => (base64Text ? encodeBase64(base64Text) : ""), [base64Text])

  useEffect(() => {
    const element = textareaRef.current
    const nextLineNumber = !element ? 1 : value.slice(0, element.selectionStart ?? 0).split("\n").length
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

  const updateFloatingPanelPosition = useCallback((anchor: HTMLDivElement | null, panel: HTMLDivElement | null, width: number): FloatingPanelPosition | null => {
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
    const top = Math.min(Math.max(rawTop, viewportPadding), window.innerHeight - panelHeight - viewportPadding)

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
    syncFloatingPanel(showImagePanel, imageButtonRef.current, 320, imagePanelRef, setImagePanelPosition, setImagePanelReady)
  }, [
    emojiPanelRef,
    imagePanelRef,
    linkPanelRef,
    mediaPanelRef,
    setEmojiPanelPosition,
    setEmojiPanelReady,
    setImagePanelPosition,
    setImagePanelReady,
    setLinkPanelPosition,
    setLinkPanelReady,
    setMediaPanelPosition,
    setMediaPanelReady,
    setTablePanelPosition,
    setTablePanelReady,
    showEmojiPanel,
    showImagePanel,
    showLinkPanel,
    showMediaPanel,
    showTablePanel,
    syncFloatingPanel,
    tablePanelRef,
  ])

  useLayoutEffect(() => {
    if (!showMediaPanel && !showEmojiPanel && !showTablePanel && !showLinkPanel && !showImagePanel) {
      return
    }

    syncFloatingPanels()
    const frameId = window.requestAnimationFrame(() => {
      syncFloatingPanels()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [showEmojiPanel, showImagePanel, showLinkPanel, showMediaPanel, showTablePanel, syncFloatingPanels])

  const closeMediaPanel = useCallback(() => {
    setShowMediaPanel(false)
    setMediaUrl("")
  }, [])

  const closeLinkPanel = useCallback(() => {
    setShowLinkPanel(false)
    setLinkText("")
    setLinkUrl("")
  }, [])

  const closeTablePanel = useCallback(() => {
    setShowTablePanel(false)
    setTableHoverSize({ rows: 0, columns: 0 })
  }, [])

  const closeImagePanel = useCallback(() => {
    setShowImagePanel(false)
    setRemoteImageUrl("")
    setRemoteImageAlt("")
  }, [])

  useEffect(() => {
    if (!showMediaPanel && !showEmojiPanel && !showTablePanel && !showLinkPanel && !showImagePanel) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node

      if (showMediaPanel && !mediaButtonRef.current?.contains(target) && !mediaPanelRef.current?.contains(target)) {
        closeMediaPanel()
      }

      if (showEmojiPanel && !emojiButtonRef.current?.contains(target) && !emojiPanelRef.current?.contains(target)) {
        setShowEmojiPanel(false)
      }

      if (showTablePanel && !tableButtonRef.current?.contains(target) && !tablePanelRef.current?.contains(target)) {
        closeTablePanel()
      }

      if (showLinkPanel && !linkButtonRef.current?.contains(target) && !linkPanelRef.current?.contains(target)) {
        closeLinkPanel()
      }

      if (showImagePanel && !imageButtonRef.current?.contains(target) && !imagePanelRef.current?.contains(target)) {
        closeImagePanel()
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
  }, [
    closeImagePanel,
    closeLinkPanel,
    closeMediaPanel,
    closeTablePanel,
    emojiPanelRef,
    imagePanelRef,
    linkPanelRef,
    mediaPanelRef,
    showEmojiPanel,
    showImagePanel,
    showLinkPanel,
    showMediaPanel,
    showTablePanel,
    syncFloatingPanels,
    tablePanelRef,
  ])

  const syncSelection = useCallback(() => {
    const element = textareaRef.current
    if (!element) {
      return selectionRef.current
    }

    const nextSelection = { start: element.selectionStart, end: element.selectionEnd }
    selectionRef.current = nextSelection
    return nextSelection
  }, [])

  const closeTransientPanels = useCallback(() => {
    setShowMediaPanel(false)
    setShowEmojiPanel(false)
    setShowTablePanel(false)
    setShowLinkPanel(false)
    setShowImagePanel(false)
  }, [])

  const handleToolbarMouseDown = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
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

  const toggleMediaPanel = useCallback(() => {
    closeTransientPanels()
    setShowMediaPanel((current) => !current)
  }, [closeTransientPanels])

  const toggleEmojiPanel = useCallback(() => {
    closeTransientPanels()
    setShowEmojiPanel((current) => !current)
  }, [closeTransientPanels])

  const toggleTablePanel = useCallback(() => {
    closeTransientPanels()
    setTableHoverSize({ rows: 0, columns: 0 })
    setShowTablePanel((current) => !current)
  }, [closeTransientPanels])

  const toggleLinkPanel = useCallback(() => {
    closeTransientPanels()
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
  }, [closeTransientPanels, value])

  const toggleImagePanel = useCallback(() => {
    closeTransientPanels()
    setShowImagePanel((current) => {
      const nextOpen = !current

      if (nextOpen && !markdownImageUploadEnabled) {
        const { start, end } = selectionRef.current
        const selectedText = value.slice(start, end).trim()
        const selectedUrl = normalizeRemoteUrl(selectedText)
        setRemoteImageUrl(selectedUrl ? selectedText : "")
        setRemoteImageAlt(selectedUrl ? "" : selectedText)
      }

      return nextOpen
    })
  }, [closeTransientPanels, markdownImageUploadEnabled, value])

  const openBase64Dialog = useCallback(() => {
    closeTransientPanels()
    const { start, end } = selectionRef.current
    setMessage("")
    setBase64Text(value.slice(start, end))
    setShowBase64Dialog(true)
  }, [closeTransientPanels, value])

  const closeBase64Dialog = useCallback(() => {
    setShowBase64Dialog(false)
    setBase64Text("")
  }, [])

  const dismissBase64Dialog = useCallback(() => {
    setMessage("")
    closeBase64Dialog()
  }, [closeBase64Dialog])

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

    if (uploadResults.length > 0 && !uploading) {
      toggleImagePanel()
      return
    }

    fileInputRef.current?.click()
  }, [markdownImageUploadEnabled, toggleImagePanel, uploadResults.length, uploading])

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
  }, [closeImagePanel, insertMarkdownTemplate, remoteImageAlt, remoteImageUrl])

  const handleInsertMedia = useCallback(() => {
    const result = inferMediaInsert(mediaUrl)
    if (!result) {
      setMessage("请输入有效的音频或视频地址")
      return
    }

    insertMarkdownTemplate(result.template)
    setMessage(result.message)
    closeMediaPanel()
  }, [closeMediaPanel, insertMarkdownTemplate, mediaUrl])

  const handleInsertLink = useCallback(() => {
    if (!linkUrl.trim()) {
      setMessage("请输入有效的链接地址")
      return
    }

    applySelectionTransform(() => buildLinkMarkdown(linkText, linkUrl))
    closeLinkPanel()
  }, [applySelectionTransform, closeLinkPanel, linkText, linkUrl])

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
  }, [applyEditorUpdate, base64Preview, closeBase64Dialog, value])

  const handleContinueUpload = useCallback(() => {
    clearUploadResults()
    setShowImagePanel(false)
  }, [clearUploadResults])

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
    setShowImagePanel(true)
    await uploadImageFiles(files)
    event.target.value = ""
  }, [markdownImageUploadEnabled, uploadImageFiles])

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
      setShowImagePanel(true)
      return
    }

    event.preventDefault()
    setMessage("")
    setShowImagePanel(true)
    await uploadImageFiles(imageFiles)
  }, [markdownImageUploadEnabled, uploadImageFiles])

  const handleTabChange = useCallback((nextTab: "write" | "preview") => {
    if (nextTab === activeTab) {
      return
    }

    if (activeTab === "write") {
      const element = textareaRef.current
      if (element) {
        writeTabViewStateRef.current = {
          scrollTop: element.scrollTop,
          scrollLeft: element.scrollLeft,
          selectionStart: element.selectionStart,
          selectionEnd: element.selectionEnd,
        }
        selectionRef.current = {
          start: element.selectionStart,
          end: element.selectionEnd,
        }
        setEditorScrollTop(element.scrollTop)
      }
    }

    setActiveTab(nextTab)
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== "write") {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      const element = textareaRef.current
      const viewState = writeTabViewStateRef.current
      if (!element || !viewState) {
        return
      }

      element.scrollTop = viewState.scrollTop
      element.scrollLeft = viewState.scrollLeft
      selectionRef.current = {
        start: viewState.selectionStart,
        end: viewState.selectionEnd,
      }

      try {
        element.focus({ preventScroll: true })
      } catch {
        element.focus()
      }
      element.setSelectionRange(viewState.selectionStart, viewState.selectionEnd)
      setEditorScrollTop(viewState.scrollTop)
      writeTabViewStateRef.current = null
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [activeTab])

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-black/45 p-4 md:p-6" : ""}>
      <div className={isFullscreen ? "flex h-full w-full items-center justify-center" : ""}>
        <div className={isFullscreen ? "flex h-full max-h-[96vh] w-full max-w-6xl flex-col overflow-x-hidden overflow-y-visible rounded-[28px] border border-border bg-background shadow-2xl" : "overflow-x-hidden overflow-y-visible rounded-[22px] border border-border bg-card shadow-sm"}>
          <EditorHeader
            activeTab={activeTab}
            disabled={disabled}
            isFullscreen={isFullscreen}
            uploading={uploading}
            valueLength={value.length}
            onTabChange={handleTabChange}
            onEnterFullscreen={() => setIsFullscreen(true)}
            onExitFullscreen={() => setIsFullscreen(false)}
          />
          <EditorBody
            activeTab={activeTab}
            isFullscreen={isFullscreen}
            contentMinHeight={contentMinHeight}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            markdownEmojiMap={markdownEmojiMap}
            textareaRef={textareaRef}
            lineMeasureContainerRef={lineMeasureContainerRef}
            lineMeasureRefs={lineMeasureRefs}
            logicalLines={logicalLines}
            lineNumbers={lineNumbers}
            lineHeights={lineHeights}
            activeLineNumber={activeLineNumber}
            editorScrollTop={editorScrollTop}
            onChange={onChange}
            onScroll={handleTextareaScroll}
            onKeyDown={handleTextareaKeyDown}
            onSelect={handleTextareaSelect}
            onPaste={handlePaste}
          />
          <div className={activeTab === "write" ? (isFullscreen ? "px-3 pb-4 sm:px-5 sm:pb-8" : "px-3 pb-4 sm:px-5") : "px-3 pb-4 sm:px-5"}>
            <EditorToolbar
              visible={activeTab === "write"}
              disabled={disabled}
              isFullscreen={isFullscreen}
              platform={shortcutPlatform}
              imageToolbarTip={imageToolbarTip}
              markdownImageUploadEnabled={markdownImageUploadEnabled}
              uploading={uploading}
              showMediaPanel={showMediaPanel}
              showEmojiPanel={showEmojiPanel}
              showTablePanel={showTablePanel}
              showLinkPanel={showLinkPanel}
              showImagePanel={showImagePanel}
              showBase64Dialog={showBase64Dialog}
              fileInputRef={fileInputRef}
              mediaButtonRef={mediaButtonRef}
              emojiButtonRef={emojiButtonRef}
              tableButtonRef={tableButtonRef}
              linkButtonRef={linkButtonRef}
              imageButtonRef={imageButtonRef}
              onToolbarMouseDown={handleToolbarMouseDown}
              onToolbarSelectMouseDown={handleToolbarSelectMouseDown}
              onToolbarSelectOpenChange={handleToolbarSelectOpenChange}
              onSetHeadingLevel={(level) => applyEditorUpdate(setHeadingLevel(getEditorState(), level))}
              onBold={() => applyWrap("**", "**")}
              onUnderline={() => applyWrap("<u>", "</u>")}
              onStrike={() => applyWrap("~~", "~~")}
              onHighlight={() => applySelectionTransform(buildInlineHighlightMarkdown)}
              onCodeFormat={applyCodeFormatByType}
              onQuote={() => applyLinePrefix("> ")}
              onListFormat={applyListFormatByType}
              onToggleLinkPanel={toggleLinkPanel}
              onToggleTablePanel={toggleTablePanel}
              onInsertDivider={() => insertMarkdownTemplate("---")}
              onAlign={(alignment) => applyEditorUpdate(applyAlignment(getEditorState(), alignment))}
              onToggleMediaPanel={toggleMediaPanel}
              onToggleEmojiPanel={toggleEmojiPanel}
              onTriggerImageShortcut={triggerImageShortcut}
              onOpenBase64Dialog={openBase64Dialog}
              onOpenHelpDialog={() => setShowHelpDialog(true)}
              onUpload={handleUpload}
            />
            {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
          </div>
        </div>
      </div>
      <MarkdownEditorHelpDialog
        open={showHelpDialog}
        onClose={() => setShowHelpDialog(false)}
        platform={shortcutPlatform}
        markdownEmojiMap={markdownEmojiMap}
      />
      <Base64Dialog
        open={showBase64Dialog}
        value={base64Text}
        preview={base64Preview}
        onChange={setBase64Text}
        onClose={dismissBase64Dialog}
        onConfirm={handleInsertBase64}
      />
      <MediaInsertPanel
        open={showMediaPanel}
        isClient={isClient}
        disabled={disabled}
        position={mediaPanelPosition}
        ready={mediaPanelReady}
        panelRef={mediaPanelRef}
        value={mediaUrl}
        hint={mediaHint}
        onChange={setMediaUrl}
        onClose={closeMediaPanel}
        onConfirm={handleInsertMedia}
      />
      <LinkInsertPanel
        open={showLinkPanel}
        isClient={isClient}
        disabled={disabled}
        position={linkPanelPosition}
        ready={linkPanelReady}
        panelRef={linkPanelRef}
        text={linkText}
        url={linkUrl}
        hint={linkHint}
        onTextChange={setLinkText}
        onUrlChange={setLinkUrl}
        onClose={closeLinkPanel}
        onConfirm={handleInsertLink}
      />
      <TableInsertPanel
        open={showTablePanel}
        isClient={isClient}
        disabled={disabled}
        position={tablePanelPosition}
        ready={tablePanelReady}
        panelRef={tablePanelRef}
        hoverSize={tableHoverSize}
        hint={tableHint}
        onHoverChange={setTableHoverSize}
        onClose={closeTablePanel}
        onSelect={handleInsertTable}
      />
      <EmojiInsertPanel
        open={showEmojiPanel}
        isClient={isClient}
        disabled={disabled}
        position={emojiPanelPosition}
        ready={emojiPanelReady}
        panelRef={emojiPanelRef}
        markdownEmojiMap={markdownEmojiMap}
        onSelect={(shortcode) => {
          applyWrap(`:${shortcode}: `)
          setShowEmojiPanel(false)
        }}
      />
      <ImageInsertPanel
        open={showImagePanel}
        isClient={isClient}
        disabled={disabled}
        position={imagePanelPosition}
        ready={imagePanelReady}
        panelRef={imagePanelRef}
        markdownImageUploadEnabled={markdownImageUploadEnabled}
        uploading={uploading}
        uploadSummary={uploadSummary}
        uploadResults={uploadResults}
        fileInputRef={fileInputRef}
        remoteImageUrl={remoteImageUrl}
        remoteImageAlt={remoteImageAlt}
        remoteImageHint={remoteImageHint}
        onRemoteImageUrlChange={setRemoteImageUrl}
        onRemoteImageAltChange={setRemoteImageAlt}
        onClose={markdownImageUploadEnabled ? () => setShowImagePanel(false) : closeImagePanel}
        onContinueUpload={handleContinueUpload}
        onConfirmRemote={handleInsertRemoteImage}
      />
    </div>
  )
}
