"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Ban, Shield, ShieldAlert, ShieldCheck } from "lucide-react"
import { useMemo, useState } from "react"

import { AdminSummaryStrip } from "@/components/admin/admin-summary-strip"
import { showConfirm } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTime, formatNumber } from "@/lib/formatters"
import { cn } from "@/lib/utils"

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
      replace: number
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
  { value: "REPLACE", label: "自动替换" },
]

export function AdminSensitiveWordManager({ data }: AdminSensitiveWordManagerProps) {
  const router = useRouter()
  const [wordInput, setWordInput] = useState("")
  const [matchType, setMatchType] = useState("CONTAINS")
  const [actionType, setActionType] = useState("REJECT")
  const [pageSize, setPageSize] = useState(String(data.pagination.pageSize))
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)

  const summary = useMemo(() => data.summary, [data.summary])
  const batchCount = useMemo(() => {
    return new Set(wordInput.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)).size
  }, [wordInput])

  async function createRule() {
    if (!wordInput.trim()) {
      setMessage("敏感词不能为空")
      return
    }

    setSaving(true)
    setMessage("")
    const response = await fetch("/api/admin/sensitive-words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: wordInput, matchType, actionType }),
    })
    const result = await response.json()
    setMessage(result.message ?? (response.ok ? "保存成功" : "保存失败"))
    setSaving(false)
    if (response.ok) {
      setWordInput("")
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

  async function removeRule(id: string, wordLabel: string) {
    const confirmed = await showConfirm({
      title: "删除敏感词规则",
      description: `确认删除规则“${wordLabel}”吗？删除后将立即失效。`,
      confirmText: "删除",
      variant: "danger",
    })

    if (!confirmed) {
      return
    }

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
      <AdminSummaryStrip
        items={[
          { label: "规则总数", value: summary.total, icon: <Shield className="h-4 w-4" /> },
          { label: "启用规则", value: summary.active, icon: <ShieldCheck className="h-4 w-4" />, tone: "emerald" },
          { label: "直接拦截", value: summary.reject, icon: <Ban className="h-4 w-4" />, tone: "rose" },
          { label: "自动替换", value: summary.replace, icon: <ShieldAlert className="h-4 w-4" />, tone: "amber" },
        ]}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>新增敏感词规则</CardTitle>
          <CardDescription>支持批量粘贴，一行一条；当前只保留拦截和替换两种处理方式。</CardDescription>
        </CardHeader>
        <CardContent className="py-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(320px,1.6fr)_160px_160px_auto]">
            <div className="space-y-2">
              <Textarea
                value={wordInput}
                onChange={(event) => setWordInput(event.target.value)}
                placeholder="输入敏感词、短语或正则表达式，支持批量粘贴，一行一个"
                rows={6}
                className="min-h-[132px] rounded-xl bg-background px-4 py-3"
              />
              <p className="text-xs text-muted-foreground">当前待新增 {formatNumber(batchCount)} 条规则，重复词会自动跳过。</p>
            </div>
            <Select value={matchType} onValueChange={setMatchType}>
              <SelectTrigger className="h-10 rounded-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {matchTypeOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={actionType} onValueChange={setActionType}>
              <SelectTrigger className="h-10 rounded-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {actionTypeOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" className="h-10 rounded-full px-4 text-xs" disabled={saving} onClick={createRule}>{saving ? "保存中..." : batchCount > 1 ? "批量新增" : "新增规则"}</Button>
          </div>
        </CardContent>
        {message ? (
          <CardFooter>
            <span className="text-sm text-muted-foreground">{message}</span>
          </CardFooter>
        ) : null}
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>敏感词库</CardTitle>
          <CardDescription>统一管理拦截与替换规则，旧的审核型规则会按拦截处理。</CardDescription>
          <CardAction>
            <form action="/admin" className="flex items-center gap-2">
              <input type="hidden" name="tab" value="security" />
              <input type="hidden" name="securityPage" value="1" />
              <input type="hidden" name="securityPageSize" value={pageSize} />
              <Select value={pageSize} onValueChange={setPageSize}>
                <SelectTrigger className="h-8 w-[104px] rounded-full bg-background text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[20, 50, 100].map((size) => <SelectItem key={size} value={String(size)}>{size} / 页</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="submit" variant="outline" size="sm" className="rounded-full px-3 text-xs">更新</Button>
            </form>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {data.words.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">当前还没有敏感词规则。</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>敏感词</TableHead>
                  <TableHead className="w-[140px]">匹配方式</TableHead>
                  <TableHead className="w-[140px]">处理方式</TableHead>
                  <TableHead className="w-[120px]">状态</TableHead>
                  <TableHead className="w-[180px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.words.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="align-top">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{item.word}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant="outline">{getMatchTypeLabel(item.matchType)}</Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant="outline">{getActionTypeLabel(item.actionType)}</Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge className={item.status ? "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200" : "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300"}>
                        {item.status ? "启用中" : "已停用"}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button type="button" variant="outline" className="h-7 rounded-full px-2.5 text-xs" onClick={() => toggleStatus(item.id, item.status)}>
                          {item.status ? "停用" : "启用"}
                        </Button>
                        <Button type="button" className="h-7 rounded-full bg-red-600 px-2.5 text-xs text-white hover:bg-red-500" onClick={() => removeRule(item.id, item.word)}>
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-3 pr-16 sm:pr-20">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>第 {data.pagination.page} / {data.pagination.totalPages} 页</span>
            <span>每页 {data.pagination.pageSize} 条</span>
            <span>共 {data.pagination.total} 条规则</span>
          </div>
          <div className="flex items-center gap-2">
            <PaginationLink href={data.pagination.hasPrevPage ? buildPageHref(data.pagination.page - 1) : "#"} disabled={!data.pagination.hasPrevPage}>上一页</PaginationLink>
            <Badge variant="secondary" className="h-8 rounded-full px-3 text-sm">{data.pagination.page}</Badge>
            <PaginationLink href={data.pagination.hasNextPage ? buildPageHref(data.pagination.page + 1) : "#"} disabled={!data.pagination.hasNextPage}>下一页</PaginationLink>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

function PaginationLink({
  href,
  disabled,
  children,
}: {
  href: string
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-disabled={disabled}
      className={cn(
        buttonVariants({ variant: "outline", size: "default" }),
        "rounded-full px-3 text-xs",
        disabled ? "pointer-events-none opacity-40" : ""
      )}
    >
      {children}
    </Link>
  )
}

function getMatchTypeLabel(value: string) {
  return matchTypeOptions.find((item) => item.value === value)?.label ?? value
}

function getActionTypeLabel(value: string) {
  if (value === "REPLACE") {
    return "自动替换"
  }

  return "直接拦截"
}
