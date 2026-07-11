"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { AdminClientPaginationBar } from "@/components/admin/admin-pagination-bar"
import { FormModal, Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/rbutton"
import { showConfirm } from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/toast"
import { formatDateTime } from "@/lib/formatters"
import type {
  RssAdminData,
  RssGlobalLogPageData,
  RssGlobalRunPageData,
  RssPaginationMeta,
  RssSourceQueuePageData,
  RssSourceRunPageData,
} from "@/lib/rss-harvest"

type SourceDraft = {
  siteName: string
  description: string
  feedUrl: string
  logoPath: string
  intervalMinutes: string
  requiresReview: boolean
  enabled: boolean
  requestTimeoutMs: string
  maxRetryCount: string
}

type QueueSettingsDraft = {
  maxConcurrentJobs: string
  maxRetryCount: string
  retryBackoffSec: string
  fetchTimeoutMs: string
  maxResponseBytes: string
  maxRedirects: string
  failurePauseThreshold: string
  homeDisplayEnabled: boolean
  homePageSize: string
  userAgent: string
}

type SourceItem = RssAdminData["sources"][number]
type QueuePreviewItem = SourceItem["queuePreview"][number]
type SourceRunItem = SourceItem["recentRuns"][number]
type GlobalRunItem = RssAdminData["recentRuns"][number]
type LogItem = RssAdminData["recentLogs"][number]

interface RssHarvestAdminPageProps {
  initialData: RssAdminData
}

function createEmptySourceDraft(): SourceDraft {
  return {
    siteName: "",
    description: "",
    feedUrl: "",
    logoPath: "",
    intervalMinutes: "30",
    requiresReview: true,
    enabled: true,
    requestTimeoutMs: "",
    maxRetryCount: "",
  }
}

function createQueueSettingsDraft(settings: RssAdminData["settings"]): QueueSettingsDraft {
  return {
    maxConcurrentJobs: String(settings.maxConcurrentJobs),
    maxRetryCount: String(settings.maxRetryCount),
    retryBackoffSec: String(settings.retryBackoffSec),
    fetchTimeoutMs: String(settings.fetchTimeoutMs),
    maxResponseBytes: String(settings.maxResponseBytes),
    maxRedirects: String(settings.maxRedirects),
    failurePauseThreshold: String(settings.failurePauseThreshold),
    homeDisplayEnabled: settings.homeDisplayEnabled,
    homePageSize: String(settings.homePageSize),
    userAgent: settings.userAgent,
  }
}

function createGlobalRunPageData(data: RssAdminData): RssGlobalRunPageData {
  return {
    items: data.recentRuns,
    pagination: data.recentRunsPagination,
  }
}

function createGlobalLogPageData(data: RssAdminData): RssGlobalLogPageData {
  return {
    items: data.recentLogs,
    pagination: data.recentLogsPagination,
  }
}

async function readJsonResponse<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init)
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message ?? "请求失败")
  }

  return result.data as T
}

function getQueuePreviewSummary(items: QueuePreviewItem[]) {
  const latest = items[0]
  if (!latest) {
    return "当前没有 Redis 队列快照。"
  }

  return `${latest.triggerType} 触发，状态 ${latest.status}，计划于 ${formatDateTime(latest.scheduledAt)}。`
}

function getSourceRunSummary(items: SourceRunItem[]) {
  const latest = items[0]
  if (!latest) {
    return "暂无执行结果，任务首次触发后会在这里展示摘要。"
  }

  return `最近一次 ${latest.status}，开始于 ${formatDateTime(latest.startedAt)}，抓取 ${latest.fetchedCount} 条，入库 ${latest.insertedCount} 条。`
}

function buildPageTokens(page: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1) as Array<number | "ellipsis">
  }

  const tokens = new Set<number>([1, totalPages, page, page - 1, page + 1])
  const visiblePages = Array.from(tokens)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right)

  const result: Array<number | "ellipsis"> = []

  for (const current of visiblePages) {
    const previous = typeof result.at(-1) === "number" ? result.at(-1) as number : null
    if (previous !== null && current - previous > 1) {
      result.push("ellipsis")
    }
    result.push(current)
  }

  return result
}

