"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Ban, Check, Save, Shield, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react"
import { useMemo, useState, useTransition } from "react"

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
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
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
import { saveAdminSiteSettings } from "@/lib/admin-site-settings-client"
import { toast } from "@/components/ui/toast"

interface SensitiveWordItem {
  id: string
  word: string
  matchType: string
  actionType: string
  replacement?: string
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
  initialSettings?: any
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

export function AdminSensitiveWordManager({ data, initialSettings }: AdminSensitiveWordManagerProps) {
  const router = useRouter()
  const [wordInput, setWordInput] = useState("")
  const [matchType, setMatchType] = useState("CONTAINS")
  const [actionType, setActionType] = useState("REJECT")
  const [replacement, setReplacement] = useState("***")
  const [pageSize, setPageSize] = useState(String(data.pagination.pageSize))
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const [isPending, startTransition] = useTransition()

  // 批量管理状态
  const [selectedIds, setSelectedIds] = useState<string[]>( [])
  const [bulkActionType, setBulkActionType] = useState("REJECT")
  const [bulkReplacement, setBulkReplacement] = useState("***")
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)

  const [usernameWords, setUsernameWords] = useState(() => {
    return Array.isArray(initialSettings?.usernameSensitiveWords)
      ? initialSettings.usernameSensitiveWords.join("\n")
      : ""
  })
  const [usernameWordsEnabled, setUsernameWordsEnabled] = useState(Boolean(initialSettings?.usernameSensitiveWordsEnabled))

