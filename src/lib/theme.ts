export const THEME_STORAGE_KEY = "rhex-theme"
export const THEME_PREFERENCE_EXPLICIT_STORAGE_KEY = "rhex-theme-explicit"
export const THEME_PRESET_STORAGE_KEY = "rhex-theme-preset"
export const FONT_SIZE_PRESET_STORAGE_KEY = "rhex-font-size-preset"
export const CUSTOM_THEME_STORAGE_KEY = "rhex-custom-theme"
export const CUSTOM_THEME_VARIABLES_STORAGE_KEY = "rhex-custom-theme-variables"
export const THEME_SETTINGS_CHANGE_EVENT = "rhex-theme-settings-change"
export const CUSTOM_THEME_STYLE_ELEMENT_ID = "rhex-custom-theme-style"
export const DEFAULT_THEME_FONT_FAMILY = "\"Microsoft YaHei\", \"PingFang SC\", \"Helvetica Neue\", Helvetica, Arial, sans-serif"
export const DEFAULT_THEME_FONT_SIZE = "16px"
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
export const THEME_MOBILE_BREAKPOINT = 768

export type ThemeMode = "light" | "dark"
export type ThemePreference = ThemeMode | "system"
export type FontSizePreset = "compact" | "normal" | "relaxed"
export type BuiltInThemePreset = keyof typeof THEME_PRESETS
export type ThemePreset = keyof typeof THEME_PRESETS | "custom"
export type ThemeDefaultDevice = "desktop" | "mobile"
type ThemeVariableName = "background" | "foreground" | "card" | "card-foreground" | "primary" | "primary-foreground" | "secondary" | "secondary-foreground" | "muted" | "muted-foreground" | "accent" | "accent-foreground" | "border" | "ring"
type ThemeVariableMap = Partial<Record<ThemeVariableName, string>>

export interface CustomThemeModeConfig {
  primary: string
  background: string
  card: string
  accent: string
  border: string
}

interface CustomThemeTypographyConfig {
  fontFamily: string
  fontSize: string
}

export interface CustomThemeConfig {
  light: CustomThemeModeConfig
  dark: CustomThemeModeConfig
  typography: CustomThemeTypographyConfig
  customCss: string
}

export type ThemePresetDefinition = {
  label: string
  description: string
  preview: [string, string, string]
  values: {
    light: ThemeVariableMap
    dark: ThemeVariableMap
  }
}

const THEME_VARIABLE_NAMES: ThemeVariableName[] = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "border",
  "ring",
]

export const THEME_PRESETS = {
  default: {
    label: "默认主题",
    description: "白天纯白，黑夜纯黑，整体保持中性黑白基调。",
    preview: ["0 0% 12%", "0 0% 100%", "0 0% 88%"],
    values: {
      light: {
        background: "0 0% 100%",
        foreground: "0 0% 8%",
        card: "0 0% 100%",
        "card-foreground": "0 0% 8%",
        primary: "0 0% 12%",
        "primary-foreground": "0 0% 100%",
        secondary: "0 0% 96%",
        "secondary-foreground": "0 0% 12%",
        muted: "0 0% 96%",
        "muted-foreground": "0 0% 42%",
        accent: "0 0% 94%",
        "accent-foreground": "0 0% 12%",
        border: "0 0% 88%",
        ring: "0 0% 24%",
      },
      dark: {
        background: "0 0% 0%",
        foreground: "0 0% 96%",
        card: "0 0% 8%",
        "card-foreground": "0 0% 96%",
        primary: "0 0% 96%",
        "primary-foreground": "0 0% 10%",
        secondary: "0 0% 14%",
        "secondary-foreground": "0 0% 96%",
        muted: "0 0% 12%",
        "muted-foreground": "0 0% 68%",
        accent: "0 0% 16%",
        "accent-foreground": "0 0% 96%",
        border: "0 0% 22%",
        ring: "0 0% 72%",
      },
    },
  },
  sea: {
    label: "海盐蓝",
    description: "保留站点原先的清爽蓝灰气质。",
    preview: ["217 91% 60%", "210 20% 98%", "214 18% 88%"],
    values: {
      light: {
        background: "210 20% 98%",
        foreground: "222.2 47.4% 11.2%",
        card: "0 0% 100%",
        "card-foreground": "222.2 47.4% 11.2%",
        primary: "217 91% 60%",
        "primary-foreground": "210 40% 98%",
        secondary: "210 26% 95%",
        "secondary-foreground": "222.2 47.4% 11.2%",
        muted: "210 20% 96%",
        "muted-foreground": "215.4 16.3% 46.9%",
        accent: "214 32% 94%",
        "accent-foreground": "221 39% 20%",
        border: "214 18% 88%",
        ring: "217 91% 60%",
      },
      dark: {
        background: "228 22% 8%",
        foreground: "36 33% 96%",
        card: "228 20% 12%",
        "card-foreground": "36 33% 96%",
        primary: "27 96% 61%",
        "primary-foreground": "228 22% 10%",
        secondary: "228 16% 18%",
        "secondary-foreground": "36 33% 96%",
        muted: "228 16% 16%",
        "muted-foreground": "220 12% 70%",
        accent: "224 24% 20%",
        "accent-foreground": "36 33% 96%",
        border: "224 16% 24%",
        ring: "27 96% 61%",
      },
    },
  },
  jade: {
    label: "暮砂褐",
    description: "介于暗黑与暖色之间的低刺激护眼配色。",
    preview: ["28 38% 54%", "34 24% 92%", "24 12% 24%"],
    values: {
      light: {
        background: "34 24% 92%",
        foreground: "28 18% 18%",
        card: "36 22% 95%",
        "card-foreground": "28 18% 18%",
        primary: "26 32% 42%",
        "primary-foreground": "36 30% 96%",
        secondary: "34 18% 88%",
        "secondary-foreground": "28 18% 22%",
        muted: "32 16% 89%",
        "muted-foreground": "28 12% 39%",
        accent: "30 24% 84%",
        "accent-foreground": "28 18% 22%",
        border: "30 16% 78%",
        ring: "26 32% 42%",
      },
      dark: {
        background: "24 14% 12%",
        foreground: "36 18% 88%",
        card: "24 12% 16%",
        "card-foreground": "36 18% 88%",
        primary: "28 40% 60%",
        "primary-foreground": "24 18% 14%",
        secondary: "24 10% 21%",
        "secondary-foreground": "36 18% 88%",
        muted: "24 10% 18%",
        "muted-foreground": "32 10% 64%",
        accent: "26 14% 25%",
        "accent-foreground": "36 18% 88%",
        border: "24 10% 28%",
        ring: "28 40% 60%",
      },
    },
  },
  amber: {
    label: "落日橙",
    description: "更暖一点，强调互动和热度。",
    preview: ["24 96% 56%", "32 100% 98%", "30 32% 84%"],
    values: {
      light: {
        background: "32 100% 98%",
        card: "34 100% 99%",
        primary: "24 96% 56%",
        "primary-foreground": "36 100% 98%",
        secondary: "32 55% 95%",
        "secondary-foreground": "20 58% 19%",
        muted: "30 44% 95%",
        "muted-foreground": "24 14% 42%",
        accent: "30 65% 92%",
        "accent-foreground": "20 58% 19%",
        border: "30 32% 84%",
        ring: "24 96% 56%",
      },
      dark: {
        background: "20 24% 8%",
        foreground: "33 45% 95%",
        card: "20 21% 11%",
        "card-foreground": "33 45% 95%",
        primary: "28 94% 61%",
        "primary-foreground": "20 28% 10%",
        secondary: "20 17% 17%",
        "secondary-foreground": "33 45% 95%",
        muted: "20 16% 15%",
        "muted-foreground": "30 16% 70%",
        accent: "21 22% 20%",
        "accent-foreground": "33 45% 95%",
        border: "21 15% 23%",
        ring: "28 94% 61%",
      },
    },
  },
  graphite: {
    label: "石墨灰",
    description: "克制、冷静，适合长时间阅读。",
    preview: ["221 18% 28%", "210 16% 97%", "214 12% 82%"],
    values: {
      light: {
        background: "210 16% 97%",
        foreground: "222 30% 12%",
        card: "0 0% 100%",
        "card-foreground": "222 30% 12%",
        primary: "221 18% 28%",
        "primary-foreground": "210 40% 98%",
        secondary: "216 14% 93%",
        "secondary-foreground": "220 24% 20%",
        muted: "214 13% 94%",
        "muted-foreground": "220 10% 42%",
        accent: "214 16% 91%",
        "accent-foreground": "220 24% 20%",
        border: "214 12% 82%",
        ring: "221 18% 28%",
      },
      dark: {
        background: "222 18% 8%",
        foreground: "210 20% 95%",
        card: "222 16% 11%",
        "card-foreground": "210 20% 95%",
        primary: "214 18% 76%",
        "primary-foreground": "222 18% 10%",
        secondary: "220 12% 17%",
        "secondary-foreground": "210 20% 95%",
        muted: "220 12% 15%",
        "muted-foreground": "216 10% 68%",
        accent: "220 14% 20%",
        "accent-foreground": "210 20% 95%",
        border: "220 10% 24%",
        ring: "214 18% 76%",
      },
    },
  },
} as const satisfies Record<string, ThemePresetDefinition>

