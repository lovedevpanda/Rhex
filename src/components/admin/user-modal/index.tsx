"use client"

import { useMemo, useState } from "react"
import { Loader2, MoreHorizontal } from "lucide-react"

import { ActivityTab } from "@/components/admin/user-modal/tabs/ActivityTab"
import { ActionsTab } from "@/components/admin/user-modal/tabs/ActionsTab"
import { PermissionsTab } from "@/components/admin/user-modal/tabs/PermissionsTab"
import { ProfileTab } from "@/components/admin/user-modal/tabs/ProfileTab"
import { useUserActions } from "@/components/admin/user-modal/hooks/use-user-actions"
import { useUserData } from "@/components/admin/user-modal/hooks/use-user-data"
import { UserInfoGrid } from "@/components/admin/user-modal/components/UserInfo"
import {
  ADMIN_USER_MODAL_TABS,
  getAdminUserModalTabLabel,
  type AdminUserModalProps,
  type AdminUserModalTab,
} from "@/components/admin/user-modal/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Modal } from "@/components/ui/modal"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDateTime } from "@/lib/formatters"

export function AdminUserModal(props: AdminUserModalProps) {
  const [open, setOpen] = useState(false)
  const [initialTab, setInitialTab] = useState<AdminUserModalTab>("profile")

  function openPanel(tab: AdminUserModalTab) {
    setInitialTab(tab)
    setOpen(true)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="h-7 rounded-full border border-border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted">
          管理
          <MoreHorizontal className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          {ADMIN_USER_MODAL_TABS.map((panel) => (
            <DropdownMenuItem key={panel.key} onClick={() => openPanel(panel.key)}>
              {panel.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {open ? <AdminUserModalDialog {...props} open={open} initialTab={initialTab} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function AdminUserModalDialog({
  user,
  moderatorScopeOptions,
  open,
  initialTab,
  onClose,
}: AdminUserModalProps & {
  open: boolean
  initialTab: AdminUserModalTab
  onClose: () => void
}) {
  const data = useUserData({
    user,
    initialTab,
  })
  const actions = useUserActions({
    user,
    detail: data.detail,
    refreshData: data.refreshData,
  })

  const headerMetrics = useMemo(() => [
    { label: "角色", value: data.activeUser.role },
    { label: "状态", value: data.activeUser.status },
    { label: "等级 / VIP", value: data.vipActive ? `Lv.${data.activeUser.level} · VIP${data.activeUser.vipLevel}` : `Lv.${data.activeUser.level} · 非 VIP` },
    { label: "最近登录", value: data.activeUser.lastLoginAt ? formatDateTime(data.activeUser.lastLoginAt) : "从未登录" },
  ], [data.activeUser, data.vipActive])

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={`${data.activeUser.displayName}  @${data.activeUser.username}  UID ${data.activeUser.id}  ${getAdminUserModalTabLabel(data.activeTab)}`}
      description={`角色 ${data.activeUser.role} · 状态 ${data.activeUser.status} · ${data.vipActive ? `VIP${data.activeUser.vipLevel}` : "非 VIP"}`}
      footer={(
        <div className="flex items-center justify-end">
          <Button type="button" variant="ghost" className="h-8 px-3 text-xs" onClick={onClose}>
            关闭
          </Button>
        </div>
      )}
    >
      {data.isLoadingDetail && !data.detail ? (
        <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-border bg-secondary/20">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>加载用户详情中...</span>
          </div>
        </div>
      ) : data.detailError ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50/70 p-5 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
          <p>{data.detailError}</p>
          <Button type="button" variant="outline" className="mt-3 h-8 rounded-full px-3 text-xs" onClick={data.reloadDetail}>
            重试
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Tabs value={data.activeTab} onValueChange={(value) => data.setActiveTab(value as AdminUserModalTab)} className="w-full flex-col">
            <TabsList className="self-start">
              {ADMIN_USER_MODAL_TABS.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {data.activeTab === "profile" ? (
              <div className="mt-4">
                <UserInfoGrid items={data.metrics} columnsClassName="sm:grid-cols-2 xl:grid-cols-3" />
              </div>
            ) : (
              <div className="mt-4">
                <UserInfoGrid items={headerMetrics} compact columnsClassName="sm:grid-cols-2 xl:grid-cols-4" />
              </div>
            )}
            <TabsContent value="profile" className="mt-4">
              <ProfileTab profile={actions.profile} isPending={actions.isPending} />
            </TabsContent>
            <TabsContent value="activity" className="mt-4">
              <ActivityTab detail={data.detail} />
            </TabsContent>
            <TabsContent value="permissions" className="mt-4">
              <PermissionsTab
                activeUser={data.activeUser}
                moderatorScopeOptions={moderatorScopeOptions}
                isModerator={data.isModerator}
                permissions={actions.permissions}
                isPending={actions.isPending}
              />
            </TabsContent>
            <TabsContent value="actions" className="mt-4">
              <ActionsTab
                activeUser={data.activeUser}
                vipActive={data.vipActive}
                detail={data.detail}
                grantableBadges={data.grantableBadges}
                account={actions.account}
                operations={actions.operations}
                isPending={actions.isPending}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </Modal>
  )
}
