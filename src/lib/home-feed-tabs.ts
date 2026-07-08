import type { ResolvedAddonHomeFeedTab } from "@/addons-host/home-feed-types"
import {
  buildAddonHomeFeedHref,
  buildHomeFeedHref,
  type HomeFeedSort,
} from "@/lib/home-feed-route"

export const BUILTIN_HOME_FEED_TAB_ORDER: Record<HomeFeedSort, number> = {
  latest: 100,
  new: 200,
  hot: 300,
  featured: 350,
  following: 400,
  universe: 500,
}

const BUILTIN_HOME_FEED_TAB_LABELS: Record<HomeFeedSort, string> = {
  latest: "最新",
  new: "新贴",
  hot: "热门",
  featured: "精华",
  following: "关注",
  universe: "宇宙",
}

export interface ResolvedHomeFeedTab {
  key: string
  label: string
  href: string
  order: number
  kind: "builtin" | "addon"
  builtinSort?: HomeFeedSort
  addonTab?: ResolvedAddonHomeFeedTab
}

function compareResolvedHomeFeedTabs(
  left: ResolvedHomeFeedTab,
  right: ResolvedHomeFeedTab,
) {
  if (left.order !== right.order) {
    return left.order - right.order
  }

  const byLabel = left.label.localeCompare(right.label, "zh-CN")
  if (byLabel !== 0) {
    return byLabel
  }

  return left.key.localeCompare(right.key, "zh-CN")
}

export function resolveDefaultAddonHomeFeedTab(
  tabs: ResolvedAddonHomeFeedTab[],
) {
  const sorted = [...tabs].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order
    }

    return `${left.addonId}:${left.providerCode}:${left.slug}`.localeCompare(
      `${right.addonId}:${right.providerCode}:${right.slug}`,
      "zh-CN",
    )
  })

  const first = sorted[0] ?? null
  if (!first || first.order >= BUILTIN_HOME_FEED_TAB_ORDER.latest) {
    return null
  }

  return first
}

export function buildResolvedHomeFeedTabs(input: {
  addonTabs: ResolvedAddonHomeFeedTab[]
  showUniverse: boolean
  rootAddonSlug?: string | null
}) {
  const builtinTabs: ResolvedHomeFeedTab[] = [
    {
      key: "latest",
      label: BUILTIN_HOME_FEED_TAB_LABELS.latest,
      href: buildHomeFeedHref("latest"),
      order: BUILTIN_HOME_FEED_TAB_ORDER.latest,
      kind: "builtin",
      builtinSort: "latest",
    },
    {
      key: "new",
      label: BUILTIN_HOME_FEED_TAB_LABELS.new,
      href: buildHomeFeedHref("new"),
      order: BUILTIN_HOME_FEED_TAB_ORDER.new,
      kind: "builtin",
      builtinSort: "new",
    },
    {
      key: "hot",
      label: BUILTIN_HOME_FEED_TAB_LABELS.hot,
      href: buildHomeFeedHref("hot"),
      order: BUILTIN_HOME_FEED_TAB_ORDER.hot,
      kind: "builtin",
      builtinSort: "hot",
    },
    {
      key: "featured",
      label: BUILTIN_HOME_FEED_TAB_LABELS.featured,
      href: buildHomeFeedHref("featured"),
      order: BUILTIN_HOME_FEED_TAB_ORDER.featured,
      kind: "builtin",
      builtinSort: "featured",
    },
    {
      key: "following",
      label: BUILTIN_HOME_FEED_TAB_LABELS.following,
      href: buildHomeFeedHref("following"),
      order: BUILTIN_HOME_FEED_TAB_ORDER.following,
      kind: "builtin",
      builtinSort: "following",
    },
    ...(input.showUniverse
      ? [{
          key: "universe",
          label: BUILTIN_HOME_FEED_TAB_LABELS.universe,
          href: buildHomeFeedHref("universe"),
          order: BUILTIN_HOME_FEED_TAB_ORDER.universe,
          kind: "builtin" as const,
          builtinSort: "universe" as const,
        }]
      : []),
  ]

  const addonTabs = input.addonTabs.map((tab) => ({
    key: tab.slug,
    label: tab.label,
    href: buildAddonHomeFeedHref(tab.slug, 1, tab.slug === input.rootAddonSlug),
    order: tab.order,
    kind: "addon" as const,
    addonTab: tab,
  }))

  return [...builtinTabs, ...addonTabs].sort(compareResolvedHomeFeedTabs)
}