export const FONT_SIZE_PRESETS = {
  compact: {
    label: "紧凑",
    size: "12px",
    preview: "A-",
  },
  normal: {
    label: "正常",
    size: "15px",
    preview: "A",
  },
  relaxed: {
    label: "宽松",
    size: "17px",
    preview: "A+",
  },
} as const satisfies Record<FontSizePreset, { label: string; size: string; preview: string }>

export type FontSizePresetDefinition = { label: string; size: string; preview: string }

export interface EditableThemePresetDefinition {
  label: string
  description: string
  light: CustomThemeModeConfig
  dark: CustomThemeModeConfig
}

export interface ThemeCustomizationSettings {
  defaultPreference: ThemePreference
  defaultThemePreset: BuiltInThemePreset
  defaultFontSizePreset: FontSizePreset
  defaultMobileThemePreset: BuiltInThemePreset
  defaultMobileFontSizePreset: FontSizePreset
  postContentImageMode: PostContentImageMode
  fontSizePresets: Record<FontSizePreset, FontSizePresetDefinition>
  themePresets: Record<BuiltInThemePreset, EditableThemePresetDefinition>
}

export interface ThemeRuntimeSettings extends ThemeDefaultSettings {
  mobilePreset: BuiltInThemePreset
  mobileFontSizePreset: FontSizePreset
  postContentImageMode: PostContentImageMode
  customization: ThemeCustomizationSettings
  fontSizePresets: Record<FontSizePreset, FontSizePresetDefinition>
  themePresets: Record<BuiltInThemePreset, ThemePresetDefinition>
}

export const DEFAULT_CUSTOM_THEME_CONFIG: CustomThemeConfig = {
  light: {
    primary: "#3b82f6",
    background: "#f8fafc",
    card: "#ffffff",
    accent: "#e8f0fb",
    border: "#d7dee8",
  },
  dark: {
    primary: "#fb923c",
    background: "#10131a",
    card: "#171b24",
    accent: "#2a3240",
    border: "#303949",
  },
  typography: {
    fontFamily: DEFAULT_THEME_FONT_FAMILY,
    fontSize: DEFAULT_THEME_FONT_SIZE,
  },
  customCss: "",
}

function isBrowser() {
  return typeof window !== "undefined"
}

export function resolveThemeDefaultDeviceFromUserAgent(userAgent: string | null | undefined): ThemeDefaultDevice {
  const normalizedUserAgent = String(userAgent ?? "").toLowerCase()
  return /android|iphone|ipad|ipod|mobile|windows phone|iemobile|opera mini|blackberry/.test(normalizedUserAgent)
    ? "mobile"
    : "desktop"
}

function resolveThemeDefaultDeviceFromViewport(): ThemeDefaultDevice {
  if (!isBrowser()) {
    return "desktop"
  }

  try {
    if (typeof window.matchMedia === "function") {
      return window.matchMedia(`(max-width: ${THEME_MOBILE_BREAKPOINT - 1}px)`).matches ? "mobile" : "desktop"
    }
  } catch {
    // Fall back to innerWidth below.
  }

  return window.innerWidth < THEME_MOBILE_BREAKPOINT ? "mobile" : "desktop"
}

function readCookieValue(cookieString: string, cookieName: string) {
  if (!cookieString.trim()) {
    return null
  }

  const cookiePrefix = `${cookieName}=`
  const entry = cookieString
    .split(";")
    .map((chunk) => chunk.trim())
    .find((chunk) => chunk.startsWith(cookiePrefix))

  if (!entry) {
    return null
  }

  const rawValue = entry.slice(cookiePrefix.length)

  try {
    return decodeURIComponent(rawValue)
  } catch {
    return rawValue
  }
}

function normalizeHexColor(value: unknown, fallback: string) {
  const normalized = String(value ?? "").trim()
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : fallback
}

