"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser"
import { Chrome, Github, KeyRound, Link2 } from "lucide-react"

import { Button } from "@/components/ui/rbutton"
import { toast } from "@/components/ui/toast"
import { clearAccountBindingFlashOnClient, readAccountBindingFlashOnClient } from "@/lib/account-binding-flash"
import { formatDateTime } from "@/lib/formatters"

interface ProviderBindingItem {
  provider: string
  label: string
  enabled: boolean
  accountId: string | null
  connected: boolean
  connectMode: "url" | "connected-only"
  loginUrl: string | null
  registerUrl: string | null
  connectUrl: string | null
  providerUsername: string | null
  providerEmail: string | null
  providerLabel: string | null
  displayName: string | null
  avatarUrl: string | null
  connectedAt: string | null
}

interface PasskeyBindingItem {
  id: string
  name: string
  deviceType: string | null
  backedUp: boolean
  lastUsedAt: string | null
  createdAt: string
}

interface ProfileAccountBindingSettingsProps {
  providers: ProviderBindingItem[]
  passkey: {
    enabled: boolean
    items: PasskeyBindingItem[]
  }
}

const ACCOUNT_BINDINGS_REDIRECT_PATH = "/settings?tab=profile&profileTab=accounts"

function formatBindingDateTime(value: string | null) {
  if (!value) {
    return "未记录"
  }

  return formatDateTime(value)
}

function buildProviderMeta(binding: ProviderBindingItem) {
  return binding.displayName?.trim()
    || binding.providerUsername?.trim()
    || binding.providerEmail?.trim()
    || "已绑定"
}

function isBuiltinProvider(provider: ProviderBindingItem["provider"]): provider is "github" | "google" {
  return provider === "github" || provider === "google"
}

function getProviderIcon(provider: ProviderBindingItem["provider"]) {
  if (provider === "github") {
    return <Github className="h-4 w-4" />
  }

  if (provider === "google") {
    return <Chrome className="h-4 w-4" />
  }

  return <Link2 className="h-4 w-4" />
}

