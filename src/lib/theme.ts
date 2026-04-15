export const THEME_STORAGE_KEY = "rhex-theme"
export const THEME_PRESET_STORAGE_KEY = "rhex-theme-preset"
export const FONT_SIZE_PRESET_STORAGE_KEY = "rhex-font-size-preset"
export const CUSTOM_THEME_STORAGE_KEY = "rhex-custom-theme"
export const CUSTOM_THEME_VARIABLES_STORAGE_KEY = "rhex-custom-theme-variables"
export const THEME_SETTINGS_CHANGE_EVENT = "rhex-theme-settings-change"
export const CUSTOM_THEME_STYLE_ELEMENT_ID = "rhex-custom-theme-style"
export const DEFAULT_THEME_FONT_FAMILY = "\"Microsoft YaHei\", \"PingFang SC\", \"Helvetica Neue\", Helvetica, Arial, sans-serif"
export const DEFAULT_THEME_FONT_SIZE = "16px"

export type ThemeMode = "light" | "dark"
export type ThemePreference = ThemeMode | "system"
export type FontSizePreset = "compact" | "normal" | "relaxed"
export type ThemePreset = keyof typeof THEME_PRESETS | "custom"
type ThemeVariableName = "background" | "foreground" | "card" | "card-foreground" | "primary" | "primary-foreground" | "secondary" | "secondary-foreground" | "muted" | "muted-foreground" | "accent" | "accent-foreground" | "border" | "ring"
type ThemeVariableMap = Partial<Record<ThemeVariableName, string>>

interface CustomThemeModeConfig {
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

type ThemePresetDefinition = {
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
    size: "14px",
    preview: "A-",
  },
  normal: {
    label: "正常",
    size: "16px",
    preview: "A",
  },
  relaxed: {
    label: "宽松",
    size: "17px",
    preview: "A+",
  },
} as const satisfies Record<FontSizePreset, { label: string; size: string; preview: string }>

const THEME_PRESET_SCRIPT_VALUES = Object.fromEntries(
  Object.entries(THEME_PRESETS).map(([key, preset]) => [key, preset.values]),
) as Record<string, (typeof THEME_PRESETS)[keyof typeof THEME_PRESETS]["values"]>

