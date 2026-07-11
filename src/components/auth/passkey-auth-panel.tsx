"use client"

import { useState, useSyncExternalStore } from "react"
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser"

import { Button } from "@/components/ui/rbutton"
import { toast } from "@/components/ui/toast"
import { normalizeAuthRedirectTarget } from "@/lib/auth-redirect"

export interface PasskeyAuthPanelProps {
  mode: "login" | "register"
  redirectTarget?: string
}

function isValidUsername(value: string) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(value)
}

function subscribeToWebAuthnSupport() {
  return () => undefined
}

function getWebAuthnSupportSnapshot() {
  return browserSupportsWebAuthn()
}

function getServerWebAuthnSupportSnapshot() {
  return true
}

export function PasskeyAuthPanel({ mode, redirectTarget = "/" }: PasskeyAuthPanelProps) {
  const supported = useSyncExternalStore(
    subscribeToWebAuthnSupport,
    getWebAuthnSupportSnapshot,
    getServerWebAuthnSupportSnapshot,
  )
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")


  async function handleLogin() {
    setLoading(true)

    try {
      const optionsResponse = await fetch("/api/auth/passkey/login/options", {
        method: "POST",
      })
      const optionsResult = await optionsResponse.json()

      if (!optionsResponse.ok) {
        throw new Error(optionsResult.message ?? "获取 Passkey 登录选项失败")
      }

      const authentication = await startAuthentication({
        optionsJSON: optionsResult.data.options,
      })

      const verifyResponse = await fetch("/api/auth/passkey/login/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ response: authentication }),
      })
      const verifyResult = await verifyResponse.json()

      if (!verifyResponse.ok) {
        throw new Error(verifyResult.message ?? "Passkey 登录失败")
      }

      window.location.replace(normalizeAuthRedirectTarget(redirectTarget || verifyResult.data?.redirectTo))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Passkey 登录失败", "登录失败")
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    if (!isValidUsername(username)) {
      toast.warning("请输入 3-20 位字母、数字或下划线用户名", "资料校验")
      return
    }

    setLoading(true)

    try {
      const optionsResponse = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
        }),
      })
      const optionsResult = await optionsResponse.json()

      if (!optionsResponse.ok) {
        throw new Error(optionsResult.message ?? "获取 Passkey 注册选项失败")
      }

      const registration = await startRegistration({
        optionsJSON: optionsResult.data.options,
      })

      const verifyResponse = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ response: registration }),
      })
      const verifyResult = await verifyResponse.json()

      if (!verifyResponse.ok) {
        throw new Error(verifyResult.message ?? "Passkey 注册失败")
      }

      window.location.replace(normalizeAuthRedirectTarget(verifyResult.data?.redirectTo))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Passkey 注册失败", "认证失败")
    } finally {
      setLoading(false)
    }
  }

  if (!supported) {
    return (
      <div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
        当前浏览器不支持 WebAuthn / Passkey，请更换现代浏览器或改用账号密码、GitHub、Google 登录。
      </div>
    )
  }

  if (mode === "login") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          如果你已经绑定过 Passkey，可直接点击下方按钮完成登录，无需输入用户名和密码。
        </div>
        <Button className="w-full" disabled={loading} onClick={handleLogin}>
          {loading ? "验证中..." : "使用 Passkey 登录"}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
        首次使用 Passkey 创建账户时，需要先给出一个期望用户名；如果邮箱命中现有账户，系统会要求你绑定已有账户。
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">用户名</p>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-hidden"
          placeholder="请输入 3-20 位字母、数字或下划线"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">邮箱</p>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-hidden"
          placeholder="可选，用于命中已有账户并绑定"
        />
      </div>

      <Button className="w-full" disabled={loading} onClick={handleRegister}>
        {loading ? "处理中..." : "创建 Passkey 并继续"}
      </Button>
    </div>
  )
}