export function ProfileAccountBindingSettings({ providers, passkey }: ProfileAccountBindingSettingsProps) {
  const router = useRouter()
  const [supportPasskey, setSupportPasskey] = useState(true)
  const [activeProvider, setActiveProvider] = useState<string | null>(null)
  const [bindingPasskey, setBindingPasskey] = useState(false)
  const [unlinkingPasskeyId, setUnlinkingPasskeyId] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ type: "success" | "error"; message: string } | null>(null)

  useEffect(() => {
    setSupportPasskey(browserSupportsWebAuthn())
  }, [])

  useEffect(() => {
    const nextFlash = readAccountBindingFlashOnClient()

    if (!nextFlash) {
      return
    }

    setFlash(nextFlash)
    clearAccountBindingFlashOnClient()

    if (nextFlash.type === "success") {
      toast.success(nextFlash.message, "账号绑定")
      return
    }

    toast.error(nextFlash.message, "账号绑定")
  }, [])

  async function unlinkProvider(provider: string, label: string) {
    setActiveProvider(provider)

    try {
      const response = await fetch("/api/profile/account-bindings/oauth/unlink", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ provider }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message ?? `${label} 解绑失败`)
      }

      toast.success(result.message ?? `${label} 已解绑`, "账号绑定")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `${label} 解绑失败`, "账号绑定")
    } finally {
      setActiveProvider(null)
    }
  }

  function connectProvider(binding: ProviderBindingItem) {
    if (!binding.connectUrl) {
      return
    }

    setActiveProvider(binding.provider)
    const separator = binding.connectUrl.includes("?") ? "&" : "?"
    window.location.href = `${binding.connectUrl}${separator}redirectTo=${encodeURIComponent(ACCOUNT_BINDINGS_REDIRECT_PATH)}`
  }

  async function bindPasskey() {
    setBindingPasskey(true)

    try {
      const optionsResponse = await fetch("/api/profile/account-bindings/passkey/options", {
        method: "POST",
      })
      const optionsResult = await optionsResponse.json()

      if (!optionsResponse.ok) {
        throw new Error(optionsResult.message ?? "获取 Passkey 绑定选项失败")
      }

      const registration = await startRegistration({
        optionsJSON: optionsResult.data.options,
      })

      const verifyResponse = await fetch("/api/profile/account-bindings/passkey/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ response: registration }),
      })
      const verifyResult = await verifyResponse.json()

      if (!verifyResponse.ok) {
        throw new Error(verifyResult.message ?? "绑定 Passkey 失败")
      }

      toast.success(verifyResult.message ?? "Passkey 已绑定", "账号绑定")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "绑定 Passkey 失败", "账号绑定")
    } finally {
      setBindingPasskey(false)
    }
  }

  async function unlinkPasskey(id: string) {
    setUnlinkingPasskeyId(id)

    try {
      const response = await fetch("/api/profile/account-bindings/passkey/unlink", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ credentialId: id }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message ?? "Passkey 解绑失败")
      }

      toast.success(result.message ?? "Passkey 已解绑", "账号绑定")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Passkey 解绑失败", "账号绑定")
    } finally {
      setUnlinkingPasskeyId(null)
    }
  }

  return (
    <div className="space-y-5">
      {flash?.type === "error" ? (
        <div className="rounded-[24px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {flash.message}
        </div>
      ) : null}
      {flash?.type === "success" ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {flash.message}
        </div>
      ) : null}

      <div className="rounded-[24px] bg-card p-5 ">
        <div className="flex items-start gap-3 ">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
            <Link2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">第三方账号</p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              绑定后可以直接使用对应渠道登录当前站内账户。内置渠道支持在这里直接发起绑定；插件追加渠道会在绑定成功后显示，并支持在这里解绑。
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {providers.map((binding) => (
            <div key={binding.provider} className="rounded-[22px] bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{binding.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {binding.enabled ? (binding.connected ? buildProviderMeta(binding) : "当前未绑定") : "后台未开启该登录方式"}
                  </p>
                </div>
                <span className={binding.connected ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700" : "rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground"}>
                  {binding.connected ? "已绑定" : "未绑定"}
                </span>
              </div>

              {binding.connected ? (
                <div className="mt-4 space-y-1 text-xs leading-6 text-muted-foreground">
                  {binding.providerUsername ? <p>用户名：{binding.providerUsername}</p> : null}
                  {binding.providerEmail ? <p>邮箱：{binding.providerEmail}</p> : null}
                  {!isBuiltinProvider(binding.provider) ? <p>渠道标识：{binding.provider}</p> : null}
                  <p>绑定时间：{formatBindingDateTime(binding.connectedAt)}</p>
                </div>
              ) : null}

              <div className="mt-4">
                {binding.connected ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    disabled={activeProvider === binding.provider}
                    onClick={() => void unlinkProvider(binding.provider, binding.label)}
                  >
                    {getProviderIcon(binding.provider)}
                    {activeProvider === binding.provider ? "解绑中..." : `解绑 ${binding.label}`}
                  </Button>
                ) : binding.connectMode === "url" && binding.connectUrl ? (
                  <Button
                    type="button"
                    className="w-full gap-2"
                    disabled={!binding.enabled || activeProvider === binding.provider}
                    onClick={() => connectProvider(binding)}
                  >
                    {getProviderIcon(binding.provider)}
                    {activeProvider === binding.provider ? "跳转中..." : `绑定 ${binding.label}`}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    disabled
                  >
                    {getProviderIcon(binding.provider)}
                    当前仅支持显示与解绑
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[24px] bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Passkey</p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              Passkey 可以绑定多把钥匙，适合不同设备分别录入。绑定后可直接免密码登录。
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-[22px] bg-background p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Passkey 列表</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {passkey.enabled
                  ? `当前共绑定 ${passkey.items.length} 把 Passkey`
                  : "后台未开启 Passkey 登录"}
              </p>
            </div>
            <Button type="button" className="gap-2 sm:min-w-[140px]" disabled={!passkey.enabled || !supportPasskey || bindingPasskey} onClick={() => void bindPasskey()}>
              <KeyRound className="h-4 w-4" />
              {bindingPasskey ? "绑定中..." : "新增 Passkey"}
            </Button>
          </div>

          {!supportPasskey ? (
            <p className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-700">
              当前浏览器不支持 WebAuthn / Passkey，请更换现代浏览器后再绑定。
            </p>
          ) : null}

          <div className="mt-4 space-y-3">
            {passkey.items.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                当前还没有绑定任何 Passkey。
              </div>
            ) : passkey.items.map((item) => (
              <div key={item.id} className="rounded-[18px] px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.name}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-6 text-muted-foreground">
                      <span>设备：{item.deviceType || "未知设备"}</span>
                      <span>备份：{item.backedUp ? "已备份" : "未备份"}</span>
                      <span>创建：{formatBindingDateTime(item.createdAt)}</span>
                      <span>最近使用：{formatBindingDateTime(item.lastUsedAt)}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 sm:min-w-[120px]"
                    disabled={unlinkingPasskeyId === item.id}
                    onClick={() => void unlinkPasskey(item.id)}
                  >
                    <KeyRound className="h-4 w-4" />
                    {unlinkingPasskeyId === item.id ? "解绑中..." : "解绑"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
