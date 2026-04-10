"use client"

import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

type PopoverSide = "top" | "bottom"
type PopoverAlign = "start" | "center" | "end"

interface PopoverPosition {
  top: number
  left: number
  side: PopoverSide
}

interface AnchoredPopoverProps {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  children: ReactNode
  side?: PopoverSide
  align?: PopoverAlign
  offset?: number
  className?: string
}

const VIEWPORT_PADDING = 12

export function AnchoredPopover({
  open,
  anchorRef,
  onClose,
  children,
  side = "top",
  align = "end",
  offset = 8,
  className,
}: AnchoredPopoverProps) {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  )
  const contentRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const [position, setPosition] = useState<PopoverPosition | null>(null)

  const clearAnimationFrame = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const schedulePositionUpdate = useCallback(() => {
    clearAnimationFrame()
    rafRef.current = window.requestAnimationFrame(() => {
      const anchorElement = anchorRef.current
      const contentElement = contentRef.current

      if (!anchorElement || !contentElement) {
        return
      }

      const anchorRect = anchorElement.getBoundingClientRect()
      const contentRect = contentElement.getBoundingClientRect()
      const topSpace = anchorRect.top
      const bottomSpace = window.innerHeight - anchorRect.bottom
      const requiredHeight = contentRect.height + offset

      const resolvedSide =
        side === "top"
          ? topSpace >= requiredHeight || topSpace >= bottomSpace
            ? "top"
            : "bottom"
          : bottomSpace >= requiredHeight || bottomSpace >= topSpace
            ? "bottom"
            : "top"

      const rawLeft =
        align === "start"
          ? anchorRect.left
          : align === "center"
            ? anchorRect.left + (anchorRect.width - contentRect.width) / 2
            : anchorRect.right - contentRect.width

      const left = Math.min(
        Math.max(rawLeft, VIEWPORT_PADDING),
        window.innerWidth - contentRect.width - VIEWPORT_PADDING,
      )
      const top =
        resolvedSide === "top"
          ? anchorRect.top - contentRect.height - offset
          : anchorRect.bottom + offset

      setPosition({
        top: Math.min(
          Math.max(top, VIEWPORT_PADDING),
          window.innerHeight - contentRect.height - VIEWPORT_PADDING,
        ),
        left,
        side: resolvedSide,
      })
    })
  }, [align, anchorRef, clearAnimationFrame, offset, side])

  useEffect(() => {
    if (!mounted || !open) {
      return
    }

    schedulePositionUpdate()

    const handleWindowChange = () => {
      schedulePositionUpdate()
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }
    const handlePointerDownOutside = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (anchorRef.current?.contains(target) || contentRef.current?.contains(target)) {
        return
      }

      onClose()
    }

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          schedulePositionUpdate()
        })

    if (anchorRef.current) {
      resizeObserver?.observe(anchorRef.current)
    }
    if (contentRef.current) {
      resizeObserver?.observe(contentRef.current)
    }

    window.addEventListener("resize", handleWindowChange)
    window.addEventListener("scroll", handleWindowChange, true)
    window.addEventListener("keydown", handleEscape)
    window.addEventListener("pointerdown", handlePointerDownOutside, true)

    return () => {
      setPosition(null)
      resizeObserver?.disconnect()
      window.removeEventListener("resize", handleWindowChange)
      window.removeEventListener("scroll", handleWindowChange, true)
      window.removeEventListener("keydown", handleEscape)
      window.removeEventListener("pointerdown", handlePointerDownOutside, true)
      clearAnimationFrame()
    }
  }, [anchorRef, clearAnimationFrame, mounted, onClose, open, schedulePositionUpdate])

  useEffect(() => {
    return () => {
      clearAnimationFrame()
    }
  }, [clearAnimationFrame])

  if (!mounted || !open) {
    return null
  }

  return createPortal(
    <div
      ref={contentRef}
      className={cn(
        "fixed z-[140] rounded-2xl border border-border bg-background/95 p-1.5 shadow-lg backdrop-blur-sm",
        className,
      )}
      style={{
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        visibility: position ? "visible" : "hidden",
      }}
      data-popover-side={position?.side}
    >
      {children}
    </div>,
    document.body,
  )
}