function normalizeCustomThemeFontFamily(value: unknown, fallback: string) {
  const normalized = String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()

  return normalized || fallback
}

function normalizeCustomThemeFontSize(value: unknown, fallback: string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${Math.max(8, Math.min(32, Math.round(value)))}px`
  }

  const normalized = String(value ?? "").trim().toLowerCase()
  const numeric = normalized.endsWith("px") ? Number.parseFloat(normalized.slice(0, -2)) : Number.parseFloat(normalized)
  if (Number.isFinite(numeric)) {
    return `${Math.max(8, Math.min(32, Math.round(numeric)))}px`
  }

  return fallback
}

function normalizeCustomThemeCss(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback
  }

  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .trim()
}

function normalizeCustomThemeModeConfig(value: unknown, fallback: CustomThemeModeConfig): CustomThemeModeConfig {
  if (!value || typeof value !== "object") {
    return fallback
  }

  const candidate = value as Record<string, unknown>

  return {
    primary: normalizeHexColor(candidate.primary, fallback.primary),
    background: normalizeHexColor(candidate.background, fallback.background),
    card: normalizeHexColor(candidate.card, fallback.card),
    accent: normalizeHexColor(candidate.accent, fallback.accent),
    border: normalizeHexColor(candidate.border, fallback.border),
  }
}

export function resolveStoredCustomThemeConfig(value: unknown): CustomThemeConfig {
  if (!value || typeof value !== "object") {
    return DEFAULT_CUSTOM_THEME_CONFIG
  }

  const candidate = value as Record<string, unknown>

  return {
    light: normalizeCustomThemeModeConfig(candidate.light, DEFAULT_CUSTOM_THEME_CONFIG.light),
    dark: normalizeCustomThemeModeConfig(candidate.dark, DEFAULT_CUSTOM_THEME_CONFIG.dark),
    typography: {
      fontFamily: normalizeCustomThemeFontFamily(candidate.typography && typeof candidate.typography === "object" ? (candidate.typography as Record<string, unknown>).fontFamily : null, DEFAULT_CUSTOM_THEME_CONFIG.typography.fontFamily),
      fontSize: normalizeCustomThemeFontSize(candidate.typography && typeof candidate.typography === "object" ? (candidate.typography as Record<string, unknown>).fontSize : null, DEFAULT_CUSTOM_THEME_CONFIG.typography.fontSize),
    },
    customCss: normalizeCustomThemeCss(candidate.customCss, DEFAULT_CUSTOM_THEME_CONFIG.customCss),
  }
}

function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex, "#000000").slice(1)

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

function rgbToHex(input: { r: number; g: number; b: number }) {
  const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")
  return `#${toHex(input.r)}${toHex(input.g)}${toHex(input.b)}`
}

function mixHexColors(base: string, overlay: string, amount: number) {
  const safeAmount = Math.max(0, Math.min(1, amount))
  const left = hexToRgb(base)
  const right = hexToRgb(overlay)

  return rgbToHex({
    r: left.r + (right.r - left.r) * safeAmount,
    g: left.g + (right.g - left.g) * safeAmount,
    b: left.b + (right.b - left.b) * safeAmount,
  })
}

function hexToHslValue(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  const normalizedR = r / 255
  const normalizedG = g / 255
  const normalizedB = b / 255
  const max = Math.max(normalizedR, normalizedG, normalizedB)
  const min = Math.min(normalizedR, normalizedG, normalizedB)
  const delta = max - min
  const lightness = (max + min) / 2

  let hue = 0
  if (delta !== 0) {
    if (max === normalizedR) {
      hue = ((normalizedG - normalizedB) / delta) % 6
    } else if (max === normalizedG) {
      hue = (normalizedB - normalizedR) / delta + 2
    } else {
      hue = (normalizedR - normalizedG) / delta + 4
    }
  }

  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))

  return `${Math.round(hue * 60 < 0 ? hue * 60 + 360 : hue * 60)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`
}

function getReadableForeground(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  const channel = (value: number) => {
    const normalized = value / 255
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

  return luminance > 0.45 ? "#0f172a" : "#f8fafc"
}

function buildCustomThemeVariableMap(modeConfig: CustomThemeModeConfig, mode: ThemeMode): ThemeVariableMap {
  const foregroundHex = getReadableForeground(modeConfig.background)
  const cardForegroundHex = getReadableForeground(modeConfig.card)
  const primaryForegroundHex = getReadableForeground(modeConfig.primary)
  const accentForegroundHex = getReadableForeground(modeConfig.accent)
  const secondaryHex = mixHexColors(modeConfig.background, foregroundHex, mode === "light" ? 0.08 : 0.12)
  const mutedHex = mixHexColors(modeConfig.background, foregroundHex, mode === "light" ? 0.05 : 0.09)
  const mutedForegroundHex = mixHexColors(foregroundHex, modeConfig.background, mode === "light" ? 0.38 : 0.28)

  return {
    background: hexToHslValue(modeConfig.background),
    foreground: hexToHslValue(foregroundHex),
    card: hexToHslValue(modeConfig.card),
    "card-foreground": hexToHslValue(cardForegroundHex),
    primary: hexToHslValue(modeConfig.primary),
    "primary-foreground": hexToHslValue(primaryForegroundHex),
    secondary: hexToHslValue(secondaryHex),
    "secondary-foreground": hexToHslValue(foregroundHex),
    muted: hexToHslValue(mutedHex),
    "muted-foreground": hexToHslValue(mutedForegroundHex),
    accent: hexToHslValue(modeConfig.accent),
    "accent-foreground": hexToHslValue(accentForegroundHex),
    border: hexToHslValue(modeConfig.border),
    ring: hexToHslValue(modeConfig.primary),
  }
}

export function buildCustomThemeVariables(config: CustomThemeConfig) {
  return {
    light: buildCustomThemeVariableMap(config.light, "light"),
    dark: buildCustomThemeVariableMap(config.dark, "dark"),
  } satisfies Record<ThemeMode, ThemeVariableMap>
}

function buildCustomThemeCssBlock(selector: string, variables: ThemeVariableMap, typography?: CustomThemeTypographyConfig) {
  const lines = [selector, "{"]

  if (typography) {
    lines.push(`  --theme-font-family: ${typography.fontFamily};`)
    lines.push(`  font-size: ${typography.fontSize};`)
  }

  for (const variableName of THEME_VARIABLE_NAMES) {
    const variableValue = variables[variableName]
    if (typeof variableValue === "string" && variableValue.trim()) {
      lines.push(`  --${variableName}: ${variableValue};`)
    }
  }

  lines.push("}")

  return lines.join("\n")
}

export function buildCustomThemeRawCss(config: CustomThemeConfig) {
  const normalizedConfig = resolveStoredCustomThemeConfig(config)
  const variables = buildCustomThemeVariables(normalizedConfig)
  const customCssBlock = normalizedConfig.customCss
    ? [
        "",
        "/* Custom CSS */",
        normalizedConfig.customCss,
      ]
    : []

  return [
    buildCustomThemeCssBlock(":root", variables.light, normalizedConfig.typography),
    "",
    buildCustomThemeCssBlock(".dark", variables.dark),
    "",
    "body {",
    "  font-family: var(--theme-font-family, \"Microsoft YaHei\", \"PingFang SC\", \"Helvetica Neue\", Helvetica, Arial, sans-serif);",
    "}",
    ...customCssBlock,
  ].join("\n")
}

function normalizeCustomThemeVariables(value: unknown) {
  if (!value || typeof value !== "object") {
    return buildCustomThemeVariables(DEFAULT_CUSTOM_THEME_CONFIG)
  }

  const fallback = buildCustomThemeVariables(DEFAULT_CUSTOM_THEME_CONFIG)
  const candidate = value as Record<string, unknown>

  const normalizeModeVariables = (modeValue: unknown, modeFallback: ThemeVariableMap) => {
    if (!modeValue || typeof modeValue !== "object") {
      return modeFallback
    }

    const map = modeValue as Record<string, unknown>
    const result: ThemeVariableMap = {}

    for (const variableName of THEME_VARIABLE_NAMES) {
      const variableValue = map[variableName]
      result[variableName] = typeof variableValue === "string" && variableValue.trim() ? variableValue : modeFallback[variableName]
    }

    return result
  }

  return {
    light: normalizeModeVariables(candidate.light, fallback.light),
    dark: normalizeModeVariables(candidate.dark, fallback.dark),
  } satisfies Record<ThemeMode, ThemeVariableMap>
}

export function readStoredCustomThemeConfig() {
  if (!isBrowser()) {
    return DEFAULT_CUSTOM_THEME_CONFIG
  }

  try {
    const raw = window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY)
    return raw ? resolveStoredCustomThemeConfig(JSON.parse(raw)) : DEFAULT_CUSTOM_THEME_CONFIG
  } catch {
    return DEFAULT_CUSTOM_THEME_CONFIG
  }
}