export function RssHarvestAdminPage({ initialData }: RssHarvestAdminPageProps) {
  const router = useRouter()
  const [dataState, setDataState] = useState(() => ({
    source: initialData,
    value: initialData,
  }))
  const data = dataState.source === initialData ? dataState.value : initialData
  const setData = (value: RssAdminData) => {
    setDataState({ source: initialData, value })
  }
  const sourcePage = data.sourcePagination.page
  const [loadingData, setLoadingData] = useState(false)
  const [sourceModalOpen, setSourceModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<SourceDraft>(createEmptySourceDraft)
  const [settingsFeedback, setSettingsFeedback] = useState("")
  const [sourceFeedback, setSourceFeedback] = useState("")
  const [queueSettingsState, setQueueSettingsState] = useState(() => ({
    source: initialData,
    value: createQueueSettingsDraft(initialData.settings),
  }))
  const queueSettings = queueSettingsState.source === initialData
    ? queueSettingsState.value
    : createQueueSettingsDraft(initialData.settings)
  const setQueueSettings = (update: (current: QueueSettingsDraft) => QueueSettingsDraft) => {
    setQueueSettingsState((current) => ({
      source: initialData,
      value: update(
        current.source === initialData
          ? current.value
          : createQueueSettingsDraft(initialData.settings),
      ),
    }))
  }
  const [queueModalOpen, setQueueModalOpen] = useState(false)
  const [queueModalData, setQueueModalData] = useState<RssSourceQueuePageData | null>(null)
  const [queueModalLoading, setQueueModalLoading] = useState(false)
  const [runsModalOpen, setRunsModalOpen] = useState(false)
  const [runsModalData, setRunsModalData] = useState<RssSourceRunPageData | null>(null)
  const [runsModalLoading, setRunsModalLoading] = useState(false)
  const [globalRunsModalOpen, setGlobalRunsModalOpen] = useState(false)
  const [globalRunsModalData, setGlobalRunsModalData] = useState<RssGlobalRunPageData>(() => createGlobalRunPageData(initialData))
  const [globalRunsModalLoading, setGlobalRunsModalLoading] = useState(false)
  const [globalLogsModalOpen, setGlobalLogsModalOpen] = useState(false)
  const [globalLogsModalData, setGlobalLogsModalData] = useState<RssGlobalLogPageData>(() => createGlobalLogPageData(initialData))
  const [globalLogsModalLoading, setGlobalLogsModalLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const enabledSourceCount = useMemo(() => data.sources.filter((item) => item.status === "ACTIVE").length, [data.sources])
  const sourceModalTitle = editingId ? "编辑 RSS 任务" : "新增 RSS 任务"

  async function loadAdminData(nextSourcePage = sourcePage) {
    setLoadingData(true)
    try {
      const searchParams = new URLSearchParams({
        sourcePage: String(nextSourcePage),
        recentRunsPage: "1",
        recentLogsPage: "1",
      })
      const nextData = await readJsonResponse<RssAdminData>(`/api/admin/apps/rss-harvest?${searchParams.toString()}`, {
        method: "GET",
        cache: "no-store",
      })
      setData(nextData)
      setQueueSettingsState({
        source: initialData,
        value: createQueueSettingsDraft(nextData.settings),
      })
      if (!globalRunsModalOpen) {
        setGlobalRunsModalData(createGlobalRunPageData(nextData))
      }
      if (!globalLogsModalOpen) {
        setGlobalLogsModalData(createGlobalLogPageData(nextData))
      }
    } catch {
      toast.error("RSS 抓取后台数据加载失败，请稍后重试", "加载失败")
    } finally {
      setLoadingData(false)
    }
  }

  async function submitAction(payload: Record<string, unknown>, successFallback: string) {
    const response = await fetch("/api/admin/apps/rss-harvest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message ?? "操作失败")
    }

    return String(result.message ?? successFallback)
  }

  async function loadSourceQueuePage(sourceId: string, page = 1) {
    setQueueModalLoading(true)
    try {
      const searchParams = new URLSearchParams({
        view: "source-queue",
        sourceId,
        page: String(page),
      })
      const nextData = await readJsonResponse<RssSourceQueuePageData>(`/api/admin/apps/rss-harvest?${searchParams.toString()}`, {
        method: "GET",
        cache: "no-store",
      })
      setQueueModalData(nextData)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "队列快照加载失败", "加载失败")
    } finally {
      setQueueModalLoading(false)
    }
  }

  async function loadSourceRunPage(sourceId: string, page = 1) {
    setRunsModalLoading(true)
    try {
      const searchParams = new URLSearchParams({
        view: "source-runs",
        sourceId,
        page: String(page),
      })
      const nextData = await readJsonResponse<RssSourceRunPageData>(`/api/admin/apps/rss-harvest?${searchParams.toString()}`, {
        method: "GET",
        cache: "no-store",
      })
      setRunsModalData(nextData)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "执行记录加载失败", "加载失败")
    } finally {
      setRunsModalLoading(false)
    }
  }

  async function loadGlobalRunsPage(page = 1) {
    setGlobalRunsModalLoading(true)
    try {
      const searchParams = new URLSearchParams({
        view: "recent-runs",
        page: String(page),
      })
      const nextData = await readJsonResponse<RssGlobalRunPageData>(`/api/admin/apps/rss-harvest?${searchParams.toString()}`, {
        method: "GET",
        cache: "no-store",
      })
      setGlobalRunsModalData(nextData)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "全局执行记录加载失败", "加载失败")
    } finally {
      setGlobalRunsModalLoading(false)
    }
  }

  async function loadGlobalLogsPage(page = 1) {
    setGlobalLogsModalLoading(true)
    try {
      const searchParams = new URLSearchParams({
        view: "recent-logs",
        page: String(page),
      })
      const nextData = await readJsonResponse<RssGlobalLogPageData>(`/api/admin/apps/rss-harvest?${searchParams.toString()}`, {
        method: "GET",
        cache: "no-store",
      })
      setGlobalLogsModalData(nextData)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "爬虫日志加载失败", "加载失败")
    } finally {
      setGlobalLogsModalLoading(false)
    }
  }

  function syncDraftFromSource(source: SourceItem) {
    setDraft({
      siteName: source.siteName,
      description: source.description ?? "",
      feedUrl: source.feedUrl,
      logoPath: source.logoPath ?? "",
      intervalMinutes: String(source.intervalMinutes),
      requiresReview: source.requiresReview,
      enabled: source.status === "ACTIVE",
      requestTimeoutMs: source.requestTimeoutMs ? String(source.requestTimeoutMs) : "",
      maxRetryCount: source.maxRetryCount === null ? "" : String(source.maxRetryCount),
    })
  }

  function resetDraft() {
    setEditingId(null)
    setDraft(createEmptySourceDraft())
    setSourceFeedback("")
  }

  function openCreateSourceModal() {
    resetDraft()
    setSourceModalOpen(true)
  }

  function openEditSourceModal(source: SourceItem) {
    setEditingId(source.id)
    syncDraftFromSource(source)
    setSourceFeedback("")
    setSourceModalOpen(true)
  }

  function closeSourceModal() {
    if (isPending) {
      return
    }

    setSourceModalOpen(false)
    resetDraft()
  }

  function saveQueueSettings() {
    setSettingsFeedback("")
    startTransition(async () => {
      try {
        const message = await submitAction({
          action: "save-settings",
          settings: {
            maxConcurrentJobs: Number(queueSettings.maxConcurrentJobs || 0),
            maxRetryCount: Number(queueSettings.maxRetryCount || 0),
            retryBackoffSec: Number(queueSettings.retryBackoffSec || 0),
            fetchTimeoutMs: Number(queueSettings.fetchTimeoutMs || 0),
            maxResponseBytes: Number(queueSettings.maxResponseBytes || 0),
            maxRedirects: Number(queueSettings.maxRedirects || 0),
            failurePauseThreshold: Number(queueSettings.failurePauseThreshold || 0),
            homeDisplayEnabled: queueSettings.homeDisplayEnabled,
            homePageSize: Number(queueSettings.homePageSize || 0),
            userAgent: queueSettings.userAgent,
          },
        }, "队列配置已保存")
        setSettingsFeedback(message)
        await loadAdminData(sourcePage)
        router.refresh()
      } catch (error) {
        setSettingsFeedback(error instanceof Error ? error.message : "队列配置保存失败")
      }
    })
  }

  function repairSchedulerJob() {
    setSettingsFeedback("")
    startTransition(async () => {
      try {
        const message = await submitAction({
          action: "repair-scheduler",
        }, "已重建 RSS 独立调度")
        setSettingsFeedback(message)
        await loadAdminData(sourcePage)
        router.refresh()
      } catch (error) {
        setSettingsFeedback(error instanceof Error ? error.message : "调度任务重新挂起失败")
      }
    })
  }

  function saveSource() {
    setSourceFeedback("")
    startTransition(async () => {
      try {
        const message = await submitAction({
          action: editingId ? "update-source" : "create-source",
          sourceId: editingId,
          source: {
            siteName: draft.siteName,
            description: draft.description,
            feedUrl: draft.feedUrl,
            logoPath: draft.logoPath,
            intervalMinutes: Number(draft.intervalMinutes || 0),
            requiresReview: draft.requiresReview,
            enabled: draft.enabled,
            requestTimeoutMs: draft.requestTimeoutMs ? Number(draft.requestTimeoutMs) : "",
            maxRetryCount: draft.maxRetryCount ? Number(draft.maxRetryCount) : "",
          },
        }, editingId ? "RSS 任务已更新" : "RSS 任务已创建")
        setSourceFeedback(message)
        setSourceModalOpen(false)
        resetDraft()
        await loadAdminData(sourcePage)
        router.refresh()
      } catch (error) {
        setSourceFeedback(error instanceof Error ? error.message : "RSS 任务保存失败")
      }
    })
  }

  function testSourceFeed() {
    const feedUrl = draft.feedUrl.trim()
    if (!feedUrl) {
      setSourceFeedback("请先填写 RSS 地址")
      return
    }

    setSourceFeedback("")
    startTransition(async () => {
      try {
        const message = await submitAction({
          action: "test-source",
          source: {
            feedUrl,
            requestTimeoutMs: draft.requestTimeoutMs ? Number(draft.requestTimeoutMs) : "",
          },
        }, "RSS 地址测试成功")
        setSourceFeedback(message)
      } catch (error) {
        setSourceFeedback(error instanceof Error ? error.message : "RSS 地址测试失败")
      }
    })
  }

  function executeSourceAction(action: "start-source" | "stop-source" | "run-source", sourceId: string) {
    startTransition(async () => {
      try {
        const fallback = action === "start-source" ? "RSS 任务已启动" : action === "stop-source" ? "RSS 任务已停止" : "任务已加入抓取队列"
        const message = await submitAction({ action, sourceId }, fallback)
        toast.success(message, "操作成功")
        await loadAdminData(sourcePage)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "操作失败", "操作失败")
      }
    })
  }

  async function clearLogs() {
    const confirmed = await showConfirm({
      title: "清空 RSS 日志",
      description: "这会删除当前 RSS 抓取日志记录，任务、队列和已入库内容不会受影响。确认继续吗？",
      confirmText: "清空日志",
      cancelText: "取消",
      variant: "danger",
    })
    if (!confirmed) {
      return
    }

    startTransition(async () => {
      try {
        const message = await submitAction({ action: "clear-logs" }, "日志已清空")
        toast.success(message, "操作成功")
        setGlobalLogsModalOpen(false)
        await loadAdminData(sourcePage)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "日志清空失败", "操作失败")
      }
    })
  }

  async function clearSourceQueue() {
    if (!queueModalData) {
      return
    }

    const confirmed = await showConfirm({
      title: "清空队列快照",
      description: "会清除这个 RSS 源已结束的 Redis 队列记录，不会删除待执行或执行中的任务；因为最近执行也来自这份记录，所以对应执行历史也会一起消失。确认继续吗？",
      confirmText: "清空快照",
      cancelText: "取消",
      variant: "danger",
    })
    if (!confirmed) {
      return
    }

    startTransition(async () => {
      try {
        const message = await submitAction({ action: "clear-source-queue", sourceId: queueModalData.sourceId }, "队列快照已清空")
        toast.success(message, "操作成功")
        await Promise.all([
          loadSourceQueuePage(queueModalData.sourceId, 1),
          loadAdminData(sourcePage),
        ])
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "队列快照清空失败", "操作失败")
      }
    })
  }

  async function clearSourceRuns() {
    if (!runsModalData) {
      return
    }

    const confirmed = await showConfirm({
      title: "清空执行记录",
      description: "只会清除这个 RSS 源已完成的执行记录和关联日志，不会影响正在执行中的任务。确认继续吗？",
      confirmText: "清空执行",
      cancelText: "取消",
      variant: "danger",
    })
    if (!confirmed) {
      return
    }

    startTransition(async () => {
      try {
        const message = await submitAction({ action: "clear-source-runs", sourceId: runsModalData.sourceId }, "执行记录已清空")
        toast.success(message, "操作成功")
        await Promise.all([
          loadSourceRunPage(runsModalData.sourceId, 1),
          loadAdminData(sourcePage),
        ])
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "执行记录清空失败", "操作失败")
      }
    })
  }

  async function clearGlobalRuns() {
    const confirmed = await showConfirm({
      title: "清空全局执行记录",
      description: "只会清除全站已完成的 RSS 执行记录和关联日志，不会影响正在执行中的任务。确认继续吗？",
      confirmText: "清空执行",
      cancelText: "取消",
      variant: "danger",
    })
    if (!confirmed) {
      return
    }

    startTransition(async () => {
      try {
        const message = await submitAction({ action: "clear-runs" }, "全局执行记录已清空")
        toast.success(message, "操作成功")
        setGlobalRunsModalOpen(false)
        await loadAdminData(sourcePage)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "全局执行记录清空失败", "操作失败")
      }
    })
  }

  function openQueueModal(sourceId: string) {
    setQueueModalOpen(true)
    void loadSourceQueuePage(sourceId, 1)
  }

  function openRunsModal(sourceId: string) {
    setRunsModalOpen(true)
    void loadSourceRunPage(sourceId, 1)
  }

  function openGlobalRunsModal() {
    setGlobalRunsModalOpen(true)
    void loadGlobalRunsPage(1)
  }

  function openGlobalLogsModal() {
    setGlobalLogsModalOpen(true)
    void loadGlobalLogsPage(1)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">RSS 抓取中心</h3>
            <p className="mt-1 text-sm text-muted-foreground">统一 background jobs + Redis 短期快照设计，每个 RSS 源都会按自己的间隔独立挂起下一次执行，支持手动触发、失败重试、日志追踪和自动暂停保护。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill label="独立调度" value={data.schedulerStatus.stateLabel} tone={data.schedulerStatus.scheduled ? "success" : "danger"} />
            <StatusPill label="启用源" value={String(enabledSourceCount)} tone="success" />
            <StatusPill label="待执行快照" value={String(data.queueSummary.pending)} tone="warning" />
            <StatusPill label="执行中" value={String(data.queueSummary.processing)} tone="info" />
            <StatusPill label="失败快照" value={String(data.queueSummary.failed)} tone={data.queueSummary.failed > 0 ? "danger" : "muted"} />
            <Link href="/admin/apps/rss-harvest/entries">
              <Button type="button" variant="outline">采集数据</Button>
            </Link>
            <Link href="/admin/apps/worker">
              <Button type="button" variant="outline">Worker 中心</Button>
            </Link>
            <Button type="button" variant="outline" onClick={() => void loadAdminData(sourcePage)} disabled={loadingData || isPending}>{loadingData ? "刷新中..." : "刷新数据"}</Button>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div>
          <h4 className="text-sm font-semibold">调度与安全配置</h4>
          <p className="mt-1 text-sm text-muted-foreground">控制并发、重试、超时、抓取体积上限，以及首页宇宙栏目展示策略。RSS 的下一次执行由每个源按自己的抓取间隔独立挂起，运行态连接和队列消费状态统一在 Worker 中心查看。</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard
            title="独立调度状态"
            value={data.schedulerStatus.stateLabel}
            detail={data.schedulerStatus.detail}
          />
          <InfoCard
            title="源挂起进度"
            value={data.schedulerStatus.locationLabel}
            detail={data.schedulerStatus.jobId ? `最早的队列项 ID ${data.schedulerStatus.jobId}` : "当前没有可显示的队列项 ID。"}
          />
          <InfoCard
            title="最早下次执行"
            value={data.schedulerStatus.availableAt
              ? formatDateTime(data.schedulerStatus.availableAt)
              : "未安排"}
            detail={data.schedulerStatus.enqueuedAt ? `入队于 ${formatDateTime(data.schedulerStatus.enqueuedAt)}` : "当前没有可显示的入队时间。"}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="最大并发任务" value={queueSettings.maxConcurrentJobs} onChange={(value) => setQueueSettings((current) => ({ ...current, maxConcurrentJobs: value }))} inputMode="numeric" />
          <Field label="默认重试次数" value={queueSettings.maxRetryCount} onChange={(value) => setQueueSettings((current) => ({ ...current, maxRetryCount: value }))} inputMode="numeric" />
          <Field label="重试退避秒数" value={queueSettings.retryBackoffSec} onChange={(value) => setQueueSettings((current) => ({ ...current, retryBackoffSec: value }))} inputMode="numeric" />
          <Field label="默认超时毫秒" value={queueSettings.fetchTimeoutMs} onChange={(value) => setQueueSettings((current) => ({ ...current, fetchTimeoutMs: value }))} inputMode="numeric" />
          <Field label="响应体上限字节" value={queueSettings.maxResponseBytes} onChange={(value) => setQueueSettings((current) => ({ ...current, maxResponseBytes: value }))} inputMode="numeric" />
          <Field label="最大重定向次数" value={queueSettings.maxRedirects} onChange={(value) => setQueueSettings((current) => ({ ...current, maxRedirects: value }))} inputMode="numeric" />
          <Field label="失败自动暂停阈值" value={queueSettings.failurePauseThreshold} onChange={(value) => setQueueSettings((current) => ({ ...current, failurePauseThreshold: value }))} inputMode="numeric" />
          <label className="flex min-h-[44px] items-center justify-between gap-3 rounded-[16px] border border-border bg-background px-4 py-3 text-sm">
            <span className="font-medium">首页显示宇宙栏目</span>
            <input type="checkbox" checked={queueSettings.homeDisplayEnabled} onChange={(event) => setQueueSettings((current) => ({ ...current, homeDisplayEnabled: event.target.checked }))} className="h-4 w-4 rounded border-border" />
          </label>
          <Field label="宇宙栏目每页条数" value={queueSettings.homePageSize} onChange={(value) => setQueueSettings((current) => ({ ...current, homePageSize: value }))} inputMode="numeric" />
          <Field label="抓取 User-Agent" value={queueSettings.userAgent} onChange={(value) => setQueueSettings((current) => ({ ...current, userAgent: value }))} className="xl:col-span-2" />
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" onClick={saveQueueSettings} disabled={isPending}>{isPending ? "保存中..." : "保存调度配置"}</Button>
          <Button type="button" variant="outline" onClick={repairSchedulerJob} disabled={isPending}>{isPending ? "处理中..." : "重建独立调度"}</Button>
          {settingsFeedback ? <span className="text-sm text-muted-foreground">{settingsFeedback}</span> : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold">新增 RSS 任务</h4>
            <p className="mt-1 text-sm text-muted-foreground">录入 RSS 地址、抓取频率、站点名称和审核策略，并支持单任务超时与重试覆盖。</p>
          </div>
          <Button type="button" onClick={openCreateSourceModal} disabled={isPending}>新增 RSS 任务</Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold">用户收录申请</h4>
            <p className="mt-1 text-sm text-muted-foreground">用户提交的 RSS 源申请已移到独立审核页，支持筛选、分页和审核备注。</p>
          </div>
          <Link href="/admin/apps/rss-harvest/applications">
            <Button type="button" variant={data.pendingSourceApplicationCount > 0 ? "default" : "outline"}>
              收录申请{data.pendingSourceApplicationCount > 0 ? ` ${data.pendingSourceApplicationCount}` : ""}
            </Button>
          </Link>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold">任务列表</h4>
            <p className="mt-1 text-sm text-muted-foreground">支持立即执行、启动、停止和查看最近 Redis 队列记录 / 执行概况。</p>
            </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
            共 {data.sourcePagination.total} 个源，第 {data.sourcePagination.page} / {data.sourcePagination.totalPages} 页
          </span>
        </div>

        {data.sources.length === 0 ? <p className="text-sm text-muted-foreground">当前没有 RSS 任务，先在上方创建一个源。</p> : null}
        {data.sourcePagination.totalPages > 1 ? (
          <AdminClientPaginationBar
            pagination={data.sourcePagination}
            itemLabel="个源"
            loading={loadingData}
            onPageChange={(page) => {
              void loadAdminData(page)
            }}
          />
        ) : null}

        <div className="space-y-3">
          {data.sources.map((source) => (
            <article key={source.id} className="rounded-[18px] border border-border bg-background/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">{source.siteName}</span>
                    <StatusBadge status={source.status} />
                    <ReviewModeBadge requiresReview={source.requiresReview} />
                    <span className="text-xs text-muted-foreground">每 {source.intervalMinutes} 分钟抓取一次</span>
                  </div>
                  <p className="mt-2 break-all text-sm font-medium text-foreground">{source.feedUrl}</p>
                  {source.description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{source.description}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    下次执行 {source.nextRunAt ? formatDateTime(source.nextRunAt) : "未安排"} · 最近成功 {source.lastSuccessAt ? formatDateTime(source.lastSuccessAt) : "暂无"} · 连续失败 {source.failureCount}
                  </p>
                  {source.lastErrorMessage ? <p className="mt-2 text-xs text-rose-600">最近错误：{source.lastErrorMessage}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openEditSourceModal(source)}>编辑</Button>
                  <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => executeSourceAction("run-source", source.id)}>立即执行</Button>
                  {source.status === "ACTIVE"
                    ? <Button type="button" variant="ghost" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => executeSourceAction("stop-source", source.id)}>停止</Button>
                    : <Button type="button" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => executeSourceAction("start-source", source.id)}>启动</Button>}
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <SummaryActionCard
                  title="Redis 队列快照"
                  caption={source.queueCount > 0 ? `累计 ${source.queueCount} 条快照记录` : "当前没有快照项"}
                  summary={getQueuePreviewSummary(source.queuePreview)}
                  onOpen={() => openQueueModal(source.id)}
                />
                <SummaryActionCard
                  title="最近执行"
                  caption={source.runCount > 0 ? `累计执行 ${source.runCount} 次` : "还没有执行记录"}
                  summary={getSourceRunSummary(source.recentRuns)}
                  onOpen={() => openRunsModal(source.id)}
                />
              </div>
            </article>
          ))}
        </div>

        {data.sourcePagination.totalPages > 1 ? (
          <AdminClientPaginationBar
            pagination={data.sourcePagination}
            itemLabel="个源"
            loading={loadingData}
            className="border-t border-border pt-4"
            onPageChange={(page) => {
              void loadAdminData(page)
            }}
          />
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold">全局最近执行</h4>
              <p className="mt-1 text-sm text-muted-foreground">默认显示最新 20 条，点击查看更多可在模态框中翻页。</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={openGlobalRunsModal}>查看更多</Button>
              <Button
                type="button"
                variant="outline"
                className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                disabled={isPending || data.recentRunsPagination.total === 0}
                onClick={clearGlobalRuns}
              >
                清空执行
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <GlobalRssRunList items={data.recentRuns} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold">Redis 短期日志</h4>
              <p className="mt-1 text-sm text-muted-foreground">默认显示最新 20 条，查看更多后可分页追踪 Redis 中带 TTL 的 RSS 执行日志。</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={openGlobalLogsModal}>查看更多</Button>
              <Button
                type="button"
                variant="outline"
                className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                disabled={isPending || data.recentLogs.length === 0}
                onClick={clearLogs}
              >
                清空日志
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <RssLogList items={data.recentLogs} />
          </div>
        </div>
      </section>

      <FormModal
        open={sourceModalOpen}
        title={sourceModalTitle}
        description="录入 RSS 地址、站点名称、Logo、抓取频率和审核策略，并支持可选的单任务超时与重试覆盖。"
        size="lg"
        closeDisabled={isPending}
        closeOnEscape={!isPending}
        onClose={closeSourceModal}
        onSubmit={(event) => {
          event.preventDefault()
          saveSource()
        }}
        footer={({ formId }) => (
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={closeSourceModal} disabled={isPending}>取消</Button>
            <Button type="submit" form={formId} disabled={isPending}>{isPending ? "保存中..." : editingId ? "保存任务" : "创建任务"}</Button>
          </div>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="站点名称" value={draft.siteName} onChange={(value) => setDraft((current) => ({ ...current, siteName: value }))} />
          <Field label="站点描述" value={draft.description} onChange={(value) => setDraft((current) => ({ ...current, description: value }))} />
          <div className="md:col-span-2 md:flex md:items-end md:gap-3">
            <Field label="RSS 地址" value={draft.feedUrl} onChange={(value) => setDraft((current) => ({ ...current, feedUrl: value }))} className="md:flex-1" type="url" />
            <Button type="button" variant="outline" className="mt-2 h-11 rounded-[16px] px-4 md:mt-0" disabled={isPending} onClick={testSourceFeed}>
              {isPending ? "测试中..." : "测试 RSS"}
            </Button>
          </div>
          <Field label="站点 Logo 地址" value={draft.logoPath} onChange={(value) => setDraft((current) => ({ ...current, logoPath: value }))} className="md:col-span-2" />
          <p className="text-xs text-muted-foreground md:col-span-2">可填写站内上传路径或外链图片地址；留空时会自动生成默认 Logo。</p>
          <Field label="抓取频率（分钟）" value={draft.intervalMinutes} onChange={(value) => setDraft((current) => ({ ...current, intervalMinutes: value }))} inputMode="numeric" />
          <Field label="单任务超时毫秒" value={draft.requestTimeoutMs} onChange={(value) => setDraft((current) => ({ ...current, requestTimeoutMs: value }))} inputMode="numeric" />
          <Field label="单任务最大重试" value={draft.maxRetryCount} onChange={(value) => setDraft((current) => ({ ...current, maxRetryCount: value }))} inputMode="numeric" />
          <label className="flex min-h-[44px] items-center justify-between gap-3 rounded-[16px] border border-border bg-background px-4 py-3 text-sm md:col-span-2">
            <div>
              <span className="font-medium">需要审核入库内容</span>
              <p className="mt-1 text-xs text-muted-foreground">关闭后，抓取入库的数据会自动通过审核。</p>
            </div>
            <input type="checkbox" checked={draft.requiresReview} onChange={(event) => setDraft((current) => ({ ...current, requiresReview: event.target.checked }))} className="h-4 w-4 rounded border-border" />
          </label>
          <label className="flex min-h-[44px] items-center justify-between gap-3 rounded-[16px] border border-border bg-background px-4 py-3 text-sm">
            <span className="font-medium">{editingId ? "保持任务启用" : "创建后立即启用"}</span>
            <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))} className="h-4 w-4 rounded border-border" />
          </label>
        </div>
        {sourceFeedback ? <p className="text-sm text-muted-foreground">{sourceFeedback}</p> : null}
      </FormModal>

      <Modal
        open={queueModalOpen}
        title={queueModalData ? `${queueModalData.sourceName} · Redis 队列快照` : "Redis 队列快照"}
        description="展示该 RSS 源在 Redis 队列中的最近快照状态、触发方式和错误信息。"
        size="lg"
        onClose={() => setQueueModalOpen(false)}
      >
        <div className="mb-4 flex justify-end">
          <Button
            type="button"
            variant="outline"
            className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            disabled={isPending || queueModalLoading || !queueModalData || queueModalData.pagination.total === 0}
            onClick={clearSourceQueue}
          >
            清空快照
          </Button>
        </div>
        {queueModalLoading ? <p className="text-sm text-muted-foreground">加载中...</p> : <RssQueuePreviewList items={queueModalData?.items ?? []} />}
        <ClientPagination
          pagination={queueModalData?.pagination ?? null}
          loading={queueModalLoading}
          onChange={(page) => {
            if (queueModalData) {
              void loadSourceQueuePage(queueModalData.sourceId, page)
            }
          }}
        />
      </Modal>

      <Modal
        open={runsModalOpen}
        title={runsModalData ? `${runsModalData.sourceName} · 最近执行` : "最近执行"}
        description="展示该 RSS 源基于 Redis 队列记录生成的执行结果、抓取数量和错误信息。"
        size="lg"
        onClose={() => setRunsModalOpen(false)}
      >
        <div className="mb-4 flex justify-end">
          <Button
            type="button"
            variant="outline"
            className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            disabled={isPending || runsModalLoading || !runsModalData || runsModalData.pagination.total === 0}
            onClick={clearSourceRuns}
          >
            清空执行
          </Button>
        </div>
        {runsModalLoading ? <p className="text-sm text-muted-foreground">加载中...</p> : <RssSourceRunList items={runsModalData?.items ?? []} />}
        <ClientPagination
          pagination={runsModalData?.pagination ?? null}
          loading={runsModalLoading}
          onChange={(page) => {
            if (runsModalData) {
              void loadSourceRunPage(runsModalData.sourceId, page)
            }
          }}
        />
      </Modal>

      <Modal
        open={globalRunsModalOpen}
        title="全局最近执行"
        description="分页查看全站基于 Redis 队列记录生成的 RSS 抓取执行记录。"
        size="xl"
        onClose={() => setGlobalRunsModalOpen(false)}
      >
        {globalRunsModalLoading ? <p className="text-sm text-muted-foreground">加载中...</p> : <GlobalRssRunList items={globalRunsModalData.items} />}
        <ClientPagination pagination={globalRunsModalData.pagination} loading={globalRunsModalLoading} onChange={(page) => { void loadGlobalRunsPage(page) }} />
      </Modal>

      <Modal
        open={globalLogsModalOpen}
        title="爬虫日志"
        description="分页查看全站 RSS 抓取日志。"
        size="xl"
        onClose={() => setGlobalLogsModalOpen(false)}
      >
        {globalLogsModalLoading ? <p className="text-sm text-muted-foreground">加载中...</p> : <RssLogList items={globalLogsModalData.items} />}
        <ClientPagination pagination={globalLogsModalData.pagination} loading={globalLogsModalLoading} onChange={(page) => { void loadGlobalLogsPage(page) }} />
      </Modal>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  className = "",
  type = "text",
  inputMode,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
  type?: "text" | "url"
  inputMode?: "text" | "numeric" | "decimal" | "email" | "search" | "tel" | "url"
}) {
  return (
    <label className={`block space-y-2 ${className}`.trim()}>
      <span className="text-sm font-medium">{label}</span>
      <input type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-[16px] border border-border bg-background px-4 text-sm outline-hidden" />
    </label>
  )
}

