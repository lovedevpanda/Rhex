"use client"

import { useMemo, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"

interface AdminRedeemCodeManagerProps {
  initialRedeemCodes: {
    id: string
    code: string
    points: number
    createdAt: string
    createdByUsername: string | null
    redeemedAt: string | null
    redeemedByUsername: string | null
    expiresAt: string | null
    note: string | null
  }[]
}

export function AdminRedeemCodeManager({ initialRedeemCodes }: AdminRedeemCodeManagerProps) {
  const [redeemCodes, setRedeemCodes] = useState(initialRedeemCodes)
  const [count, setCount] = useState("10")
  const [points, setPoints] = useState("100")
  const [note, setNote] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()

  const summary = useMemo(() => ({
    total: redeemCodes.length,
    unused: redeemCodes.filter((item) => !item.redeemedByUsername).length,
    used: redeemCodes.filter((item) => item.redeemedByUsername).length,
    permanent: redeemCodes.filter((item) => !item.expiresAt).length,
  }), [redeemCodes])

  const pendingRedeemCodes = useMemo(() => redeemCodes.filter((item) => !item.redeemedByUsername), [redeemCodes])
  const exportText = useMemo(() => pendingRedeemCodes.map((item) => [item.code, `${item.points}积分`, item.expiresAt ? `过期:${new Date(item.expiresAt).toLocaleString()}` : "不过期", item.note ?? ""].filter(Boolean).join("\t")).join("\n"), [pendingRedeemCodes])

  async function handleCopyPendingCodes() {
    if (!exportText) {
      setFeedback("当前没有可复制的未兑换兑换码")
      return
    }
    try {
      await navigator.clipboard.writeText(exportText)
      setFeedback(`已复制 ${pendingRedeemCodes.length} 个未兑换兑换码`)
    } catch {
      setFeedback("复制失败，请检查浏览器剪贴板权限")
    }
  }

  function handleExportPendingCodes() {
    if (!exportText) {
      setFeedback("当前没有可导出的未兑换兑换码")
      return
    }
    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `redeem-codes-${new Date().toISOString().slice(0, 10)}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
    setFeedback(`已导出 ${pendingRedeemCodes.length} 个未兑换兑换码`)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="兑换码总数" value={summary.total} />
        <Stat title="未兑换" value={summary.unused} />
        <Stat title="已兑换" value={summary.used} />
        <Stat title="永久有效" value={summary.permanent} />
      </div>

      <form
        className="rounded-[22px] border border-border bg-card p-4 space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          setFeedback("")
          startTransition(async () => {
            const response = await fetch("/api/admin/redeem-codes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ count: Number(count), points: Number(points), note, expiresAt }),
            })
            const result = await response.json()
            if (!response.ok) {
              setFeedback(result.message ?? "生成失败")
              return
            }
            const listResponse = await fetch("/api/admin/redeem-codes", { cache: "no-store" })
            const listResult = await listResponse.json()
            setRedeemCodes(Array.isArray(listResult.data) ? listResult.data : [])
            setFeedback(result.message ?? "生成成功")
          })
        }}
      >
        <div>
          <h3 className="text-sm font-semibold">兑换码批量生成</h3>
          <p className="mt-1 text-xs text-muted-foreground">积分活动、补偿发放与运营投放统一从这里生成和导出。</p>
        </div>
        <div className="grid gap-3 xl:grid-cols-[120px_160px_minmax(0,1fr)_200px_auto]">
          <Field label="数量" value={count} onChange={setCount} placeholder="1-100" />
          <Field label="积分" value={points} onChange={setPoints} placeholder="如 100" />
          <Field label="备注" value={note} onChange={setNote} placeholder="如 活动发放 / 补偿" />
          <DateTimeField label="过期时间" value={expiresAt} onChange={setExpiresAt} />
          <div className="flex items-end">
            <Button disabled={isPending} className="h-10 rounded-full px-4 text-xs">{isPending ? "生成中..." : "生成兑换码"}</Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={handleCopyPendingCodes} disabled={pendingRedeemCodes.length === 0}>复制未兑换兑换码</Button>
          <Button type="button" variant="outline" onClick={handleExportPendingCodes} disabled={pendingRedeemCodes.length === 0}>导出未兑换兑换码</Button>
          <span className="text-xs text-muted-foreground">当前未兑换：{pendingRedeemCodes.length} 个</span>
          {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
        </div>
      </form>

      <div className="overflow-hidden rounded-[22px] border border-border bg-card">
        <div className="grid items-center gap-3 border-b border-border bg-secondary/40 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground lg:grid-cols-[minmax(0,1.1fr)_100px_160px_180px_minmax(0,1fr)]">
          <span>兑换码</span>
          <span>积分</span>
          <span>状态</span>
          <span>过期时间</span>
          <span>备注</span>
        </div>
        {redeemCodes.length === 0 ? <div className="px-4 py-10 text-sm text-muted-foreground">当前还没有兑换码。</div> : null}
        {redeemCodes.map((item) => (
          <div key={item.id} className="grid items-center gap-3 border-b border-border px-4 py-3 text-xs last:border-b-0 lg:grid-cols-[minmax(0,1.1fr)_100px_160px_180px_minmax(0,1fr)]">
            <div className="min-w-0">
              <div className="truncate font-mono text-sm font-medium">{item.code}</div>
              <div className="mt-1 text-muted-foreground">{new Date(item.createdAt).toLocaleString("zh-CN")}</div>
            </div>
            <div>{item.points}</div>
            <div className="text-muted-foreground">{item.redeemedByUsername ? `已被 ${item.redeemedByUsername} 兑换` : "未兑换"}</div>
            <div className="text-muted-foreground">{item.expiresAt ? new Date(item.expiresAt).toLocaleString() : "不过期"}</div>
            <div className="truncate text-muted-foreground">{item.note ?? "-"}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-[18px] border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="space-y-2 block">
      <span className="text-sm font-medium">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" />
    </label>
  )
}

function DateTimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2 block">
      <span className="text-sm font-medium">{label}</span>
      <input type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" />
    </label>
  )
}
