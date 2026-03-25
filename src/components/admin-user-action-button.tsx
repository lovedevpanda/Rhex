"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"

import { Button } from "@/components/ui/button"

interface AdminUserActionButtonProps {
  userId: number
  action: string
  label: string
  message?: string
  variant?: "default" | "outline" | "ghost"
  className?: string
  onSuccess?: () => void
}

export function AdminUserActionButton({
  userId,
  action,
  label,
  message,
  variant = "outline",
  className,
  onSuccess,
}: AdminUserActionButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant={variant}
      className={className ?? "h-8 rounded-full px-3"}
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const response = await fetch("/api/admin/actions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, targetId: String(userId), message }),
          })

          if (response.ok) {
            onSuccess?.()
            router.refresh()
          }
        })
      }}
    >
      {isPending ? "处理中..." : label}
    </Button>
  )
}