function SummaryActionCard({ title, caption, summary, onOpen }: { title: string; caption: string; summary: string; onOpen: () => void }) {
  return (
    <div className="rounded-[16px] border border-border p-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
      <p className="mt-3 text-sm font-medium">{caption}</p>
      <p className="mt-1 text-xs leading-6 text-muted-foreground">{summary}</p>
      <Button type="button" variant="outline" className="mt-4 h-8 rounded-full px-3 text-xs" onClick={onOpen}>查看更多</Button>
    </div>
  )
}

function ClientPagination({
  pagination,
  loading,
  onChange,
}: {
  pagination: RssPaginationMeta | null
  loading: boolean
  onChange: (page: number) => void
}) {
  if (!pagination || pagination.totalPages <= 1) {
    return null
  }

  const tokens = buildPageTokens(pagination.page, pagination.totalPages)

  return (
    <div className="mt-4 flex flex-col items-center gap-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" variant="outline" className="h-9 px-4 text-xs" disabled={!pagination.hasPrevPage || loading} onClick={() => onChange(pagination.page - 1)}>上一页</Button>
        {tokens.map((token, index) => token === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="px-1 text-sm text-muted-foreground">...</span>
        ) : (
          <Button
            key={token}
            type="button"
            variant={token === pagination.page ? "default" : "outline"}
            className="h-9 min-w-9 px-3 text-xs"
            disabled={loading}
            onClick={() => onChange(token)}
          >
            {token}
          </Button>
        ))}
        <Button type="button" variant="outline" className="h-9 px-4 text-xs" disabled={!pagination.hasNextPage || loading} onClick={() => onChange(pagination.page + 1)}>下一页</Button>
      </div>
      <p className="text-xs text-muted-foreground">第 {pagination.page} / {pagination.totalPages} 页，共 {pagination.total} 条</p>
    </div>
  )
}

