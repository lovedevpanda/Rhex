import { normalizePostListLoadMode } from "@/lib/post-list-load-mode"
import type { PostListLoadMode } from "@/lib/post-list-load-mode"
import {
  isRecord,
  normalizeLeftSidebarDisplayMode,
  normalizeNonNegativeInteger,
  normalizePostSlugGenerationMode,
  readSiteSettingsState,
  writeSiteSettingsState,
} from "@/lib/site-settings-app-state.types"
import type {
  FooterCopyrightSettings,
  HomeFeedPostListLoadSettings,
  HomeHotFeedSettings,
  HomeSidebarAnnouncementSettings,
  LeftSidebarDisplayMode,
  LeftSidebarDisplaySettings,
  PostPageSizeSettings,
  PostSlugGenerationMode,
  PostSlugGenerationSettings,
  SiteBrandingSettings,
} from "@/lib/site-settings-app-state.types"

export function resolveSiteBrandingSettings(options: {
  appStateJson?: string | null
  iconPathFallback?: string
} = {}): SiteBrandingSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const siteBranding = isRecord(siteSettingsState.siteBranding)
    ? siteSettingsState.siteBranding
    : {}
  const resolvedIconPath =
    typeof siteBranding.iconPath === "string"
      ? siteBranding.iconPath.trim().slice(0, 1000)
      : ""
  const fallbackIconPath =
    typeof options.iconPathFallback === "string"
      ? options.iconPathFallback.trim().slice(0, 1000)
      : ""

  return {
    iconPath: resolvedIconPath || fallbackIconPath,
  }
}

export function mergeSiteBrandingSettings(
  appStateJson: string | null | undefined,
  input: SiteBrandingSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    siteBranding: {
      iconPath:
        typeof input.iconPath === "string"
          ? input.iconPath.trim().slice(0, 1000)
          : "",
    },
  })
}

export function resolveFooterCopyrightSettings(options: {
  appStateJson?: string | null
  textFallback?: string
  brandingVisibleFallback?: boolean
} = {}): FooterCopyrightSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const footerCopyright = isRecord(siteSettingsState.footerCopyright)
    ? siteSettingsState.footerCopyright
    : {}
  const resolvedText =
    typeof footerCopyright.text === "string" ? footerCopyright.text.trim() : ""
  const fallbackText = (options.textFallback ?? "").trim()

  return {
    text: resolvedText || fallbackText,
    brandingVisible:
      typeof footerCopyright.brandingVisible === "boolean"
        ? footerCopyright.brandingVisible
        : options.brandingVisibleFallback ?? true,
  }
}

export function mergeFooterCopyrightSettings(
  appStateJson: string | null | undefined,
  input: FooterCopyrightSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    footerCopyright: {
      text: typeof input.text === "string" ? input.text.trim() : "",
      brandingVisible: Boolean(input.brandingVisible),
    },
  })
}

export function resolvePostSlugGenerationSettings(options: {
  appStateJson?: string | null
  modeFallback?: PostSlugGenerationMode
} = {}): PostSlugGenerationSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const postSlugGeneration = isRecord(siteSettingsState.postSlugGeneration)
    ? siteSettingsState.postSlugGeneration
    : {}

  return {
    mode: normalizePostSlugGenerationMode(postSlugGeneration.mode, options.modeFallback),
  }
}

export function mergePostSlugGenerationSettings(
  appStateJson: string | null | undefined,
  input: PostSlugGenerationSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    postSlugGeneration: {
      mode: normalizePostSlugGenerationMode(input.mode),
    },
  })
}

export function resolveHomeSidebarAnnouncementSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
} = {}): HomeSidebarAnnouncementSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const homeSidebarAnnouncement = isRecord(siteSettingsState.homeSidebarAnnouncement)
    ? siteSettingsState.homeSidebarAnnouncement
    : {}

  return {
    enabled:
      typeof homeSidebarAnnouncement.enabled === "boolean"
        ? homeSidebarAnnouncement.enabled
        : options.enabledFallback ?? true,
  }
}

export function mergeHomeSidebarAnnouncementSettings(
  appStateJson: string | null | undefined,
  input: HomeSidebarAnnouncementSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    homeSidebarAnnouncement: {
      enabled: input.enabled,
    },
  })
}

export function resolveLeftSidebarDisplaySettings(options: {
  appStateJson?: string | null
  modeFallback?: LeftSidebarDisplayMode
} = {}): LeftSidebarDisplaySettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const leftSidebarDisplay = isRecord(siteSettingsState.leftSidebarDisplay)
    ? siteSettingsState.leftSidebarDisplay
    : {}

  return {
    mode: normalizeLeftSidebarDisplayMode(leftSidebarDisplay.mode, options.modeFallback),
  }
}

