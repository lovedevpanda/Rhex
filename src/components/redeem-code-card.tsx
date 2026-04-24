"use client"

import Link from "next/link"
import { useState, useTransition } from "react"

import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { Button } from "@/components/ui/rbutton"
import { toast } from "@/components/ui/toast"
import { formatNumber } from "@/lib/formatters"

const REDEEM_PRIMARY_BUTTON_CLASS = "h-11 rounded-2xl bg-foreground px-5 text-background hover:bg-foreground/90"
const REDEEM_INPUT_GROUP_CLASS = "h-11 rounded-2xl bg-background/80"

interface RedeemCodeCardProps {
  pointName: string
  currentPoints: number
  helpLinkEnabled?: boolean
  helpLinkTitle?: string
  helpLinkUrl?: string
}

export function RedeemCodeCard({ pointName, currentPoints, helpLinkEnabled = false, helpLinkTitle = "", helpLinkUrl = "" }: RedeemCodeCardProps) {
  const [code, setCode] = useState("")
  const [isPending, startTransition] = useTransition()
  const normalizedHelpLinkUrl = helpLinkUrl.trim()
  const normalizedHelpLinkTitle = helpLinkTitle.trim() || "查看说明"
  const showHelpLink = helpLinkEnabled && normalizedHelpLinkUrl.length > 0
  const helpLinkIsExternal = /^https?:\/\//i.test(normalizedHelpLinkUrl)


  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">兑换码兑换</h3>
          {showHelpLink ? (
            <Link
              href={normalizedHelpLinkUrl}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              target={helpLinkIsExternal ? "_blank" : undefined}
              rel={helpLinkIsExternal ? "noreferrer" : undefined}
            >
              {normalizedHelpLinkTitle}
            </Link>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">输入兑换码即可领取 {pointName}。兑换成功后请刷新当前页面查看最新余额与明细。</p>
      </div>
      <div className="mt-4 rounded-xl bg-secondary/40 p-4 text-sm text-muted-foreground">
        当前账户余额：<span className="font-semibold text-foreground">{formatNumber(currentPoints)}</span> {pointName}
      </div>
      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row"
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
        <InputGroup className={`${REDEEM_INPUT_GROUP_CLASS} flex-1`}>
          <InputGroupInput
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="请输入兑换码"
            className="uppercase tracking-[0.2em]"
          />
        </InputGroup>
        <Button size="lg" className={`w-full sm:w-auto ${REDEEM_PRIMARY_BUTTON_CLASS}`} disabled={isPending || !code.trim()}>{isPending ? "兑换中..." : `兑换${pointName}`}</Button>
      </form>

    </div>
  )
}
