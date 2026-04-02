"use client"

import { type MutableRefObject, type ReactNode, useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

type TooltipSide = "top" | "bottom"
type TooltipAlign = "start" | "center" | "end"

interface TooltipPosition {
  top: number
  left: number
  arrowLeft: number
  side: TooltipSide
}

interface TooltipProps {
  content?: ReactNode
  children: ReactNode
  side?: TooltipSide
  align?: TooltipAlign
  offset?: number
  openDelay?: number
  closeDelay?: number
  disabled?: boolean
  className?: string
  contentClassName?: string
}

const VIEWPORT_PADDING = 12
const ARROW_SIZE = 8

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  offset = 10,
  openDelay = 120,
  closeDelay = 80,
  disabled = false,
  className,
  contentClassName,
}: TooltipProps) {
  const tooltipId = useId()
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  )
  const triggerRef = useRef<HTMLSpanElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const openTimerRef = useRef<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<TooltipPosition | null>(null)

  function clearTimer(timerRef: MutableRefObject<number | null>) {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const clearAnimationFrame = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const schedulePositionUpdate = useCallback(() => {
    clearAnimationFrame()
    rafRef.current = window.requestAnimationFrame(() => {
      const triggerElement = triggerRef.current
      const tooltipElement = contentRef.current

      if (!triggerElement || !tooltipElement) {
        return
      }

      const triggerRect = triggerElement.getBoundingClientRect()
      const tooltipRect = tooltipElement.getBoundingClientRect()
      const preferredSide = side
      const topSpace = triggerRect.top
      const bottomSpace = window.innerHeight - triggerRect.bottom
      const requiredHeight = tooltipRect.height + offset + ARROW_SIZE

      const resolvedSide =
        preferredSide === "top"
          ? topSpace >= requiredHeight || topSpace >= bottomSpace
            ? "top"
            : "bottom"
          : bottomSpace >= requiredHeight || bottomSpace >= topSpace
            ? "bottom"
            : "top"

      const rawLeft =
        align === "start"
          ? triggerRect.left
          : align === "end"
            ? triggerRect.right - tooltipRect.width
            : triggerRect.left + (triggerRect.width - tooltipRect.width) / 2

      const left = Math.min(
        Math.max(rawLeft, VIEWPORT_PADDING),
        window.innerWidth - tooltipRect.width - VIEWPORT_PADDING,
      )
      const top =
        resolvedSide === "top"
          ? triggerRect.top - tooltipRect.height - offset - ARROW_SIZE
          : triggerRect.bottom + offset + ARROW_SIZE
      const arrowLeft = Math.min(
        Math.max(triggerRect.left + triggerRect.width / 2 - left, 14),
        tooltipRect.width - 14,
      )

      setPosition({
        top: Math.max(VIEWPORT_PADDING, top),
        left,
        arrowLeft,
        side: resolvedSide,
      })
    })
  }, [align, clearAnimationFrame, offset, side])

  function openTooltip(delay = openDelay) {
    if (disabled || !content) {
      return
    }

    clearTimer(closeTimerRef)

    if (delay <= 0) {
      setOpen(true)
      return
    }

    clearTimer(openTimerRef)
    openTimerRef.current = window.setTimeout(() => {
      setOpen(true)
    }, delay)
  }

  const closeTooltip = useCallback((delay = closeDelay) => {
    clearTimer(openTimerRef)

    if (delay <= 0) {
      setOpen(false)
      setPosition(null)
      return
    }

    clearTimer(closeTimerRef)
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false)
      setPosition(null)
    }, delay)
  }, [closeDelay])

  useEffect(() => {
    if (!mounted || !open || disabled || !content) {
      return
    }

    schedulePositionUpdate()

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeTooltip(0)
      }
    }

    const handleWindowChange = () => {
      schedulePositionUpdate()
    }

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          schedulePositionUpdate()
        })

    if (triggerRef.current) {
      resizeObserver?.observe(triggerRef.current)
    }

    if (contentRef.current) {
      resizeObserver?.observe(contentRef.current)
    }

    window.addEventListener("resize", handleWindowChange)
    window.addEventListener("scroll", handleWindowChange, true)
    window.addEventListener("keydown", handleEscape)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener("resize", handleWindowChange)
      window.removeEventListener("scroll", handleWindowChange, true)
      window.removeEventListener("keydown", handleEscape)
      clearAnimationFrame()
    }
  }, [align, clearAnimationFrame, closeDelay, closeTooltip, content, disabled, mounted, offset, open, openDelay, schedulePositionUpdate, side])

  useEffect(() => {
    return () => {
      clearTimer(openTimerRef)
      clearTimer(closeTimerRef)
      clearAnimationFrame()
    }
  }, [clearAnimationFrame])

  if (!content) {
    return <>{children}</>
  }

  return (
    <>
      <span
        ref={triggerRef}
        aria-describedby={open ? tooltipId : undefined}
        className={cn("inline-flex align-middle", className)}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse" || event.pointerType === "pen") {
            openTooltip()
          }
        }}
        onPointerLeave={() => closeTooltip()}
        onFocusCapture={() => openTooltip(0)}
        onBlurCapture={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
            return
          }

          closeTooltip(0)
        }}
      >
        {children}
      </span>

      {mounted && open
        ? createPortal(
            <div
              ref={contentRef}
              id={tooltipId}
              role="tooltip"
              className={cn(
                "pointer-events-none fixed z-[90] max-w-[min(280px,calc(100vw-24px))] rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] px-3 py-2 text-[12px] font-medium leading-5 text-slate-700 shadow-[0_18px_45px_rgba(15,23,42,0.18)] backdrop-blur-md transition-opacity duration-150 dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] dark:text-slate-100",
                contentClassName,
              )}
              style={{
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
                opacity: position ? 1 : 0,
                visibility: position ? "visible" : "hidden",
              }}
            >
              {content}
              {position ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute h-3 w-3 rotate-45 border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))]",
                    position.side === "top" ? "-bottom-[7px] border-l-0 border-t-0" : "-top-[7px] border-b-0 border-r-0",
                  )}
                  style={{ left: position.arrowLeft - ARROW_SIZE / 2 }}
                />
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
