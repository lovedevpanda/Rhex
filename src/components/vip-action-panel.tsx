"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"

import { isVipActive } from "@/lib/vip-status"

interface VipActionPanelProps {
  vipMonthlyPrice: number
  vipQuarterlyPrice: number
  vipYearlyPrice: number
  pointName: string
  userPoints?: number
  vipExpiresAt?: string | null
}

export function VipActionPanel({ vipMonthlyPrice, vipQuarterlyPrice, vipYearlyPrice, pointName, userPoints = 0, vipExpiresAt = null }: VipActionPanelProps) {

  const vipActive = isVipActive({ vipExpiresAt })

  const router = useRouter()

  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState("")

  async function runAction(action: string) {
    setLoading(action)
    setMessage("")
    const response = await fetch("/api/vip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    const result = await response.json()
    setLoading("")
    setMessage(result.message ?? (response.ok ? "操作成功" : "操作失败"))
    if (response.ok) {
      router.refresh()
    }
  }

  return (
    <div className="mt-6">
      <div className="rounded-[24px] border border-border p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h3 className="text-sm font-semibold">购买 / 续费 VIP（{pointName}支付）</h3>
          <p className="text-sm text-muted-foreground">当前{pointName}：{userPoints}{vipActive ? "，当前已是 VIP，可继续续期。" : "，可直接购买开通 VIP。"}</p>
        </div>
        <div className="mt-4 space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center justify-between rounded-[18px] border border-border px-4 py-3 dark:bg-secondary/20"><span>月卡 30 天 = VIP1</span><Button onClick={() => runAction("purchase.month")} disabled={loading !== "" || userPoints < vipMonthlyPrice}>{loading === "purchase.month" ? "处理中..." : `${vipMonthlyPrice} ${pointName}`}</Button></div>
          <div className="flex items-center justify-between rounded-[18px] border border-border px-4 py-3 dark:bg-secondary/20"><span>季卡 90 天 = VIP2</span><Button onClick={() => runAction("purchase.quarter")} disabled={loading !== "" || userPoints < vipQuarterlyPrice}>{loading === "purchase.quarter" ? "处理中..." : `${vipQuarterlyPrice} ${pointName}`}</Button></div>
          <div className="flex items-center justify-between rounded-[18px] border border-border px-4 py-3 dark:bg-secondary/20"><span>年卡 365 天 = VIP3</span><Button onClick={() => runAction("purchase.year")} disabled={loading !== "" || userPoints < vipYearlyPrice}>{loading === "purchase.year" ? "处理中..." : `${vipYearlyPrice} ${pointName}`}</Button></div>


        </div>
      </div>
      {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}
    </div>
  )
}

