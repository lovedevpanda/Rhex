"use client"

import type { AdminUserDetailResult, AdminUserListItem } from "@/lib/admin-user-management"
import { formatDateTime } from "@/lib/formatters"
import { CONFIGURABLE_VIP_LEVELS } from "@/lib/vip-status"

import { ActionButtons } from "@/components/admin/user-modal/components/ActionButtons"
import { Field, SelectField, TextAreaField } from "@/components/admin/user-modal/components/FormFields"
import { UserInfoGrid } from "@/components/admin/user-modal/components/UserInfo"
import type { UserActionsState } from "@/components/admin/user-modal/hooks/use-user-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const VIP_LEVEL_OPTIONS = CONFIGURABLE_VIP_LEVELS.map((level) => ({
  value: String(level),
  label: `VIP${level}`,
}))

const EMPTY_BADGE_SELECT_VALUE = "__empty_badge__"

export function ActionsTab({
  activeUser,
  vipActive,
  detail,
  grantableBadges,
  account,
  operations,
  isPending,
}: {
  activeUser: AdminUserDetailResult | AdminUserListItem
  vipActive: boolean
  detail: AdminUserDetailResult | null
  grantableBadges: AdminUserDetailResult["availableBadges"]
  account: UserActionsState["account"]
  operations: UserActionsState["operations"]
  isPending: boolean
}) {
  const canMute = activeUser.status === "ACTIVE"
  const canActivate = activeUser.status !== "ACTIVE"
  const activateLabel = activeUser.status === "BANNED" ? "解除拉黑" : "恢复状态"

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-[20px] border border-border p-4">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold">账号状态</h4>
            <p className="text-xs text-muted-foreground">禁言、恢复、拉黑等状态操作集中在这里，备注会进入后台日志。</p>
          </div>
          <div className="mt-4">
            <UserInfoGrid
              compact
              columnsClassName="sm:grid-cols-3"
              items={[
                { label: "当前状态", value: activeUser.status },
                { label: "注册时间", value: formatDateTime(activeUser.createdAt) },
                { label: "最近登录", value: activeUser.lastLoginAt ? formatDateTime(activeUser.lastLoginAt) : "从未登录" },
              ]}
            />
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <TextAreaField label="操作备注" value={account.state.statusMessage} onChange={account.setStatusMessage} placeholder="记录禁言、恢复或拉黑原因" rows={4} />
            <ActionButtons
              items={[
                {
                  key: "mute",
                  label: isPending ? "处理中..." : "禁言",
                  hidden: !canMute,
                  disabled: isPending,
                  onClick: () => account.runStatusAction("user.mute"),
                },
                {
                  key: "activate",
                  label: isPending ? "处理中..." : activateLabel,
                  hidden: !canActivate,
                  disabled: isPending,
                  onClick: () => account.runStatusAction("user.activate"),
                },
                {
                  key: "ban",
                  label: isPending ? "处理中..." : "拉黑",
                  hidden: activeUser.status === "BANNED",
                  disabled: isPending,
                  onClick: () => account.runStatusAction("user.ban", `确认拉黑 @${activeUser.username} 吗？`),
                  className: "h-8 rounded-full bg-red-600 px-3 text-xs text-white hover:bg-red-500",
                },
              ]}
            />
            {account.state.statusFeedback ? <p className="text-xs text-muted-foreground">{account.state.statusFeedback}</p> : null}
          </div>
        </section>

        <section className="rounded-[20px] border border-border p-4">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold">重置密码</h4>
            <p className="text-xs text-muted-foreground">用于人工核验后的账号找回或安全处置。</p>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <Field type="password" label="新密码" value={account.state.newPassword} onChange={account.setNewPassword} placeholder="请输入 6-64 位新密码" />
            <Field type="password" label="确认新密码" value={account.state.confirmPassword} onChange={account.setConfirmPassword} placeholder="请再次输入新密码" />
            <TextAreaField label="操作备注" value={account.state.passwordMessage} onChange={account.setPasswordMessage} placeholder="记录重置原因、工单号或核验说明" rows={4} />
            {account.state.passwordFeedback ? <p className="text-xs text-muted-foreground">{account.state.passwordFeedback}</p> : null}
            <Button type="button" variant="outline" disabled={isPending} className="h-8 rounded-full px-3 text-xs" onClick={account.savePassword}>
              {isPending ? "保存中..." : "确认修改密码"}
            </Button>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-[20px] border border-border p-4">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold">积分校正</h4>
            <p className="text-xs text-muted-foreground">支持手动修正积分，并记录发放或扣减原因。</p>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <Field label="积分值" value={operations.state.points} onChange={operations.setPoints} />
            <TextAreaField label="操作备注" value={operations.state.pointsMessage} onChange={operations.setPointsMessage} placeholder="记录调整原因、工单号或审核说明" rows={4} />
            {operations.state.pointsFeedback ? <p className="text-xs text-muted-foreground">{operations.state.pointsFeedback}</p> : null}
            <Button type="button" disabled={isPending} className="h-9 rounded-full px-4 text-xs" onClick={operations.savePoints}>
              {isPending ? "保存中..." : "保存积分"}
            </Button>
          </div>
        </section>

        <section className="rounded-[20px] border border-border p-4">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold">VIP 配置</h4>
            <p className="text-xs text-muted-foreground">支持人工开通、续期或修正 VIP 到期时间。</p>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <UserInfoGrid compact columnsClassName="sm:grid-cols-2" items={[{ label: "当前 VIP", value: vipActive ? `VIP${activeUser.vipLevel}` : "非 VIP" }, { label: "到期时间", value: activeUser.vipExpiresAt ? formatDateTime(activeUser.vipExpiresAt) : "长期 / 无" }]} />
            <SelectField label="VIP 等级" value={operations.state.vipLevelDraft} onValueChange={operations.setVipLevelDraft} options={VIP_LEVEL_OPTIONS} />
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">到期时间</span>
              <Input
                type="datetime-local"
                value={operations.state.vipExpiresAtDraft}
                onChange={(event) => operations.setVipExpiresAtDraft(event.target.value)}
                className="h-10 rounded-full bg-background"
              />
            </label>
            <TextAreaField label="操作备注" value={operations.state.vipMessage} onChange={operations.setVipMessage} placeholder="记录套餐来源、补偿原因或工单号" rows={4} />
            {operations.state.vipFeedback ? <p className="text-xs text-muted-foreground">{operations.state.vipFeedback}</p> : null}
            <Button type="button" disabled={isPending} className="h-8 rounded-full px-3 text-xs" onClick={operations.saveVip}>
              {isPending ? "保存中..." : "保存 VIP 设置"}
            </Button>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-[20px] border border-border p-4">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold">手动颁发勋章</h4>
            <p className="text-xs text-muted-foreground">可按用户当前持有情况筛掉重复勋章，并在发放后发通知。</p>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <SelectField
              label="选择勋章"
              value={operations.state.badgeId || EMPTY_BADGE_SELECT_VALUE}
              onValueChange={(value) => operations.setBadgeId(value === EMPTY_BADGE_SELECT_VALUE ? "" : value)}
              options={[
                { value: EMPTY_BADGE_SELECT_VALUE, label: "请选择勋章" },
                ...grantableBadges.map((item) => ({
                  value: item.id,
                  label: `${item.name}${item.category ? ` · ${item.category}` : ""}${!item.status ? " · 已停用" : ""}${item.isHidden ? " · 隐藏" : ""}`,
                })),
              ]}
            />
            <TextAreaField label="操作备注" value={operations.state.badgeMessage} onChange={operations.setBadgeMessage} placeholder="记录发放理由、活动来源或补发说明" rows={4} />
            {detail?.grantedBadges.length ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">已持有勋章</p>
                <div className="flex flex-wrap gap-1.5">
                  {detail.grantedBadges.map((item) => (
                    <span key={`${item.badgeId}-${item.grantedAt}`} className="rounded-full border border-border px-2.5 py-1 text-[11px]" style={{ color: item.color, borderColor: `${item.color}55`, backgroundColor: `${item.color}12` }}>
                      {item.name}
                      {item.isDisplayed ? ` · 展示第 ${item.displayOrder || 1} 位` : ""}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {operations.state.badgeFeedback ? <p className="text-xs text-muted-foreground">{operations.state.badgeFeedback}</p> : null}
            <Button type="button" variant="outline" disabled={isPending || grantableBadges.length === 0} className="h-8 rounded-full px-3 text-xs" onClick={operations.grantBadge}>
              {isPending ? "处理中..." : grantableBadges.length === 0 ? "无可颁发勋章" : "颁发勋章"}
            </Button>
          </div>
        </section>

        <section className="rounded-[20px] border border-border p-4">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold">手动发送通知</h4>
            <p className="text-xs text-muted-foreground">用于人工补发说明、活动通知或申诉处理结果通知。</p>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <Field label="通知标题" value={operations.state.notificationTitle} onChange={operations.setNotificationTitle} placeholder="如 资料申诉已通过" />
            <TextAreaField label="通知内容" value={operations.state.notificationContent} onChange={operations.setNotificationContent} placeholder="填写要发给用户的通知正文" rows={4} />
            <TextAreaField label="操作备注" value={operations.state.notificationMessage} onChange={operations.setNotificationMessage} placeholder="记录通知背景、工单号或内部说明" rows={4} />
            {operations.state.notificationFeedback ? <p className="text-xs text-muted-foreground">{operations.state.notificationFeedback}</p> : null}
            <Button type="button" variant="outline" disabled={isPending} className="h-8 rounded-full px-3 text-xs" onClick={operations.sendNotification}>
              {isPending ? "发送中..." : "发送通知"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
