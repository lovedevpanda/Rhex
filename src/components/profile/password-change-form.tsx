"use client"

import { useState } from "react"

import { Button } from "@/components/ui/rbutton"
import { toast } from "@/components/ui/toast"

interface PasswordChangeFormProps {
  embedded?: boolean
  requireEmailVerification?: boolean
  emailDeliveryEnabled?: boolean
  currentEmail?: string | null
  currentEmailVerified?: boolean
}

function resolvePasswordChangeBlockReason(input: {
  requireEmailVerification: boolean
  emailDeliveryEnabled: boolean
  currentEmail: string
  currentEmailVerified: boolean
}) {
  if (!input.requireEmailVerification) {
    return ""
  }

  if (!input.emailDeliveryEnabled) {
    return "站点尚未配置邮件发送能力，当前无法通过邮箱验证修改密码，请联系管理员。"
  }

  if (!input.currentEmail) {
    return "当前账号还没有绑定邮箱，请先到“邮箱”页完成绑定和验证。"
  }

  if (!input.currentEmailVerified) {
    return "当前账号邮箱尚未验证，请先到“邮箱”页完成验证后再修改密码。"
  }

  return ""
}

export function PasswordChangeForm({
  embedded = false,
  requireEmailVerification = false,
  emailDeliveryEnabled = false,
  currentEmail = null,
  currentEmailVerified = false,
}: PasswordChangeFormProps) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [emailCode, setEmailCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const normalizedEmail = currentEmail?.trim() ?? ""
  const blockedReason = resolvePasswordChangeBlockReason({
    requireEmailVerification,
    emailDeliveryEnabled,
    currentEmail: normalizedEmail,
    currentEmailVerified,
  })
  const submitDisabled = loading || Boolean(blockedReason)

  async function handleSendCode() {
    if (blockedReason) {
      toast.warning(blockedReason, "修改密码")
      return
    }

    setSendingCode(true)

    try {
      const response = await fetch("/api/profile/password/send-code", {
        method: "POST",
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message ?? "验证码发送失败")
      }

      toast.success(result.message ?? "验证码已发送", "修改密码")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "验证码发送失败", "修改密码")
    } finally {
      setSendingCode(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (blockedReason) {
      toast.warning(blockedReason, "修改密码")
      return
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.warning("请完整填写密码信息", "修改密码")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.warning("两次输入的新密码不一致", "修改密码")
      return
    }

    if (requireEmailVerification && !emailCode) {
      toast.warning("请填写邮箱验证码", "修改密码")
      return
    }

    setLoading(true)
    const response = await fetch("/api/profile/password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPassword,
        newPassword,
        emailCode: requireEmailVerification ? emailCode : "",
      }),
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
    setEmailCode("")
  }

  return (
    <form onSubmit={handleSubmit} className={embedded ? "space-y-4" : "space-y-4 rounded-[24px] border border-border bg-card p-5"}>
      {requireEmailVerification ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">邮箱安全验证</p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">修改密码前完成一次邮箱验证码确认，验证码会发送到你已验证的绑定邮箱。</p>
          </div>
          {normalizedEmail ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">当前邮箱</p>
              <p className="text-sm font-medium">{normalizedEmail}</p>
            </div>
          ) : null}
          {blockedReason ? (
            <div className="rounded-[16px] border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-800">
              {blockedReason}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">邮箱验证码</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    value={emailCode}
                    onChange={(event) => setEmailCode(event.target.value)}
                    className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden"
                    placeholder="输入收到的 6 位验证码"
                  />
                  <Button type="button" variant="outline" disabled={sendingCode} onClick={handleSendCode}>
                    {sendingCode ? "发送中..." : "发送验证码"}
                  </Button>
                </div>
              </div>
              <p className="text-xs leading-6 text-muted-foreground">如果没有收到邮件，请检查垃圾箱，或稍后重新发送。</p>
            </>
          )}
        </div>
      ) : null}
      <div className="space-y-2">
        <p className="text-sm font-medium">当前密码</p>
        <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden" />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">新密码</p>
        <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden" />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">确认新密码</p>
        <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden" />
      </div>
      <Button disabled={submitDisabled}>{loading ? "保存中..." : "修改密码"}</Button>
    </form>
  )
}
