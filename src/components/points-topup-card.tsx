"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import QRCode from "qrcode"

import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/rbutton"
import { toast } from "@/components/ui/toast"
import { formatNumber } from "@/lib/formatters"
import type {
  PaymentGatewayCheckoutMethodOption,
  PaymentGatewayClientType,
  PaymentGatewayTopupPackage,
} from "@/lib/payment-gateway.types"

interface PointsTopupCardProps {
  enabled: boolean
  pointName: string
  packages: PaymentGatewayTopupPackage[]
  paymentMethods?: PaymentGatewayCheckoutMethodOption[]
  initialRuntimeClientType?: WebRuntimeClientType
  customAmountEnabled?: boolean
  customMinAmountFen?: number
  customMaxAmountFen?: number
  customPointsPerYuan?: number
  heading?: string
  description?: string
  showStandaloneLink?: boolean
  standaloneHref?: string
}

interface PendingTopupOrderState {
  merchantOrderNo: string
  packageTitle: string
  totalPoints: number
  paymentMethodLabel: string
  qrCode: string
  qrDataUrl: string | null
  statusText: string
}

type WebRuntimeClientType = Extract<PaymentGatewayClientType, "WEB_DESKTOP" | "WEB_MOBILE">

function submitCheckoutForm(html: string) {
  const container = document.createElement("div")
  container.style.display = "none"
  container.innerHTML = html
  document.body.appendChild(container)
  const form = container.querySelector("form")

  if (!(form instanceof HTMLFormElement)) {
    container.remove()
    throw new Error("支付表单生成失败")
  }

  form.submit()
}

function formatAmountFen(amountFen: number) {
  return `¥${(amountFen / 100).toFixed(2)}`
}

function parseAmountInputToFen(value: string) {
  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) {
    return null
  }

  const amount = Number(normalized)
  if (!Number.isFinite(amount) || amount <= 0) {
    return null
  }

  return Math.round(amount * 100)
}

function isVisiblePaymentMethod(method: PaymentGatewayCheckoutMethodOption, runtimeClientType: WebRuntimeClientType) {
  if (method.checkoutClientType === "QR_CODE") {
    return true
  }

  return method.checkoutClientType === runtimeClientType
}

function compactPaymentMethodTitle(method: PaymentGatewayCheckoutMethodOption) {
  return method.label.split(/\s+/).filter(Boolean)[0] || method.label
}

function compactPaymentMethodHint(method: PaymentGatewayCheckoutMethodOption) {
  if (method.presentationType === "QR_CODE") {
    return "扫码"
  }

  switch (method.checkoutClientType) {
    case "WEB_MOBILE":
      return "H5"
    case "WEB_DESKTOP":
      return "网页"
    case "APP":
      return "App"
    case "MINI_APP":
      return "小程序"
    default:
      return "支付"
  }
}

