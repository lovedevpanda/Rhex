"use client"

import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

interface AdminModalProps {
  open: boolean
  title: string
  description?: string
  size?: "md" | "lg" | "xl"
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
}

const sizeClassMap: Record<NonNullable<AdminModalProps["size"]>, string> = {
  md: "max-w-lg",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
}

export function AdminModal({ open, title, description, size = "md", children, footer, onClose }: AdminModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-3 py-4">
      <div className={`flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-[28px] bg-background shadow-2xl ${sizeClassMap[size]}`}>
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold">{title}</h3>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={onClose}>
            关闭
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-border px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  )
}