const FONT_SIZE_PRESET_SCRIPT_VALUES = Object.fromEntries(
  Object.entries(FONT_SIZE_PRESETS).map(([key, preset]) => [key, preset.size]),
) as Record<FontSizePreset, string>

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
    return `${Math.max(12, Math.min(24, Math.round(value)))}px`
  }

  const normalized = String(value ?? "").trim().toLowerCase()
  const numeric = normalized.endsWith("px") ? Number.parseFloat(normalized.slice(0, -2)) : Number.parseFloat(normalized)
  if (Number.isFinite(numeric)) {
    return `${Math.max(12, Math.min(24, Math.round(numeric)))}px`
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

function notifyThemeSettingsChanged() {
  if (!isBrowser()) {
    return
  }

  window.dispatchEvent(new Event(THEME_SETTINGS_CHANGE_EVENT))
}

function writeThemeSetting(storageKey: string, value: string) {
  if (!isBrowser()) {
    return
  }

  window.localStorage.setItem(storageKey, value)
  updateThemeLocalSettingsSnapshot(readThemeLocalSettingsSnapshotFromStorage())
  notifyThemeSettingsChanged()
}

export function setStoredThemePreference(preference: ThemePreference) {
  writeThemeSetting(THEME_STORAGE_KEY, preference)
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

export function getThemeInitScript() {
  return `
    (function () {
      try {
        var root = document.documentElement;
        var preference = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
        var preset = window.localStorage.getItem(${JSON.stringify(THEME_PRESET_STORAGE_KEY)});
        var fontSizePreset = window.localStorage.getItem(${JSON.stringify(FONT_SIZE_PRESET_STORAGE_KEY)});
        var customThemeConfigRaw = window.localStorage.getItem(${JSON.stringify(CUSTOM_THEME_STORAGE_KEY)});
        var customThemeVariablesRaw = window.localStorage.getItem(${JSON.stringify(CUSTOM_THEME_VARIABLES_STORAGE_KEY)});
        var presetValuesMap = ${JSON.stringify(THEME_PRESET_SCRIPT_VALUES)};
        var fontSizeValuesMap = ${JSON.stringify(FONT_SIZE_PRESET_SCRIPT_VALUES)};
        var variableNames = ${JSON.stringify(THEME_VARIABLE_NAMES)};
        var resolvedPreference = preference === "dark" || preference === "light" || preference === "system" ? preference : "light";
        var resolvedMode = resolvedPreference === "system"
          ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
          : resolvedPreference;
        var resolvedPreset = preset === "custom"
          ? "custom"
          : preset === "mono"
            ? "default"
            : preset === "rose"
              ? "sea"
              : (preset && presetValuesMap[preset] ? preset : "default");

        root.classList.toggle("dark", resolvedMode === "dark");
        root.style.colorScheme = resolvedMode;
        root.dataset.themePreset = resolvedPreset;

        var applyVariableMap = function (map) {
          for (var i = 0; i < variableNames.length; i += 1) {
            var variableName = variableNames[i];
            var variableValue = map && typeof map[variableName] === "string" ? map[variableName] : "";
            if (variableValue) {
              root.style.setProperty("--" + variableName, variableValue);
            } else {
              root.style.removeProperty("--" + variableName);
            }
          }
        };

        if (resolvedPreset === "custom") {
          var customThemeVariables = null;
          var customThemeConfig = null;

          try {
            customThemeVariables = customThemeVariablesRaw ? JSON.parse(customThemeVariablesRaw) : null;
          } catch (_error) {
            customThemeVariables = null;
          }

          try {
            customThemeConfig = customThemeConfigRaw ? JSON.parse(customThemeConfigRaw) : null;
          } catch (_error) {
            customThemeConfig = null;
          }

          applyVariableMap(customThemeVariables && customThemeVariables[resolvedMode] && typeof customThemeVariables[resolvedMode] === "object"
            ? customThemeVariables[resolvedMode]
            : null);

          var typography = customThemeConfig && customThemeConfig.typography && typeof customThemeConfig.typography === "object"
            ? customThemeConfig.typography
            : null;

          if (typography && typeof typography.fontFamily === "string" && typography.fontFamily.trim()) {
            root.style.setProperty("--theme-font-family", typography.fontFamily);
          } else {
            root.style.removeProperty("--theme-font-family");
          }

          if (typography && typeof typography.fontSize === "string" && typography.fontSize.trim()) {
            root.style.fontSize = typography.fontSize;
          } else {
            root.style.fontSize = fontSizeValuesMap.normal;
          }

          root.removeAttribute("data-font-size-preset");

          var customCss = customThemeConfig && typeof customThemeConfig.customCss === "string"
            ? customThemeConfig.customCss.trim()
            : "";
          if (customCss) {
            var existingStyleElement = document.getElementById(${JSON.stringify(CUSTOM_THEME_STYLE_ELEMENT_ID)});
            var styleElement = existingStyleElement instanceof HTMLStyleElement
              ? existingStyleElement
              : Object.assign(document.createElement("style"), { id: ${JSON.stringify(CUSTOM_THEME_STYLE_ELEMENT_ID)} });
            styleElement.textContent = customCss;
            if (!styleElement.parentNode) {
              document.head.appendChild(styleElement);
            }
          }
        } else {
          var presetValues = presetValuesMap[resolvedPreset] && presetValuesMap[resolvedPreset][resolvedMode]
            ? presetValuesMap[resolvedPreset][resolvedMode]
            : {};
          var resolvedFontSizePreset = fontSizePreset && fontSizeValuesMap[fontSizePreset]
            ? fontSizePreset
            : "normal";

          applyVariableMap(presetValues);
          root.style.removeProperty("--theme-font-family");
          root.dataset.fontSizePreset = resolvedFontSizePreset;
          root.style.fontSize = fontSizeValuesMap[resolvedFontSizePreset];

          var customStyleElement = document.getElementById(${JSON.stringify(CUSTOM_THEME_STYLE_ELEMENT_ID)});
          if (customStyleElement) {
            customStyleElement.remove();
          }
        }
      } catch (_error) {
        // Ignore theme bootstrap failures and fall back to client sync.
      }
    })();
  `
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

let cachedThemeLocalSettingsSnapshot: ThemeLocalSettingsSnapshot = DEFAULT_THEME_LOCAL_SETTINGS_SNAPSHOT
let themeLocalSettingsCacheHydrated = false

function readThemeLocalSettingsSnapshotFromStorage(): ThemeLocalSettingsSnapshot {
  if (!isBrowser()) {
    return DEFAULT_THEME_LOCAL_SETTINGS_SNAPSHOT
  }

  return {
    preference: resolveStoredThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY)),
    preset: resolveStoredThemePreset(window.localStorage.getItem(THEME_PRESET_STORAGE_KEY)),
    fontSizePreset: resolveStoredFontSizePreset(window.localStorage.getItem(FONT_SIZE_PRESET_STORAGE_KEY)),
    customThemeConfig: readStoredCustomThemeConfig(),
  }
}

function updateThemeLocalSettingsSnapshot(nextSnapshot: ThemeLocalSettingsSnapshot) {
  cachedThemeLocalSettingsSnapshot = nextSnapshot
  themeLocalSettingsCacheHydrated = true
}

export function readThemeLocalSettingsSnapshot(): ThemeLocalSettingsSnapshot {
  if (!isBrowser()) {
    return DEFAULT_THEME_LOCAL_SETTINGS_SNAPSHOT
  }

  if (!themeLocalSettingsCacheHydrated) {
    updateThemeLocalSettingsSnapshot(readThemeLocalSettingsSnapshotFromStorage())
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
      || event.key === THEME_PRESET_STORAGE_KEY
      || event.key === FONT_SIZE_PRESET_STORAGE_KEY
      || event.key === CUSTOM_THEME_STORAGE_KEY
      || event.key === CUSTOM_THEME_VARIABLES_STORAGE_KEY
    ) {
      onStoreChange()
    }
  }

  window.addEventListener(THEME_SETTINGS_CHANGE_EVENT, handleChange)
  window.addEventListener("storage", handleStorage)

  return () => {
    window.removeEventListener(THEME_SETTINGS_CHANGE_EVENT, handleChange)
    window.removeEventListener("storage", handleStorage)
  }
}