function RssQueuePreviewList({ items }: { items: QueuePreviewItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">当前没有 Redis 队列快照。</p>
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-[14px] border border-border bg-card px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium">{item.triggerType}</span>
            <span className="text-xs text-muted-foreground">{item.status}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">计划 {formatDateTime(item.scheduledAt)} · 尝试 {item.attemptCount}/{item.maxAttempts}</p>
          {item.startedAt ? <p className="mt-1 text-xs text-muted-foreground">开始执行 {formatDateTime(item.startedAt)}</p> : null}
          {item.errorMessage ? <p className="mt-1 text-xs text-rose-600">{item.errorMessage}</p> : null}
        </div>
      ))}
    </div>
  )
}

function RssSourceRunList({ items }: { items: SourceRunItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">还没有执行记录。</p>
  }

  return (
    <div className="space-y-2">
      {items.map((run) => (
        <div key={run.id} className="rounded-[14px] border border-border bg-card px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium">{run.triggerType}</span>
            <span className="text-xs text-muted-foreground">{run.status}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">开始 {formatDateTime(run.startedAt)} · 抓取 {run.fetchedCount} · 入库 {run.insertedCount} · 重复 {run.duplicateCount}</p>
          {run.finishedAt ? <p className="mt-1 text-xs text-muted-foreground">结束 {formatDateTime(run.finishedAt)}{run.durationMs ? ` · 耗时 ${run.durationMs}ms` : ""}</p> : null}
          {run.errorMessage ? <p className="mt-1 text-xs text-rose-600">{run.errorMessage}</p> : null}
        </div>
      ))}
    </div>
  )
}

