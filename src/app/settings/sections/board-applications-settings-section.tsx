import { BoardApplicationPanel } from "@/components/board/board-application-panel"
import type { SettingsPageData } from "@/app/settings/settings-page-loader"

export function BoardApplicationsSettingsSection({ data }: { data: SettingsPageData }) {
  const { settings, currentUser, profile, boardApplicationZones, boardApplicationData } = data

  return (
    <BoardApplicationPanel
      pointName={settings.pointName}
      currentUser={{
        id: currentUser.id,
        username: currentUser.username,
        displayName: profile.displayName,
        status: currentUser.status,
      }}
      zones={boardApplicationZones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        slug: zone.slug,
      }))}
      items={boardApplicationData.items}
      pendingCount={boardApplicationData.pendingCount}
    />
  )
}
