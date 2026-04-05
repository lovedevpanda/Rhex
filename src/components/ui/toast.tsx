"use client"

import { CheckCircle2, CircleAlert, Info, X } from "lucide-react"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"

import { cn } from "@/lib/utils"

const TOAST_DURATION = 3200

export type ToastVariant = "success" | "error" | "info" | "warning"

export interface ToastOptions {
  title?: string
  description: string
  variant?: ToastVariant
  duration?: number
}

interface ToastItem extends Required<Pick<ToastOptions, "description">> {
  id: string
  title?: string
  variant: ToastVariant
  duration: number
}

interface ToastContextValue {
  toast: (options: ToastOptions) => string
  success: (description: string, title?: string) => string
  error: (description: string, title?: string) => string
  info: (description: string, title?: string) => string
  warning: (description: string, title?: string) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)
let globalToastBridge: ToastContextValue | null = null

const toastToneClassNames: Record<ToastVariant, string> = {
  success: "border-emerald-200/80 bg-emerald-50/95 shadow-emerald-100/80 dark:border-emerald-500/30 dark:bg-zinc-900/95 dark:shadow-black/40",
  error: "border-rose-200/80 bg-rose-50/95 shadow-rose-100/80 dark:border-rose-500/30 dark:bg-zinc-900/95 dark:shadow-black/40",
  info: "border-sky-200/80 bg-sky-50/95 shadow-sky-100/80 dark:border-sky-500/30 dark:bg-zinc-900/95 dark:shadow-black/40",
  warning: "border-amber-200/80 bg-amber-50/95 shadow-amber-100/80 dark:border-amber-500/30 dark:bg-zinc-900/95 dark:shadow-black/40",
}

const toastIconClassNames: Record<ToastVariant, string> = {
  success: "text-emerald-600 dark:text-emerald-300",
  error: "text-rose-600 dark:text-rose-300",
  info: "text-sky-600 dark:text-sky-300",
  warning: "text-amber-600 dark:text-amber-300",
}

function getToastIcon(variant: ToastVariant) {
  switch (variant) {
    case "success":
      return <CheckCircle2 className="h-5 w-5" />
    case "error":
      return <CircleAlert className="h-5 w-5" />
    case "warning":
      return <CircleAlert className="h-5 w-5" />
    default:
      return <Info className="h-5 w-5" />
  }
}

function createToastId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const timersRef = useRef<Map<string, number>>(new Map())

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timersRef.current.delete(id)
    }

    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(({ title, description, variant = "info", duration = TOAST_DURATION }: ToastOptions) => {
    const id = createToastId()
    setItems((current) => [...current, { id, title, description, variant, duration }])

    const timer = window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id))
      timersRef.current.delete(id)
    }, duration)

    timersRef.current.set(id, timer)
    return id
  }, [])

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current.clear()
  }, [])

  const contextValue = useMemo<ToastContextValue>(() => ({
    toast,
    dismiss,
    success: (description, title) => toast({ description, title, variant: "success" }),
    error: (description, title) => toast({ description, title, variant: "error" }),
    info: (description, title) => toast({ description, title, variant: "info" }),
    warning: (description, title) => toast({ description, title, variant: "warning" }),
  }), [dismiss, toast])

  useEffect(() => {
    globalToastBridge = contextValue
    return () => {
      if (globalToastBridge === contextValue) {
        globalToastBridge = null
      }
    }
  }, [contextValue])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[120] flex justify-center px-4 sm:top-6 sm:justify-end sm:px-6">
        <div className="flex w-full max-w-sm flex-col gap-3">
          {items.map((item) => (
            <section
              key={item.id}
              className={cn(
                "pointer-events-auto overflow-hidden rounded-[22px] border p-4 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/70",
                "animate-[toast-in_180ms_ease-out]",
                toastToneClassNames[item.variant],
              )}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <div className={cn("mt-0.5 shrink-0", toastIconClassNames[item.variant])}>{getToastIcon(item.variant)}</div>
                <div className="min-w-0 flex-1 space-y-1">
                  {item.title ? <p className="text-base font-semibold leading-5 text-zinc-950 dark:text-white">{item.title}</p> : null}
                  <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-200">{item.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-black/5 hover:text-zinc-700 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-zinc-100"
                  aria-label="关闭提示"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </section>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast 必须在 ToastProvider 内使用")
  }

  return context
}

function fallbackNotify(description: string) {
  if (typeof window !== "undefined") {
    window.alert(description)
  }
}

export const toast = {
  show(options: ToastOptions) {
    if (!globalToastBridge) {
      fallbackNotify(options.description)
      return ""
    }

    return globalToastBridge.toast(options)
  },
  success(description: string, title?: string) {
    if (!globalToastBridge) {
      fallbackNotify(description)
      return ""
    }

    return globalToastBridge.success(description, title)
  },
  error(description: string, title?: string) {
    if (!globalToastBridge) {
      fallbackNotify(description)
      return ""
    }

    return globalToastBridge.error(description, title)
  },
  info(description: string, title?: string) {
    if (!globalToastBridge) {
      fallbackNotify(description)
      return ""
    }

    return globalToastBridge.info(description, title)
  },
  warning(description: string, title?: string) {
    if (!globalToastBridge) {
      fallbackNotify(description)
      return ""
    }

    return globalToastBridge.warning(description, title)
  },
}
