export interface ExternalSearchEngine {
  id: string
  label: string
  urlTemplate: string
}

export interface SiteSearchSettings {
  enabled: boolean
  externalEngines: ExternalSearchEngine[]
}

const SITE_SETTINGS_STATE_KEY = "__siteSettings"
const SEARCH_SETTINGS_KEY = "search"

const DEFAULT_EXTERNAL_SEARCH_ENGINES: ExternalSearchEngine[] = [
  {
    id: "google",
    label: "Google 搜索",
    urlTemplate: "https://www.google.com/search?q={keyword}",
  },
  {
    id: "bing",
    label: "Bing 搜索",
    urlTemplate: "https://www.bing.com/search?q={keyword}",
  },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function parseAppStateRoot(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function readSiteSettingsState(raw: string | null | undefined) {
  const root = parseAppStateRoot(raw)
  const siteSettingsState = root[SITE_SETTINGS_STATE_KEY]
  return isRecord(siteSettingsState) ? siteSettingsState : {}
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase()
    if (normalizedValue === "true" || normalizedValue === "1" || normalizedValue === "on") {
      return true
    }
    if (normalizedValue === "false" || normalizedValue === "0" || normalizedValue === "off") {
      return false
    }
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true
    }
    if (value === 0) {
      return false
    }
  }

  return fallback
}

function getDefaultExternalSearchEngines() {
  return DEFAULT_EXTERNAL_SEARCH_ENGINES.map((item) => ({ ...item }))
}

function normalizeExternalSearchEngines(value: unknown) {
  if (!Array.isArray(value)) {
    return getDefaultExternalSearchEngines()
  }

  const normalized = value.flatMap((item, index) => {
    if (!isRecord(item)) {
      return []
    }

    const fallback = DEFAULT_EXTERNAL_SEARCH_ENGINES[index]
    const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : fallback?.id
    const label = typeof item.label === "string" && item.label.trim() ? item.label.trim() : fallback?.label
    const urlTemplate = typeof item.urlTemplate === "string" && item.urlTemplate.includes("{keyword}")
      ? item.urlTemplate.trim()
      : fallback?.urlTemplate

    if (!id || !label || !urlTemplate) {
      return []
    }

    return [{ id, label, urlTemplate }]
  })

  if (normalized.length === 0) {
    return getDefaultExternalSearchEngines()
  }

  return normalized.filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index)
}

export function resolveSiteSearchSettings(appStateJson?: string | null, enabledFallback = true): SiteSearchSettings {
  const siteSettingsState = readSiteSettingsState(appStateJson)
  const searchSettings = isRecord(siteSettingsState[SEARCH_SETTINGS_KEY])
    ? siteSettingsState[SEARCH_SETTINGS_KEY]
    : {}

  return {
    enabled: normalizeBoolean(searchSettings.enabled, enabledFallback),
    externalEngines: normalizeExternalSearchEngines(searchSettings.externalEngines),
  }
}

export function mergeSiteSearchSettings(
  appStateJson: string | null | undefined,
  input: Pick<SiteSearchSettings, "enabled"> & Partial<Pick<SiteSearchSettings, "externalEngines">>,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)
  const current = resolveSiteSearchSettings(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    [SEARCH_SETTINGS_KEY]: {
      enabled: normalizeBoolean(input.enabled, current.enabled),
      externalEngines: normalizeExternalSearchEngines(input.externalEngines ?? current.externalEngines),
    },
  }

  return JSON.stringify(root)
}

export function buildExternalSearchUrl(urlTemplate: string, keyword: string) {
  const normalizedKeyword = keyword.trim()
  return urlTemplate.replaceAll("{keyword}", encodeURIComponent(normalizedKeyword))
}
