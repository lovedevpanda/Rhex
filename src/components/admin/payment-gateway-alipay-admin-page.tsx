"use client"

import Link from "next/link"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/rbutton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { TextField } from "@/components/ui/text-field"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import {
  PAYMENT_GATEWAY_KEY_TYPES,
  PAYMENT_GATEWAY_SIGN_MODES,
  type PaymentGatewayAdminData,
} from "@/lib/payment-gateway.types"

interface PaymentGatewayAlipayAdminPageProps {
  initialData: PaymentGatewayAdminData
}

function SecretTextarea(props: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  clearLabel: string
  clearChecked: boolean
  onClearChange: (checked: boolean) => void
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{props.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{props.placeholder}</p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={props.clearChecked} onCheckedChange={props.onClearChange} />
          {props.clearLabel}
        </label>
      </div>
      <Textarea
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        rows={7}
        placeholder="留空则保留当前值"
        className="min-h-[180px] resize-y font-mono text-xs"
      />
    </div>
  )
}

export function PaymentGatewayAlipayAdminPage({ initialData }: PaymentGatewayAlipayAdminPageProps) {
  const [data, setData] = useState(initialData)
  const [sandbox, setSandbox] = useState(initialData.config.alipay.sandbox)
  const [signMode, setSignMode] = useState(initialData.config.alipay.signMode)
  const [keyType, setKeyType] = useState(initialData.config.alipay.keyType)
  const [appId, setAppId] = useState(initialData.config.alipay.appId)
  const [sellerId, setSellerId] = useState(initialData.config.alipay.sellerId)
  const [returnPath, setReturnPath] = useState(initialData.config.alipay.returnPath)
  const [notifyPath, setNotifyPath] = useState(initialData.config.alipay.notifyPath)

  const [privateKey, setPrivateKey] = useState("")
  const [alipayPublicKey, setAlipayPublicKey] = useState("")
  const [appCertContent, setAppCertContent] = useState("")
  const [alipayPublicCertContent, setAlipayPublicCertContent] = useState("")
  const [alipayRootCertContent, setAlipayRootCertContent] = useState("")

  const [clearPrivateKey, setClearPrivateKey] = useState(false)
  const [clearAlipayPublicKey, setClearAlipayPublicKey] = useState(false)
  const [clearAppCertContent, setClearAppCertContent] = useState(false)
  const [clearAlipayPublicCertContent, setClearAlipayPublicCertContent] = useState(false)
  const [clearAlipayRootCertContent, setClearAlipayRootCertContent] = useState(false)

  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()

  function syncDraftFromData(nextData: PaymentGatewayAdminData) {
    setData(nextData)
    setSandbox(nextData.config.alipay.sandbox)
    setSignMode(nextData.config.alipay.signMode)
    setKeyType(nextData.config.alipay.keyType)
    setAppId(nextData.config.alipay.appId)
    setSellerId(nextData.config.alipay.sellerId)
    setReturnPath(nextData.config.alipay.returnPath)
    setNotifyPath(nextData.config.alipay.notifyPath)
    setPrivateKey("")
    setAlipayPublicKey("")
    setAppCertContent("")
    setAlipayPublicCertContent("")
    setAlipayRootCertContent("")
    setClearPrivateKey(false)
    setClearAlipayPublicKey(false)
    setClearAppCertContent(false)
    setClearAlipayPublicCertContent(false)
    setClearAlipayRootCertContent(false)
  }

  function buildPayload() {
    return {
      config: {
        alipay: {
          sandbox,
          signMode,
          keyType,
          appId,
          sellerId,
          returnPath,
          notifyPath,
        },
      },
      secret: {
        privateKey,
        alipayPublicKey,
        appCertContent,
        alipayPublicCertContent,
        alipayRootCertContent,
        clearPrivateKey,
        clearAlipayPublicKey,
        clearAppCertContent,
        clearAlipayPublicCertContent,
        clearAlipayRootCertContent,
      },
    }
  }

  function saveConfig() {
    setFeedback("")

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/apps/payment-gateway/alipay", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildPayload()),
        })
        const result = await response.json()

        if (!response.ok || !result?.data) {
          throw new Error(result?.message ?? "支付宝配置保存失败")
        }

        syncDraftFromData(result.data as PaymentGatewayAdminData)
        setFeedback(result?.message ?? "配置已保存")
        toast.success(result?.message ?? "支付宝配置已保存", "保存成功")
      } catch (error) {
        const message = error instanceof Error ? error.message : "支付宝配置保存失败"
        setFeedback(message)
        toast.error(message, "保存失败")
      }
    })
  }

  const runtimeReady = data.config.alipay.privateKeyConfigured
    && (
      signMode === "PUBLIC_KEY"
        ? data.config.alipay.alipayPublicKeyConfigured
        : (
            data.config.alipay.appCertConfigured
            && data.config.alipay.alipayPublicCertConfigured
            && data.config.alipay.alipayRootCertConfigured
          )
    )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>支付宝接口配置</CardTitle>
            <Link href="/admin/apps/payment-gateway" className="inline-flex h-10 items-center justify-center rounded-full border border-border px-4 text-sm transition-colors hover:bg-accent hover:text-accent-foreground">
              返回网关基础页
            </Link>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 py-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">当前提供方</p>
            <p className="mt-2 text-base font-semibold">支付宝</p>
            <p className="mt-1 text-sm text-muted-foreground">不再单独维护提供方开关，实际启停由基础页的支付通道控制。</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">运行环境</p>
            <p className="mt-2 text-base font-semibold">{sandbox ? "沙箱" : "正式"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{sandbox ? "用于联调和验签调试" : "用于生产收款"}</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">签名模式</p>
            <p className="mt-2 text-base font-semibold">{signMode === "PUBLIC_KEY" ? "公钥模式" : "证书模式"}</p>
            <p className="mt-1 text-sm text-muted-foreground">密钥格式 {keyType}</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">运行态</p>
            <p className="mt-2 text-base font-semibold">{runtimeReady ? "可用" : "未完成"}</p>
            <p className="mt-1 text-sm text-muted-foreground">是否具备完整的 AppId、私钥与公钥 / 证书组合。</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>基础参数</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 py-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">使用沙箱</p>
                  <p className="mt-1 text-sm text-muted-foreground">本地开发和联调建议开启。</p>
                </div>
                <Switch checked={sandbox} onCheckedChange={setSandbox} />
              </div>
            </div>
            <label className="space-y-2 rounded-xl border border-border p-4">
              <span className="text-sm font-medium">加签模式</span>
              <select
                value={signMode}
                onChange={(event) => setSignMode(event.target.value as typeof signMode)}
                className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-hidden"
              >
                {PAYMENT_GATEWAY_SIGN_MODES.map((item) => (
                  <option key={item} value={item}>{item === "PUBLIC_KEY" ? "公钥模式" : "证书模式"}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 rounded-xl border border-border p-4">
              <span className="text-sm font-medium">私钥格式</span>
              <select
                value={keyType}
                onChange={(event) => setKeyType(event.target.value as typeof keyType)}
                className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-hidden"
              >
                {PAYMENT_GATEWAY_KEY_TYPES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <TextField label="AppId" value={appId} onChange={setAppId} placeholder="2019xxxxxxxxxxxx" />
            <TextField label="Seller ID" value={sellerId} onChange={setSellerId} placeholder="2088xxxxxxxxxxxx" />
            <TextField label="支付完成返回地址" value={returnPath} onChange={setReturnPath} placeholder="/topup/result" />
            <TextField label="异步通知路径" value={notifyPath} onChange={setNotifyPath} placeholder="/api/payments/notify/alipay" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>敏感配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 py-5">
          <div className="grid gap-4 xl:grid-cols-2">
            <SecretTextarea
              label={`应用私钥 ${data.config.alipay.privateKeyConfigured ? "（已配置）" : "（未配置）"}`}
              value={privateKey}
              onChange={setPrivateKey}
              placeholder="支持 PKCS1 / PKCS8，具体格式与上方“私钥格式”保持一致。"
              clearLabel="保存时清空当前私钥"
              clearChecked={clearPrivateKey}
              onClearChange={setClearPrivateKey}
            />

            {signMode === "PUBLIC_KEY" ? (
              <SecretTextarea
                label={`支付宝公钥 ${data.config.alipay.alipayPublicKeyConfigured ? "（已配置）" : "（未配置）"}`}
                value={alipayPublicKey}
                onChange={setAlipayPublicKey}
                placeholder="公钥模式下必填。留空则保持当前值。"
                clearLabel="保存时清空当前支付宝公钥"
                clearChecked={clearAlipayPublicKey}
                onClearChange={setClearAlipayPublicKey}
              />
            ) : (
              <div className="grid gap-4">
                <SecretTextarea
                  label={`应用公钥证书 ${data.config.alipay.appCertConfigured ? "（已配置）" : "（未配置）"}`}
                  value={appCertContent}
                  onChange={setAppCertContent}
                  placeholder="证书模式下必填。粘贴完整证书内容。"
                  clearLabel="保存时清空当前应用公钥证书"
                  clearChecked={clearAppCertContent}
                  onClearChange={setClearAppCertContent}
                />
                <SecretTextarea
                  label={`支付宝公钥证书 ${data.config.alipay.alipayPublicCertConfigured ? "（已配置）" : "（未配置）"}`}
                  value={alipayPublicCertContent}
                  onChange={setAlipayPublicCertContent}
                  placeholder="证书模式下必填。粘贴完整证书内容。"
                  clearLabel="保存时清空当前支付宝公钥证书"
                  clearChecked={clearAlipayPublicCertContent}
                  onClearChange={setClearAlipayPublicCertContent}
                />
                <SecretTextarea
                  label={`支付宝根证书 ${data.config.alipay.alipayRootCertConfigured ? "（已配置）" : "（未配置）"}`}
                  value={alipayRootCertContent}
                  onChange={setAlipayRootCertContent}
                  placeholder="证书模式下必填。粘贴完整证书内容。"
                  clearLabel="保存时清空当前支付宝根证书"
                  clearChecked={clearAlipayRootCertContent}
                  onClearChange={setClearAlipayRootCertContent}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={saveConfig} disabled={isPending}>{isPending ? "保存中..." : "保存支付宝配置"}</Button>
        {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
      </div>
    </div>
  )
}
