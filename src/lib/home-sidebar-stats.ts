import { findHomeSidebarStats } from "@/db/home-sidebar-queries"

export interface HomeSidebarStatsData {
  postCount: number
  replyCount: number
  userCount: number
}

const HOME_SIDEBAR_STATS_CACHE_TTL_MS = 60_000

let cachedHomeSidebarStats: HomeSidebarStatsData | null = null
let homeSidebarStatsCacheExpiry = 0
let homeSidebarStatsCachePromise: Promise<HomeSidebarStatsData> | null = null

function setHomeSidebarStatsCache(stats: HomeSidebarStatsData) {
  cachedHomeSidebarStats = stats
  homeSidebarStatsCacheExpiry = Date.now() + HOME_SIDEBAR_STATS_CACHE_TTL_MS
}

export function invalidateHomeSidebarStatsCache() {
  cachedHomeSidebarStats = null
  homeSidebarStatsCacheExpiry = 0
  homeSidebarStatsCachePromise = null
}

async function getMemoryCachedHomeSidebarStats(): Promise<HomeSidebarStatsData> {
  if (cachedHomeSidebarStats && Date.now() < homeSidebarStatsCacheExpiry) {
    return cachedHomeSidebarStats
  }

  if (!homeSidebarStatsCachePromise) {
    homeSidebarStatsCachePromise = findHomeSidebarStats()
      .then((stats) => {
        setHomeSidebarStatsCache(stats)
        return stats
      })
      .finally(() => {
        homeSidebarStatsCachePromise = null
      })
  }

  return homeSidebarStatsCachePromise
}

export async function getHomeSidebarStats(): Promise<HomeSidebarStatsData> {
  return getMemoryCachedHomeSidebarStats()
}