function GlobalRssRunList({ items }: { items: GlobalRunItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无执行记录。</p>
  }

  return (
    <div className="space-y-2">
      {items.map((run) => (
        <div key={run.id} className="rounded-[16px] border border-border bg-background px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{run.sourceName}</p>
              <p className="text-xs text-muted-foreground">{run.triggerType} · {formatDateTime(run.startedAt)}</p>
            </div>
            <StatusBadge status={run.status} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">HTTP {run.httpStatus ?? "-"} · 抓取 {run.fetchedCount} · 入库 {run.insertedCount} · 重复 {run.duplicateCount}</p>
          {run.errorMessage ? <p className="mt-2 text-xs text-rose-600">{run.errorMessage}</p> : null}
        </div>
      ))}
    </div>
  )
}

function RssLogList({ items }: { items: LogItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无日志记录。</p>
  }

  return (
    <div className="space-y-2">
      {items.map((log) => (
        <div key={log.id} className="rounded-[16px] border border-border bg-background px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{log.sourceName}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)} · {log.stage}</p>
            </div>
            <LogLevelBadge level={log.level} />
          </div>
          <p className="mt-2 text-sm">{log.message}</p>
          {log.detailText ? <p className="mt-2 break-all font-mono text-[11px] leading-5 text-muted-foreground">{log.detailText}</p> : null}
        </div>
      ))}
    </div>
  )
}

