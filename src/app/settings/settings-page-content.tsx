import type { ReactNode } from "react"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import type { AddonSlotKey } from "@/addons-host"
import type { SettingsPageData } from "@/app/settings/settings-page-loader"
import { BadgesSettingsSection } from "@/app/settings/sections/badges-settings-section"
import { BoardApplicationsSettingsSection } from "@/app/settings/sections/board-applications-settings-section"
import { FollowsSettingsSection } from "@/app/settings/sections/follows-settings-section"
import { InviteSettingsSection } from "@/app/settings/sections/invite-settings-section"
import { LevelSettingsSection } from "@/app/settings/sections/level-settings-section"
import { PointsSettingsSection } from "@/app/settings/sections/points-settings-section"
import { PostManagementSettingsSection } from "@/app/settings/sections/post-management-settings-section"
import { ProfileSettingsSection } from "@/app/settings/sections/profile-settings-section"
import { VerificationsSettingsSection } from "@/app/settings/sections/verifications-settings-section"

type SettingsSectionSlotBase =
  | "settings.profile"
  | "settings.invite"
  | "settings.post-management"
  | "settings.board-applications"
  | "settings.level"
  | "settings.badges"
  | "settings.verifications"
  | "settings.points"
  | "settings.follows"

function renderSectionWithSlots(
  slotBase: SettingsSectionSlotBase,
  content: ReactNode,
  data: SettingsPageData,
) {
  const beforeSlot = `${slotBase}.before` as AddonSlotKey
  const afterSlot = `${slotBase}.after` as AddonSlotKey

  return (
    <>
      <AddonSlotRenderer slot={beforeSlot} />
      <AddonSurfaceRenderer surface={slotBase} props={{ data }}>
        {content}
      </AddonSurfaceRenderer>
      <AddonSlotRenderer slot={afterSlot} />
    </>
  )
}

export function SettingsPageContent({ data }: { data: SettingsPageData }) {
  switch (data.route.currentTab) {
    case "profile":
      return renderSectionWithSlots("settings.profile", <ProfileSettingsSection data={data} />, data)
    case "invite":
      return renderSectionWithSlots("settings.invite", <InviteSettingsSection data={data} />, data)
    case "post-management":
      return renderSectionWithSlots("settings.post-management", <PostManagementSettingsSection data={data} />, data)
    case "board-applications":
      return renderSectionWithSlots("settings.board-applications", <BoardApplicationsSettingsSection data={data} />, data)
    case "level":
      return renderSectionWithSlots("settings.level", <LevelSettingsSection data={data} />, data)
    case "badges":
      return renderSectionWithSlots("settings.badges", <BadgesSettingsSection data={data} />, data)
    case "verifications":
      return renderSectionWithSlots("settings.verifications", <VerificationsSettingsSection data={data} />, data)
    case "points":
      return renderSectionWithSlots("settings.points", <PointsSettingsSection data={data} />, data)
    case "follows":
      return renderSectionWithSlots("settings.follows", <FollowsSettingsSection data={data} />, data)
    default:
      return null
  }
}
