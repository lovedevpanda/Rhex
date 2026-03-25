"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"


interface RedeemCodeCardProps {
  pointName: string
  currentPoints: number
}

export function RedeemCodeCard({ pointName, currentPoints }: RedeemCodeCardProps) {
  const [code, setCode] = useState("")
  const [isPending, startTransition] = useTransition()


  return (
    <div className="rounded-[24px] border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">兑换码兑换</h3>
        <p className="text-sm text-muted-foreground">输入兑换码即可领取 {pointName}。兑换成功后请刷新当前页面查看最新余额与明细。</p>
      </div>
      <div className="mt-4 rounded-[20px] bg-secondary/40 p-4 text-sm text-muted-foreground">
        当前账户余额：<span className="font-semibold text-foreground">{currentPoints}</span> {pointName}
      </div>
      <form
        className="mt-4 flex flex-col gap-3 md:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          startTransition(async () => {
            const response = await fetch("/api/redeem-codes/redeem", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code }),
            })
            const result = await response.json()
            if (!response.ok) {
              toast.error(result.message ?? "兑换失败", "兑换失败")
              return
            }
            toast.success(result.message ?? "兑换成功", "兑换成功")
            setCode("")
          })
        }}

      >
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="请输入兑换码"
          className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-sm uppercase tracking-[0.2em] outline-none"
        />
        <Button disabled={isPending || !code.trim()}>{isPending ? "兑换中..." : `兑换${pointName}`}</Button>
      </form>

    </div>
  )
}