export function PointsTopupCard({
  enabled,
  pointName,
  packages,
  paymentMethods = [],
  initialRuntimeClientType = "WEB_DESKTOP",
  customAmountEnabled = false,
  customMinAmountFen = 0,
  customMaxAmountFen = 0,
  customPointsPerYuan = 0,
  heading = "积分充值",
  description = "",
  showStandaloneLink = false,
  standaloneHref = "/topup",
}: PointsTopupCardProps) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState("")
  const [pendingOrder, setPendingOrder] = useState<PendingTopupOrderState | null>(null)
  const [customAmountInput, setCustomAmountInput] = useState("")
  const [runtimeClientType] = useState<WebRuntimeClientType>(initialRuntimeClientType)
  const [selectedMethodId, setSelectedMethodId] = useState(() => paymentMethods[0]?.id ?? "")

  const normalizedDescription = description.trim() || `选择一个充值套餐并确认支付方式，支付成功后 ${pointName} 会自动到账。若后台路由到扫码通道，会在当前页显示收款二维码。`
  const customAmountFen = useMemo(() => parseAmountInputToFen(customAmountInput), [customAmountInput])
  const customAmountRangeText = customAmountEnabled
    ? `范围 ${formatAmountFen(customMinAmountFen)} - ${formatAmountFen(customMaxAmountFen)}，当前按 1 元 = ${formatNumber(customPointsPerYuan)} ${pointName} 换算。`
    : ""
  const customAmountError = useMemo(() => {
    if (!customAmountEnabled || !customAmountInput.trim()) {
      return ""
    }
    if (customAmountFen === null) {
      return "请输入正确的金额，最多支持两位小数。"
    }
    if (customAmountFen < customMinAmountFen || customAmountFen > customMaxAmountFen) {
      return `自定义金额必须在 ${formatAmountFen(customMinAmountFen)} 到 ${formatAmountFen(customMaxAmountFen)} 之间。`
    }
    return ""
  }, [customAmountEnabled, customAmountFen, customAmountInput, customMaxAmountFen, customMinAmountFen])
  const customPoints = useMemo(() => {
    if (!customAmountEnabled || customAmountFen === null || customAmountFen <= 0 || customAmountError) {
      return 0
    }

    return Math.max(1, Math.floor((customAmountFen / 100) * customPointsPerYuan))
  }, [customAmountEnabled, customAmountError, customAmountFen, customPointsPerYuan])
  const visiblePaymentMethods = useMemo(() => {
    const filtered = paymentMethods.filter((item) => isVisiblePaymentMethod(item, runtimeClientType))
    return filtered.length > 0 ? filtered : paymentMethods
  }, [paymentMethods, runtimeClientType])
  const selectedPaymentMethod = visiblePaymentMethods.find((item) => item.id === selectedMethodId) ?? visiblePaymentMethods[0] ?? null

  useEffect(() => {
    if (visiblePaymentMethods.some((item) => item.id === selectedMethodId)) {
      return
    }

    setSelectedMethodId(visiblePaymentMethods[0]?.id ?? "")
  }, [selectedMethodId, visiblePaymentMethods])

  useEffect(() => {
    const merchantOrderNo = pendingOrder?.merchantOrderNo
    if (!merchantOrderNo) {
      return
    }
    const activeMerchantOrderNo = merchantOrderNo

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function pollOrder() {
      try {
        const response = await fetch(`/api/payments/order?merchantOrderNo=${encodeURIComponent(activeMerchantOrderNo)}`, {
          method: "GET",
          cache: "no-store",
        })
        const result = await response.json()
        if (!response.ok || !result?.data) {
          throw new Error(result?.message ?? "充值订单状态获取失败")
        }

        if (cancelled) {
          return
        }

        const nextData = result.data as {
          status: string
          fulfillmentStatus: string
          lastErrorMessage: string | null
        }

        if (nextData.status === "PAID" && nextData.fulfillmentStatus === "SUCCEEDED") {
          setPendingOrder(null)
          router.push(`/topup/result?merchantOrderNo=${encodeURIComponent(activeMerchantOrderNo)}`)
          return
        }

        if (["FAILED", "CLOSED", "REFUNDED"].includes(nextData.status) || nextData.fulfillmentStatus === "FAILED") {
          setPendingOrder((current) => current ? {
            ...current,
            statusText: nextData.lastErrorMessage || "订单已关闭，请重新发起充值。",
          } : current)
          return
        }

        timer = setTimeout(() => {
          void pollOrder()
        }, 3000)
      } catch (error) {
        if (cancelled) {
          return
        }

        setPendingOrder((current) => current ? {
          ...current,
          statusText: error instanceof Error ? error.message : "充值订单状态获取失败",
        } : current)
      }
    }

    void pollOrder()

    return () => {
      cancelled = true
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [pendingOrder?.merchantOrderNo, router])

  async function createTopupOrder(
    payload: { packageId?: string; customAmountFen?: number; preferredChannelCode?: string; clientType?: PaymentGatewayClientType },
    summary: { title: string; totalPoints: number; paymentMethodLabel: string },
  ) {
    try {
      const response = await fetch("/api/payments/topup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok || !result?.data) {
        throw new Error(result?.message ?? "创建充值订单失败")
      }

      const order = result.data as {
        merchantOrderNo: string
        presentation: {
          type: "HTML_FORM" | "QR_CODE"
          html?: string
          qrCode?: string
        }
      }

      if (order.presentation.type === "HTML_FORM" && order.presentation.html) {
        submitCheckoutForm(order.presentation.html)
        return
      }

      if (order.presentation.type === "QR_CODE" && order.presentation.qrCode) {
        const qrDataUrl = await QRCode.toDataURL(order.presentation.qrCode, {
          width: 240,
          margin: 2,
        })

        setPendingOrder({
          merchantOrderNo: order.merchantOrderNo,
          packageTitle: summary.title,
          totalPoints: summary.totalPoints,
          paymentMethodLabel: summary.paymentMethodLabel,
          qrCode: order.presentation.qrCode,
          qrDataUrl,
          statusText: `请使用 ${summary.paymentMethodLabel} 完成支付，支付成功后会自动跳转结果页。`,
        })
        return
      }

      throw new Error("当前充值订单未返回可用的支付展示信息")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建充值订单失败", "充值失败")
    }
  }

  async function handlePackageTopup(selectedPackage: PaymentGatewayTopupPackage) {
    if (!selectedPaymentMethod) {
      toast.error("当前没有可用支付方式，请联系管理员检查充值通道配置", "充值失败")
      return
    }

    setLoadingId(selectedPackage.id)
    try {
      await createTopupOrder(
        {
          packageId: selectedPackage.id,
          preferredChannelCode: selectedPaymentMethod.channelCode,
          clientType: selectedPaymentMethod.checkoutClientType,
        },
        {
          title: selectedPackage.title,
          totalPoints: selectedPackage.points + selectedPackage.bonusPoints,
          paymentMethodLabel: selectedPaymentMethod.label,
        },
      )
    } finally {
      setLoadingId("")
    }
  }

  async function handleCustomTopup() {
    if (!customAmountEnabled) {
      return
    }

    if (customAmountFen === null || customAmountError || customPoints <= 0) {
      toast.error(customAmountError || "请输入正确的自定义充值金额", "充值失败")
      return
    }
    if (!selectedPaymentMethod) {
      toast.error("当前没有可用支付方式，请联系管理员检查充值通道配置", "充值失败")
      return
    }

    setLoadingId("custom")
    try {
      await createTopupOrder(
        {
          customAmountFen,
          preferredChannelCode: selectedPaymentMethod.channelCode,
          clientType: selectedPaymentMethod.checkoutClientType,
        },
        {
          title: `自定义充值 ${formatAmountFen(customAmountFen)}`,
          totalPoints: customPoints,
          paymentMethodLabel: selectedPaymentMethod.label,
        },
      )
    } finally {
      setLoadingId("")
    }
  }

  if (!enabled || (packages.length === 0 && !customAmountEnabled)) {
    return null
  }

  return (
    <>
      <div className="rounded-[24px] px-4 py-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium">{heading}</p>
            <p className="mt-1 text-sm text-muted-foreground">{normalizedDescription}</p>
          </div>
          {showStandaloneLink ? (
            <Link href={standaloneHref} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              打开独立充值页
            </Link>
          ) : null}
        </div>

        {paymentMethods.length > 0 ? (
          <div className="rounded-[18px] bg-card/70 p-3">
            <p className="text-sm font-semibold">支付方式</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {visiblePaymentMethods.map((method) => {
                const active = method.id === (selectedPaymentMethod?.id ?? "")

                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setSelectedMethodId(method.id)}
                    className={`flex h-[58px] min-w-[68px] w-auto shrink-0 flex-col rounded-[14px] border px-3 py-2 text-left transition-colors ${active ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:bg-accent hover:text-accent-foreground"}`}
                    aria-pressed={active}
                    title={method.label}
                  >
                    <div className="flex h-full flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <p className="whitespace-nowrap text-[13px] font-semibold leading-none">{compactPaymentMethodTitle(method)}</p>
                        {active ? (
                          <span className="text-[10px] font-medium leading-none">选中</span>
                        ) : null}
                      </div>
                      <div className="mt-auto flex items-end justify-between gap-2">
                        <span className={`text-[11px] leading-none ${active ? "text-background/78" : "text-muted-foreground"}`}>
                          {compactPaymentMethodHint(method)}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-[20px] border border-dashed border-border bg-card/40 p-4 text-sm text-muted-foreground">
            当前积分充值已开启，但还没有配置可用支付方式，请联系管理员检查支付通道和路由规则。
          </div>
        )}

        {packages.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {packages.map((item) => {
              const totalPoints = item.points + item.bonusPoints
              const bonusText = item.bonusPoints > 0 ? `，赠送 ${formatNumber(item.bonusPoints)} ${pointName}` : ""
              return (
                <div key={item.id} className="rounded-[20px] border border-border bg-card/70 p-4">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-2 text-2xl font-semibold">{formatNumber(totalPoints)} <span className="text-sm font-normal text-muted-foreground">{pointName}</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    基础 {formatNumber(item.points)} {pointName}{bonusText}
                  </p>
                  <p className="mt-4 text-sm text-muted-foreground">支付金额 {formatAmountFen(item.amountFen)}</p>
                  <Button
                    type="button"
                    className="mt-4 w-full"
                    disabled={loadingId !== "" || !selectedPaymentMethod}
                    onClick={() => void handlePackageTopup(item)}
                  >
                    {loadingId === item.id ? "创建订单中..." : `支付 ${formatAmountFen(item.amountFen)} 充值`}
                  </Button>
                </div>
              )
            })}
          </div>
        ) : null}

        {customAmountEnabled ? (
          <div className="rounded-[20px] border border-border bg-card/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">自定义充值金额</p>
                <p className="mt-1 text-xs text-muted-foreground">{customAmountRangeText}</p>
              </div>
              {customPoints > 0 ? (
                <div className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                  预计到账 {formatNumber(customPoints)} {pointName}
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-col gap-3 md:flex-row">
              <input
                value={customAmountInput}
                onChange={(event) => setCustomAmountInput(event.target.value)}
                placeholder="输入充值金额，如 68 或 128.50"
                className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-hidden"
                inputMode="decimal"
              />
              <Button
                type="button"
                disabled={loadingId !== "" || customAmountFen === null || Boolean(customAmountError) || customPoints <= 0 || !selectedPaymentMethod}
                onClick={() => void handleCustomTopup()}
              >
                {loadingId === "custom" ? "创建订单中..." : `按输入金额充值`}
              </Button>
            </div>
            {customAmountError ? <p className="mt-2 text-xs text-destructive">{customAmountError}</p> : null}
          </div>
        ) : null}
      </div>

      <Modal
        open={Boolean(pendingOrder)}
        onClose={() => setPendingOrder(null)}
        title="支付二维码"
        description={pendingOrder?.statusText ?? "请使用所选支付方式完成支付"}
        size="md"
        footer={(
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPendingOrder(null)}>关闭</Button>
          </div>
        )}
      >
        {pendingOrder ? (
          <div className="space-y-4">
            <div className="rounded-[20px] border border-border bg-background px-4 py-4 text-center">
              <p className="text-sm font-medium">{pendingOrder.packageTitle}</p>
              <p className="mt-2 text-xs text-muted-foreground">订单号 {pendingOrder.merchantOrderNo}</p>
              <p className="mt-1 text-xs text-muted-foreground">支付方式 {pendingOrder.paymentMethodLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">到账 {formatNumber(pendingOrder.totalPoints)} {pointName}</p>
            </div>

            {pendingOrder.qrDataUrl ? (
              <div className="flex justify-center">
                <Image
                  src={pendingOrder.qrDataUrl}
                  alt="支付二维码"
                  width={240}
                  height={240}
                  unoptimized
                  className="h-60 w-60 rounded-2xl border border-border bg-white p-3"
                />
              </div>
            ) : null}

            <a
              href={pendingOrder.qrCode}
              target="_blank"
              rel="noreferrer"
              className="block text-center text-sm text-primary underline underline-offset-4"
            >
              无法扫码时，点这里打开支付链接
            </a>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
