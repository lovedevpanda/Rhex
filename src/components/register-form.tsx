"use client"

import { VerificationChannel } from "@/db/types"
import { useMemo, useState } from "react"

import { useRouter, useSearchParams } from "next/navigation"

import { BuiltinCaptchaField } from "@/components/builtin-captcha-field"
import { TurnstileCaptchaField } from "@/components/turnstile-captcha-field"
import { Button } from "@/components/ui/button"
import { TextField } from "@/components/ui/text-field"
import { toast } from "@/components/ui/toast"
import type { SiteSettingsData } from "@/lib/site-settings"

interface RegisterFormProps {
  settings: SiteSettingsData
}

export function RegisterForm({ settings }: RegisterFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialInviterUsername = searchParams.get("invite") ?? searchParams.get("inviter") ?? ""
  const initialInviteCode = (searchParams.get("code") ?? "").toUpperCase()
  const [username, setUsername] = useState("")
  const [nickname, setNickname] = useState("")
  const [password, setPassword] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [emailCode, setEmailCode] = useState("")
  const [phoneCode, setPhoneCode] = useState("")
  const [gender, setGender] = useState("unknown")
  const [inviterUsername, setInviterUsername] = useState(initialInviterUsername)
  const [inviteCode, setInviteCode] = useState(initialInviteCode)
  const [captchaToken, setCaptchaToken] = useState("")
  const [builtinCaptchaCode, setBuiltinCaptchaCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [emailMessage, setEmailMessage] = useState("")

  const [phoneMessage, setPhoneMessage] = useState("")
  const [emailSending, setEmailSending] = useState(false)
  const [phoneSending, setPhoneSending] = useState(false)

  const captchaMode = settings.registerCaptchaMode
  const useTurnstile = captchaMode === "TURNSTILE" && Boolean(settings.turnstileSiteKey)
  const useBuiltinCaptcha = captchaMode === "BUILTIN"

  const hiddenInviterBound = useMemo(() => !settings.registerInviterEnabled && !!inviterUsername, [settings.registerInviterEnabled, inviterUsername])
  const hiddenInviteCodeBound = useMemo(() => !settings.registerInviteCodeEnabled && !!inviteCode, [settings.registerInviteCodeEnabled, inviteCode])

  async function sendCode(channel: VerificationChannel) {
    const target = channel === VerificationChannel.EMAIL ? email : phone
    const setSending = channel === VerificationChannel.EMAIL ? setEmailSending : setPhoneSending
    const setFieldMessage = channel === VerificationChannel.EMAIL ? setEmailMessage : setPhoneMessage

    setSending(true)
    setFieldMessage("")

    const response = await fetch("/api/auth/send-verification-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel, target }),
    })

    const result = await response.json()
    setFieldMessage(result.message ?? (response.ok ? "验证码已发送" : "验证码发送失败"))
    setSending(false)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)


    if ((useTurnstile || useBuiltinCaptcha) && !captchaToken) {
      toast.warning("请先完成验证码验证", "注册校验")
      setLoading(false)
      return
    }

    if (useBuiltinCaptcha && !builtinCaptchaCode.trim()) {
      toast.warning("请输入图形验证码", "注册校验")
      setLoading(false)
      return
    }

    if (settings.registerEmailEnabled && settings.registerEmailVerification && !emailCode) {
      toast.warning("请填写邮箱验证码", "注册校验")
      setLoading(false)
      return
    }

    if (settings.registerPhoneEnabled && settings.registerPhoneVerification && !phoneCode) {
      toast.warning("请填写手机验证码", "注册校验")
      setLoading(false)
      return
    }

    if (settings.registrationRequireInviteCode && !inviteCode) {
      toast.warning("请填写邀请码", "注册校验")
      setLoading(false)
      return
    }


    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        nickname,
        password,
        inviterUsername,
        inviteCode,
        email,
        emailCode,
        phone,
        phoneCode,
        gender,
        captchaToken,
        builtinCaptchaCode,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      const errorMessage = result.message ?? "注册失败"
      toast.error(errorMessage, "注册失败")
      setLoading(false)
      return
    }

    const successMessage = "注册成功，正在跳转到首页…"
    toast.success(successMessage, "注册成功")


    router.replace("/")
    router.refresh()
    setLoading(false)
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="用户名" value={username} onChange={setUsername} placeholder="设置用户名" required background="card" />
        {settings.registerNicknameEnabled ? <TextField label="昵称" value={nickname} onChange={setNickname} placeholder={settings.registerNicknameRequired ? "设置昵称" : "设置昵称（可选）"} required={settings.registerNicknameRequired} background="card" /> : null}
        <TextField label="密码" value={password} onChange={setPassword} placeholder="设置密码" required type="password" background="card" />

        {settings.registerEmailEnabled ? (
          <VerificationField
            label="邮箱"
            value={email}
            onChange={setEmail}
            code={emailCode}
            onCodeChange={setEmailCode}
            placeholder={settings.registerEmailRequired ? "请输入邮箱" : "邮箱（可选）"}
            required={settings.registerEmailRequired}
            verifyRequired={settings.registerEmailVerification}
            sending={emailSending}
            message={emailMessage}
            onSend={() => sendCode(VerificationChannel.EMAIL)}
          />
        ) : null}

        {settings.registerPhoneEnabled ? (
          <VerificationField
            label="手机"
            value={phone}
            onChange={setPhone}
            code={phoneCode}
            onCodeChange={setPhoneCode}
            placeholder={settings.registerPhoneRequired ? "请输入手机号" : "手机号（可选）"}
            required={settings.registerPhoneRequired}
            verifyRequired={settings.registerPhoneVerification}
            sending={phoneSending}
            message={phoneMessage}
            onSend={() => sendCode(VerificationChannel.PHONE)}
          />
        ) : null}

        {settings.registerGenderEnabled ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">性别{settings.registerGenderRequired ? " *" : ""}</p>
            <select value={gender} onChange={(event) => setGender(event.target.value)} className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none">
              <option value="unknown">保密</option>
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </div>
        ) : null}

        {settings.registerInviterEnabled ? (
          <TextField label="邀请人用户名" value={inviterUsername} onChange={setInviterUsername} placeholder="选填，可填写邀请你的用户名" background="card" />
        ) : hiddenInviterBound ? (
          <p className="rounded-2xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">已通过链接绑定邀请人 <span className="font-medium text-foreground">{inviterUsername}</span>，当前输入框已按后台设置隐藏。</p>
        ) : null}

        {settings.registerInviteCodeEnabled ? (
          <TextField label="邀请码" value={inviteCode} onChange={(value) => setInviteCode(value.toUpperCase())} placeholder={settings.registrationRequireInviteCode ? "请输入邀请码" : "有邀请码可填写"} required={settings.registrationRequireInviteCode} background="card" />
        ) : hiddenInviteCodeBound ? (
          <p className="rounded-2xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">已通过链接绑定邀请码 <span className="font-mono font-medium text-foreground">{inviteCode}</span>，当前输入框已按后台设置隐藏。</p>
        ) : null}

        {useTurnstile && settings.turnstileSiteKey ? <TurnstileCaptchaField siteKey={settings.turnstileSiteKey} description="使用 Cloudflare Turnstile 防止机器人批量注册。" onTokenChange={setCaptchaToken} /> : null}

        {useBuiltinCaptcha ? <BuiltinCaptchaField code={builtinCaptchaCode} onCodeChange={setBuiltinCaptchaCode} onTokenChange={setCaptchaToken} onLoadError={(message) => toast.error(message, "验证码")} /> : null}

        <Button className="w-full" disabled={loading}>{loading ? "注册中..." : "注册并登录"}</Button>

      </form>
    </>
  )
}

function VerificationField({
  label,
  value,
  onChange,
  code,
  onCodeChange,
  placeholder,
  required,
  verifyRequired,
  sending,
  message,
  onSend,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  code: string
  onCodeChange: (value: string) => void
  placeholder: string
  required: boolean
  verifyRequired: boolean
  sending: boolean
  message: string
  onSend: () => Promise<void>
}) {
  return (
    <div className="space-y-3 rounded-[24px]">
      <TextField label={label} value={value} onChange={onChange} placeholder={placeholder} required={required} background="card" />
      {verifyRequired ? (
        <>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <TextField label={`${label}验证码`} value={code} onChange={onCodeChange} placeholder="请输入 6 位验证码" required={verifyRequired} background="card" />
            <Button type="button" variant="outline" onClick={onSend} disabled={sending || !value}>{sending ? "发送中..." : "发送验证码"}</Button>
          </div>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </>
      ) : null}
    </div>
  )
}
