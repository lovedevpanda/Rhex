import { apiSuccess, createRouteHandler } from "@/lib/api-route"
import { buildHookedFeedDisplayItems } from "@/lib/addon-feed-posts"
import { getSessionActorFromRequest } from "@/lib/auth"
import { getLatestFeed, type FeedSort } from "@/lib/forum-feed"
import { resolveContentVisibleAdminActor } from "@/lib/admin-scope-permissions"
import {
  attachPostListTipSummaries,
  shouldAttachPostListTipSummaries,
} from "@/lib/post-list-tipping"
import { getSiteSettings } from "@/lib/site-settings"

function parsePage(request: Request) {
  const value = Number(new URL(request.url).searchParams.get("page") ?? "1")
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 1
}

function parseSort(request: Request): Exclude<FeedSort, "weekly"> {
  const value = new URL(request.url).searchParams.get("sort")
  return value === "new" || value === "hot" || value === "featured" || value === "following" ? value : "latest"
}

export const GET = createRouteHandler(async ({ request }) => {
  const page = parsePage(request)
  const sort = parseSort(request)
  const [currentUser, settings] = await Promise.all([getSessionActorFromRequest(request), getSiteSettings()])
  const result = await getLatestFeed(page, settings.homeFeedPostPageSize, sort, currentUser?.id, settings.homeHotRecentWindowHours, {
    userId: currentUser?.id ?? null,
    adminActor: await resolveContentVisibleAdminActor(currentUser),
  })
  const pathname = sort === "new"
    ? "/new"
    : sort === "hot"
      ? "/hot"
      : sort === "featured"
        ? "/featured"
        : sort === "following"
          ? "/following"
          : "/"

  const items = await buildHookedFeedDisplayItems({
    items: result.items,
    sort,
    settings,
    listDisplayMode: settings.homeFeedPostListDisplayMode,
    pathname,
    request,
    searchParams: new URL(request.url).searchParams,
  })

  return apiSuccess({
    ...result,
    items: shouldAttachPostListTipSummaries(settings.homeFeedPostListDisplayMode)
      ? await attachPostListTipSummaries(items, currentUser?.id)
      : items,
  })
}, {
  errorMessage: "获取首页帖子失败",
  logPrefix: "[api/feed] unexpected error",
})
