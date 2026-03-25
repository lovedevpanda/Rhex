"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"


export function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)


  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.warning("请完整填写密码信息", "修改密码")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.warning("两次输入的新密码不一致", "修改密码")
      return
    }


    setLoading(true)
    const response = await fetch("/api/profile/password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const result = await response.json()
    setLoading(false)

    if (!response.ok) {
      toast.error(result.message ?? "修改失败", "修改密码失败")
      return
    }

    toast.success(result.message ?? "密码已更新", "修改密码成功")
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")

  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-[24px] border border-border bg-card p-5">
      <div className="space-y-2">
        <p className="text-sm font-medium">当前密码</p>
        <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">新密码</p>
        <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">确认新密码</p>
        <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" />
      </div>
      <Button disabled={loading}>{loading ? "保存中..." : "修改密码"}</Button>

    </form>
  )
}
