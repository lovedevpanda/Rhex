"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { CornerDownRight, Plus, ShieldCheck, Sparkles } from "lucide-react"

import { AdminFormModal } from "@/components/admin-modal"
import { Button } from "@/components/ui/button"
import { showConfirm } from "@/components/ui/confirm-dialog"
import { toast } from "@/components/ui/toast"
import { formatNumber } from "@/lib/formatters"

interface BoardApplicationPanelProps {
  pointName: string
  currentUser: {
    id: number
    username: string
    displayName: string
    status: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  } | null
  zones: Array<{
    id: string
    name: string
    slug: string
  }>
  items: Array<{
    id: string
    name: string
    slug: string
    description: string
    icon: string
    reason: string
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
    reviewNote: string
    reviewedAt: string | null
    createdAt: string
    zone: {
      id: string
      name: string
      slug: string
    }
    board: {
      id: string
      name: string
      slug: string
      treasuryPoints: number
      canWithdrawTreasury: boolean
    } | null
  }>
  pendingCount: number
}

const INITIAL_FORM = {
  zoneId: "",
  name: "",
  slug: "",
  icon: "💬",
  description: "",
  reason: "",
}

export function BoardApplicationPanel({ pointName, currentUser, zones, items, pendingCount }: BoardApplicationPanelProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [withdrawingBoardId, setWithdrawingBoardId] = useState<string | null>(null)
  const [form, setForm] = useState(() => ({
    ...INITIAL_FORM,
    zoneId: zones[0]?.id ?? "",
  }))

  const canApply = currentUser?.status === "ACTIVE"
  const canSubmit = useMemo(
    () => Boolean(canApply && form.zoneId.trim() && form.name.trim() && !submitting),
    [canApply, form.name, form.zoneId, submitting],
  )

  function closeDialog() {
    if (submitting) {
      return
    }

    setOpen(false)
  }

  function updateField<K extends keyof typeof INITIAL_FORM>(key: K, value: (typeof INITIAL_FORM)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleWithdrawTreasury(board: NonNullable<(typeof items)[number]["board"]>) {
    if (withdrawingBoardId) {
      return
    }

    const confirmed = await showConfirm({
      title: "提取节点金库",
      description: `确认把 ${board.name} 当前节点金库中的 ${formatNumber(board.treasuryPoints)} ${pointName}全部提取到你的账户吗？系统会写入${pointName}日志。`,
      confirmText: "确认提取",
    })

    if (!confirmed) {
      return
    }

    setWithdrawingBoardId(board.id)

    try {
      const response = await fetch("/api/board-applications/treasury", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId: board.id }),
      })
      const result = await response.json().catch(() => null) as { message?: string } | null

      if (!response.ok) {
        toast.error(result?.message ?? "提取节点金库失败", "提取失败")
        return
      }

        toast.success(result?.message ?? `节点金库已提取到你的${pointName}账户`, "提取成功")
      router.refresh()
    } catch {
      toast.error("提取节点金库失败，请稍后重试", "提取失败")
    } finally {
      setWithdrawingBoardId(null)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch("/api/board-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const result = await response.json().catch(() => null) as { message?: string } | null

      if (!response.ok) {
        toast.error(result?.message ?? "节点申请提交失败", "提交失败")
        return
      }

      toast.success(result?.message ?? "节点申请已提交，待管理员审核", "提交成功")
      setForm({
        ...INITIAL_FORM,
        zoneId: zones[0]?.id ?? "",
      })
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("节点申请提交失败，请稍后重试", "提交失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <section className="rounded-[28px] border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              节点申请
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">申请新建节点</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              你可以提交新的节点提案。管理员审核通过后会自动创建节点，并把你设为该节点版主。
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-secondary/70 px-3 py-1">待审核 {pendingCount}</span>
              <span className="rounded-full bg-secondary/70 px-3 py-1">最近记录 {items.length}</span>
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[220px]">
            {currentUser ? (
              <Button type="button" onClick={() => setOpen(true)} disabled={!canApply || zones.length === 0} className="rounded-full px-5">
                <Plus className="mr-2 h-4 w-4" />
                申请新建节点
              </Button>
            ) : (
              <Link href="/login" className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                登录后申请
              </Link>
            )}
            {!currentUser ? (
              <p className="text-xs leading-6 text-muted-foreground">需要先登录账号，提交后进入管理员审核。</p>
            ) : currentUser.status !== "ACTIVE" ? (
              <p className="text-xs leading-6 text-rose-600">当前账号状态为 {renderUserStatus(currentUser.status)}，暂时不能提交节点申请。</p>
            ) : zones.length === 0 ? (
              <p className="text-xs leading-6 text-muted-foreground">当前还没有可挂载的分区，暂时不能提交申请。</p>
            ) : (
              <p className="text-xs leading-6 text-muted-foreground">当前账号：@{currentUser.username}{currentUser.displayName !== currentUser.username ? `（${currentUser.displayName}）` : ""}。slug 可留空，系统会根据节点名称自动生成。</p>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <InfoCard
            icon={<ShieldCheck className="h-4 w-4" />}
            title="审核后创建"
            description="管理员可以在通过前修改节点名称、slug、分区和描述。"
          />
          <InfoCard
            icon={<CornerDownRight className="h-4 w-4" />}
            title="通过即授予版主"
            description="审核通过后系统会把申请人绑定到该节点的版主管理范围。"
          />
          <InfoCard
            icon={<Sparkles className="h-4 w-4" />}
            title="避免重复提案"
            description="同名节点或同 slug 节点已存在时，系统会直接拦截提交。"
          />
        </div>

        <div className="mt-6 rounded-[24px] border border-border bg-background/70 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">我的申请记录</h3>
              <p className="mt-1 text-sm text-muted-foreground">这里只显示你最近提交的节点申请，便于查看审核状态。</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <article key={item.id} className="rounded-[22px] border border-border bg-card px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-sm font-semibold">{item.name}</span>
                      <BoardApplicationStatusBadge status={item.status} />
                      <span className="text-xs text-muted-foreground">{item.zone.name}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      /{item.slug} · 提交于 {formatDateTime(item.createdAt)}
                    </p>
                    {item.description ? <p className="mt-2 text-sm text-muted-foreground">{item.description}</p> : null}
                    {item.reason ? <p className="mt-2 text-sm text-muted-foreground">申请说明：{item.reason}</p> : null}
                    {item.reviewNote ? <p className="mt-2 text-sm text-muted-foreground">审核备注：{item.reviewNote}</p> : null}
                    {item.board ? <p className="mt-2 text-sm text-muted-foreground">节点金库：{formatNumber(item.board.treasuryPoints)}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {item.board ? (
                      <Link href={`/boards/${item.board.slug}`} className="inline-flex h-8 items-center justify-center rounded-full border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                        进入节点
                      </Link>
                    ) : null}
                    {item.board?.canWithdrawTreasury ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 rounded-full px-3 text-xs"
                        disabled={item.board.treasuryPoints <= 0 || withdrawingBoardId === item.board.id}
                        onClick={() => handleWithdrawTreasury(item.board!)}
                      >
                        {withdrawingBoardId === item.board.id ? "提取中..." : item.board.treasuryPoints > 0 ? "提取金库" : "金库为空"}
                      </Button>
                    ) : null}
                    {item.status !== "PENDING" && item.reviewedAt ? (
                      <span className="text-xs text-muted-foreground">处理于 {formatDateTime(item.reviewedAt)}</span>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
            {items.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                你还没有提交过节点申请。
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <AdminFormModal
        open={open}
        onClose={closeDialog}
        closeDisabled={submitting}
        closeOnEscape={!submitting}
        size="lg"
        title="申请新建节点"
        description="提交后进入管理员审核；审核通过后会自动创建节点，并把你设为该节点版主。"
        onSubmit={handleSubmit}
        formClassName="space-y-4"
        footer={({ formId }) => (
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={closeDialog} disabled={submitting} className="w-full sm:w-auto">
              取消
            </Button>
            <Button type="submit" form={formId} disabled={!canSubmit} className="w-full sm:w-auto">
              {submitting ? "提交中..." : "提交申请"}
            </Button>
          </div>
        )}
      >
        <Field label="所属分区" hint="选择这个节点要挂载到哪个分区下。">
          <select value={form.zoneId} onChange={(event) => updateField("zoneId", event.target.value)} className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-none">
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>{zone.name}</option>
            ))}
          </select>
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="节点名称" hint="例如 摄影、骑行、模型。">
            <input value={form.name} onChange={(event) => updateField("name", event.target.value)} className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-none" placeholder="请输入节点名称" maxLength={40} />
          </Field>
          <Field label="节点图标" hint="可输入 emoji，例如 📷。">
            <input value={form.icon} onChange={(event) => updateField("icon", event.target.value)} className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-none" placeholder="例如 💬" maxLength={20} />
          </Field>
        </div>

        <Field label="slug" hint="可留空，系统会根据节点名称自动生成；仅支持英文字母、数字和连字符。">
          <input value={form.slug} onChange={(event) => updateField("slug", event.target.value)} className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-none" placeholder="例如 photography" maxLength={60} />
        </Field>

        <Field label="节点描述" hint="简要说明这个节点讨论什么，方便管理员判断定位。">
          <textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} className="min-h-[110px] w-full rounded-[20px] border border-border bg-background px-4 py-3 text-sm outline-none" placeholder="补充节点定位、适合发布的内容类型和预期用途" maxLength={3000} />
        </Field>

        <Field label="申请理由" hint="说明为什么要建这个节点，以及你准备如何维护它。">
          <textarea value={form.reason} onChange={(event) => updateField("reason", event.target.value)} className="min-h-[120px] w-full rounded-[20px] border border-border bg-background px-4 py-3 text-sm outline-none" placeholder="例如已有稳定内容来源，愿意负责节点规则维护和日常整理" maxLength={2000} />
        </Field>
      </AdminFormModal>
    </>
  )
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <p className="text-xs leading-6 text-muted-foreground">{hint}</p>
      {children}
    </label>
  )
}

function InfoCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-[22px] border border-border bg-background/70 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

function BoardApplicationStatusBadge({ status }: { status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" }) {
  const className = status === "APPROVED"
    ? "rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] text-emerald-700"
    : status === "REJECTED"
      ? "rounded-full bg-rose-100 px-2.5 py-1 text-[11px] text-rose-700"
      : status === "CANCELLED"
        ? "rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-700"
        : "rounded-full bg-amber-100 px-2.5 py-1 text-[11px] text-amber-700"

  return <span className={className}>{renderBoardApplicationStatus(status)}</span>
}

function renderBoardApplicationStatus(status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED") {
  if (status === "APPROVED") return "已通过"
  if (status === "REJECTED") return "已驳回"
  if (status === "CANCELLED") return "已取消"
  return "待审核"
}

function renderUserStatus(status: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE") {
  if (status === "MUTED") return "禁言"
  if (status === "BANNED") return "封禁"
  if (status === "INACTIVE") return "未激活"
  return "正常"
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN")
}
