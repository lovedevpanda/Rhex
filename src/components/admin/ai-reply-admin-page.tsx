"use client"

import { useState, useTransition } from "react"

import { useConfirm } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/rbutton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { TextField } from "@/components/ui/text-field"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { formatPreciseDateTime } from "@/lib/formatters"

import type { AiReplyAdminData } from "@/lib/ai-reply"

interface AiReplyAdminPageProps {
  initialData: AiReplyAdminData
}

const TASK_STATUS_LABELS = {
  PENDING: "待执行",
  PROCESSING: "执行中",
  SUCCEEDED: "成功",
  FAILED: "失败",
  CANCELLED: "取消",
} as const

const TASK_STATUS_CLASS_NAMES = {
  PENDING: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  PROCESSING: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  SUCCEEDED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  FAILED: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  CANCELLED: "border-muted bg-muted/60 text-muted-foreground",
} as const

function canDeleteTaskLog(status: keyof typeof TASK_STATUS_LABELS) {
  return status === "SUCCEEDED" || status === "FAILED" || status === "CANCELLED"
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "暂无"
  }

  return formatPreciseDateTime(value) ?? value
}

function LabeledTextarea(props: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{props.label}</p>
      <Textarea
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        rows={props.rows ?? 6}
        className="min-h-[150px] resize-y"
      />
    </div>
  )
}

