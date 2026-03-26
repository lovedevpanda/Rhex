"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { AdminModal } from "@/components/admin-modal"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"

interface AdminUserPasswordModalProps {
  userId: number
  username: string
  displayName: string
}

export function AdminUserPasswordModal({ userId, username, displayName }: AdminUserPasswordModalProps) {
  const [open, setOpen] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState("")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit() {
    if (!newPassword || !confirmPassword) {
      toast.warning("请完整填写新密码与确认密码", "修改密码")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.warning("两次输入的新密码不一致", "修改密码")
      return
    }

    if (newPassword.length < 6 || newPassword.length > 64) {
      toast.warning("新密码长度需为 6-64 位", "修改密码")
      return
    }

    startTransition(async () => {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "user.password.update",
          targetId: String(userId),
          newPassword,
          message,
        }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(result?.message ?? "密码更新失败", "修改密码失败")
        return
      }

      toast.success(result?.message ?? `用户 @${username} 的密码已更新`, "修改密码成功")
      setOpen(false)
      setNewPassword("")
      setConfirmPassword("")
      setMessage("")
      router.refresh()
    })
  }

  return (
    <>
      <Button type="button" variant="outline" className="h-7 rounded-full px-2.5 text-xs" onClick={() => setOpen(true)}>
        改密
      </Button>
      <AdminModal
        open={open}
        onClose={() => setOpen(false)}
        title="修改用户密码"
        description={`将为 ${displayName}（@${username}）直接设置新密码`}
        footer={
          <div className="flex items-center gap-2">
            <Button type="button" disabled={isPending} className="h-9 rounded-full px-4 text-xs" onClick={handleSubmit}>
              {isPending ? "保存中..." : "确认修改密码"}
            </Button>
            <Button type="button" variant="ghost" className="h-9 px-3 text-xs" onClick={() => setOpen(false)}>
              取消
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">新密码</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none"
              placeholder="请输入 6-64 位新密码"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">确认新密码</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none"
              placeholder="请再次输入新密码"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">操作备注</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="min-h-[88px] w-full rounded-[20px] border border-border bg-background px-4 py-3 text-sm outline-none"
              placeholder="记录重置原因、工单号或审核说明"
            />
          </label>
        </div>
      </AdminModal>
    </>
  )
}