function readStoredCustomThemeVariables() {
  if (!isBrowser()) {
    return buildCustomThemeVariables(DEFAULT_CUSTOM_THEME_CONFIG)
  }

  try {
    const raw = window.localStorage.getItem(CUSTOM_THEME_VARIABLES_STORAGE_KEY)
    return raw ? normalizeCustomThemeVariables(JSON.parse(raw)) : buildCustomThemeVariables(readStoredCustomThemeConfig())
  } catch {
    return buildCustomThemeVariables(DEFAULT_CUSTOM_THEME_CONFIG)
  }
}

export function notifyThemeSettingsChanged() {
  if (!isBrowser()) {
    return
  }

  window.dispatchEvent(new Event(THEME_SETTINGS_CHANGE_EVENT))
}

function writeThemeCookie(cookieName: string, value: string) {
  if (!isBrowser()) {
    return
  }

  try {
    document.cookie = `${cookieName}=${encodeURIComponent(value)}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`
  } catch {
    // Ignore cookie write failures and still keep the local snapshot available.
  }
}

function readThemeCookieValue(cookieName: string) {
  if (!isBrowser()) {
    return null
  }

  try {
    return readCookieValue(document.cookie, cookieName)
  } catch {
    return null
  }
}

function syncThemeSettingFromCookie(storageKey: string, cookieValue: string | null) {
  if (!isBrowser() || !cookieValue) {
    return
  }

  try {
    if (window.localStorage.getItem(storageKey) == null) {
      window.localStorage.setItem(storageKey, cookieValue)
    }
  } catch {
    // Ignore storage sync failures.
  }
}

function writeThemeSetting(storageKey: string, value: string) {
  if (!isBrowser()) {
    return
  }

  let storedValue: string | null = null

  try {
    storedValue = window.localStorage.getItem(storageKey)
  } catch {
    storedValue = null
  }

  const cookieValue = readThemeCookieValue(storageKey)

  if (storedValue === value && cookieValue === value) {
    return
  }

  try {
    window.localStorage.setItem(storageKey, value)
  } catch {
    // Ignore storage write failures and still keep the cookie/snapshot path available.
  }

  writeThemeCookie(storageKey, value)
  updateThemeLocalSettingsSnapshot(readThemeLocalSettingsSnapshotFromStorage())
  notifyThemeSettingsChanged()
}

export function setStoredThemePreference(preference: ThemePreference) {
  writeThemeSetting(THEME_STORAGE_KEY, preference)
  try {
    window.localStorage.setItem(THEME_PREFERENCE_EXPLICIT_STORAGE_KEY, "1")
  } catch {
    // Ignore storage write failures and still keep the cookie/snapshot path available.
  }
  writeThemeCookie(THEME_PREFERENCE_EXPLICIT_STORAGE_KEY, "1")
  notifyThemeSettingsChanged()
}

export function writeStoredThemePreferenceCookie(preference: ThemePreference) {
  writeThemeCookie(THEME_STORAGE_KEY, preference)
}

export function setStoredThemePreset(preset: ThemePreset) {
  writeThemeSetting(THEME_PRESET_STORAGE_KEY, preset)
}

export function setStoredFontSizePreset(preset: FontSizePreset) {
  writeThemeSetting(FONT_SIZE_PRESET_STORAGE_KEY, preset)
}

export function saveCustomThemeConfig(config: CustomThemeConfig) {
  if (!isBrowser()) {
    return
  }

  const normalizedConfig = resolveStoredCustomThemeConfig(config)
  const variables = buildCustomThemeVariables(normalizedConfig)
  window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(normalizedConfig))
  window.localStorage.setItem(CUSTOM_THEME_VARIABLES_STORAGE_KEY, JSON.stringify(variables))
  updateThemeLocalSettingsSnapshot(readThemeLocalSettingsSnapshotFromStorage())
  notifyThemeSettingsChanged()
}

export function resetCustomThemeConfig() {
  saveCustomThemeConfig(DEFAULT_CUSTOM_THEME_CONFIG)
}

export interface ThemeLocalSettingsSnapshot {
  preference: ThemePreference
  preset: ThemePreset
  fontSizePreset: FontSizePreset
  customThemeConfig: CustomThemeConfig
}

