"use client"

import type { AdminUserListResult } from "@/lib/admin-user-management"

import { ActionButtons } from "@/components/admin/user-modal/components/ActionButtons"
import { TextAreaField } from "@/components/admin/user-modal/components/FormFields"
import { PermissionEditor } from "@/components/admin/user-modal/components/PermissionEditor"
import { UserInfoGrid } from "@/components/admin/user-modal/components/UserInfo"
import type { UserActionsState } from "@/components/admin/user-modal/hooks/use-user-actions"
import { Button } from "@/components/ui/button"

export function PermissionsTab({
  activeUser,
  moderatorScopeOptions,
  isModerator,
  permissions,
  isPending,
}: {
  activeUser: {
    username: string
    role: string
  }
  moderatorScopeOptions: AdminUserListResult["moderatorScopeOptions"]
  isModerator: boolean
  permissions: UserActionsState["permissions"]
  isPending: boolean
}) {
  const canPromoteModerator = activeUser.role === "USER"
  const canSetAdmin = activeUser.role !== "ADMIN"
  const canDemote = activeUser.role !== "USER"

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[20px] border border-border p-4">
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-semibold">权限身份</h4>
          <p className="text-xs text-muted-foreground">提权、降权和版主管辖范围配置集中在这里。</p>
        </div>
        <div className="mt-4">
          <UserInfoGrid
            compact
            columnsClassName="sm:grid-cols-2 xl:grid-cols-3"
            items={[
              { label: "当前角色", value: activeUser.role },
              { label: "分区授权", value: `${permissions.state.zoneScopes.length} 个` },
              { label: "节点授权", value: `${permissions.state.boardScopes.length} 个` },
            ]}
          />
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <TextAreaField label="操作备注" value={permissions.state.message} onChange={permissions.setMessage} placeholder="记录提权、降权或权限调整原因" rows={4} />
          <ActionButtons
            items={[
              {
                key: "promote-moderator",
                label: isPending ? "处理中..." : "设为版主",
                hidden: !canPromoteModerator,
                disabled: isPending,
                onClick: () => permissions.runPermissionAction("user.promoteModerator"),
              },
              {
                key: "set-admin",
                label: isPending ? "处理中..." : "设为管理员",
                hidden: !canSetAdmin,
                disabled: isPending,
                onClick: () => permissions.runPermissionAction("user.setAdmin", `确认将 @${activeUser.username} 提升为管理员吗？`),
              },
              {
                key: "demote",
                label: isPending ? "处理中..." : "降为普通用户",
                hidden: !canDemote,
                disabled: isPending,
                onClick: () => permissions.runPermissionAction("user.demoteToUser", `确认将 @${activeUser.username} 降为普通用户吗？`),
              },
            ]}
          />
          {permissions.state.feedback ? <p className="text-xs text-muted-foreground">{permissions.state.feedback}</p> : null}
        </div>
      </section>

      {isModerator && moderatorScopeOptions ? (
        <section className="rounded-[20px] border border-border p-4">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold">版主管辖范围</h4>
            <p className="text-xs text-muted-foreground">分区授权自动覆盖分区下全部节点；“可改设置”控制结构编辑，“可提金库”控制节点金库提取权限。</p>
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <PermissionEditor
              title="分区授权"
              items={moderatorScopeOptions.zones.map((zone) => ({
                id: zone.id,
                label: zone.name,
                description: `/${zone.slug}`,
              }))}
              activeScopes={permissions.state.zoneScopes}
              onToggle={permissions.toggleZoneScope}
              onToggleEdit={permissions.toggleZoneScopeEdit}
              onToggleWithdraw={permissions.toggleZoneScopeWithdraw}
            />
            <PermissionEditor
              title="节点授权"
              items={moderatorScopeOptions.boards.map((board) => ({
                id: board.id,
                label: board.name,
                description: `${board.zoneName ? `${board.zoneName} / ` : ""}/${board.slug}`,
              }))}
              activeScopes={permissions.state.boardScopes}
              onToggle={permissions.toggleBoardScope}
              onToggleEdit={permissions.toggleBoardScopeEdit}
              onToggleWithdraw={permissions.toggleBoardScopeWithdraw}
            />
            {permissions.state.scopeFeedback ? <p className="text-xs text-muted-foreground">{permissions.state.scopeFeedback}</p> : null}
            <Button type="button" disabled={isPending} className="h-9 rounded-full px-4 text-xs" onClick={permissions.saveModeratorScopes}>
              {isPending ? "保存中..." : "保存版主管辖范围"}
            </Button>
          </div>
        </section>
      ) : (
        <section className="rounded-[20px] border border-dashed border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
          当前用户不是版主，无需配置版主管辖范围。
        </section>
      )}
    </div>
  )
}
