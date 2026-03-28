import {
  createSiteSettingsAppStateRecord,
  findSiteSettingsAppStateRecord,
  updateSiteSettingsAppState,
} from "@/db/app-config-queries"




const APP_CONFIG_KEYS = {
  gobang: "app.gobang",
  selfServeAds: "app.self-serve-ads",
} as const


export type AppConfigValue = Record<string, boolean | number | string>

type PluginStateRecord = {
  AppId: string
  enabled: boolean
  installedAt: string | null
  uninstalledAt: string | null
  config: Record<string, unknown>
  status: string
  version: string | null
  sourceDir: string | null
  lastActivatedAt: string | null
  lastErrorAt: string | null
  lastErrorMessage: string | null
  failureCount: number
}

type PluginStateMap = Record<string, PluginStateRecord>

function parsePluginState(raw: string | null | undefined): PluginStateMap {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as PluginStateMap
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function serializePluginState(state: PluginStateMap) {
  return JSON.stringify(state)
}

async function getOrCreateSiteSettingsRecord() {
  const existing = await findSiteSettingsAppStateRecord()

  if (existing) {
    return existing
  }

  return createSiteSettingsAppStateRecord()
}


async function readStateMap() {
  const settings = await getOrCreateSiteSettingsRecord()
  return {
    settings,
    state: parsePluginState(settings.appStateJson),
  }
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "1", "on"].includes(normalized)) return true
    if (["false", "0", "off"].includes(normalized)) return false
  }
  return fallback
}

import { parseSafeInteger } from "@/lib/shared/safe-integer"

function normalizeNumber(value: unknown, fallback: number) {
  return parseSafeInteger(value) ?? fallback
}


function normalizeText(value: unknown, fallback: string) {
  const resolved = String(value ?? fallback).trim()
  return resolved || fallback
}

function normalizeConfig(defaults: AppConfigValue, input?: Record<string, unknown>): AppConfigValue {
  const next = { ...defaults }
  for (const key of Object.keys(defaults)) {
    const fallback = defaults[key]
    const rawValue = input?.[key]
    if (typeof fallback === "boolean") {
      next[key] = normalizeBoolean(rawValue, fallback)
    } else if (typeof fallback === "number") {
      next[key] = normalizeNumber(rawValue, fallback)
    } else {
      next[key] = normalizeText(rawValue, fallback)
    }
  }
  return next
}

async function upsertAppConfig(configKey: string, defaults: AppConfigValue, input?: Record<string, unknown>) {
  const { settings, state } = await readStateMap()
  const previous = state[configKey]
  const nextConfig = normalizeConfig(defaults, {
    ...(previous?.config ?? {}),
    ...(input ?? {}),
  })

  state[configKey] = {
    AppId: configKey,
    enabled: true,
    installedAt: previous?.installedAt ?? new Date().toISOString(),
    uninstalledAt: null,
    config: nextConfig,
    status: "active",
    version: previous?.version ?? "hosted",
    sourceDir: previous?.sourceDir ?? "src",
    lastActivatedAt: previous?.lastActivatedAt ?? new Date().toISOString(),
    lastErrorAt: null,
    lastErrorMessage: null,
    failureCount: 0,
  }

  await updateSiteSettingsAppState(settings.id, serializePluginState(state))


  return nextConfig
}

export const GOBANG_DEFAULT_CONFIG = {
  enabled: true,
  dailyFreeGames: 1,
  dailyVipFreeGames: 2,
  dailyNormalGameLimit: 3,
  dailyVipGameLimit: 5,
  ticketCost: 10,
  aiLevel: 2,
  winReward: 20,
  matchLabel: "五子棋人机对战",
} satisfies AppConfigValue

export const SELF_SERVE_ADS_DEFAULT_CONFIG = {
  enabled: true,
  visibleOnHome: true,
  cardTitle: "推广广告位",

  sidebarSlot: "home-right-middle",
  sidebarOrder: 40,
  imageSlotCount: 2,
  textSlotCount: 6,
  imagePriceMonthly: 300,
  imagePriceQuarterly: 800,
  imagePriceSemiAnnual: 1500,
  imagePriceYearly: 2800,
  textPriceMonthly: 120,
  textPriceQuarterly: 320,
  textPriceSemiAnnual: 600,
  textPriceYearly: 1100,
  placeholderLabel: "点击购买",
} satisfies AppConfigValue

export async function getGobangAppConfig() {
  const { state } = await readStateMap()
  return normalizeConfig(GOBANG_DEFAULT_CONFIG, state[APP_CONFIG_KEYS.gobang]?.config)
}

export async function updateGobangAppConfig(input: Record<string, unknown>) {
  return upsertAppConfig(APP_CONFIG_KEYS.gobang, GOBANG_DEFAULT_CONFIG, input)
}

export async function getSelfServeAdsAppConfig() {
  const { state } = await readStateMap()
  return normalizeConfig(SELF_SERVE_ADS_DEFAULT_CONFIG, state[APP_CONFIG_KEYS.selfServeAds]?.config)
}

export async function updateSelfServeAdsAppConfig(input: Record<string, unknown>) {
  return upsertAppConfig(APP_CONFIG_KEYS.selfServeAds, SELF_SERVE_ADS_DEFAULT_CONFIG, input)
}
