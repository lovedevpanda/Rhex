"use client"

import React, { useRef, useState } from "react"
import { createPortal } from "react-dom"

import type { FloatingPanelPosition } from "@/components/refined-rich-post-editor/types"

export function useFloatingPanel() {
  const [position, setPosition] = useState<FloatingPanelPosition | null>(null)
  const [isReady, setIsReady] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  return [position, setPosition, isReady, setIsReady, ref] as const
}

type FloatingEditorPanelProps = {
  open: boolean
  isClient: boolean
  disabled?: boolean
  position: FloatingPanelPosition | null
  ready: boolean
  panelRef: React.MutableRefObject<HTMLDivElement | null>
  className: string
  children: React.ReactNode
}

export function FloatingEditorPanel({
  open,
  isClient,
  disabled = false,
  position,
  ready,
  panelRef,
  className,
  children,
}: FloatingEditorPanelProps) {
  if (!isClient || !open || !position || disabled) {
    return null
  }

  return createPortal(
    <div
      ref={panelRef}
      className={className}
      style={{
        left: position.left,
        top: position.top,
        width: position.width,
        maxHeight: position.maxHeight,
        opacity: ready ? 1 : 0,
        pointerEvents: ready ? "auto" : "none",
      }}
      aria-hidden={!ready}
    >
      {children}
    </div>,
    document.body,
  )
}
