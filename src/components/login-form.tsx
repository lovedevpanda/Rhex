"use client"

import Image from "next/image"
import Script from "next/script"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

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

interface LoginFormProps {
  settings: SiteSettingsData
}

export function LoginForm({ settings }: LoginFormProps) {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [captchaToken, setCaptchaToken] = useState("")
  const [builtinCaptchaCode, setBuiltinCaptchaCode] = useState("")
  const [builtinCaptchaUrl, setBuiltinCaptchaUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const captchaMode = settings.loginCaptchaMode
  const useTurnstile = captchaMode === "TURNSTILE" && Boolean(settings.turnstileSiteKey)
  const useBuiltinCaptcha = captchaMode === "BUILTIN"

  async function refreshBuiltinCaptcha() {
    const response = await fetch(`/api/auth/captcha?ts=${Date.now()}`, { cache: "no-store" })
    const result = await response.json()

    if (!response.ok || result?.code !== 0) {
      setMessage(result?.message ?? "验证码加载失败")
      return
    }

    setBuiltinCaptchaUrl(result.data?.imageDataUrl ?? "")
    setCaptchaToken(result.data?.captchaToken ?? "")
    setBuiltinCaptchaCode("")
  }

  useEffect(() => {
    if (useBuiltinCaptcha) {
      void refreshBuiltinCaptcha()
    }
  }, [useBuiltinCaptcha])

  useEffect(() => {
    if (!useTurnstile || !settings.turnstileSiteKey || !window.turnstile) {
      return
    }

    const container = document.getElementById("login-turnstile")
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    if ((useTurnstile || useBuiltinCaptcha) && !captchaToken) {
      setMessage("请先完成验证码验证")
      setLoading(false)
      return
    }

    if (useBuiltinCaptcha && !builtinCaptchaCode.trim()) {
      setMessage("请输入图形验证码")
      setLoading(false)
      return
    }

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password, captchaToken, builtinCaptchaCode }),
    })

    const result = await response.json()

    if (!response.ok) {
      const errorMessage = result.message ?? "登录失败"
      setMessage(errorMessage)
      toast.error(errorMessage, "登录失败")
      if (useBuiltinCaptcha) {
        void refreshBuiltinCaptcha()
      }
      setLoading(false)
      return
    }

    const successMessage = "登录成功，正在跳转到首页…"
    setMessage(successMessage)
    toast.success(successMessage, "登录成功")
    router.push("/")
    router.refresh()
    setLoading(false)
  }

  return (
    <>
      {useTurnstile ? <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" /> : null}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">用户名</p>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none"
            placeholder="输入用户名"
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">密码</p>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none"
            placeholder="输入密码"
          />
        </div>

        {useTurnstile ? (
          <div className="space-y-2 rounded-[24px] border border-border p-4">
            <p className="text-sm font-medium">验证码</p>
            <div id="login-turnstile" className="min-h-[65px]" />
            <p className="text-xs text-muted-foreground">使用 Cloudflare Turnstile 防止机器人撞库登录。</p>
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
                <Image
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

        <Button className="w-full" disabled={loading}>
          {loading ? "登录中..." : "登录"}
        </Button>

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </form>
    </>
  )
}
