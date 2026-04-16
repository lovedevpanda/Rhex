"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type * as React from "react"

import { EDITOR_FALLBACK_LINE_HEIGHT_PX } from "@/components/refined-rich-post-editor/constants"
import type {
  EditorSelectionRange,
  EditorTab,
  EditorWriteViewState,
} from "@/components/refined-rich-post-editor/types"

type UseEditorViewStateOptions = {
  value: string
  minHeight: number
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  updateSelection: (selection: EditorSelectionRange) => void
}

export function useEditorViewState({
  value,
  minHeight,
  textareaRef,
  updateSelection,
}: UseEditorViewStateOptions) {
  const lineMeasureContainerRef = useRef<HTMLDivElement | null>(null)
  const lineMeasureRefs = useRef<Array<HTMLDivElement | null>>([])
  const writeTabViewStateRef = useRef<EditorWriteViewState | null>(null)

  const [activeTab, setActiveTab] = useState<EditorTab>("write")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [editorScrollTop, setEditorScrollTop] = useState(0)
  const [activeLineNumber, setActiveLineNumber] = useState(1)
  const [lineHeights, setLineHeights] = useState<number[]>([EDITOR_FALLBACK_LINE_HEIGHT_PX])

  const hasEditorSurface = useCallback((tab: EditorTab) => tab !== "preview", [])

  const contentMinHeight = isFullscreen ? "100%" : minHeight
  const logicalLines = useMemo(() => value.split("\n"), [value])
  const lineNumbers = useMemo(() => Array.from({ length: logicalLines.length }, (_, index) => index + 1), [logicalLines.length])

  const updateActiveLineNumber = useCallback((element: HTMLTextAreaElement | null) => {
    if (!element) {
      setActiveLineNumber(1)
      return
    }

    const caretPosition = element.selectionStart ?? 0
    const nextLineNumber = value.slice(0, caretPosition).split("\n").length
    setActiveLineNumber(nextLineNumber)
  }, [value])

  useEffect(() => {
    const element = textareaRef.current
    const nextLineNumber = !element ? 1 : value.slice(0, element.selectionStart ?? 0).split("\n").length
    const frameId = window.requestAnimationFrame(() => {
      setActiveLineNumber(nextLineNumber)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [textareaRef, value])

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
  }, [logicalLines, textareaRef])

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
  }, [measureLineHeights, textareaRef])

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

  const handleTabChange = useCallback((nextTab: EditorTab) => {
    if (nextTab === activeTab) {
      return
    }

    if (hasEditorSurface(activeTab)) {
      const element = textareaRef.current
      if (element) {
        writeTabViewStateRef.current = {
          scrollTop: element.scrollTop,
          scrollLeft: element.scrollLeft,
          selectionStart: element.selectionStart,
          selectionEnd: element.selectionEnd,
        }
        updateSelection({
          start: element.selectionStart,
          end: element.selectionEnd,
        })
        setEditorScrollTop(element.scrollTop)
      }
    }

    setActiveTab(nextTab)
  }, [activeTab, hasEditorSurface, textareaRef, updateSelection])

  useEffect(() => {
    if (!hasEditorSurface(activeTab)) {
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
      updateSelection({
        start: viewState.selectionStart,
        end: viewState.selectionEnd,
      })

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
  }, [activeTab, hasEditorSurface, textareaRef, updateSelection])

  const handleTextareaScroll = useCallback((event: React.UIEvent<HTMLTextAreaElement>) => {
    setEditorScrollTop(event.currentTarget.scrollTop)
    updateActiveLineNumber(event.currentTarget)
  }, [updateActiveLineNumber])

  const handleTextareaSelect = useCallback((event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    updateSelection({
      start: event.currentTarget.selectionStart,
      end: event.currentTarget.selectionEnd,
    })
    updateActiveLineNumber(event.currentTarget)
  }, [updateActiveLineNumber, updateSelection])

  return {
    activeTab,
    isFullscreen,
    setIsFullscreen,
    contentMinHeight,
    logicalLines,
    lineNumbers,
    lineHeights,
    activeLineNumber,
    editorScrollTop,
    setEditorScrollTop,
    lineMeasureContainerRef,
    lineMeasureRefs,
    handleTabChange,
    handleTextareaScroll,
    handleTextareaSelect,
  }
}
