"use client"

import { VerificationChannel } from "@/db/types"
import NextImage from "next/image"
import Script from "next/script"
import { useEffect, useMemo, useState } from "react"

import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import type { SiteSettingsData } from "@/lib/site-settings"


declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: { sitekey: string; callback?: (token: string) => void; "expired-callback"?: () => void; "error-callback"?: () => void; theme?: "light" | "dark" | "auto" }) => string
      reset: (widgetId?: string) => void
    }
  }
}

interface RegisterFormProps {
  settings: SiteSettingsData
}

export function RegisterForm({ settings }: RegisterFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState("")
  const [nickname, setNickname] = useState("")
  const [password, setPassword] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [emailCode, setEmailCode] = useState("")
  const [phoneCode, setPhoneCode] = useState("")
  const [gender, setGender] = useState("unknown")
  const [inviterUsername, setInviterUsername] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [captchaToken, setCaptchaToken] = useState("")
  const [builtinCaptchaCode, setBuiltinCaptchaCode] = useState("")
  const [builtinCaptchaUrl, setBuiltinCaptchaUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [emailMessage, setEmailMessage] = useState("")

  const [phoneMessage, setPhoneMessage] = useState("")
  const [emailSending, setEmailSending] = useState(false)
  const [phoneSending, setPhoneSending] = useState(false)

  const captchaMode = settings.registerCaptchaMode
  const useTurnstile = captchaMode === "TURNSTILE" && Boolean(settings.turnstileSiteKey)
  const useBuiltinCaptcha = captchaMode === "BUILTIN"

  async function refreshBuiltinCaptcha() {
    const response = await fetch(`/api/auth/captcha?ts=${Date.now()}`, { cache: "no-store" })
    const result = await response.json()

    if (!response.ok || result?.code !== 0) {
      const errorMessage = result?.message ?? "验证码加载失败"
      toast.error(errorMessage, "验证码")
      return
    }


    setBuiltinCaptchaUrl(result.data?.imageDataUrl ?? "")
    setCaptchaToken(result.data?.captchaToken ?? "")
    setBuiltinCaptchaCode("")
  }

  useEffect(() => {
    const inviter = searchParams.get("invite") ?? searchParams.get("inviter") ?? ""
    const code = searchParams.get("code") ?? ""
    if (inviter) {
      setInviterUsername(inviter)
    }
    if (code) {
      setInviteCode(code.toUpperCase())
    }
  }, [searchParams])

  useEffect(() => {
    if (useBuiltinCaptcha) {
      void refreshBuiltinCaptcha()
    }
  }, [useBuiltinCaptcha])

  useEffect(() => {
    if (!useTurnstile || !settings.turnstileSiteKey || !window.turnstile) {
      return
    }

    const container = document.getElementById("register-turnstile")
    if (!container || container.dataset.rendered === "true") {
      return
    }

    window.turnstile.render(container, {
      sitekey: settings.turnstileSiteKey,
      callback: (token) => setCaptchaToken(token),
      "expired-callback": () => setCaptchaToken(""),
      "error-callback": () => setCaptchaToken(""),
      theme: "auto",
    })
    container.dataset.rendered = "true"
  }, [settings.turnstileSiteKey, useTurnstile])

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
      if (useBuiltinCaptcha) {
        void refreshBuiltinCaptcha()
      }
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
      {useTurnstile ? <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" /> : null}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="用户名" value={username} onChange={setUsername} placeholder="设置用户名" required />
        {settings.registerNicknameEnabled ? <Field label="昵称" value={nickname} onChange={setNickname} placeholder={settings.registerNicknameRequired ? "设置昵称" : "设置昵称（可选）"} required={settings.registerNicknameRequired} /> : null}
        <Field label="密码" value={password} onChange={setPassword} placeholder="设置密码" required type="password" />

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
          <Field label="邀请人用户名" value={inviterUsername} onChange={setInviterUsername} placeholder="选填，可填写邀请你的用户名" />
        ) : hiddenInviterBound ? (
          <p className="rounded-2xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">已通过链接绑定邀请人 <span className="font-medium text-foreground">{inviterUsername}</span>，当前输入框已按后台设置隐藏。</p>
        ) : null}

        {settings.registerInviteCodeEnabled ? (
          <Field label="邀请码" value={inviteCode} onChange={(value) => setInviteCode(value.toUpperCase())} placeholder={settings.registrationRequireInviteCode ? "请输入邀请码" : "有邀请码可填写"} required={settings.registrationRequireInviteCode} />
        ) : hiddenInviteCodeBound ? (
          <p className="rounded-2xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">已通过链接绑定邀请码 <span className="font-mono font-medium text-foreground">{inviteCode}</span>，当前输入框已按后台设置隐藏。</p>
        ) : null}

        {useTurnstile ? (
          <div className="space-y-2 rounded-[24px] border border-border p-4">
            <p className="text-sm font-medium">验证码</p>
            <div id="register-turnstile" className="min-h-[65px]" />
            <p className="text-xs text-muted-foreground">使用 Cloudflare Turnstile 防止机器人批量注册。</p>
          </div>
        ) : null}

        {useBuiltinCaptcha ? (
          <div className="space-y-3 rounded-[24px] border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">图形验证码</p>
              <button type="button" className="text-xs text-primary hover:opacity-80" onClick={() => void refreshBuiltinCaptcha()}>刷新验证码</button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {builtinCaptchaUrl ? (
                <NextImage
                  src={builtinCaptchaUrl}
                  alt="图形验证码"
                  width={132}
                  height={44}
                  unoptimized
                  className="h-11 w-[132px] rounded-xl bg-card"
                />

              ) : null}

              <input value={builtinCaptchaCode} onChange={(event) => setBuiltinCaptchaCode(event.target.value.toUpperCase())} placeholder="输入图中验证码" className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none sm:max-w-[220px]" />
            </div>
          </div>
        ) : null}

        <Button className="w-full" disabled={loading}>{loading ? "注册中..." : "注册并登录"}</Button>

      </form>
    </>
  )
}

function Field({ label, value, onChange, placeholder, required = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean; type?: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}{required ? " *" : ""}</p>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none" placeholder={placeholder} required={required} />
    </div>
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
    <div className="space-y-3 rounded-[24px] border border-border p-4">
      <Field label={label} value={value} onChange={onChange} placeholder={placeholder} required={required} />
      {verifyRequired ? (
        <>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <Field label={`${label}验证码`} value={code} onChange={onCodeChange} placeholder="请输入 6 位验证码" required={verifyRequired} />
            <Button type="button" variant="outline" onClick={onSend} disabled={sending || !value}>{sending ? "发送中..." : "发送验证码"}</Button>
          </div>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </>
      ) : null}
    </div>
  )
}