function StatusPill({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "info" | "danger" | "muted" }) {
  const className = tone === "success"
    ? "bg-emerald-100 text-emerald-700"
    : tone === "warning"
      ? "bg-amber-100 text-amber-700"
      : tone === "info"
        ? "bg-sky-100 text-sky-700"
        : tone === "danger"
          ? "bg-rose-100 text-rose-700"
        : "bg-slate-100 text-slate-700"

  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs ${className}`}><span>{label}</span><strong>{value}</strong></span>
}

function InfoCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="rounded-[16px] border border-border bg-background px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
      <p className="mt-1 break-all text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const className = status === "ACTIVE" || status === "SUCCEEDED"
    ? "bg-emerald-100 text-emerald-700"
    : status === "PAUSED" || status === "FAILED" || status === "CANCELLED"
      ? "bg-rose-100 text-rose-700"
      : "bg-amber-100 text-amber-700"

  return <span className={`rounded-full px-2.5 py-1 text-[11px] ${className}`}>{status}</span>
}

function ReviewModeBadge({ requiresReview }: { requiresReview: boolean }) {
  const className = requiresReview
    ? "bg-amber-100 text-amber-700"
    : "bg-emerald-100 text-emerald-700"

  return <span className={`rounded-full px-2.5 py-1 text-[11px] ${className}`}>{requiresReview ? "需审核" : "自动通过"}</span>
}

function LogLevelBadge({ level }: { level: string }) {
  const className = level === "ERROR"
    ? "bg-rose-100 text-rose-700"
    : level === "WARN"
      ? "bg-amber-100 text-amber-700"
      : "bg-sky-100 text-sky-700"

  return <span className={`rounded-full px-2.5 py-1 text-[11px] ${className}`}>{level}</span>
}
