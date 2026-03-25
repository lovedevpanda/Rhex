"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { AdminModal } from "@/components/admin-modal"
import { Button } from "@/components/ui/button"

interface AdminPostActionButtonProps {
  action: string
  targetId: string
  label: string
  className?: string
  variant?: "default" | "outline" | "ghost"
  tone?: "default" | "danger"
  payload?: Record<string, unknown>
  modalTitle?: string
  modalDescription?: string
  placeholder?: string
  confirmText?: string
}

export function AdminPostActionButton({
  action,
  targetId,
  label,
  className,
  variant = "outline",
  tone = "default",
  payload,
  modalTitle,
  modalDescription,
  placeholder,
  confirmText,
}: AdminPostActionButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [isPending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetId, message, ...payload }),
      })

      if (response.ok) {
        setOpen(false)
        setMessage("")
        router.refresh()
      }
    })
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={className ?? (tone === "danger" ? "h-7 rounded-full bg-red-600 px-2.5 text-xs text-white hover:bg-red-500" : "h-7 rounded-full px-2.5 text-xs")}
        onClick={() => {
          if (!modalTitle && !placeholder) {
            submit()
            return
          }
          setOpen(true)
        }}
        disabled={isPending}
      >
        {isPending ? "处理中..." : label}
      </Button>

      <AdminModal
        open={open}
        onClose={() => setOpen(false)}
        title={modalTitle ?? `确认${label}`}
        description={modalDescription}
        footer={
          <div className="flex items-center gap-2">
            <Button type="button" disabled={isPending} className={tone === "danger" ? "h-9 rounded-full bg-red-600 px-4 text-xs text-white hover:bg-red-500" : "h-9 rounded-full px-4 text-xs"} onClick={submit}>
              {isPending ? "处理中..." : confirmText ?? label}
            </Button>
            <Button type="button" variant="ghost" className="h-9 px-3 text-xs" onClick={() => setOpen(false)}>
              取消
            </Button>
          </div>
        }
      >
        {placeholder ? (
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={placeholder}
            className="min-h-[120px] w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm outline-none"
          />
        ) : null}
      </AdminModal>
    </>
  )
}