export function mergeLeftSidebarDisplaySettings(
  appStateJson: string | null | undefined,
  input: LeftSidebarDisplaySettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    leftSidebarDisplay: {
      mode: normalizeLeftSidebarDisplayMode(input.mode),
    },
  })
}

export function resolveHomeFeedPostListLoadSettings(options: {
  appStateJson?: string | null
  loadModeFallback?: PostListLoadMode
} = {}): HomeFeedPostListLoadSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const homeFeedPostList = isRecord(siteSettingsState.homeFeedPostList)
    ? siteSettingsState.homeFeedPostList
    : {}

  return {
    loadMode: normalizePostListLoadMode(homeFeedPostList.loadMode, options.loadModeFallback),
  }
}

export function mergeHomeFeedPostListLoadSettings(
  appStateJson: string | null | undefined,
  input: HomeFeedPostListLoadSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    homeFeedPostList: {
      loadMode: normalizePostListLoadMode(input.loadMode),
    },
  })
}

export function resolveHomeHotFeedSettings(options: {
  appStateJson?: string | null
  recentWindowHoursFallback?: number
} = {}): HomeHotFeedSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const homeHotFeed = isRecord(siteSettingsState.homeHotFeed)
    ? siteSettingsState.homeHotFeed
    : {}

  return {
    recentWindowHours: Math.min(
      720,
      Math.max(
        1,
        normalizeNonNegativeInteger(
          homeHotFeed.recentWindowHours,
          normalizeNonNegativeInteger(options.recentWindowHoursFallback, 72),
        ),
      ),
    ),
  }
}

export function mergeHomeHotFeedSettings(
  appStateJson: string | null | undefined,
  input: HomeHotFeedSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    homeHotFeed: {
      recentWindowHours: Math.min(
        720,
        Math.max(1, normalizeNonNegativeInteger(input.recentWindowHours, 72)),
      ),
    },
  })
}

export function resolvePostPageSizeSettings(options: {
  appStateJson?: string | null
  homeFeedFallback?: number
  zonePostsFallback?: number
  boardPostsFallback?: number
  commentsFallback?: number
  hotTopicsFallback?: number
  postRelatedTopicsFallback?: number
} = {}): PostPageSizeSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const postPageSizes = isRecord(siteSettingsState.postPageSizes)
    ? siteSettingsState.postPageSizes
    : {}

  return {
    homeFeed: Math.min(100, Math.max(1, normalizeNonNegativeInteger(postPageSizes.homeFeed, normalizeNonNegativeInteger(options.homeFeedFallback, 35)))),
    zonePosts: Math.min(100, Math.max(1, normalizeNonNegativeInteger(postPageSizes.zonePosts, normalizeNonNegativeInteger(options.zonePostsFallback, 20)))),
    boardPosts: Math.min(100, Math.max(1, normalizeNonNegativeInteger(postPageSizes.boardPosts, normalizeNonNegativeInteger(options.boardPostsFallback, 20)))),
    comments: Math.min(100, Math.max(1, normalizeNonNegativeInteger(postPageSizes.comments, normalizeNonNegativeInteger(options.commentsFallback, 15)))),
    hotTopics: Math.min(30, Math.max(1, normalizeNonNegativeInteger(postPageSizes.hotTopics, normalizeNonNegativeInteger(options.hotTopicsFallback, 5)))),
    postRelatedTopics: Math.min(30, Math.max(1, normalizeNonNegativeInteger(postPageSizes.postRelatedTopics, normalizeNonNegativeInteger(options.postRelatedTopicsFallback, 5)))),
  }
}

export function mergePostPageSizeSettings(
  appStateJson: string | null | undefined,
  input: PostPageSizeSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    postPageSizes: {
      homeFeed: Math.min(100, Math.max(1, normalizeNonNegativeInteger(input.homeFeed, 35))),
      zonePosts: Math.min(100, Math.max(1, normalizeNonNegativeInteger(input.zonePosts, 20))),
      boardPosts: Math.min(100, Math.max(1, normalizeNonNegativeInteger(input.boardPosts, 20))),
      comments: Math.min(100, Math.max(1, normalizeNonNegativeInteger(input.comments, 15))),
      hotTopics: Math.min(30, Math.max(1, normalizeNonNegativeInteger(input.hotTopics, 5))),
      postRelatedTopics: Math.min(30, Math.max(1, normalizeNonNegativeInteger(input.postRelatedTopics, 5))),
    },
  })
}