export const DEFAULT_THEME_LOCAL_SETTINGS_SNAPSHOT: ThemeLocalSettingsSnapshot = {
  preference: "light",
  preset: "default",
  fontSizePreset: "normal",
  customThemeConfig: DEFAULT_CUSTOM_THEME_CONFIG,
}

export interface ThemeDefaultSettings {
  preference: ThemePreference
  preset: BuiltInThemePreset
  fontSizePreset: FontSizePreset
  mobilePreset?: BuiltInThemePreset
  mobileFontSizePreset?: FontSizePreset
}

export const DEFAULT_THEME_DEFAULT_SETTINGS: ThemeDefaultSettings = {
  preference: "light",
  preset: "default",
  fontSizePreset: "normal",
  mobilePreset: "default",
  mobileFontSizePreset: "normal",
}

export type PostContentImageMode = "large" | "small" | "auto"

const THEME_PRESET_SOURCE_CONFIGS = {
  default: {
    label: THEME_PRESETS.default.label,
    description: THEME_PRESETS.default.description,
    light: {
      primary: "#1f1f1f",
      background: "#ffffff",
      card: "#ffffff",
      accent: "#f0f0f0",
      border: "#e0e0e0",
    },
    dark: {
      primary: "#f5f5f5",
      background: "#000000",
      card: "#141414",
      accent: "#292929",
      border: "#383838",
    },
  },
  sea: {
    label: THEME_PRESETS.sea.label,
    description: THEME_PRESETS.sea.description,
    light: {
      primary: "#3b82f6",
      background: "#f8fafc",
      card: "#ffffff",
      accent: "#e8f0fb",
      border: "#d7dee8",
    },
    dark: {
      primary: "#60a5fa",
      background: "#0b1220",
      card: "#111827",
      accent: "#1d2b44",
      border: "#2f3d55",
    },
  },
  jade: {
    label: THEME_PRESETS.jade.label,
    description: THEME_PRESETS.jade.description,
    light: {
      primary: "#10b981",
      background: "#f7fbf8",
      card: "#ffffff",
      accent: "#e8f6ef",
      border: "#d6eadf",
    },
    dark: {
      primary: "#34d399",
      background: "#07130f",
      card: "#0f1f19",
      accent: "#173329",
      border: "#245143",
    },
  },
  amber: {
    label: THEME_PRESETS.amber.label,
    description: THEME_PRESETS.amber.description,
    light: {
      primary: "#f97316",
      background: "#fffaf3",
      card: "#ffffff",
      accent: "#fff1dd",
      border: "#f3dcc2",
    },
    dark: {
      primary: "#fb923c",
      background: "#17100a",
      card: "#21170f",
      accent: "#372313",
      border: "#4d321b",
    },
  },
  graphite: {
    label: THEME_PRESETS.graphite.label,
    description: THEME_PRESETS.graphite.description,
    light: {
      primary: "#334155",
      background: "#f8fafc",
      card: "#ffffff",
      accent: "#eef2f7",
      border: "#dbe3ee",
    },
    dark: {
      primary: "#cbd5e1",
      background: "#0f172a",
      card: "#111827",
      accent: "#1e293b",
      border: "#334155",
    },
  },
} as const satisfies Record<BuiltInThemePreset, EditableThemePresetDefinition>

export const DEFAULT_THEME_CUSTOMIZATION_SETTINGS: ThemeCustomizationSettings = {
  defaultPreference: DEFAULT_THEME_DEFAULT_SETTINGS.preference,
  defaultThemePreset: DEFAULT_THEME_DEFAULT_SETTINGS.preset,
  defaultFontSizePreset: DEFAULT_THEME_DEFAULT_SETTINGS.fontSizePreset,
  defaultMobileThemePreset: DEFAULT_THEME_DEFAULT_SETTINGS.mobilePreset ?? DEFAULT_THEME_DEFAULT_SETTINGS.preset,
  defaultMobileFontSizePreset: DEFAULT_THEME_DEFAULT_SETTINGS.mobileFontSizePreset ?? DEFAULT_THEME_DEFAULT_SETTINGS.fontSizePreset,
  postContentImageMode: "auto",
  fontSizePresets: FONT_SIZE_PRESETS,
  themePresets: THEME_PRESET_SOURCE_CONFIGS,
}

export const DEFAULT_THEME_RUNTIME_SETTINGS: ThemeRuntimeSettings = buildThemeRuntimeSettings(
  DEFAULT_THEME_CUSTOMIZATION_SETTINGS,
)

export function resolveBuiltInThemePreset(
  value: string | null | undefined,
  fallback: BuiltInThemePreset = DEFAULT_THEME_DEFAULT_SETTINGS.preset,
): BuiltInThemePreset {
  if (value === "mono") {
    return "default"
  }

  if (value === "rose") {
    return "sea"
  }

  if (value && value in THEME_PRESETS) {
    return value as BuiltInThemePreset
  }

  return fallback
}

export function normalizeFontSizePresetDefinition(value: unknown, fallback: FontSizePresetDefinition): FontSizePresetDefinition {
  const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const label = typeof candidate.label === "string" && candidate.label.trim()
    ? candidate.label.trim().slice(0, 24)
    : fallback.label
  const preview = typeof candidate.preview === "string" && candidate.preview.trim()
    ? candidate.preview.trim().slice(0, 4)
    : fallback.preview

  return {
    label,
    preview,
    size: normalizeCustomThemeFontSize(candidate.size, fallback.size),
  }
}

export function normalizeEditableThemePresetDefinition(value: unknown, fallback: EditableThemePresetDefinition): EditableThemePresetDefinition {
  const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const label = typeof candidate.label === "string" && candidate.label.trim()
    ? candidate.label.trim().slice(0, 24)
    : fallback.label
  const description = typeof candidate.description === "string" && candidate.description.trim()
    ? candidate.description.trim().slice(0, 120)
    : fallback.description

  return {
    label,
    description,
    light: normalizeCustomThemeModeConfig(candidate.light, fallback.light),
    dark: normalizeCustomThemeModeConfig(candidate.dark, fallback.dark),
  }
}