export function AiReplyAdminPage({ initialData }: AiReplyAdminPageProps) {
  const confirm = useConfirm()
  const [data, setData] = useState(initialData)
  const [enabled, setEnabled] = useState(initialData.config.enabled)
  const [respondToPostMentions, setRespondToPostMentions] = useState(initialData.config.respondToPostMentions)
  const [respondToCommentMentions, setRespondToCommentMentions] = useState(initialData.config.respondToCommentMentions)
  const [agentUsername, setAgentUsername] = useState(initialData.agentUser?.username ?? "")
  const [baseUrl, setBaseUrl] = useState(initialData.config.baseUrl)
  const [model, setModel] = useState(initialData.config.model)
  const [temperature, setTemperature] = useState(String(initialData.config.temperature))
  const [maxOutputTokens, setMaxOutputTokens] = useState(String(initialData.config.maxOutputTokens))
  const [timeoutMs, setTimeoutMs] = useState(String(initialData.config.timeoutMs))
  const [systemPrompt, setSystemPrompt] = useState(initialData.config.systemPrompt)
  const [postReplyPrompt, setPostReplyPrompt] = useState(initialData.config.postReplyPrompt)
  const [commentReplyPrompt, setCommentReplyPrompt] = useState(initialData.config.commentReplyPrompt)
  const [apiKey, setApiKey] = useState("")
  const [clearApiKey, setClearApiKey] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [testFeedback, setTestFeedback] = useState("")
  const [testReply, setTestReply] = useState("")
  const [isPending, startTransition] = useTransition()
  const [isTesting, startTesting] = useTransition()
  const [isTaskListLoading, setIsTaskListLoading] = useState(false)
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState<string | null>(null)
  const [isDeletingAllTaskLogs, setIsDeletingAllTaskLogs] = useState(false)

  const currentAgentLabel = data.agentUser
    ? `${data.agentUser.nickname ?? data.agentUser.username} (@${data.agentUser.username})`
    : "未配置"
  const apiKeyStateLabel = clearApiKey
    ? "本次保存会清空当前密钥"
    : data.config.apiKeyConfigured
      ? "已保存密钥，留空可保留"
      : "尚未保存密钥"
  const isRunnable = enabled
    && Boolean(agentUsername.trim())
    && Boolean(model.trim())
    && Boolean((apiKey || (clearApiKey ? "" : (data.config.apiKeyConfigured ? "configured" : ""))).trim())

  function syncDraftFromData(nextData: AiReplyAdminData) {
    setData(nextData)
    setEnabled(nextData.config.enabled)
    setRespondToPostMentions(nextData.config.respondToPostMentions)
    setRespondToCommentMentions(nextData.config.respondToCommentMentions)
    setAgentUsername(nextData.agentUser?.username ?? "")
    setBaseUrl(nextData.config.baseUrl)
    setModel(nextData.config.model)
    setTemperature(String(nextData.config.temperature))
    setMaxOutputTokens(String(nextData.config.maxOutputTokens))
    setTimeoutMs(String(nextData.config.timeoutMs))
    setSystemPrompt(nextData.config.systemPrompt)
    setPostReplyPrompt(nextData.config.postReplyPrompt)
    setCommentReplyPrompt(nextData.config.commentReplyPrompt)
    setApiKey("")
    setClearApiKey(false)
  }

  function buildRequestPayload() {
    return {
      config: {
        enabled,
        respondToPostMentions,
        respondToCommentMentions,
        agentUsername,
        baseUrl,
        model,
        temperature: Number(temperature),
        maxOutputTokens: Number(maxOutputTokens),
        timeoutMs: Number(timeoutMs),
        systemPrompt,
        postReplyPrompt,
        commentReplyPrompt,
      },
      secret: {
        apiKey,
        clearApiKey,
      },
      pagination: {
        page: data.recentTasksPagination.page,
      },
    }
  }

  async function loadTaskPage(page: number) {
    setIsTaskListLoading(true)

    try {
      const response = await fetch(`/api/admin/apps/ai-reply?page=${page}`, {
        method: "GET",
        cache: "no-store",
      })
      const result = await response.json()

      if (!response.ok || !result?.data) {
        throw new Error(result?.message ?? "任务列表加载失败")
      }

      setData(result.data as AiReplyAdminData)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "任务列表加载失败", "加载失败")
    } finally {
      setIsTaskListLoading(false)
    }
  }

  async function deleteTaskLog(taskId: string) {
    const confirmed = await confirm({
      title: "删除任务日志",
      description: "删除后只会移除这条 AI 任务日志记录，不会删除已经生成的评论内容。该操作不可撤销。",
      confirmText: "删除",
      cancelText: "取消",
      variant: "danger",
    })

    if (!confirmed) {
      return
    }

    setPendingDeleteTaskId(taskId)
    setIsTaskListLoading(true)

    try {
      const response = await fetch("/api/admin/apps/ai-reply", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId,
          pagination: {
            page: data.recentTasksPagination.page,
          },
        }),
      })
      const result = await response.json()

      if (!response.ok || !result?.data) {
        throw new Error(result?.message ?? "删除任务日志失败")
      }

      setData(result.data as AiReplyAdminData)
      toast.success(result?.message ?? "任务日志已删除", "删除成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除任务日志失败", "删除失败")
    } finally {
      setPendingDeleteTaskId(null)
      setIsTaskListLoading(false)
    }
  }

  async function deleteAllTaskLogs() {
    const confirmed = await confirm({
      title: "删除全部任务日志",
      description: "这会删除所有已结束的 AI 任务日志，包括成功、失败和已取消记录。执行中的任务会被保留。该操作不可撤销。",
      confirmText: "全部删除",
      cancelText: "取消",
      variant: "danger",
    })

    if (!confirmed) {
      return
    }

    setIsDeletingAllTaskLogs(true)
    setIsTaskListLoading(true)

    try {
      const response = await fetch("/api/admin/apps/ai-reply", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deleteAllLogs: true,
          pagination: {
            page: data.recentTasksPagination.page,
          },
        }),
      })
      const result = await response.json()

      if (!response.ok || !result?.data) {
        throw new Error(result?.message ?? "删除全部任务日志失败")
      }

      setData(result.data as AiReplyAdminData)
      toast.success(result?.message ?? "任务日志已全部删除", "删除成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除全部任务日志失败", "删除失败")
    } finally {
      setIsDeletingAllTaskLogs(false)
      setIsTaskListLoading(false)
    }
  }

  function saveConfig() {
    setFeedback("")

    startTransition(async () => {
      const response = await fetch("/api/admin/apps/ai-reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildRequestPayload()),
      })

      const result = await response.json()
      if (response.ok && result?.data) {
        syncDraftFromData(result.data as AiReplyAdminData)
      }

      setFeedback(result?.message ?? (response.ok ? "保存成功" : "保存失败"))
    })
  }

  function runTest() {
    setTestFeedback("")
    setTestReply("")

    startTesting(async () => {
      const response = await fetch("/api/admin/apps/ai-reply/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildRequestPayload()),
      })

      const result = await response.json()
      if (response.ok && result?.data?.reply) {
        setTestReply(String(result.data.reply))
      }

      setTestFeedback(result?.message ?? (response.ok ? "测试成功" : "测试失败"))
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
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">当前代理账号</p>
            <p className="mt-2 text-base font-semibold">{currentAgentLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">{data.agentUser ? `状态：${data.agentUser.status}` : "保存时按用户名或昵称解析"}</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">任务池</p>
            <p className="mt-2 text-base font-semibold">{data.summary.pending} 待执行 / {data.summary.processing} 执行中</p>
            <p className="mt-1 text-sm text-muted-foreground">成功 {data.summary.succeeded}，失败 {data.summary.failed}，取消 {data.summary.cancelled}</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">AI 运行状态</p>
            <p className="mt-2 text-base font-semibold">{isRunnable ? "配置完整" : "配置未完成"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{enabled ? "开关已开启" : "当前总开关关闭"}</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">接口密钥</p>
            <p className="mt-2 text-base font-semibold">{data.config.apiKeyConfigured ? "已配置" : "未配置"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{apiKeyStateLabel}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>AI 配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 py-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">启用 AI 回复</p>
                  <p className="mt-1 text-sm text-muted-foreground">总开关，关闭后不会再创建新的 AI 提及任务。</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">帖子提及回复</p>
                  <p className="mt-1 text-sm text-muted-foreground">当帖子正文里出现 @AI 账号时，自动评论回复。</p>
                </div>
                <Switch checked={respondToPostMentions} onCheckedChange={setRespondToPostMentions} />
              </div>
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">评论提及回复</p>
                  <p className="mt-1 text-sm text-muted-foreground">当评论里出现 @AI 账号时，自动在楼中楼回复。</p>
                </div>
                <Switch checked={respondToCommentMentions} onCheckedChange={setRespondToCommentMentions} />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <TextField label="AI 代理账号" value={agentUsername} onChange={setAgentUsername} placeholder="填写用户名或昵称" />
            <TextField label="模型接口 Base URL" value={baseUrl} onChange={setBaseUrl} placeholder="https://api.openai.com/v1" />
            <TextField label="模型名称" value={model} onChange={setModel} placeholder="gpt-4.1-mini / qwen-max / deepseek-chat" />
            <div className="space-y-2">
              <TextField label="温度" value={temperature} onChange={setTemperature} placeholder="0.7" containerClassName="space-y-0" />
              <p className="text-xs leading-6 text-muted-foreground">值越低越稳定保守，值越高越发散活跃。论坛助手建议使用 0.4 到 0.7。</p>
            </div>
            <TextField label="最大输出 Token" value={maxOutputTokens} onChange={setMaxOutputTokens} placeholder="500" />
            <TextField label="请求超时（毫秒）" value={timeoutMs} onChange={setTimeoutMs} placeholder="30000" />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
            <TextField label="API Key" value={apiKey} onChange={setApiKey} placeholder="留空则保留当前密钥" type="password" />
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">清空已保存密钥</p>
                  <p className="mt-1 text-sm text-muted-foreground">{apiKeyStateLabel}</p>
                </div>
                <Switch checked={clearApiKey} onCheckedChange={setClearApiKey} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>提示词</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 py-5 xl:grid-cols-3">
          <LabeledTextarea
            label="系统提示词"
            value={systemPrompt}
            onChange={setSystemPrompt}
            placeholder="定义 AI 的整体角色、语气和输出约束。"
          />
          <LabeledTextarea
            label="帖子提及提示词"
            value={postReplyPrompt}
            onChange={setPostReplyPrompt}
            placeholder="定义 @AI 出现在帖子正文时的回复策略。"
          />
          <LabeledTextarea
            label="评论提及提示词"
            value={commentReplyPrompt}
            onChange={setCommentReplyPrompt}
            placeholder="定义 @AI 出现在评论时的楼中楼回复策略。"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>最近任务</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                共 {data.recentTasksPagination.total} 条任务日志，当前第 {data.recentTasksPagination.page} / {data.recentTasksPagination.totalPages} 页
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(data.summary.succeeded + data.summary.failed + data.summary.cancelled) > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isTaskListLoading || isDeletingAllTaskLogs}
                  onClick={() => void deleteAllTaskLogs()}
                >
                  {isDeletingAllTaskLogs ? "删除中..." : "删除全部日志"}
                </Button>
              ) : null}
              {isTaskListLoading ? <span className="text-sm text-muted-foreground">任务列表加载中...</span> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 py-5">
          {data.recentTasks.length > 0 ? data.recentTasks.map((task) => (
            <div key={task.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${TASK_STATUS_CLASS_NAMES[task.status]}`}>{TASK_STATUS_LABELS[task.status]}</span>
                  <span className="text-sm font-medium">{task.sourceType === "POST" ? "帖子提及" : "评论提及"}</span>
                  <span className="text-sm text-muted-foreground">#{task.id.slice(0, 8)}</span>
                </div>
                {canDeleteTaskLog(task.status) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isTaskListLoading || pendingDeleteTaskId === task.id}
                    onClick={() => void deleteTaskLog(task.id)}
                  >
                    {pendingDeleteTaskId === task.id ? "删除中..." : "删除日志"}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">执行中的任务暂不支持删除</span>
                )}
              </div>

              <p className="mt-3 text-sm font-medium">{task.postTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">触发者：{task.triggerUserDisplayName}，代理：{task.agentDisplayName}</p>
              <p className="mt-1 text-sm text-muted-foreground">创建于 {formatDateTime(task.createdAt)}，完成于 {formatDateTime(task.finishedAt)}</p>
              <p className="mt-1 text-sm text-muted-foreground">尝试次数 {task.attemptCount} / {task.maxAttempts}</p>
              {task.sourceCommentExcerpt ? <p className="mt-2 text-sm text-muted-foreground">源评论：{task.sourceCommentExcerpt}</p> : null}
              {task.resultExcerpt ? <p className="mt-2 text-sm text-muted-foreground">AI 回复：{task.resultExcerpt}</p> : null}
              {task.errorMessage ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">错误：{task.errorMessage}</p> : null}
            </div>
          )) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              还没有 AI 回复任务。
            </div>
          )}

          {data.recentTasksPagination.totalPages > 1 ? (
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                第 {data.recentTasksPagination.page} / {data.recentTasksPagination.totalPages} 页，每页 {data.recentTasksPagination.pageSize} 条
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!data.recentTasksPagination.hasPrevPage || isTaskListLoading}
                  onClick={() => void loadTaskPage(data.recentTasksPagination.page - 1)}
                >
                  上一页
                </Button>
                <span className="inline-flex h-8 min-w-10 items-center justify-center rounded-full border border-border bg-muted px-3 text-sm font-medium">
                  {data.recentTasksPagination.page}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!data.recentTasksPagination.hasNextPage || isTaskListLoading}
                  onClick={() => void loadTaskPage(data.recentTasksPagination.page + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={isPending || isTesting} onClick={saveConfig}>{isPending ? "保存中..." : "保存配置"}</Button>
        <Button type="button" disabled={isPending || isTesting} onClick={runTest}>{isTesting ? "测试中..." : "测试 AI"}</Button>
        {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
      </div>

      {testFeedback || testReply ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>测试结果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 py-5">
            {testFeedback ? <p className="text-sm text-muted-foreground">{testFeedback}</p> : null}
            {testReply ? (
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">模型返回</p>
                <p className="mt-2 text-sm leading-7">{testReply}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
