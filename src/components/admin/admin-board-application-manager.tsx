"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, FolderTree, ShieldCheck } from "lucide-react"

import { AdminSummaryStrip } from "@/components/admin/admin-summary-strip"
import { Field, SelectField, TextAreaField } from "@/components/admin/admin-structure.shared"
import type {
  AdminBoardApplicationManagerProps,
  BoardApplicationItem,
  BoardApplicationReviewFormState,
} from "@/components/admin/admin-structure.types"
import { LevelIcon } from "@/components/level-icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FormModal } from "@/components/ui/modal"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { formatDateTime, formatNumber } from "@/lib/formatters"
import type { ZoneItem } from "@/lib/admin-structure-management"

export function AdminBoardApplicationManager({
  zones,
  boardApplications,
  canReviewBoardApplications,
}: AdminBoardApplicationManagerProps) {
  const [applicationModal, setApplicationModal] = useState<BoardApplicationItem | null>(null)
  const pendingBoardApplications = useMemo(
    () => boardApplications.filter((item) => item.status === "PENDING"),
    [boardApplications],
  )
  const approvedBoardApplications = useMemo(
    () => boardApplications.filter((item) => item.status === "APPROVED"),
    [boardApplications],
  )

  return (
    <div className="space-y-4">
      <AdminSummaryStrip
        items={[
          { label: "申请总数", value: boardApplications.length, icon: <FolderTree className="h-4 w-4" /> },
          { label: "待审核", value: pendingBoardApplications.length, icon: <AlertCircle className="h-4 w-4" />, tone: "amber" },
          { label: "已通过", value: approvedBoardApplications.length, icon: <ShieldCheck className="h-4 w-4" />, tone: "emerald" },
        ]}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>节点申请</CardTitle>
          <CardDescription>用户提交新建节点申请后，会在这里等待管理员审核；通过后自动创建节点并把申请人设为该节点版主。</CardDescription>
          <CardAction>
            <Badge className="border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
              待审核 {pendingBoardApplications.length}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {!canReviewBoardApplications ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              当前无权审核节点申请。
            </div>
          ) : boardApplications.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              当前还没有节点申请。
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>申请</TableHead>
                  <TableHead className="w-[200px]">申请人 / 分区</TableHead>
                  <TableHead className="w-[220px]">状态与结果</TableHead>
                  <TableHead className="w-[120px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boardApplications.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="align-top">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <LevelIcon
                            icon={item.icon}
                            className="h-5 w-5 shrink-0 text-lg"
                            emojiClassName="text-inherit leading-none"
                            svgClassName="[&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                            title={`${item.name} 图标`}
                          />
                          <span className="text-sm font-semibold">{item.name}</span>
                          <BoardApplicationStatusBadge status={item.status} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">/{item.slug}</p>
                        {item.reason ? (
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.reason}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <p>@{item.applicant.username} · {item.applicant.displayName}</p>
                        <p>{item.zone.name}</p>
                        <p>提交于 {formatDateTime(item.createdAt)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <p>状态：{getBoardApplicationStatusLabel(item.status)}</p>
                        {item.reviewNote ? <p className="line-clamp-2">审核备注：{item.reviewNote}</p> : <p>暂无审核备注</p>}
                        {item.board ? <p className="text-emerald-700 dark:text-emerald-300">已创建 /boards/{item.board.slug} · 金库 {formatNumber(item.board.treasuryPoints)}</p> : null}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex justify-end">
                        <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => setApplicationModal(item)}>
                          {item.status === "PENDING" ? "审核" : "查看"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <BoardApplicationReviewModal
        key={applicationModal?.id ?? "board-application-modal"}
        application={applicationModal}
        zones={zones}
        onClose={() => setApplicationModal(null)}
      />
    </div>
  )
}

function getInitialBoardApplicationReviewState(application: BoardApplicationItem | null): BoardApplicationReviewFormState {
  return {
    zoneId: application?.zone.id ?? "",
    name: application?.name ?? "",
    slug: application?.slug ?? "",
    description: application?.description ?? "",
    icon: application?.icon ?? "💬",
    reason: application?.reason ?? "",
    reviewNote: application?.reviewNote ?? "",
  }
}

function BoardApplicationReviewModal({
  application,
  zones,
  onClose,
}: {
  application: BoardApplicationItem | null
  zones: ZoneItem[]
  onClose: () => void
}) {
  const router = useRouter()
  const [form, setForm] = useState<BoardApplicationReviewFormState>(() => getInitialBoardApplicationReviewState(application))
  const [isPending, startTransition] = useTransition()

  if (!application) {
    return null
  }

  const currentApplication = application

  function updateField<K extends keyof BoardApplicationReviewFormState>(field: K, value: BoardApplicationReviewFormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function runReviewAction(action: "update" | "approve" | "reject") {
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/board-applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: currentApplication.id,
            action,
            zoneId: form.zoneId,
            name: form.name,
            slug: form.slug,
            description: form.description,
            icon: form.icon,
            reason: form.reason,
            reviewNote: form.reviewNote,
          }),
        })
        const result = await response.json().catch(() => null) as { message?: string } | null

        if (!response.ok) {
          toast.error(result?.message ?? "处理节点申请失败", "节点申请")
          return
        }

        toast.success(result?.message ?? "节点申请已处理", "节点申请")
        router.refresh()
        onClose()
      } catch {
        toast.error("处理节点申请失败", "节点申请")
      }
    })
  }

  return (
    <FormModal
      open
      onClose={onClose}
      closeDisabled={isPending}
      closeOnEscape={!isPending}
      size="lg"
      title={currentApplication.status === "PENDING" ? "审核节点申请" : "查看节点申请"}
      description={`申请人 @${currentApplication.applicant.username}，提交于 ${formatDateTime(currentApplication.createdAt)}`}
      onSubmit={(event) => {
        event.preventDefault()
        runReviewAction("update")
      }}
      footer={({ formId }) => (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" form={formId} variant="outline" disabled={isPending}>
            {isPending ? "保存中..." : "保存修改"}
          </Button>
          {currentApplication.status === "PENDING" ? (
            <>
              <Button type="button" disabled={isPending} onClick={() => runReviewAction("approve")}>
                通过并创建节点
              </Button>
              <Button type="button" variant="outline" disabled={isPending} onClick={() => runReviewAction("reject")}>
                驳回申请
              </Button>
            </>
          ) : null}
          <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>
            关闭
          </Button>
        </div>
      )}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField label="所属分区" value={form.zoneId} onValueChange={(value) => updateField("zoneId", value)} options={zones.map((zone) => ({ value: zone.id, label: zone.name }))} />
        <Field label="节点名称" value={form.name} onChange={(value) => updateField("name", value)} placeholder="请输入节点名称" />
        <Field label="slug" value={form.slug} onChange={(value) => updateField("slug", value)} placeholder="例如 photography" />
        <Field label="图标" value={form.icon} onChange={(value) => updateField("icon", value)} placeholder="例如 📷" />
      </div>

      <TextAreaField label="节点描述" value={form.description} onChange={(value) => updateField("description", value)} placeholder="补充这个节点的定位和用途" rows={5} />

      <TextAreaField label="申请理由" value={form.reason} onChange={(value) => updateField("reason", value)} placeholder="申请人补充说明为什么需要这个节点" rows={5} />

      <TextAreaField label="审核备注" value={form.reviewNote} onChange={(value) => updateField("reviewNote", value)} placeholder="填写审核意见、补充说明或驳回原因" rows={4} />

      <div className="rounded-[18px] border border-border bg-background/70 px-4 py-3 text-xs text-muted-foreground">
        <p>申请人：@{currentApplication.applicant.username}（{currentApplication.applicant.displayName}）</p>
        <p className="mt-1">当前状态：{getBoardApplicationStatusLabel(currentApplication.status)}</p>
        {currentApplication.board ? <p className="mt-1">已创建节点：/boards/{currentApplication.board.slug} · 节点金库 {formatNumber(currentApplication.board.treasuryPoints)}</p> : null}
      </div>
    </FormModal>
  )
}

function getBoardApplicationStatusLabel(status: BoardApplicationItem["status"]) {
  if (status === "APPROVED") return "已通过"
  if (status === "REJECTED") return "已驳回"
  if (status === "CANCELLED") return "已取消"
  return "待审核"
}

function BoardApplicationStatusBadge({ status }: { status: BoardApplicationItem["status"] }) {
  const className = status === "APPROVED"
    ? "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
    : status === "REJECTED"
      ? "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"
      : status === "CANCELLED"
        ? "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200"
        : "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"

  return <Badge className={className}>{getBoardApplicationStatusLabel(status)}</Badge>
}
