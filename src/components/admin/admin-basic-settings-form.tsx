"use client"

import { useEffect, useState } from "react"

import { AdminBoardApplicationSettingsForm } from "@/components/admin/admin-board-application-settings-form"
import {
  INTERNAL_SETTING_TABS,
  resolveInternalSettingTab,
} from "@/components/admin/admin-basic-settings.constants"
import type {
  UpdateAdminBasicSettingsDraftField,
  AdminBasicSettingsDraft,
  AdminBasicSettingsFormProps,
  AdminBasicSettingsMode,
} from "@/components/admin/admin-basic-settings.types"
import { AdminInteractionSettingsForm } from "@/components/admin/admin-interaction-settings-form"
import { AdminProfileSettingsForm } from "@/components/admin/admin-profile-settings-form"
import { AdminRegistrationSettingsForm } from "@/components/admin/admin-registration-settings-form"
import { AdminSettingsSubTabs } from "@/components/admin/admin-settings-sub-tabs"
import {
  buildAdminBasicSettingsPayload,
  createAdminBasicSettingsDraft,
} from "@/components/admin/admin-site-settings.shared"
import { Button } from "@/components/ui/rbutton"
import { useAdminMutation } from "@/hooks/use-admin-mutation"
import { adminPost } from "@/lib/admin-client"

export function AdminBasicSettingsForm({
  initialSettings,
  mode = "profile",
  initialSubTab,
  subTabRouteSection,
  initialInviteCodes = [],
}: AdminBasicSettingsFormProps) {
  const [draft, setDraft] = useState(() => createAdminBasicSettingsDraft(initialSettings))
  const [activeSubTab, setActiveSubTab] = useState(() =>
    resolveInternalSettingTab(mode, initialSubTab),
  )
  const { isPending, runMutation } = useAdminMutation()
  const { isPending: isClearingCache, runMutation: runCacheMutation } =
    useAdminMutation()

  useEffect(() => {
    setActiveSubTab(resolveInternalSettingTab(mode, initialSubTab))
  }, [initialSubTab, mode])

  const updateDraftField: UpdateAdminBasicSettingsDraftField = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  const submitText =
    mode === "profile"
      ? "保存基础信息"
      : mode === "registration"
        ? "保存注册与邀请"
        : mode === "board-applications"
          ? "保存节点申请设置"
          : "保存互动与热度"

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        runMutation({
          mutation: () =>
            adminPost(
              "/api/admin/site-settings",
              buildAdminBasicSettingsPayload(draft, mode),
              {
                defaultSuccessMessage: "保存成功",
                defaultErrorMessage: "保存失败",
              },
            ),
          successTitle: "保存成功",
          errorTitle: "保存失败",
          refreshRouter: true,
        })
      }}
    >
      <div className="rounded-[24px] space-y-4">
        {INTERNAL_SETTING_TABS[mode].length > 1 && !subTabRouteSection ? (
          <AdminSettingsSubTabs
            items={INTERNAL_SETTING_TABS[mode].map((tab) => ({
              key: tab.key,
              label: tab.label,
              onSelect: () => setActiveSubTab(tab.key),
            }))}
            activeKey={activeSubTab}
          />
        ) : null}
      </div>

      <ModeSection
        mode={mode}
        activeSubTab={activeSubTab}
        draft={draft}
        updateDraftField={updateDraftField}
        initialInviteCodes={initialInviteCodes}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "保存中..." : submitText}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isClearingCache}
          onClick={() => {
            runCacheMutation({
              mutation: () =>
                adminPost("/api/admin/site-settings/cache", undefined, {
                  defaultSuccessMessage: "站点设置缓存已清除",
                  defaultErrorMessage: "清除缓存失败",
                }),
              successTitle: "缓存已清除",
              errorTitle: "清除失败",
              refreshRouter: true,
            })
          }}
        >
          {isClearingCache ? "清理中..." : "清除站点设置缓存"}
        </Button>
        <span className="text-xs leading-6 text-muted-foreground">
          用于强制刷新站点设置的缓存；
        </span>
      </div>
    </form>
  )
}

function ModeSection({
  mode,
  activeSubTab,
  draft,
  updateDraftField,
  initialInviteCodes,
}: {
  mode: AdminBasicSettingsMode
  activeSubTab: string
  draft: AdminBasicSettingsDraft
  updateDraftField: UpdateAdminBasicSettingsDraftField
  initialInviteCodes: AdminBasicSettingsFormProps["initialInviteCodes"]
}) {
  if (mode === "profile") {
    return (
      <AdminProfileSettingsForm
        activeSubTab={activeSubTab}
        draft={draft}
        updateDraftField={updateDraftField}
      />
    )
  }

  if (mode === "registration") {
    return (
      <AdminRegistrationSettingsForm
        activeSubTab={activeSubTab}
        draft={draft}
        updateDraftField={updateDraftField}
        initialInviteCodes={initialInviteCodes ?? []}
      />
    )
  }

  if (mode === "board-applications") {
    return (
      <AdminBoardApplicationSettingsForm
        activeSubTab={activeSubTab}
        draft={draft}
        updateDraftField={updateDraftField}
      />
    )
  }

  return (
    <AdminInteractionSettingsForm
      activeSubTab={activeSubTab}
      draft={draft}
      updateDraftField={updateDraftField}
    />
  )
}
