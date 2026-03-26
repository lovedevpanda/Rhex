"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"

import { AdminModal } from "@/components/admin-modal"
import { Button } from "@/components/ui/button"
import type { AdminUserListItem } from "@/lib/admin-user-management"
import { formatDateTime } from "@/lib/formatters"
import { isVipActive } from "@/lib/vip-status"

interface AdminUserModalProps {
  user: AdminUserListItem
}

export function AdminUserModal({ user }: AdminUserModalProps) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [points, setPoints] = useState(String(user.points))
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const vipActive = isVipActive({ vipLevel: user.vipLevel, vipExpiresAt: user.vipExpiresAt })

  const metrics = useMemo(
    () => [
      { label: "角色", value: user.role },
      { label: "状态", value: user.status },
      { label: "等级", value: `Lv.${user.level}` },
      { label: "积分", value: String(user.points) },
      { label: "发帖", value: String(user.postCount) },
      { label: "评论", value: String(user.commentCount) },
      { label: "获赞", value: String(user.likeReceivedCount) },
      { label: "收藏", value: String(user.favoriteCount) },
      { label: "签到天数", value: String(user.checkInDays) },
      { label: "邀请数", value: String(user.inviteCount) },
      { label: "邮箱", value: user.email ?? "-" },
      { label: "手机", value: user.phone ?? "-" },
      { label: "注册时间", value: formatDateTime(user.createdAt) },
      { label: "最近登录", value: user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "-" },
      { label: "登录 IP", value: user.lastLoginIp ?? "-" },
      { label: "VIP", value: vipActive ? `VIP${user.vipLevel}` : "非 VIP" },
      { label: "VIP 到期", value: user.vipExpiresAt ? formatDateTime(user.vipExpiresAt) : "长期 / 无" },
    ],
    [user, vipActive],
  )

  function submit(action: "user.points.adjust" | "user.profile.note") {
    startTransition(async () => {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          targetId: String(user.id),
          message,
          points: Number(points) || 0,
        }),
      })

      if (response.ok) {
        router.refresh()
      }
    })
  }

  return (
    <>
      <Button type="button" variant="outline" className="h-7 rounded-full px-2.5 text-xs" onClick={() => setOpen(true)}>
        详情
      </Button>
      <AdminModal
        open={open}
        onClose={() => setOpen(false)}
        size="xl"
        title={`${user.displayName} · @${user.username}`}
        description={`角色 ${user.role} · 状态 ${user.status} · ${vipActive ? `VIP${user.vipLevel}` : "非 VIP"}`}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" className="h-8 px-3 text-xs" onClick={() => setOpen(false)}>
                关闭
              </Button>
            </div>
          </div>
        }
      >
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((item) => (
                <Info key={item.label} label={item.label} value={item.value} compact />
              ))}
            </div>
            <div className="rounded-[20px] border border-border bg-secondary/40 p-4 text-sm leading-7 text-muted-foreground">
              {user.bio || "这个用户还没有填写个人简介。"}
            </div>
            <div className="rounded-[20px] border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold">最近登录记录</h4>
                <span className="text-xs text-muted-foreground">最近 10 条</span>
              </div>
              <div className="mt-3 space-y-2">
                {user.loginLogs.length === 0 ? <p className="text-sm text-muted-foreground">暂无登录记录</p> : null}
                {user.loginLogs.map((log) => (
                  <div key={log.id} className="grid gap-2 rounded-[16px] border border-border px-3 py-2 text-xs text-muted-foreground md:grid-cols-[160px_120px_minmax(0,1fr)]">
                    <span>{formatDateTime(log.createdAt)}</span>
                    <span>IP：{log.ip ?? "-"}</span>
                    <span className="truncate">{log.userAgent ?? "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[20px] border border-border p-4">
              <h4 className="text-sm font-semibold">积分校正</h4>
              <div className="mt-3 space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">积分值</span>
                  <input value={points} onChange={(event) => setPoints(event.target.value)} className="h-10 w-full rounded-full border border-border bg-background px-3 text-sm outline-none" />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">操作备注</span>
                  <textarea value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-[88px] w-full rounded-[20px] border border-border bg-background px-3 py-2 text-sm outline-none" placeholder="记录调整原因、工单号或审核说明" />
                </label>
                <Button type="button" disabled={isPending} className="h-9 rounded-full px-4 text-xs" onClick={() => submit("user.points.adjust")}>
                  {isPending ? "保存中..." : "保存积分"}
                </Button>
              </div>
            </div>
            <div className="rounded-[20px] border border-border p-4">
              <h4 className="text-sm font-semibold">管理员备注</h4>
              <p className="mt-1 text-xs text-muted-foreground">写入后台日志，便于追踪操作上下文。</p>
              <Button type="button" variant="outline" disabled={isPending} className="mt-3 h-9 rounded-full px-4 text-xs" onClick={() => submit("user.profile.note")}>
                {isPending ? "记录中..." : "保存备注"}
              </Button>
            </div>
          </div>
        </div>
      </AdminModal>
    </>
  )
}

function Info({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={compact ? "rounded-[16px] border border-border px-3 py-2" : "rounded-[18px] border border-border p-4"}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium break-all">{value}</p>
    </div>
  )
}
