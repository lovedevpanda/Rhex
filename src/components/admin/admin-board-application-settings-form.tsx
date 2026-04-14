"use client"

import { AdminBooleanSelectField } from "@/components/admin/admin-settings-fields"
import type { AdminBoardApplicationSettingsFormProps } from "@/components/admin/admin-basic-settings.types"

export function AdminBoardApplicationSettingsForm({
  activeSubTab,
  draft,
  updateDraftField,
}: AdminBoardApplicationSettingsFormProps) {
  if (activeSubTab !== "general") {
    return null
  }

  return (
    <div className="rounded-[24px] border border-border p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">节点申请</h3>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          单独控制前台是否展示节点申请入口，以及是否允许用户提交新申请。
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminBooleanSelectField
          label="开启节点申请"
          checked={draft.boardApplicationEnabled}
          onChange={(value) => updateDraftField("boardApplicationEnabled", value)}
        />
      </div>
      <p className="text-xs leading-6 text-muted-foreground">
        关闭后，前台设置导航会隐藏“节点申请”，直接访问对应页面也会被拦回个人资料页，同时新建申请接口会拒绝提交。
      </p>
    </div>
  )
}
