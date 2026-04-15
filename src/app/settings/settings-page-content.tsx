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

export function SettingsPageContent({ data }: { data: SettingsPageData }) {
  switch (data.route.currentTab) {
    case "profile":
      return <ProfileSettingsSection data={data} />
    case "invite":
      return <InviteSettingsSection data={data} />
    case "post-management":
      return <PostManagementSettingsSection data={data} />
    case "board-applications":
      return <BoardApplicationsSettingsSection data={data} />
    case "level":
      return <LevelSettingsSection data={data} />
    case "badges":
      return <BadgesSettingsSection data={data} />
    case "verifications":
      return <VerificationsSettingsSection data={data} />
    case "points":
      return <PointsSettingsSection data={data} />
    case "follows":
      return <FollowsSettingsSection data={data} />
    default:
      return null
  }
}
