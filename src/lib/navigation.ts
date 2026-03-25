import { getBoards, type SiteBoardItem } from "@/lib/boards"
import { getZones } from "@/lib/zones"

export interface NavigationItem {
  label: string
  href: string
  activePrefix?: string
}

export async function getPrimaryNavigation(): Promise<NavigationItem[]> {
  const [boards, zones] = await Promise.all([getBoards(), getZones()])
  const zoneItems = zones.slice(0, 3).map((zone) => ({
    label: zone.name,
    href: `/zones/${zone.slug}`,
    activePrefix: `/zones/${zone.slug}`,
  }))
  const boardItems = boards.slice(0, 3).map(mapBoardToNavigationItem)

  return [{ label: "首页", href: "/", activePrefix: "/" }, ...zoneItems, ...boardItems]
}

function mapBoardToNavigationItem(board: SiteBoardItem): NavigationItem {
  return {
    label: board.name,
    href: `/boards/${board.slug}`,
    activePrefix: `/boards/${board.slug}`,
  }
}