export function resolveThemeCustomizationSettings(value: unknown): ThemeCustomizationSettings {
  const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const rawFontSizePresets = candidate.fontSizePresets && typeof candidate.fontSizePresets === "object"
    ? candidate.fontSizePresets as Record<string, unknown>
    : {}
  const rawThemePresets = candidate.themePresets && typeof candidate.themePresets === "object"
    ? candidate.themePresets as Record<string, unknown>
    : {}
  const defaultThemePreset = resolveBuiltInThemePreset(typeof candidate.defaultThemePreset === "string" ? candidate.defaultThemePreset : null)
  const defaultFontSizePreset = resolveStoredFontSizePreset(
    typeof candidate.defaultFontSizePreset === "string" ? candidate.defaultFontSizePreset : null,
  )
  const defaultPreference = resolveStoredThemePreference(
    typeof candidate.defaultPreference === "string"
      ? candidate.defaultPreference
      : typeof candidate.defaultThemePreference === "string"
        ? candidate.defaultThemePreference
        : null,
    DEFAULT_THEME_DEFAULT_SETTINGS.preference,
  )
  const postContentImageMode = candidate.postContentImageMode === "large" || candidate.postContentImageMode === "small"
    ? candidate.postContentImageMode
    : "auto"

  return {
    defaultPreference,
    defaultThemePreset,
    defaultFontSizePreset,
    defaultMobileThemePreset: resolveBuiltInThemePreset(
      typeof candidate.defaultMobileThemePreset === "string" ? candidate.defaultMobileThemePreset : null,
      defaultThemePreset,
    ),
    defaultMobileFontSizePreset: resolveStoredFontSizePreset(
      typeof candidate.defaultMobileFontSizePreset === "string" ? candidate.defaultMobileFontSizePreset : null,
      defaultFontSizePreset,
    ),
    postContentImageMode,
    fontSizePresets: {
      compact: normalizeFontSizePresetDefinition(rawFontSizePresets.compact, DEFAULT_THEME_CUSTOMIZATION_SETTINGS.fontSizePresets.compact),
      normal: normalizeFontSizePresetDefinition(rawFontSizePresets.normal, DEFAULT_THEME_CUSTOMIZATION_SETTINGS.fontSizePresets.normal),
      relaxed: normalizeFontSizePresetDefinition(rawFontSizePresets.relaxed, DEFAULT_THEME_CUSTOMIZATION_SETTINGS.fontSizePresets.relaxed),
    },
    themePresets: {
      default: normalizeEditableThemePresetDefinition(rawThemePresets.default, DEFAULT_THEME_CUSTOMIZATION_SETTINGS.themePresets.default),
      sea: normalizeEditableThemePresetDefinition(rawThemePresets.sea, DEFAULT_THEME_CUSTOMIZATION_SETTINGS.themePresets.sea),
      jade: normalizeEditableThemePresetDefinition(rawThemePresets.jade, DEFAULT_THEME_CUSTOMIZATION_SETTINGS.themePresets.jade),
      amber: normalizeEditableThemePresetDefinition(rawThemePresets.amber, DEFAULT_THEME_CUSTOMIZATION_SETTINGS.themePresets.amber),
      graphite: normalizeEditableThemePresetDefinition(rawThemePresets.graphite, DEFAULT_THEME_CUSTOMIZATION_SETTINGS.themePresets.graphite),
    },
  }
}

export function buildThemePresetDefinition(input: EditableThemePresetDefinition): ThemePresetDefinition {
  return {
    label: input.label,
    description: input.description,
    preview: [
      hexToHslValue(input.light.primary),
      hexToHslValue(input.light.background),
      hexToHslValue(input.light.border),
    ],
    values: buildCustomThemeVariables({
      light: input.light,
      dark: input.dark,
      typography: DEFAULT_CUSTOM_THEME_CONFIG.typography,
      customCss: "",
    }),
  }
}

export function buildThemeRuntimeSettings(settings: ThemeCustomizationSettings): ThemeRuntimeSettings {
  return {
    preference: settings.defaultPreference,
    preset: settings.defaultThemePreset,
    fontSizePreset: settings.defaultFontSizePreset,
    mobilePreset: settings.defaultMobileThemePreset,
    mobileFontSizePreset: settings.defaultMobileFontSizePreset,
    postContentImageMode: settings.postContentImageMode,
    customization: settings,
    fontSizePresets: settings.fontSizePresets,
    themePresets: {
      default: buildThemePresetDefinition(settings.themePresets.default),
      sea: buildThemePresetDefinition(settings.themePresets.sea),
      jade: buildThemePresetDefinition(settings.themePresets.jade),
      amber: buildThemePresetDefinition(settings.themePresets.amber),
      graphite: buildThemePresetDefinition(settings.themePresets.graphite),
    },
  }
}

function resolveThemeRuntimeSettings(settings?: ThemeRuntimeSettings | ThemeCustomizationSettings | ThemeDefaultSettings): ThemeRuntimeSettings {
  if (settings && "preset" in settings && "fontSizePreset" in settings && "themePresets" in settings && "fontSizePresets" in settings) {
    return settings as ThemeRuntimeSettings
  }

  if (settings && "defaultThemePreset" in settings && "defaultFontSizePreset" in settings) {
    return buildThemeRuntimeSettings(resolveThemeCustomizationSettings(settings))
  }

  if (settings && "preset" in settings && "fontSizePreset" in settings) {
    return buildThemeRuntimeSettings(resolveThemeCustomizationSettings({
      ...DEFAULT_THEME_CUSTOMIZATION_SETTINGS,
      defaultPreference: settings.preference,
      defaultThemePreset: settings.preset,
      defaultFontSizePreset: settings.fontSizePreset,
      defaultMobileThemePreset: settings.mobilePreset ?? settings.preset,
      defaultMobileFontSizePreset: settings.mobileFontSizePreset ?? settings.fontSizePreset,
    }))
  }

  return DEFAULT_THEME_RUNTIME_SETTINGS
}

export function getThemeDefaultsFromRuntime(
  settings: ThemeRuntimeSettings,
  options: { device?: ThemeDefaultDevice } = {},
): ThemeDefaultSettings {
  const useMobileDefaults = options.device === "mobile"

  return {
    preference: settings.preference,
    preset: useMobileDefaults ? settings.mobilePreset : settings.preset,
    fontSizePreset: useMobileDefaults ? settings.mobileFontSizePreset : settings.fontSizePreset,
    mobilePreset: settings.mobilePreset,
    mobileFontSizePreset: settings.mobileFontSizePreset,
  }
}

export function getThemeDefaultsForCurrentDevice(
  settings: ThemeRuntimeSettings | ThemeCustomizationSettings | ThemeDefaultSettings = DEFAULT_THEME_RUNTIME_SETTINGS,
): ThemeDefaultSettings {
  return getThemeDefaultsFromRuntime(resolveThemeRuntimeSettings(settings), {
    device: resolveThemeDefaultDeviceFromViewport(),
  })
}

let cachedThemeLocalSettingsSnapshot: ThemeLocalSettingsSnapshot = DEFAULT_THEME_LOCAL_SETTINGS_SNAPSHOT

