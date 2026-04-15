import Link from "next/link"
import { AlertTriangle, CheckCircle2, ExternalLink, ListRestart, Server, TriangleAlert, Wallet } from "lucide-react"
import type { ReactNode } from "react"

import { PageNumberPagination } from "@/components/page-number-pagination"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BackgroundWorkerAdminData } from "@/lib/background-job-admin"
import { formatDateTime, formatNumber } from "@/lib/formatters"
import { getCanonicalPostPath } from "@/lib/post-links"

interface BackgroundWorkerAdminPageProps {
  data: BackgroundWorkerAdminData
  pageQueryEntries?: Array<[string, string]>
}

export function BackgroundWorkerAdminPage({ data, pageQueryEntries = [] }: BackgroundWorkerAdminPageProps) {
  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <WorkerStatCard
          title="队列模式"
          value={data.runtime.transportLabel}
          hint={data.runtime.webConsumesJobs ? "Web 进程会参与消费任务" : "Web 进程只负责入队"}
          icon={<Server className="h-4 w-4" />}
          tone={data.runtime.transport === "redis" ? "info" : "warning"}
        />
        <WorkerStatCard
          title="活跃 Worker 连接"
          value={data.queue.liveWorkerCount === null ? "N/A" : formatNumber(data.queue.liveWorkerCount)}
          hint={data.queue.liveWorkerCount === null ? "当前未启用 Redis 监控" : `并发上限 ${formatNumber(data.runtime.concurrency)}`}
          icon={<ListRestart className="h-4 w-4" />}
          tone={data.queue.liveWorkerCount && data.queue.liveWorkerCount > 0 ? "success" : "warning"}
        />
        <WorkerStatCard
          title="Dead Letter"
          value={formatNumber(data.queue.deadLetterCount)}
          hint={data.queue.deadLetterCount > 0 ? "存在失败任务，需要人工介入" : "当前没有死信任务"}
          icon={<TriangleAlert className="h-4 w-4" />}
          tone={data.queue.deadLetterCount > 0 ? "danger" : "success"}
        />
        <WorkerStatCard
          title="竞拍结算中"
          value={formatNumber(data.auctionSettlement.settlingCount)}
          hint={`待处理冻结记录 ${formatNumber(data.auctionSettlement.pendingEntryCount)} 条`}
          icon={<Wallet className="h-4 w-4" />}
          tone={data.auctionSettlement.pendingEntryCount > 0 ? "warning" : "default"}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Worker 信息</CardTitle>
            <CardDescription>当前后台任务运行模式、重试策略、队列积压指标，以及最近 24 小时的日志保留策略。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 py-4 sm:grid-cols-2">
            <StatusMeta title="Web Runtime 模式" value={data.runtime.webRuntimeMode} detail={data.runtime.webConsumesJobs ? "当前 Web/API 可直接消费队列" : "当前建议单独跑 worker 进程"} />
            <StatusMeta title="最大重试次数" value={String(data.runtime.maxAttempts)} detail={`首次重试延迟 ${formatNumber(data.runtime.retryBaseDelayMs)} ms`} />
            <StatusMeta title="Stream 积压" value={data.queue.streamLength === null ? "N/A" : formatNumber(data.queue.streamLength)} detail="等待被消费的流队列长度" />
            <StatusMeta title="Pending ACK" value={data.queue.pendingCount === null ? "N/A" : formatNumber(data.queue.pendingCount)} detail="已取出但尚未确认完成的任务数" />
            <StatusMeta title="延迟任务" value={data.queue.delayedCount === null ? "N/A" : formatNumber(data.queue.delayedCount)} detail="尚未到可执行时间的任务数" />
            <StatusMeta title="执行日志" value={data.runtime.redisEnabled ? "Redis 24h" : "未启用"} detail={data.runtime.redisEnabled ? "background-job 关键事件会写入 Redis，保留最近 24 小时。" : "未启用 Redis 时，仅保留进程 stdout / stderr 日志。"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Worker 连接</CardTitle>
            <CardDescription>基于 Redis `CLIENT LIST` 的当前在线连接快照。</CardDescription>
          </CardHeader>
          <CardContent className="px-0 py-0">
            {data.queue.liveWorkers.length === 0 ? (
              <div className="px-6 py-10 text-sm text-muted-foreground">
                {data.runtime.redisEnabled
                  ? "当前没有发现在线的 background-job worker 连接。"
                  : "当前未启用 Redis 队列，无法列出在线 worker 连接。"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>连接名</TableHead>
                    <TableHead className="w-[120px]">进程角色</TableHead>
                    <TableHead className="w-[110px]">PID</TableHead>
                    <TableHead className="w-[180px]">连接职责</TableHead>
                    <TableHead className="w-[200px]">地址 / Idle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.queue.liveWorkers.map((worker) => (
                    <TableRow key={worker.name}>
                      <TableCell className="align-top text-xs text-muted-foreground">{worker.name}</TableCell>
                      <TableCell className="align-top">
                        <Badge variant="outline" className="rounded-full">{worker.processRole}</Badge>
                      </TableCell>
                      <TableCell className="align-top text-sm">{worker.pid}</TableCell>
                      <TableCell className="align-top text-sm">{worker.connectionRole}</TableCell>
                      <TableCell className="align-top text-xs text-muted-foreground">
                        <div>{worker.address ?? "-"}</div>
                        <div>{worker.idleSeconds === null ? "Idle 未知" : `Idle ${formatNumber(worker.idleSeconds)}s`}</div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>延迟任务明细</CardTitle>
              <CardDescription>展示当前 Redis 延迟队列里最早执行的一批任务，方便直接确认具体任务体。</CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full">
              {data.queue.delayedCount === null ? "N/A" : `${formatNumber(data.queue.delayedCount)} 个待执行`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="py-4">
          <BackgroundJobDelayedList data={data} pageQueryEntries={pageQueryEntries} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>Worker 执行日志</CardTitle>
              <CardDescription>最近 24 小时写入 Redis 的 background-job 运行日志，包含开始、成功、重试、死信和 worker 事件。</CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full">
              {`共 ${formatNumber(data.executionLogs.pagination.total)} 条日志`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="py-4">
          <BackgroundJobExecutionLogList data={data} pageQueryEntries={pageQueryEntries} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>竞拍结算进度</CardTitle>
          <CardDescription>展示所有处于 `SETTLING` 的竞拍，以及当前退款处理进度。</CardDescription>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {data.auctionSettlement.items.length === 0 ? (
            <div className="flex items-center gap-2 px-6 py-10 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>当前没有处于结算中的竞拍。</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>帖子</TableHead>
                  <TableHead className="w-[140px]">卖家</TableHead>
                  <TableHead className="w-[220px]">进度</TableHead>
                  <TableHead className="w-[160px]">状态</TableHead>
                  <TableHead className="w-[150px]">最后更新</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.auctionSettlement.items.map((item) => {
                  const postHref = getCanonicalPostPath({ slug: item.postSlug })
                  return (
                    <TableRow key={item.auctionId}>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <Link href={postHref} className="line-clamp-1 text-sm font-medium transition-colors hover:text-primary">
                            {item.postTitle}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            结束于 {formatDateTime(item.endsAt)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-sm">{item.sellerName}</TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span>{formatNumber(item.processedCount)} / {formatNumber(item.participantCount)}</span>
                            <span>{formatNumber(item.progressPercent)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-amber-500 transition-[width]"
                              style={{ width: `${Math.max(4, item.progressPercent)}%` }}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            剩余冻结记录 {formatNumber(item.remainingCount)} 条
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant={item.remainingCount > 0 ? "secondary" : "outline"} className="rounded-full">
                            {item.remainingCount > 0 ? "退款处理中" : "待完成成交"}
                          </Badge>
                          <Badge variant="outline" className="rounded-full">
                            {item.winnerReady ? "赢家已锁定" : "赢家未锁定"}
                          </Badge>
                          <Badge variant="outline" className="rounded-full">
                            {item.finalPriceReady ? "成交价已锁定" : "成交价未锁定"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-xs text-muted-foreground">
                        {formatDateTime(item.updatedAt)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Dead Letter 告警</CardTitle>
              <CardDescription>最近进入死信队列的后台任务。优先关注 `post-auction.settle`。</CardDescription>
            </div>
            <Badge className={data.deadLetters.pagination.total > 0 ? "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200" : "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"}>
              {data.deadLetters.pagination.total > 0 ? `${formatNumber(data.deadLetters.pagination.total)} 条告警` : "无告警"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {data.deadLetters.items.length === 0 ? (
            <div className="flex items-center gap-2 px-6 py-10 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>当前没有 dead-letter 任务。</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3 px-6 py-4">
              <div className="text-xs text-muted-foreground">
                第 {formatNumber(data.deadLetters.pagination.page)} / {formatNumber(data.deadLetters.pagination.totalPages)} 页，每页 {formatNumber(data.deadLetters.pagination.pageSize)} 条
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[160px]">失败时间</TableHead>
                    <TableHead className="w-[180px]">任务</TableHead>
                    <TableHead>关联对象</TableHead>
                    <TableHead>错误</TableHead>
                    <TableHead className="w-[120px]">重试</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.deadLetters.items.map((item) => {
                    const postHref = item.auction ? getCanonicalPostPath({ slug: item.auction.postSlug }) : null

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="align-top text-xs text-muted-foreground">
                          {formatDateTime(item.failedAt)}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            <Badge className="border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                              {item.jobName}
                            </Badge>
                            <div className="text-xs text-muted-foreground">
                              attempt {item.attempt} / {item.maxAttempts}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          {item.auction ? (
                            <div className="space-y-1">
                              <Link href={postHref!} className="line-clamp-1 text-sm font-medium transition-colors hover:text-primary">
                                {item.auction.postTitle}
                              </Link>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{item.auction.status}</span>
                                <Link href={postHref!} className="inline-flex items-center gap-1 hover:text-foreground">
                                  前台帖子
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">暂无关联业务对象</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-rose-700 dark:text-rose-200">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span>{item.errorName}</span>
                            </div>
                            <div className="text-xs leading-5 text-muted-foreground">{item.errorMessage}</div>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline" className="rounded-full">
                            {item.retryable ? "可重试" : "不可重试"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {data.deadLetters.pagination.totalPages > 1 ? (
                <PageNumberPagination
                  page={data.deadLetters.pagination.page}
                  totalPages={data.deadLetters.pagination.totalPages}
                  hasPrevPage={data.deadLetters.pagination.hasPrevPage}
                  hasNextPage={data.deadLetters.pagination.hasNextPage}
                  buildHref={(page) => buildWorkerPageHref("deadLetterPage", page, pageQueryEntries)}
                />
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function BackgroundJobDelayedList({ data, pageQueryEntries = [] }: BackgroundWorkerAdminPageProps) {
  if (data.queue.delayedJobs.items.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-10 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <span>
          {data.runtime.redisEnabled ? "当前没有待执行的延迟任务。" : "当前未启用 Redis 队列，无法列出延迟任务明细。"}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-muted-foreground">
        第 {formatNumber(data.queue.delayedJobs.pagination.page)} / {formatNumber(data.queue.delayedJobs.pagination.totalPages)} 页，每页 {formatNumber(data.queue.delayedJobs.pagination.pageSize)} 条
      </div>
      {data.queue.delayedJobs.items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-border bg-background/70 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full">{item.jobName}</Badge>
                <Badge variant="outline" className="rounded-full">attempt {item.attempt} / {item.maxAttempts}</Badge>
              </div>
              <p className="text-sm font-medium text-foreground">{item.payloadSummary}</p>
              <p className="text-xs text-muted-foreground">
                入队 {formatDateTime(item.enqueuedAt)} · 计划执行 {item.availableAt ? formatDateTime(item.availableAt) : "-"} · {formatRemainingDelay(item.delayRemainingMs)}
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Payload</p>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-foreground">{item.payloadPreview}</pre>
          </div>
        </div>
      ))}
      {data.queue.delayedJobs.pagination.totalPages > 1 ? (
        <PageNumberPagination
          page={data.queue.delayedJobs.pagination.page}
          totalPages={data.queue.delayedJobs.pagination.totalPages}
          hasPrevPage={data.queue.delayedJobs.pagination.hasPrevPage}
          hasNextPage={data.queue.delayedJobs.pagination.hasNextPage}
          buildHref={(page) => buildWorkerPageHref("delayedPage", page, pageQueryEntries)}
        />
      ) : null}
    </div>
  )
}

function BackgroundJobExecutionLogList({ data, pageQueryEntries = [] }: BackgroundWorkerAdminPageProps) {
  if (data.executionLogs.items.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-10 text-sm text-muted-foreground">
        <Server className="h-4 w-4" />
        <span>
          {data.runtime.redisEnabled ? "最近 24 小时没有采集到 worker 执行日志。" : "当前未启用 Redis，暂时不会记录可查询的执行日志。"}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-muted-foreground">
        第 {formatNumber(data.executionLogs.pagination.page)} / {formatNumber(data.executionLogs.pagination.totalPages)} 页，每页 {formatNumber(data.executionLogs.pagination.pageSize)} 条
      </div>
      {data.executionLogs.items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-border bg-background/70 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <LogLevelBadge level={item.level} />
                <Badge variant="outline" className="rounded-full">{item.action}</Badge>
                {item.jobName ? <Badge variant="secondary" className="rounded-full">{item.jobName}</Badge> : null}
                {item.attempt !== null && item.maxAttempts !== null ? (
                  <span className="text-xs text-muted-foreground">attempt {item.attempt} / {item.maxAttempts}</span>
                ) : null}
              </div>
              <p className="text-sm font-medium text-foreground">{item.summary}</p>
              {item.payloadSummary ? <p className="text-xs text-muted-foreground">负载摘要：{item.payloadSummary}</p> : null}
              {item.errorMessage ? (
                <div className="rounded-xl border border-rose-200/70 bg-rose-50/60 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                  <div className="font-medium">{item.errorName ?? "执行错误"}</div>
                  <div className="mt-1 leading-5">{item.errorMessage}</div>
                </div>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground">{formatDateTime(item.occurredAt)}</div>
          </div>
          {item.metadataPreview ? (
            <div className="mt-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Metadata</p>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-foreground">{item.metadataPreview}</pre>
            </div>
          ) : null}
        </div>
      ))}
      {data.executionLogs.pagination.totalPages > 1 ? (
        <PageNumberPagination
          page={data.executionLogs.pagination.page}
          totalPages={data.executionLogs.pagination.totalPages}
          hasPrevPage={data.executionLogs.pagination.hasPrevPage}
          hasNextPage={data.executionLogs.pagination.hasNextPage}
          buildHref={(page) => buildWorkerPageHref("logPage", page, pageQueryEntries)}
        />
      ) : null}
    </div>
  )
}

function WorkerStatCard({
  title,
  value,
  hint,
  icon,
  tone = "default",
}: {
  title: string
  value: string
  hint: string
  icon: ReactNode
  tone?: "default" | "info" | "warning" | "danger" | "success"
}) {
  const toneClassName = {
    default: "bg-accent text-foreground",
    info: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
    danger: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  }[tone]

  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="text-[12px] text-muted-foreground">{title}</p>
          <p className="mt-1.5 line-clamp-1 text-2xl font-semibold leading-none">{value}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>
        </div>
        <Badge className={`h-9 w-9 shrink-0 justify-center rounded-xl border-transparent p-0 ${toneClassName}`}>
          {icon}
        </Badge>
      </CardContent>
    </Card>
  )
}

function LogLevelBadge({ level }: { level: "info" | "error" }) {
  return (
    <Badge className={level === "error"
      ? "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"
      : "border-transparent bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200"}
    >
      {level === "error" ? "error" : "info"}
    </Badge>
  )
}

function StatusMeta({
  title,
  value,
  detail,
}: {
  title: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-2 text-base font-semibold">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  )
}

function formatRemainingDelay(delayRemainingMs: number | null) {
  if (delayRemainingMs === null) {
    return "剩余时间未知"
  }

  if (delayRemainingMs <= 1_000) {
    return "即将执行"
  }

  const totalSeconds = Math.ceil(delayRemainingMs / 1_000)
  const totalMinutes = Math.ceil(totalSeconds / 60)

  if (totalMinutes < 60) {
    return `剩余 ${totalMinutes} 分钟`
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes > 0 ? `剩余 ${hours} 小时 ${minutes} 分钟` : `剩余 ${hours} 小时`
}

function buildWorkerPageHref(paramKey: "logPage" | "delayedPage" | "deadLetterPage", page: number, queryEntries: Array<[string, string]>) {
  const query = new URLSearchParams(queryEntries)

  if (page > 1) {
    query.set(paramKey, String(page))
  }

  const queryString = query.toString()
  return queryString ? `/admin/apps/worker?${queryString}` : "/admin/apps/worker"
}
