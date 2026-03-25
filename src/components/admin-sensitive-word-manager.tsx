"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"


import { Button } from "@/components/ui/button"

interface SensitiveWordItem {
  id: string
  word: string
  matchType: string
  actionType: string
  status: boolean
  createdAt: string
}

interface AdminSensitiveWordManagerProps {
  data: {
    words: SensitiveWordItem[]
    summary: {
      total: number
      active: number
      reject: number
      review: number
    }
    pagination: {
      page: number
      pageSize: number
      total: number
      totalPages: number
      hasPrevPage: boolean
      hasNextPage: boolean
    }
  }
}

const matchTypeOptions = [
  { value: "CONTAINS", label: "包含匹配" },
  { value: "EXACT", label: "完全匹配" },
  { value: "REGEX", label: "正则匹配" },
]

const actionTypeOptions = [
  { value: "REJECT", label: "直接拦截" },
  { value: "REVIEW", label: "进入审核" },
  { value: "REPLACE", label: "自动替换" },
]

export function AdminSensitiveWordManager({ data }: AdminSensitiveWordManagerProps) {
  const router = useRouter()
  const [word, setWord] = useState("")
  const [matchType, setMatchType] = useState("CONTAINS")
  const [actionType, setActionType] = useState("REJECT")
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)

  const summary = useMemo(() => data.summary, [data.summary])

  async function createRule() {
    if (!word.trim()) {
      setMessage("敏感词不能为空")
      return
    }

    setSaving(true)
    setMessage("")
    const response = await fetch("/api/admin/sensitive-words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, matchType, actionType }),
    })
    const result = await response.json()
    setMessage(result.message ?? (response.ok ? "保存成功" : "保存失败"))
    setSaving(false)
    if (response.ok) {
      setWord("")
      router.refresh()
    }
  }

  async function toggleStatus(id: string, status: boolean) {
    const response = await fetch("/api/admin/sensitive-words", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: !status }),
    })
    if (response.ok) {
      router.refresh()
    }
  }

  async function removeRule(id: string) {
    const response = await fetch("/api/admin/sensitive-words", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    if (response.ok) {
      router.refresh()
    }
  }

  function buildPageHref(page: number) {
    const search = new URLSearchParams({
      tab: "security",
      securityPage: String(page),
      securityPageSize: String(data.pagination.pageSize),
    })
    return `/admin?${search.toString()}`
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="规则总数" value={summary.total} />
        <Stat title="启用规则" value={summary.active} />
        <Stat title="直接拦截" value={summary.reject} />
        <Stat title="进入审核" value={summary.review} />
      </div>

      <div className="rounded-[22px] border border-border bg-card p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1.4fr)_160px_160px_auto]">
          <input value={word} onChange={(event) => setWord(event.target.value)} placeholder="输入敏感词、短语或正则表达式" className="h-10 rounded-full border border-border bg-background px-4 text-sm outline-none" />
          <select value={matchType} onChange={(event) => setMatchType(event.target.value)} className="h-10 rounded-full border border-border bg-background px-3 text-sm outline-none">
            {matchTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select value={actionType} onChange={(event) => setActionType(event.target.value)} className="h-10 rounded-full border border-border bg-background px-3 text-sm outline-none">
            {actionTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <Button type="button" className="h-10 rounded-full px-4 text-xs" disabled={saving} onClick={createRule}>{saving ? "保存中..." : "新增规则"}</Button>
        </div>
        {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
      </div>

      <div className="overflow-hidden rounded-[22px] border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">敏感词库</h3>
            <p className="mt-1 text-xs text-muted-foreground">统一管理拦截、审核与替换规则。</p>
          </div>
          <div className="flex items-center gap-2">
            <select defaultValue={String(data.pagination.pageSize)} onChange={(event) => { window.location.href = `/admin?tab=security&securityPage=1&securityPageSize=${event.target.value}` }} className="h-8 rounded-full border border-border bg-background px-3 text-xs outline-none">
              {[20, 50, 100].map((size) => <option key={size} value={size}>{size} / 页</option>)}
            </select>
            <span className="rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">共 {data.pagination.total} 条规则</span>
          </div>
        </div>

        <div className="grid items-center gap-3 border-b border-border bg-secondary/40 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground lg:grid-cols-[minmax(0,1.3fr)_140px_140px_120px_180px]">
          <span>敏感词</span>
          <span>匹配方式</span>
          <span>处理方式</span>
          <span>状态</span>
          <span className="text-right">操作</span>
        </div>
        {data.words.map((item) => (
          <div key={item.id} className="grid items-center gap-3 border-b border-border px-4 py-3 text-xs last:border-b-0 lg:grid-cols-[minmax(0,1.3fr)_140px_140px_120px_180px]">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{item.word}</div>
              <div className="mt-1 text-muted-foreground">{new Date(item.createdAt).toLocaleString("zh-CN")}</div>
            </div>
            <div className="text-muted-foreground">{item.matchType}</div>
            <div className="text-muted-foreground">{item.actionType}</div>
            <div><span className={item.status ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700" : "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"}>{item.status ? "启用中" : "已停用"}</span></div>
            <div className="flex flex-wrap justify-end gap-1.5">
              <Button type="button" variant="outline" className="h-7 rounded-full px-2.5 text-xs" onClick={() => toggleStatus(item.id, item.status)}>{item.status ? "停用" : "启用"}</Button>
              <Button type="button" className="h-7 rounded-full bg-red-600 px-2.5 text-xs text-white hover:bg-red-500" onClick={() => removeRule(item.id)}>删除</Button>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/20 px-4 py-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <span>第 {data.pagination.page} / {data.pagination.totalPages} 页</span>
            <span>每页 {data.pagination.pageSize} 条</span>
            <span>共 {data.pagination.total} 条规则</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={data.pagination.hasPrevPage ? buildPageHref(data.pagination.page - 1) : "#"} aria-disabled={!data.pagination.hasPrevPage} className={data.pagination.hasPrevPage ? "inline-flex h-8 items-center justify-center rounded-full border border-border bg-card px-3 font-medium transition-colors hover:bg-accent hover:text-accent-foreground" : "inline-flex h-8 items-center justify-center rounded-full border border-border px-3 opacity-40 pointer-events-none"}>上一页</Link>
            <span className="inline-flex h-8 items-center rounded-full bg-accent px-3 font-medium text-foreground">{data.pagination.page}</span>
            <Link href={data.pagination.hasNextPage ? buildPageHref(data.pagination.page + 1) : "#"} aria-disabled={!data.pagination.hasNextPage} className={data.pagination.hasNextPage ? "inline-flex h-8 items-center justify-center rounded-full border border-border bg-card px-3 font-medium transition-colors hover:bg-accent hover:text-accent-foreground" : "inline-flex h-8 items-center justify-center rounded-full border border-border px-3 opacity-40 pointer-events-none"}>下一页</Link>
          </div>
        </div>
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
