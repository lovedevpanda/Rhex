"use client"

import { useMemo, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { TextField } from "@/components/ui/text-field"

interface AdminInviteCodeManagerProps {
  initialInviteCodes: {
    id: string
    code: string
    createdAt: string
    createdByUsername: string | null
    usedAt: string | null
    usedByUsername: string | null
    note: string | null
  }[]
}

export function AdminInviteCodeManager({ initialInviteCodes }: AdminInviteCodeManagerProps) {
  const [inviteCodes, setInviteCodes] = useState(initialInviteCodes)
  const [count, setCount] = useState("10")
  const [note, setNote] = useState("")
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()

  const summary = useMemo(() => ({
    total: inviteCodes.length,
    unused: inviteCodes.filter((item) => !item.usedByUsername).length,
    used: inviteCodes.filter((item) => item.usedByUsername).length,
    manual: inviteCodes.filter((item) => item.createdByUsername).length,
  }), [inviteCodes])

  function handleGenerateInviteCodes() {
    setFeedback("")
    startTransition(async () => {
      const response = await fetch("/api/admin/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: Number(count), note }),
      })
      const result = await response.json()
      if (!response.ok) {
        setFeedback(result.message ?? "生成失败")
        return
      }
      const listResponse = await fetch("/api/admin/invite-codes", { cache: "no-store" })
      const listResult = await listResponse.json()
      setInviteCodes(Array.isArray(listResult.data) ? listResult.data : [])
      setFeedback(result.message ?? "生成成功")
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="邀请码总数" value={summary.total} />
        <Stat title="未使用" value={summary.unused} />
        <Stat title="已使用" value={summary.used} />
        <Stat title="人工生成" value={summary.manual} />
      </div>

      <div className="rounded-[22px] border border-border bg-card p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">邀请码批量生成</h3>
          <p className="mt-1 text-xs text-muted-foreground">运营活动、人审发放、邀新链路都统一收口到这里。</p>
        </div>
        <div className="grid gap-3 xl:grid-cols-[160px_minmax(0,1fr)_auto]">
          <TextField label="生成数量" value={count} onChange={setCount} placeholder="1-100" inputClassName="h-10" />
          <TextField label="备注" value={note} onChange={setNote} placeholder="如 活动赠送 / 人工发放" inputClassName="h-10" />
          <div className="flex items-end">
            <Button type="button" onClick={handleGenerateInviteCodes} disabled={isPending} className="h-10 rounded-full px-4 text-xs">{isPending ? "生成中..." : "生成邀请码"}</Button>
          </div>
        </div>
        {feedback ? <p className="text-sm text-muted-foreground">{feedback}</p> : null}
      </div>

      <div className="overflow-hidden rounded-[22px] border border-border bg-card">
        <div className="grid items-center gap-3 border-b border-border bg-secondary/40 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground lg:grid-cols-[minmax(0,1.2fr)_140px_180px_minmax(0,1fr)]">
          <span>邀请码</span>
          <span>创建人</span>
          <span>使用状态</span>
          <span>备注</span>
        </div>
        {inviteCodes.length === 0 ? <div className="px-4 py-10 text-sm text-muted-foreground">当前还没有邀请码。</div> : null}
        {inviteCodes.map((item) => (
          <div key={item.id} className="grid items-center gap-3 border-b border-border px-4 py-3 text-xs last:border-b-0 lg:grid-cols-[minmax(0,1.2fr)_140px_180px_minmax(0,1fr)]">
            <div className="min-w-0">
              <div className="truncate font-mono text-sm font-medium">{item.code}</div>
              <div className="mt-1 text-muted-foreground">{new Date(item.createdAt).toLocaleString("zh-CN")}</div>
            </div>
            <div className="truncate text-muted-foreground">{item.createdByUsername ?? "系统"}</div>
            <div className="text-muted-foreground">{item.usedByUsername ? `已被 ${item.usedByUsername} 使用` : "未使用"}</div>
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