  const summary = useMemo(() => data.summary, [data.summary])
  const batchCount = useMemo(() => {
    return new Set(wordInput.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)).size
  }, [wordInput])

  async function handleSaveRegistrationWords() {
    startTransition(async () => {
      const result = await saveAdminSiteSettings({
        usernameSensitiveWordsEnabled: usernameWordsEnabled,
        usernameSensitiveWords: usernameWords,
      })

      if (result.ok) {
        toast.success("注册敏感词配置已更新")
        router.refresh()
      } else {
        toast.error(result.message || "保存失败")
      }
    })
  }

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
      body: JSON.stringify({ 
        word: wordInput, 
        matchType, 
        actionType,
        replacement: actionType === "REPLACE" ? replacement : undefined 
      }),
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

  // 批量操作处理
  async function handleBulkUpdate(action: "status_on" | "status_off" | "action_type" | "delete") {
    if (selectedIds.length === 0) return

    if (action === "delete") {
      const confirmed = await showConfirm({
        title: "批量删除规则",
        description: `确认删除选中的 ${selectedIds.length} 条规则吗？`,
        confirmText: "批量删除",
        variant: "danger",
      })
      if (!confirmed) return
    }

    setIsBulkProcessing(true)
    try {
      let response
      if (action === "delete") {
        response = await fetch("/api/admin/sensitive-words", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: selectedIds }),
        })
      } else {
        const body: any = { ids: selectedIds }
        if (action === "status_on") body.status = true
        if (action === "status_off") body.status = false
        if (action === "action_type") {
          body.actionType = bulkActionType
          if (bulkActionType === "REPLACE") body.replacement = bulkReplacement
        }
        
        response = await fetch("/api/admin/sensitive-words", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      }

      if (response.ok) {
        toast.success("操作成功")
        setSelectedIds([])
        router.refresh()
      } else {
        toast.error("操作失败")
      }
    } catch (error) {
      toast.error("网络请求失败")
    } finally {
      setIsBulkProcessing(false)
    }
  }

  function toggleSelectAll() {
    if (selectedIds.length === data.words.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(data.words.map(w => w.id))
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
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
          <div className="grid gap-3 xl:grid-cols-[1fr_160px_160px_160px_auto]">
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
            <div className="space-y-3">
              <Select value={matchType} onValueChange={setMatchType}>
                <SelectTrigger className="h-10 rounded-full bg-background">
                  <SelectValue placeholder="匹配方式" />
                </SelectTrigger>
                <SelectContent>
                  {matchTypeOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger className="h-10 rounded-full bg-background">
                  <SelectValue placeholder="处理方式" />
                </SelectTrigger>
                <SelectContent>
                  {actionTypeOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {actionType === "REPLACE" && (
              <div className="space-y-2">
                <label className="text-xs font-medium px-1">替换为</label>
                <Input 
                  value={replacement} 
                  onChange={(e) => setReplacement(e.target.value)}
                  className="h-10 rounded-full"
                  placeholder="替换内容"
                />
              </div>
            )}
            <div className="flex items-end">
              <Button type="button" className="h-10 w-full rounded-full px-4 text-xs" disabled={saving} onClick={createRule}>
                {saving ? "保存中..." : batchCount > 1 ? "批量新增" : "新增规则"}
              </Button>
            </div>
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
          <CardTitle>用户名 / 昵称敏感词</CardTitle>
          <CardDescription>设置注册用户名和用户修改昵称时禁止使用的词汇。</CardDescription>
          <CardAction>
            <Button
              size="sm"
              className="h-8 rounded-full px-4 text-xs gap-1.5"
              disabled={isPending}
              onClick={handleSaveRegistrationWords}
            >
              {isPending ? (
                <span className="flex items-center gap-1">保存中...</span>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  保存设置
                </>
              )}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4 py-4">
          <div className="grid gap-4 md:grid-cols-[200px_1fr]">
            <div className="space-y-2">
              <label className="text-sm font-medium">启用过滤</label>
              <Select value={String(usernameWordsEnabled)} onValueChange={(v) => setUsernameWordsEnabled(v === "true")}>
                <SelectTrigger className="h-10 rounded-xl bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">开启拦截</SelectItem>
                  <SelectItem value="false">关闭拦截</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs leading-5 text-muted-foreground">开启后，包含下方列表词汇的用户名或昵称将无法提交。</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">敏感词列表</label>
              <Textarea
                value={usernameWords}
                onChange={(e) => setUsernameWords(e.target.value)}
                placeholder="支持换行、空格或逗号分隔，如 admin, root"
                rows={5}
                className="min-h-[120px] rounded-xl bg-background px-4 py-3"
              />
              <p className="text-xs leading-5 text-muted-foreground">此处设置专门用于注册和昵称修改，采用包含匹配。通用词库规则对用户名也生效。</p>
            </div>
          </div>
        </CardContent>
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

        {/* 批量操作工具栏 */}
        {selectedIds.length > 0 && (
          <div className="bg-muted/50 border-b px-4 py-3 flex flex-wrap items-center gap-4 transition-all animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2 text-sm font-medium mr-2">
              <Check className="h-4 w-4 text-primary" />
              已选择 {selectedIds.length} 条规则
            </div>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <div className="flex flex-wrap items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 rounded-full text-xs" 
                disabled={isBulkProcessing}
                onClick={() => handleBulkUpdate("status_on")}
              >启用</Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 rounded-full text-xs" 
                disabled={isBulkProcessing}
                onClick={() => handleBulkUpdate("status_off")}
              >停用</Button>
              
              <div className="flex items-center gap-2 ml-2">
                <Select value={bulkActionType} onValueChange={setBulkActionType}>
                  <SelectTrigger className="h-8 w-[120px] rounded-full bg-background text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {actionTypeOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {bulkActionType === "REPLACE" && (
                  <Input 
                    value={bulkReplacement} 
                    onChange={(e) => setBulkReplacement(e.target.value)}
                    className="h-8 w-[100px] rounded-full text-xs"
                    placeholder="替换内容"
                  />
                )}
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="h-8 rounded-full text-xs" 
                  disabled={isBulkProcessing}
                  onClick={() => handleBulkUpdate("action_type")}
                >更改类型</Button>
              </div>

              <div className="h-4 w-px bg-border hidden sm:block mx-1" />
              <Button 
                variant="destructive" 
                size="sm" 
                className="h-8 rounded-full text-xs gap-1.5" 
                disabled={isBulkProcessing}
                onClick={() => handleBulkUpdate("delete")}
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除所选
              </Button>
            </div>
          </div>
        )}

        <CardContent className="px-0 py-0">
          {data.words.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">当前还没有敏感词规则。</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[50px]">
                    <Checkbox 
                      checked={selectedIds.length === data.words.length && data.words.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>敏感词</TableHead>
                  <TableHead className="w-[140px]">匹配方式</TableHead>
                  <TableHead className="w-[180px]">处理方式</TableHead>
                  <TableHead className="w-[120px]">状态</TableHead>
                  <TableHead className="w-[180px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.words.map((item) => (
                  <TableRow key={item.id} data-state={selectedIds.includes(item.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedIds.includes(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                      />
                    </TableCell>
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
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant="outline">{getActionTypeLabel(item.actionType)}</Badge>
                        {item.actionType === "REPLACE" && item.replacement && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                            替换为: {item.replacement}
                          </span>
                        )}
                      </div>
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
        <CardFooter className="flex flex-col items-center justify-center gap-4 py-6">
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            <span>第 {data.pagination.page} / {data.pagination.totalPages} 页</span>
            <span>每页 {data.pagination.pageSize} 条</span>
            <span>共 {data.pagination.total} 条规则</span>
          </div>
          <div className="flex items-center justify-center gap-2">
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