export function getThemePresetDisplayMeta(preset: ThemePreset, customThemeConfig?: CustomThemeConfig) {
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

  return THEME_PRESETS[preset]
}

export function resolveStoredThemePreference(value: string | null | undefined): ThemePreference {
  if (value === "dark" || value === "light" || value === "system") {
    return value
  }

  return "light"
}

export function resolveSystemTheme(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function resolveThemeMode(preference: ThemePreference): ThemeMode {
  return preference === "system" ? resolveSystemTheme() : preference
}

export function resolveStoredThemePreset(value: string | null | undefined): ThemePreset {
  if (value === "custom") {
    return "custom"
  }

  if (value === "mono") {
    return "default"
  }

  if (value === "rose") {
    return "sea"
  }

  if (value && value in THEME_PRESETS) {
    return value as ThemePreset
  }

  return "default"
}

export function resolveStoredFontSizePreset(value: string | null | undefined): FontSizePreset {
  if (value === "compact" || value === "normal" || value === "relaxed") {
    return value
  }

  return "normal"
}

function applyThemePreset(preset: ThemePreset, mode: ThemeMode) {
  const root = document.documentElement
  const presetValues = preset === "custom"
    ? readStoredCustomThemeVariables()[mode]
    : (THEME_PRESETS[preset]?.values[mode] ?? {}) as ThemeVariableMap

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

function applyFontSizePreset(fontSizePreset: FontSizePreset) {
  const root = document.documentElement
  root.dataset.fontSizePreset = fontSizePreset
  root.style.fontSize = FONT_SIZE_PRESETS[fontSizePreset].size
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

export function applyTheme(preference: ThemePreference, preset: ThemePreset = "default", fontSizePreset: FontSizePreset = "normal") {
  const resolvedTheme = resolveThemeMode(preference)
  const root = document.documentElement
  root.classList.toggle("dark", resolvedTheme === "dark")
  root.style.colorScheme = resolvedTheme
  applyThemePreset(preset, resolvedTheme)
  if (preset === "custom") {
    const customThemeConfig = readStoredCustomThemeConfig()
    applyCustomThemeTypography(customThemeConfig)
    applyCustomThemeCss(customThemeConfig)
  } else {
    root.style.removeProperty("--theme-font-family")
    document.getElementById(CUSTOM_THEME_STYLE_ELEMENT_ID)?.remove()
    applyFontSizePreset(fontSizePreset)
  }
}
