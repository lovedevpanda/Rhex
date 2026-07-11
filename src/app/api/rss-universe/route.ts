import { apiError, apiSuccess, createRouteHandler } from "@/lib/api-route"
import { getSessionActorFromRequest } from "@/lib/auth"
import { getRssHomeDisplaySettings } from "@/lib/rss-harvest"
import { getRssUniverseFeedPage } from "@/lib/rss-public-feed"

const MAX_RSS_UNIVERSE_PAGE = 10_000
const MAX_RSS_UNIVERSE_SOURCE_IDS = 50
const MAX_RSS_UNIVERSE_SOURCE_ID_LENGTH = 128

export function parseRssUniversePage(request: Request) {
  const value = Number(new URL(request.url).searchParams.get("page") ?? "1")
  return Number.isFinite(value)
    ? Math.min(MAX_RSS_UNIVERSE_PAGE, Math.max(1, Math.trunc(value)))
    : 1
}

export function parseRssUniverseSourceIds(request: Request) {
  const rawValue = new URL(request.url).searchParams.get("sourceIds") ?? ""
  if (!rawValue.trim()) {
    return []
  }

  const sourceIds = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  if (
    sourceIds.length > MAX_RSS_UNIVERSE_SOURCE_IDS
    || sourceIds.some((sourceId) => sourceId.length > MAX_RSS_UNIVERSE_SOURCE_ID_LENGTH)
  ) {
    apiError(400, "RSS 源筛选参数过多或格式不正确")
  }

  return Array.from(new Set(sourceIds))
}

export const GET = createRouteHandler(async ({ request }) => {
  const page = parseRssUniversePage(request)
  const sourceIds = parseRssUniverseSourceIds(request)
  const [settings, currentUser] = await Promise.all([
    getRssHomeDisplaySettings(),
    getSessionActorFromRequest(request),
  ])
  const data = await getRssUniverseFeedPage(page, settings.homePageSize, sourceIds, currentUser?.id)

  return apiSuccess(data)
}, {
  errorMessage: "获取宇宙栏目失败",
  logPrefix: "[api/rss-universe] unexpected error",
})
