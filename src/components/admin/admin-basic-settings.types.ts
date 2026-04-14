import type { AdminSettingsSectionKey } from "@/lib/admin-navigation"
import type {
  AdminBasicSettingsDraft,
  AdminBasicSettingsInitialSettings,
} from "@/components/admin/admin-site-settings.shared"

export type { AdminBasicSettingsDraft } from "@/components/admin/admin-site-settings.shared"

export type AdminBasicSettingsMode =
  | "profile"
  | "registration"
  | "interaction"
  | "board-applications"

export interface AdminBasicSettingsInviteCodeItem {
  id: string
  code: string
  createdAt: string
  createdByUsername: string | null
  usedAt: string | null
  usedByUsername: string | null
  note: string | null
}

export interface AdminBasicSettingsFormProps {
  initialSettings: AdminBasicSettingsInitialSettings
  mode?: AdminBasicSettingsMode
  initialSubTab?: string
  subTabRouteSection?: AdminSettingsSectionKey
  initialInviteCodes?: AdminBasicSettingsInviteCodeItem[]
}

export type UpdateAdminBasicSettingsDraftField = <Key extends keyof AdminBasicSettingsDraft>(
  field: Key,
  value: AdminBasicSettingsDraft[Key],
) => void

interface AdminBasicSettingsModeProps {
  activeSubTab: string
  draft: AdminBasicSettingsDraft
  updateDraftField: UpdateAdminBasicSettingsDraftField
}

export interface AdminProfileSettingsFormProps
  extends AdminBasicSettingsModeProps {}

export interface AdminRegistrationSettingsFormProps
  extends AdminBasicSettingsModeProps {
  initialInviteCodes: AdminBasicSettingsInviteCodeItem[]
}

export interface AdminInteractionSettingsFormProps
  extends AdminBasicSettingsModeProps {}

export interface AdminBoardApplicationSettingsFormProps
  extends AdminBasicSettingsModeProps {}
