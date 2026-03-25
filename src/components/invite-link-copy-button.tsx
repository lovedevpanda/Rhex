"use client"

import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"


interface InviteLinkCopyButtonProps {
  path: string
}

export function InviteLinkCopyButton({ path }: InviteLinkCopyButtonProps) {
  const [origin, setOrigin] = useState("")


  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const link = useMemo(() => {
    if (!origin) {
      return path
    }

    return `${origin}${path}`
  }, [origin, path])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link)
      toast.success("已复制邀请链接", "复制成功")
    } catch {
      toast.error("复制失败，请手动复制", "复制失败")
    }
  }


  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" onClick={handleCopy} className="rounded-full">
        复制邀请链接
      </Button>
      <span className="break-all text-xs text-muted-foreground">{link}</span>

    </div>
  )
}
