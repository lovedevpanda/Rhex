"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { AdminModal } from "@/components/admin-modal"
import { Button } from "@/components/ui/button"
import { isVipActive } from "@/lib/vip-status"

interface AdminUserVipModalProps {
  userId: number
  username: string
  vipLevel?: number
  vipExpiresAt?: string | null
}

export function AdminUserVipModal({ userId, username, vipLevel = 1, vipExpiresAt }: AdminUserVipModalProps) {
  const vipActive = isVipActive({ vipLevel, vipExpiresAt })
  const [open, setOpen] = useState(false)
  const [nextLevel, setNextLevel] = useState(String(vipLevel || 1))
  const [expiresAt, setExpiresAt] = useState(vipExpiresAt ? vipExpiresAt.slice(0, 16) : "")
  const [message, setMessage] = useState("")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <>
      <Button type="button" variant="outline" className="h-7 rounded-full px-2.5 text-xs" onClick={() => setOpen(true)}>
        VIP
      </Button>
      <AdminModal
        open={open}
        onClose={() => setOpen(false)}
        title="配置 VIP 身份"
        description={`用户 @${username} 当前状态：${vipActive ? `VIP${vipLevel}` : "非 VIP"}`}
        footer={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              disabled={isPending}
              className="h-9 rounded-full px-4 text-xs"
              onClick={() => {
                startTransition(async () => {
                  const response = await fetch("/api/admin/actions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "user.vip.configure",
                      targetId: String(userId),
                      vipLevel: Number(nextLevel) || 1,
                      vipExpiresAt: expiresAt || null,
                      message,
                    }),
                  })
                  if (response.ok) {
                    setOpen(false)
                    router.refresh()
                  }
                })
              }}
            >
              {isPending ? "保存中..." : "保存 VIP 设置"}
            </Button>
            <Button type="button" variant="ghost" className="h-9 px-3 text-xs" onClick={() => setOpen(false)}>
              取消
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">VIP 等级</p>
            <input value={nextLevel} onChange={(event) => setNextLevel(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" placeholder="例如 1 / 2 / 3" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">到期时间</p>
            <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" />
            <p className="text-xs text-muted-foreground">留空表示长期有效。</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">操作备注</p>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-[88px] w-full rounded-[20px] border border-border bg-background px-4 py-3 text-sm outline-none" placeholder="记录发放原因、套餐来源或工单编号" />
          </div>
        </div>
      </AdminModal>
    </>
  )
}