export function readThemeLocalSettingsSnapshotFromStorage(settings: ThemeRuntimeSettings | ThemeCustomizationSettings | ThemeDefaultSettings = DEFAULT_THEME_RUNTIME_SETTINGS): ThemeLocalSettingsSnapshot {
  if (!isBrowser()) {
    return DEFAULT_THEME_LOCAL_SETTINGS_SNAPSHOT
  }

  const runtime = resolveThemeRuntimeSettings(settings)
  const deviceDefaults = getThemeDefaultsFromRuntime(runtime, {
    device: resolveThemeDefaultDeviceFromViewport(),
  })

  const preferenceExplicitFromCookie = readThemeCookieValue(THEME_PREFERENCE_EXPLICIT_STORAGE_KEY) === "1"
  const preferenceFromCookie = preferenceExplicitFromCookie ? readThemeCookieValue(THEME_STORAGE_KEY) : null
  const presetFromCookie = readThemeCookieValue(THEME_PRESET_STORAGE_KEY)
  const fontSizePresetFromCookie = readThemeCookieValue(FONT_SIZE_PRESET_STORAGE_KEY)

  syncThemeSettingFromCookie(THEME_PRESET_STORAGE_KEY, presetFromCookie)
  syncThemeSettingFromCookie(FONT_SIZE_PRESET_STORAGE_KEY, fontSizePresetFromCookie)

  const preferenceFromStorage = (() => {
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY)
    } catch {
      return null
    }
  })()
  const preferenceExplicitFromStorage = (() => {
    try {
      return window.localStorage.getItem(THEME_PREFERENCE_EXPLICIT_STORAGE_KEY) === "1"
    } catch {
      return false
    }
  })()
  const preference = preferenceExplicitFromStorage || preferenceExplicitFromCookie
    ? preferenceFromStorage ?? preferenceFromCookie
    : null
  const preset = (() => {
    try {
      return window.localStorage.getItem(THEME_PRESET_STORAGE_KEY) ?? presetFromCookie
    } catch {
      return presetFromCookie
    }
  })()
  const fontSizePreset = (() => {
    try {
      return window.localStorage.getItem(FONT_SIZE_PRESET_STORAGE_KEY) ?? fontSizePresetFromCookie
    } catch {
      return fontSizePresetFromCookie
    }
  })()

  return {
    preference: resolveStoredThemePreference(preference, deviceDefaults.preference),
    preset: resolveStoredThemePreset(preset, deviceDefaults.preset),
    fontSizePreset: resolveStoredFontSizePreset(fontSizePreset, deviceDefaults.fontSizePreset),
    customThemeConfig: readStoredCustomThemeConfig(),
  }
}

function updateThemeLocalSettingsSnapshot(nextSnapshot: ThemeLocalSettingsSnapshot) {
  cachedThemeLocalSettingsSnapshot = nextSnapshot
}

function areThemeLocalSettingsSnapshotsEqual(left: ThemeLocalSettingsSnapshot, right: ThemeLocalSettingsSnapshot) {
  return left.preference === right.preference
    && left.preset === right.preset
    && left.fontSizePreset === right.fontSizePreset
    && JSON.stringify(left.customThemeConfig) === JSON.stringify(right.customThemeConfig)
}

export function readThemeLocalSettingsSnapshot(settings: ThemeRuntimeSettings | ThemeCustomizationSettings | ThemeDefaultSettings = DEFAULT_THEME_RUNTIME_SETTINGS): ThemeLocalSettingsSnapshot {
  if (!isBrowser()) {
    return DEFAULT_THEME_LOCAL_SETTINGS_SNAPSHOT
  }

  const nextSnapshot = readThemeLocalSettingsSnapshotFromStorage(settings)

  if (!areThemeLocalSettingsSnapshotsEqual(cachedThemeLocalSettingsSnapshot, nextSnapshot)) {
    updateThemeLocalSettingsSnapshot(nextSnapshot)
  }

  return cachedThemeLocalSettingsSnapshot
}

export function subscribeThemeSettings(onStoreChange: () => void) {
  if (!isBrowser()) {
    return () => undefined
  }

  const handleChange = () => {
    updateThemeLocalSettingsSnapshot(readThemeLocalSettingsSnapshotFromStorage())
    onStoreChange()
  }
  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === THEME_STORAGE_KEY
      || event.key === THEME_PREFERENCE_EXPLICIT_STORAGE_KEY
      || event.key === THEME_PRESET_STORAGE_KEY
      || event.key === FONT_SIZE_PRESET_STORAGE_KEY
      || event.key === CUSTOM_THEME_STORAGE_KEY
      || event.key === CUSTOM_THEME_VARIABLES_STORAGE_KEY
    ) {
      handleChange()
    }
  }

  window.addEventListener(THEME_SETTINGS_CHANGE_EVENT, handleChange)
  window.addEventListener("storage", handleStorage)
  const mobileMediaQuery = typeof window.matchMedia === "function"
    ? window.matchMedia(`(max-width: ${THEME_MOBILE_BREAKPOINT - 1}px)`)
    : null
  mobileMediaQuery?.addEventListener("change", handleChange)

  return () => {
    window.removeEventListener(THEME_SETTINGS_CHANGE_EVENT, handleChange)
    window.removeEventListener("storage", handleStorage)
    mobileMediaQuery?.removeEventListener("change", handleChange)
  }
}

export function getThemePresetDisplayMeta(
  preset: ThemePreset,
  customThemeConfig?: CustomThemeConfig,
  settings: ThemeRuntimeSettings | ThemeCustomizationSettings | ThemeDefaultSettings = DEFAULT_THEME_RUNTIME_SETTINGS,
) {
  if (preset === "custom") {
    const resolvedCustomTheme = customThemeConfig ?? readStoredCustomThemeConfig()

    return {
      label: "自定义主题",
      description: "使用你自己保存的本地主题。",
      preview: [
        hexToHslValue(resolvedCustomTheme.light.primary),
        hexToHslValue(resolvedCustomTheme.light.background),
        hexToHslValue(resolvedCustomTheme.light.border),
      ] as [string, string, string],
    }
  }

  return resolveThemeRuntimeSettings(settings).themePresets[preset]
}

export function resolveStoredThemePreference(value: string | null | undefined, fallback: ThemePreference = "light"): ThemePreference {
  if (value === "dark" || value === "light" || value === "system") {
    return value
  }

  return fallback
}

