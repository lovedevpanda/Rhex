"use client"

import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextTheme,
  type UseThemeProps,
} from "next-themes"
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react"

import {
  DEFAULT_THEME_LOCAL_SETTINGS_SNAPSHOT,
  DEFAULT_THEME_RUNTIME_SETTINGS,
  THEME_STORAGE_KEY,
  applyTheme,
  getThemeDefaultsFromRuntime,
  notifyThemeSettingsChanged,
  readThemeLocalSettingsSnapshot,
  resolveStoredThemePreference,
  subscribeThemeSettings,
  type ThemeDefaultDevice,
  type ThemeMode,
  type ThemePreference,
  type ThemeRuntimeSettings,
  writeStoredThemePreferenceCookie,
} from "@/lib/theme"

interface ThemeContextValue {
  forcedTheme?: string
  resolvedTheme: ThemeMode
  setTheme: Dispatch<SetStateAction<string>>
  systemTheme: ThemeMode
  theme: ThemePreference
  themeSettings?: ThemeRuntimeSettings
  themes: ThemePreference[]
}

const THEME_CONTEXT_FALLBACK: ThemeContextValue = {
  resolvedTheme: "light",
  setTheme: () => undefined,
  systemTheme: "light",
  theme: "light",
  themes: ["light", "dark", "system"],
}

const ThemeSettingsContext = createContext<ThemeRuntimeSettings | undefined>(undefined)

function resolveThemeMode(value: UseThemeProps["resolvedTheme"]): ThemeMode {
  return value === "dark" ? "dark" : "light"
}

export function useTheme(): ThemeContextValue {
  const nextTheme = useNextTheme()
  const themeSettings = useContext(ThemeSettingsContext)
  const theme = resolveStoredThemePreference(nextTheme.theme)

  return {
    forcedTheme: nextTheme.forcedTheme,
    resolvedTheme: resolveThemeMode(nextTheme.resolvedTheme),
    setTheme: nextTheme.setTheme,
    systemTheme: resolveThemeMode(nextTheme.systemTheme),
    theme,
    themeSettings,
    themes: THEME_CONTEXT_FALLBACK.themes,
  }
}

export function ThemeProvider({
  children,
  defaultDevice = "desktop",
  settings: themeSettings,
}: {
  children: ReactNode
  defaultDevice?: ThemeDefaultDevice
  settings?: ThemeRuntimeSettings
}) {
  const defaultTheme = themeSettings?.preference ?? DEFAULT_THEME_RUNTIME_SETTINGS.preference

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      disableTransitionOnChange
      enableColorScheme
      enableSystem
      storageKey={THEME_STORAGE_KEY}
      themes={["light", "dark", "system"]}
    >
      <ThemeSettingsContext.Provider value={themeSettings}>
        <ThemeRuntimeSync defaultDevice={defaultDevice} settings={themeSettings} />
        {children}
      </ThemeSettingsContext.Provider>
    </NextThemesProvider>
  )
}

function ThemeRuntimeSync({
  defaultDevice,
  settings: themeSettings,
}: {
  defaultDevice: ThemeDefaultDevice
  settings?: ThemeRuntimeSettings
}) {
  const {
    resolvedTheme: nextResolvedTheme,
    setTheme: setNextTheme,
    theme: nextTheme,
  } = useNextTheme()
  const syncedInitialThemeRef = useRef(false)
  const serverSnapshot = useMemo(
    () => {
      const runtimeSettings = themeSettings ?? DEFAULT_THEME_RUNTIME_SETTINGS
      const defaults = getThemeDefaultsFromRuntime(runtimeSettings, { device: defaultDevice })

      return {
        ...DEFAULT_THEME_LOCAL_SETTINGS_SNAPSHOT,
        preference: defaults.preference,
        preset: defaults.preset,
        fontSizePreset: defaults.fontSizePreset,
      }
    },
    [defaultDevice, themeSettings],
  )
  const localSettings = useSyncExternalStore(
    subscribeThemeSettings,
    () => readThemeLocalSettingsSnapshot(themeSettings),
    () => serverSnapshot,
  )
  const resolvedTheme = resolveThemeMode(nextResolvedTheme)

  const syncPreferenceSideEffects = useCallback((preference: ThemePreference) => {
    writeStoredThemePreferenceCookie(preference)
    notifyThemeSettingsChanged()
  }, [])

  useEffect(() => {
    const currentPreference = resolveStoredThemePreference(nextTheme)

    if (syncedInitialThemeRef.current) {
      syncPreferenceSideEffects(currentPreference)
      return
    }

    syncedInitialThemeRef.current = true
    const storedPreference = readThemeLocalSettingsSnapshot(themeSettings).preference

    if (storedPreference !== currentPreference) {
      setNextTheme(storedPreference)
      return
    }

    syncPreferenceSideEffects(currentPreference)
  }, [nextTheme, setNextTheme, syncPreferenceSideEffects, themeSettings])

  useLayoutEffect(() => {
    try {
      applyTheme(
        resolvedTheme,
        localSettings.preset,
        localSettings.fontSizePreset,
        themeSettings ?? DEFAULT_THEME_RUNTIME_SETTINGS,
      )
    } finally {
      document.documentElement.setAttribute("data-root-init", "ready")
    }
  }, [
    localSettings.customThemeConfig,
    localSettings.fontSizePreset,
    localSettings.preset,
    resolvedTheme,
    themeSettings,
  ])

  return null
}
