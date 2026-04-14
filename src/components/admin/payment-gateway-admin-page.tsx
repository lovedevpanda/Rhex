"use client"

import Link from "next/link"
import { useState, useTransition } from "react"

import { useConfirm } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/rbutton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { TextField } from "@/components/ui/text-field"
import { toast } from "@/components/ui/toast"
import { formatPreciseDateTime } from "@/lib/formatters"
import {
  PAYMENT_GATEWAY_CLIENT_TYPES,
  type PaymentGatewayAdminData,
  type PaymentGatewayRouteRule,
} from "@/lib/payment-gateway.types"

interface PaymentGatewayAdminPageProps {
  initialData: PaymentGatewayAdminData
}

function formatAmountFen(amountFen: number, currency: string) {
  return `${currency} ${(amountFen / 100).toFixed(2)}`
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "暂无"
  }

  return formatPreciseDateTime(value) ?? value
}

function describeRouteRule(route: PaymentGatewayRouteRule, channelLabel: string) {
  return `匹配场景 ${route.scene || "*"}，客户端 ${route.clientType}；命中后优先级 ${route.priority}，走 ${channelLabel}。`
}

export function PaymentGatewayAdminPage({ initialData }: PaymentGatewayAdminPageProps) {
  const confirm = useConfirm()
  const [data, setData] = useState(initialData)
  const [enabled, setEnabled] = useState(initialData.config.enabled)
  const [orderExpireMinutes, setOrderExpireMinutes] = useState(String(initialData.config.orderExpireMinutes))
  const [defaultReturnPath, setDefaultReturnPath] = useState(initialData.config.defaultReturnPath)
  const [topupEnabled, setTopupEnabled] = useState(initialData.config.topupEnabled)
  const [topupPackages, setTopupPackages] = useState(initialData.config.topupPackages)
  const [topupCustomAmountEnabled, setTopupCustomAmountEnabled] = useState(initialData.config.topupCustomAmountEnabled)
  const [topupCustomMinAmountFen, setTopupCustomMinAmountFen] = useState(String(initialData.config.topupCustomMinAmountFen))
  const [topupCustomMaxAmountFen, setTopupCustomMaxAmountFen] = useState(String(initialData.config.topupCustomMaxAmountFen))
  const [topupCustomPointsPerYuan, setTopupCustomPointsPerYuan] = useState(String(initialData.config.topupCustomPointsPerYuan))
  const [channels, setChannels] = useState(initialData.config.channels)
  const [routes, setRoutes] = useState(initialData.config.routes)
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()
  const [isLogsLoading, setIsLogsLoading] = useState(false)
  const [isClearingLogs, setIsClearingLogs] = useState(false)

  const activeChannelCount = channels.filter((item) => item.enabled).length
  const activeRouteCount = routes.filter((item) => item.enabled).length

  function syncDraftFromData(nextData: PaymentGatewayAdminData) {
    setData(nextData)
    setEnabled(nextData.config.enabled)
    setOrderExpireMinutes(String(nextData.config.orderExpireMinutes))
    setDefaultReturnPath(nextData.config.defaultReturnPath)
    setTopupEnabled(nextData.config.topupEnabled)
    setTopupPackages(nextData.config.topupPackages)
    setTopupCustomAmountEnabled(nextData.config.topupCustomAmountEnabled)
    setTopupCustomMinAmountFen(String(nextData.config.topupCustomMinAmountFen))
    setTopupCustomMaxAmountFen(String(nextData.config.topupCustomMaxAmountFen))
    setTopupCustomPointsPerYuan(String(nextData.config.topupCustomPointsPerYuan))
    setChannels(nextData.config.channels)
    setRoutes(nextData.config.routes)
  }

  function buildPayload() {
    return {
      config: {
        enabled,
        orderExpireMinutes: Number(orderExpireMinutes),
        defaultReturnPath,
        topupEnabled,
        topupPackages,
        topupCustomAmountEnabled,
        topupCustomMinAmountFen: Number(topupCustomMinAmountFen),
        topupCustomMaxAmountFen: Number(topupCustomMaxAmountFen),
        topupCustomPointsPerYuan: Number(topupCustomPointsPerYuan),
        channels,
        routes,
      },
      pagination: {
        page: data.recentOrdersPagination.page,
      },
    }
  }

  function updateTopupPackage(id: string, patch: Partial<typeof topupPackages[number]>) {
    setTopupPackages((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  function addTopupPackage() {
    setTopupPackages((current) => [
      ...current,
      {
        id: `topup-${Date.now()}`,
        title: "新套餐",
        amountFen: 1000,
        points: 100,
        bonusPoints: 0,
        enabled: true,
        sortOrder: (current.at(-1)?.sortOrder ?? 0) + 10,
      },
    ])
  }

  function removeTopupPackage(id: string) {
    setTopupPackages((current) => current.filter((item) => item.id !== id))
  }

  function updateChannel(channelCode: string, enabled: boolean) {
    setChannels((current) => current.map((item) => item.channelCode === channelCode ? { ...item, enabled } : item))
  }

  function updateRoute(id: string, patch: Partial<PaymentGatewayRouteRule>) {
    setRoutes((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  function addRoute() {
    const fallbackChannel = data.channelDefinitions[0]
    if (!fallbackChannel) {
      return
    }

    setRoutes((current) => [
      ...current,
      {
        id: `payment-route-${Date.now()}`,
        scene: "*",
        description: "",
        clientType: fallbackChannel.clientTypes[0] ?? "WEB_DESKTOP",
        providerCode: fallbackChannel.providerCode,
        channelCode: fallbackChannel.channelCode,
        priority: 100,
        enabled: true,
      },
    ])
  }

  function removeRoute(id: string) {
    setRoutes((current) => current.filter((item) => item.id !== id))
  }

  async function loadOrdersPage(page: number) {
    setIsLogsLoading(true)

    try {
      const response = await fetch(`/api/admin/apps/payment-gateway?page=${page}`, {
        method: "GET",
        cache: "no-store",
      })
      const result = await response.json()

      if (!response.ok || !result?.data) {
        throw new Error(result?.message ?? "支付日志加载失败")
      }

      setData(result.data as PaymentGatewayAdminData)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "支付日志加载失败", "加载失败")
    } finally {
      setIsLogsLoading(false)
    }
  }

  async function clearLogs() {
    const confirmed = await confirm({
      title: "清除支付日志",
      description: "这会清除所有已结束的支付日志，包括已支付到账、已关闭、已退款和失败记录。进行中的订单会保留。该操作不可撤销。",
      confirmText: "清除日志",
      cancelText: "取消",
      variant: "danger",
    })

    if (!confirmed) {
      return
    }

    setIsClearingLogs(true)
    setIsLogsLoading(true)

    try {
      const response = await fetch("/api/admin/apps/payment-gateway", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pagination: {
            page: data.recentOrdersPagination.page,
          },
        }),
      })
      const result = await response.json()

      if (!response.ok || !result?.data) {
        throw new Error(result?.message ?? "清除支付日志失败")
      }

      setData(result.data as PaymentGatewayAdminData)
      toast.success(result?.message ?? "支付日志已清除", "清除成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "清除支付日志失败", "清除失败")
    } finally {
      setIsClearingLogs(false)
      setIsLogsLoading(false)
    }
  }

  function saveConfig() {
    setFeedback("")

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/apps/payment-gateway", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildPayload()),
        })
        const result = await response.json()

        if (!response.ok || !result?.data) {
          throw new Error(result?.message ?? "支付网关配置保存失败")
        }

        syncDraftFromData(result.data as PaymentGatewayAdminData)
        setFeedback(result?.message ?? "配置已保存")
        toast.success(result?.message ?? "支付网关配置已保存", "保存成功")
      } catch (error) {
        const message = error instanceof Error ? error.message : "支付网关配置保存失败"
        setFeedback(message)
        toast.error(message, "保存失败")
      }
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle>运行概览</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 py-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">网关总开关</p>
            <p className="mt-2 text-base font-semibold">{enabled ? "已启用" : "未启用"}</p>
            <p className="mt-1 text-sm text-muted-foreground">关闭后前台不会再创建新的支付单。</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">启用通道</p>
            <p className="mt-2 text-base font-semibold">{activeChannelCount} / {channels.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">当前可被路由器选中的支付通道数量。</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">启用路由</p>
            <p className="mt-2 text-base font-semibold">{activeRouteCount} 条</p>
            <p className="mt-1 text-sm text-muted-foreground">按场景和客户端类型决定最终使用哪个支付通道。</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">接口提供方</p>
            <p className="mt-2 text-base font-semibold">{data.config.alipay.enabled ? "支付宝已启用" : "支付宝未启用"}</p>
            <p className="mt-1 text-sm text-muted-foreground">具体接口参数、沙箱、密钥与证书已拆分到独立渠道页。</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>网关基础配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 py-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">启用支付网关</p>
                  <p className="mt-1 text-sm text-muted-foreground">统一支付入口总开关。</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </div>
            <TextField label="订单超时（分钟）" value={orderExpireMinutes} onChange={setOrderExpireMinutes} placeholder="30" />
            <TextField label="默认返回地址" value={defaultReturnPath} onChange={setDefaultReturnPath} placeholder="/settings" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>渠道提供方</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 py-5 md:grid-cols-4">
          <div className="rounded-xl border border-border p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">支付宝</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs ${data.config.alipay.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                {data.config.alipay.enabled ? "已启用" : "未启用"}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/admin/apps/payment-gateway/alipay" className="inline-flex h-10 items-center justify-center rounded-full border border-border px-4 text-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                打开支付宝接口页
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>支付通道</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 py-5 md:grid-cols-2 xl:grid-cols-3">
          {data.channelDefinitions.map((definition) => {
            const channel = channels.find((item) => item.channelCode === definition.channelCode)
            const enabled = channel?.enabled ?? false

            return (
              <div key={definition.channelCode} className="rounded-xl border border-border p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{definition.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{definition.description}</p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={(checked) => updateChannel(definition.channelCode, checked)} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border px-3 py-1">{definition.channelCode}</span>
                  <span className="rounded-full border border-border px-3 py-1">{definition.clientTypes.join(" / ")}</span>
                  <span className="rounded-full border border-border px-3 py-1">
                    {definition.presentationType === "QR_CODE" ? "二维码展示" : "跳转表单"}
                  </span>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>积分充值套餐</CardTitle>
            <Button type="button" variant="outline" onClick={addTopupPackage}>新增套餐</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 py-5">
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">开放积分充值</p>
                <p className="mt-1 text-sm text-muted-foreground">开启后，用户可在独立充值页发起充值。</p>
              </div>
              <Switch checked={topupEnabled} onCheckedChange={setTopupEnabled} />
            </div>
          </div>

          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">开放自定义金额</p>
                <p className="mt-1 text-sm text-muted-foreground">用户可在独立充值页输入任意金额，系统按比例自动换算积分。</p>
              </div>
              <Switch checked={topupCustomAmountEnabled} onCheckedChange={setTopupCustomAmountEnabled} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <TextField label="自定义最小金额（分）" value={topupCustomMinAmountFen} onChange={setTopupCustomMinAmountFen} placeholder="如 1000" />
            <TextField label="自定义最大金额（分）" value={topupCustomMaxAmountFen} onChange={setTopupCustomMaxAmountFen} placeholder="如 100000" />
            <TextField label="每 1 元兑换积分" value={topupCustomPointsPerYuan} onChange={setTopupCustomPointsPerYuan} placeholder="如 10" />
          </div>

          {topupPackages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              当前没有充值套餐。建议至少保留一个低价试用包和一个高客单主推包。
            </div>
          ) : null}

          <div className="space-y-4">
            {topupPackages.map((item) => (
              <div key={item.id} className="rounded-xl border border-border p-4">
                <div className="grid gap-4 xl:grid-cols-[1.2fr_140px_140px_140px_120px_auto_auto] xl:items-end">
                  <TextField label="套餐标题" value={item.title} onChange={(value) => updateTopupPackage(item.id, { title: value })} placeholder="如 新手包" />
                  <TextField label="支付金额（分）" value={String(item.amountFen)} onChange={(value) => updateTopupPackage(item.id, { amountFen: Number(value || 0) })} placeholder="如 1000" />
                  <TextField label="基础积分" value={String(item.points)} onChange={(value) => updateTopupPackage(item.id, { points: Number(value || 0) })} placeholder="如 100" />
                  <TextField label="赠送积分" value={String(item.bonusPoints)} onChange={(value) => updateTopupPackage(item.id, { bonusPoints: Number(value || 0) })} placeholder="如 20" />
                  <TextField label="排序" value={String(item.sortOrder)} onChange={(value) => updateTopupPackage(item.id, { sortOrder: Number(value || 0) })} placeholder="如 10" />
                  <div className="rounded-xl border border-border px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">启用</p>
                        <p className="mt-1 text-xs text-muted-foreground">到账 {item.points + item.bonusPoints}</p>
                      </div>
                      <Switch checked={item.enabled} onCheckedChange={(checked) => updateTopupPackage(item.id, { enabled: checked })} />
                    </div>
                  </div>
                  <Button type="button" variant="outline" onClick={() => removeTopupPackage(item.id)}>删除</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>路由规则</CardTitle>
            <Button type="button" variant="outline" onClick={addRoute}>新增规则</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 py-5">
          {routes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              当前没有路由规则。你可以新增一条 `* + WEB_DESKTOP` 指向 `alipay.page` 的默认规则作为起点。
            </div>
          ) : null}

          {routes.map((route) => (
            <div key={route.id} className="rounded-xl border border-border p-4">
              <div className="grid gap-4 xl:grid-cols-[1.2fr_180px_220px_120px_auto_auto] xl:items-end">
                <TextField
                  label="业务场景"
                  value={route.scene}
                  onChange={(value) => updateRoute(route.id, { scene: value })}
                  placeholder="例如 vip.purchase / points.topup / *"
                />
                <label className="space-y-2">
                  <span className="text-sm font-medium">客户端类型</span>
                  <select
                    value={route.clientType}
                    onChange={(event) => updateRoute(route.id, { clientType: event.target.value as PaymentGatewayRouteRule["clientType"] })}
                    className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-hidden"
                  >
                    {PAYMENT_GATEWAY_CLIENT_TYPES.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">支付接口</span>
                  <select
                    value={route.channelCode}
                    onChange={(event) => {
                      const nextChannel = data.channelDefinitions.find((item) => item.channelCode === event.target.value)
                      if (!nextChannel) {
                        return
                      }

                      updateRoute(route.id, {
                        channelCode: nextChannel.channelCode,
                        providerCode: nextChannel.providerCode,
                        clientType: nextChannel.clientTypes.includes(route.clientType)
                          ? route.clientType
                          : (nextChannel.clientTypes[0] ?? "WEB_DESKTOP"),
                      })
                    }}
                    className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-hidden"
                  >
                    {data.channelDefinitions.map((item) => (
                      <option key={item.channelCode} value={item.channelCode}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <TextField
                  label="优先级"
                  value={String(route.priority)}
                  onChange={(value) => updateRoute(route.id, { priority: Number(value || 0) })}
                  placeholder="100"
                />
                <div className="rounded-xl border border-border px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">启用</p>
                      <p className="mt-1 text-xs text-muted-foreground">数字越小越优先。</p>
                    </div>
                    <Switch checked={route.enabled} onCheckedChange={(checked) => updateRoute(route.id, { enabled: checked })} />
                  </div>
                </div>
                <Button type="button" variant="outline" onClick={() => removeRoute(route.id)}>删除</Button>
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
                <TextField
                  label="说明"
                  value={route.description}
                  onChange={(value) => updateRoute(route.id, { description: value })}
                  placeholder="给后台看的备注，例如：PC 用户默认收银台；扫码页专用。"
                />
                <div className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
                  {route.description.trim() || describeRouteRule(
                    route,
                    data.channelDefinitions.find((item) => item.channelCode === route.channelCode)?.label ?? route.channelCode,
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>最近支付订单</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                共 {data.recentOrdersPagination.total} 条记录，当前第 {data.recentOrdersPagination.page} / {data.recentOrdersPagination.totalPages} 页
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {data.clearableRecentOrderCount > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLogsLoading || isClearingLogs}
                  onClick={() => void clearLogs()}
                >
                  {isClearingLogs ? "清除中..." : "清除已结束日志"}
                </Button>
              ) : null}
              {isLogsLoading ? <span className="text-sm text-muted-foreground">日志加载中...</span> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 py-5">
          {data.recentOrders.length > 0 ? data.recentOrders.map((order) => (
            <div key={order.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{order.subject}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{order.bizScene} · {formatAmountFen(order.amountFen, order.currency)} · {order.status}</p>
                  <p className="mt-1 text-xs text-muted-foreground">履约 {order.fulfillmentStatus}{order.fulfilledAt ? ` · ${formatDateTime(order.fulfilledAt)}` : ""}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    单号 {order.merchantOrderNo}
                    {order.providerTradeNo ? ` · 第三方流水 ${order.providerTradeNo}` : ""}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{order.userDisplayName}</p>
                  <p className="mt-1">{order.providerCode} / {order.channelCode}</p>
                  <p className="mt-1">{formatDateTime(order.createdAt)}</p>
                </div>
              </div>
              {order.lastErrorMessage ? (
                <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">
                  {order.lastErrorCode ? `${order.lastErrorCode} · ` : ""}{order.lastErrorMessage}
                </p>
              ) : null}
            </div>
          )) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              还没有支付订单。配置完成后，前台通过统一下单接口创建的订单会显示在这里。
            </div>
          )}
          {data.recentOrdersPagination.totalPages > 1 ? (
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                第 {data.recentOrdersPagination.page} / {data.recentOrdersPagination.totalPages} 页，每页 {data.recentOrdersPagination.pageSize} 条
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!data.recentOrdersPagination.hasPrevPage || isLogsLoading}
                  onClick={() => void loadOrdersPage(data.recentOrdersPagination.page - 1)}
                >
                  上一页
                </Button>
                <span className="inline-flex h-8 min-w-10 items-center justify-center rounded-full border border-border bg-muted px-3 text-sm font-medium">
                  {data.recentOrdersPagination.page}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!data.recentOrdersPagination.hasNextPage || isLogsLoading}
                  onClick={() => void loadOrdersPage(data.recentOrdersPagination.page + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={saveConfig} disabled={isPending}>{isPending ? "保存中..." : "保存基础配置"}</Button>
        {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
      </div>
    </div>
  )
}