export function resolveStoredThemePreset(
  value: string | null | undefined,
  fallback: BuiltInThemePreset = DEFAULT_THEME_DEFAULT_SETTINGS.preset,
): ThemePreset {
  if (value === "custom") {
    return "custom"
  }

  return resolveBuiltInThemePreset(value, fallback)
}

export function resolveStoredFontSizePreset(
  value: string | null | undefined,
  fallback: FontSizePreset = DEFAULT_THEME_DEFAULT_SETTINGS.fontSizePreset,
): FontSizePreset {
  if (value === "compact" || value === "normal" || value === "relaxed") {
    return value
  }

  return fallback
}

export interface ThemeDocumentProps {
  dataFontSizePreset: FontSizePreset
  dataThemePreset: ThemePreset
  requiresBootGuard: boolean
  rootClassName: "" | "dark"
  rootStyle: Record<string, string>
}

export interface ThemeDocumentResolveOptions {
  device?: ThemeDefaultDevice
}

export function resolveThemeDocumentPropsFromCookieString(
  cookieString: string | null | undefined,
  settings: ThemeRuntimeSettings | ThemeCustomizationSettings | ThemeDefaultSettings = DEFAULT_THEME_RUNTIME_SETTINGS,
  options: ThemeDocumentResolveOptions = {},
): ThemeDocumentProps {
  const runtime = resolveThemeRuntimeSettings(settings)
  const deviceDefaults = getThemeDefaultsFromRuntime(runtime, { device: options.device })
  const themePreferenceExplicitCookie = readCookieValue(cookieString ?? "", THEME_PREFERENCE_EXPLICIT_STORAGE_KEY) === "1"
  const themePreferenceCookie = themePreferenceExplicitCookie ? readCookieValue(cookieString ?? "", THEME_STORAGE_KEY) : null
  const themePresetCookie = readCookieValue(cookieString ?? "", THEME_PRESET_STORAGE_KEY)
  const fontSizePresetCookie = readCookieValue(cookieString ?? "", FONT_SIZE_PRESET_STORAGE_KEY)
  const resolvedPreference = resolveStoredThemePreference(themePreferenceCookie, deviceDefaults.preference)
  const resolvedPreset = resolveStoredThemePreset(themePresetCookie, deviceDefaults.preset)
  const resolvedFontSizePreset = resolveStoredFontSizePreset(fontSizePresetCookie, deviceDefaults.fontSizePreset)
  const requiresBootGuard = resolvedPreference === "system"
    || resolvedPreset === "custom"
    || !themePreferenceCookie
    || !themePresetCookie
    || !fontSizePresetCookie

  if (requiresBootGuard || (resolvedPreference !== "light" && resolvedPreference !== "dark")) {
    return {
      dataFontSizePreset: resolvedFontSizePreset,
      dataThemePreset: resolvedPreset,
      requiresBootGuard: true,
      rootClassName: "",
      rootStyle: {},
    }
  }

  const rootStyle: Record<string, string> = {
    colorScheme: resolvedPreference,
    fontSize: runtime.fontSizePresets[resolvedFontSizePreset].size,
  }
  const presetValues = (runtime.themePresets[resolvedPreset]?.values[resolvedPreference] ?? {}) as ThemeVariableMap

  for (const variableName of THEME_VARIABLE_NAMES) {
    const variableValue = presetValues[variableName]
    if (typeof variableValue === "string" && variableValue.length > 0) {
      rootStyle[`--${variableName}`] = variableValue
    }
  }

  return {
    dataFontSizePreset: resolvedFontSizePreset,
    dataThemePreset: resolvedPreset,
    requiresBootGuard: false,
    rootClassName: resolvedPreference === "dark" ? "dark" : "",
    rootStyle,
  }
}

function applyThemePreset(preset: ThemePreset, mode: ThemeMode, settings: ThemeRuntimeSettings | ThemeCustomizationSettings | ThemeDefaultSettings = DEFAULT_THEME_RUNTIME_SETTINGS) {
  const root = document.documentElement
  const runtime = resolveThemeRuntimeSettings(settings)
  const presetValues = preset === "custom"
    ? readStoredCustomThemeVariables()[mode]
    : (runtime.themePresets[preset]?.values[mode] ?? {}) as ThemeVariableMap

  root.dataset.themePreset = preset
  for (const variableName of THEME_VARIABLE_NAMES) {
    const variableValue = presetValues[variableName]
    if (typeof variableValue === "string" && variableValue.length > 0) {
      root.style.setProperty(`--${variableName}`, variableValue)
    } else {
      root.style.removeProperty(`--${variableName}`)
    }
  }
}

function applyFontSizePreset(fontSizePreset: FontSizePreset, settings: ThemeRuntimeSettings | ThemeCustomizationSettings | ThemeDefaultSettings = DEFAULT_THEME_RUNTIME_SETTINGS) {
  const root = document.documentElement
  const runtime = resolveThemeRuntimeSettings(settings)
  root.dataset.fontSizePreset = fontSizePreset
  root.style.fontSize = runtime.fontSizePresets[fontSizePreset].size
}

function applyCustomThemeTypography(config: CustomThemeConfig) {
  const root = document.documentElement
  root.style.setProperty("--theme-font-family", config.typography.fontFamily)
  root.style.fontSize = config.typography.fontSize
}

function applyCustomThemeCss(config: CustomThemeConfig) {
  const existingElement = document.getElementById(CUSTOM_THEME_STYLE_ELEMENT_ID)

  if (!config.customCss.trim()) {
    existingElement?.remove()
    return
  }

  const styleElement = existingElement instanceof HTMLStyleElement
    ? existingElement
    : Object.assign(document.createElement("style"), { id: CUSTOM_THEME_STYLE_ELEMENT_ID })

  styleElement.textContent = config.customCss
  if (!styleElement.parentNode) {
    document.head.appendChild(styleElement)
  }
}

export function applyTheme(
  mode: ThemeMode,
  preset: ThemePreset = "default",
  fontSizePreset: FontSizePreset = "normal",
  settings: ThemeRuntimeSettings | ThemeCustomizationSettings | ThemeDefaultSettings = DEFAULT_THEME_RUNTIME_SETTINGS,
) {
  const root = document.documentElement
  root.style.colorScheme = mode
  applyThemePreset(preset, mode, settings)
  if (preset === "custom") {
    const customThemeConfig = readStoredCustomThemeConfig()
    applyCustomThemeTypography(customThemeConfig)
    applyCustomThemeCss(customThemeConfig)
  } else {
    root.style.removeProperty("--theme-font-family")
    document.getElementById(CUSTOM_THEME_STYLE_ELEMENT_ID)?.remove()
    applyFontSizePreset(fontSizePreset, settings)
  }
}
