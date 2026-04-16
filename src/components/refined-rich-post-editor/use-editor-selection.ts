"use client"

import { useCallback, useRef } from "react"
import type * as React from "react"

import type { EditorRestoreViewState, EditorSelectionRange } from "@/components/refined-rich-post-editor/types"
import { insertTemplate, type MarkdownEditorState, type MarkdownEditorUpdate } from "@/lib/markdown-editor-shortcuts"

type UseEditorSelectionOptions = {
  value: string
  onChange: (value: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  selectionRef: React.MutableRefObject<EditorSelectionRange>
  updateSelection: (selection: EditorSelectionRange) => void
  onRestoreScrollTop: (scrollTop: number) => void
}

export function useEditorSelection({
  value,
  onChange,
  textareaRef,
  selectionRef,
  updateSelection,
  onRestoreScrollTop,
}: UseEditorSelectionOptions) {
  const restoreViewStateRef = useRef<EditorRestoreViewState | null>(null)

  const getEditorState = useCallback((element?: HTMLTextAreaElement | null): MarkdownEditorState => {
    const currentElement = element ?? textareaRef.current
    const nextSelection = currentElement
      ? { start: currentElement.selectionStart, end: currentElement.selectionEnd }
      : selectionRef.current

    updateSelection(nextSelection)

    return {
      value,
      selectionStart: nextSelection.start,
      selectionEnd: nextSelection.end,
    }
  }, [selectionRef, textareaRef, updateSelection, value])

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
      updateSelection({ start, end })

      if (!viewState) {
        return
      }

      element.scrollTop = viewState.scrollTop
      element.scrollLeft = viewState.scrollLeft
      onRestoreScrollTop(viewState.scrollTop)
      window.scrollTo(viewState.pageXOffset, viewState.pageYOffset)
      restoreViewStateRef.current = null
    })
  }, [onRestoreScrollTop, textareaRef, updateSelection])

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
  }, [onChange, restoreSelection, textareaRef])

  const insertMarkdownTemplate = useCallback((template: string) => {
    applyEditorUpdate(insertTemplate(getEditorState(), template))
  }, [applyEditorUpdate, getEditorState])

  const syncSelection = useCallback(() => {
    const element = textareaRef.current
    if (!element) {
      return selectionRef.current
    }

    const nextSelection = { start: element.selectionStart, end: element.selectionEnd }
    updateSelection(nextSelection)
    return nextSelection
  }, [selectionRef, textareaRef, updateSelection])

  return {
    getEditorState,
    applyEditorUpdate,
    insertMarkdownTemplate,
    syncSelection,
  }
}
