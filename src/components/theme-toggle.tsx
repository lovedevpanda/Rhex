"use client"

import { Monitor, Moon, Palette, Sun, Type } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"

import { Button } from "@/components/ui/rbutton"
import {
  FONT_SIZE_PRESET_STORAGE_KEY,
  FONT_SIZE_PRESETS,
  THEME_PRESET_STORAGE_KEY,
  THEME_PRESETS,
  THEME_SETTINGS_CHANGE_EVENT,
  type FontSizePreset,
  type ThemePreference,
  type ThemePreset,
  getThemePresetDisplayMeta,
  readStoredCustomThemeConfig,
  resolveStoredFontSizePreset,
  resolveStoredThemePreset,
  setStoredFontSizePreset,
  setStoredThemePreference,
  setStoredThemePreset,
} from "@/lib/theme"

const themeMeta: Record<ThemePreference, { label: string; icon: typeof Sun }> = {
  light: {
    label: "白天模式",
    icon: Sun,
  },
  dark: {
    label: "黑夜模式",
    icon: Moon,
  },
  system: {
    label: "跟随系统",
    icon: Monitor,
  },
}

const themeOptions: ThemePreference[] = ["light", "dark", "system"]
const themePresetOptions = Object.entries(THEME_PRESETS) as Array<[keyof typeof THEME_PRESETS, (typeof THEME_PRESETS)[keyof typeof THEME_PRESETS]]>
const fontSizePresetOptions = Object.entries(FONT_SIZE_PRESETS) as Array<[FontSizePreset, (typeof FONT_SIZE_PRESETS)[FontSizePreset]]>

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [themePreset, setThemePreset] = useState<ThemePreset>(() => {
    if (typeof window === "undefined") {
      return "default"
    }

    return resolveStoredThemePreset(window.localStorage.getItem(THEME_PRESET_STORAGE_KEY))
  })
  const [fontSizePreset, setFontSizePreset] = useState<FontSizePreset>(() => {
    if (typeof window === "undefined") {
      return "normal"
    }

    return resolveStoredFontSizePreset(window.localStorage.getItem(FONT_SIZE_PRESET_STORAGE_KEY))
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  )

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node

      if (!menuRef.current?.contains(target)) {
        setMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [menuOpen])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const syncThemeState = () => {
      setThemePreset(resolveStoredThemePreset(window.localStorage.getItem(THEME_PRESET_STORAGE_KEY)))
      setFontSizePreset(resolveStoredFontSizePreset(window.localStorage.getItem(FONT_SIZE_PRESET_STORAGE_KEY)))
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_PRESET_STORAGE_KEY || event.key === FONT_SIZE_PRESET_STORAGE_KEY || event.key === "rhex-custom-theme") {
        syncThemeState()
      }
    }

    window.addEventListener(THEME_SETTINGS_CHANGE_EVENT, syncThemeState)
    window.addEventListener("storage", handleStorage)

    return () => {
      window.removeEventListener(THEME_SETTINGS_CHANGE_EVENT, syncThemeState)
      window.removeEventListener("storage", handleStorage)
    }
  }, [])

  function handleThemeSelect(preference: ThemePreference) {
    setTheme(preference)
    setStoredThemePreference(preference)
  }

  function handlePresetSelect(preset: ThemePreset) {
    setStoredThemePreset(preset)
    setThemePreset(preset)
  }

  function handleFontSizePresetSelect(preset: FontSizePreset) {
    setStoredFontSizePreset(preset)
    setFontSizePreset(preset)
  }

  const currentTheme: ThemePreference = mounted && (theme === "light" || theme === "dark" || theme === "system")
    ? theme
    : "light"
  const currentPreset = mounted ? themePreset : "default"
  const currentMeta = themeMeta[currentTheme]
  const CurrentIcon = currentMeta.icon
  const currentPresetMeta = getThemePresetDisplayMeta(currentPreset, readStoredCustomThemeConfig())

  return (
    <div ref={menuRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        className="h-7 gap-1 rounded-full border border-border bg-background px-2 hover:bg-accent"
        onClick={() => setMenuOpen((current) => !current)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={mounted ? `当前${currentMeta.label}，主题 ${currentPresetMeta.label}` : "切换主题"}
        title={mounted ? `当前${currentMeta.label}，主题 ${currentPresetMeta.label}` : "切换主题"}
      >
        <CurrentIcon className="h-3.5 w-3.5" />
        <span
          className="h-2 w-2 rounded-full border border-white/60"
          style={{ backgroundColor: "hsl(var(--primary))" }}
          aria-hidden="true"
        />
      </Button>

      {menuOpen ? (
        <div className="fixed left-2 right-2 top-14 z-50 max-h-[calc(100vh-4rem)] overflow-y-auto rounded-xl border border-border bg-background p-1.5 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+8px)] sm:max-h-none sm:w-72 sm:overflow-visible" role="menu" aria-label="主题模式">
          <div className="flex items-center gap-1.5 px-1 pb-1 pt-0.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
            <Sun className="h-3 w-3" />
            <span>界面模式</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {themeOptions.map((option) => {
              const meta = themeMeta[option]
              const Icon = meta.icon
              const active = currentTheme === option

              return (
                <button
                  key={option}
                  type="button"
                  className={active ? "flex h-7.5 w-full items-center justify-center rounded-full bg-foreground text-background shadow-xs" : "flex h-7.5 w-full items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-accent"}
                  onClick={() => handleThemeSelect(option)}
                  role="menuitemradio"
                  aria-checked={active}
                  aria-label={meta.label}
                  title={meta.label}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              )
            })}
          </div>

          <div className="mx-1.5 my-1.5 border-t border-border" />
          <div className="flex items-center gap-1.5 px-1 pb-1 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
            <Palette className="h-3 w-3" />
            <span>主题预设</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {themePresetOptions.map(([presetKey, presetMeta]) => {
              const active = currentPreset === presetKey

              return (
                <button
                  key={presetKey}
                  type="button"
                  onClick={() => handlePresetSelect(presetKey)}
                  className={active ? "flex h-7.5 w-full items-center justify-center rounded-full border border-foreground/10 bg-accent px-1 shadow-xs" : "flex h-7.5 w-full items-center justify-center rounded-full border border-border bg-background px-1 transition-colors hover:bg-accent"}
                  aria-label={presetMeta.label}
                  title={presetMeta.label}
                >
                  <span className="flex items-center gap-1">
                    {presetMeta.preview.map((color: string) => (
                      <span
                        key={`${presetKey}-${color}`}
                        className={active ? "h-2.5 w-2.5 rounded-full border border-white/70 shadow-xs" : "h-2.5 w-2.5 rounded-full border border-white/60 shadow-xs"}
                        style={{ backgroundColor: `hsl(${color})` }}
                        aria-hidden="true"
                      />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mx-1.5 my-1.5 border-t border-border" />
          <div className="flex items-center gap-1.5 px-1 pb-1 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
            <Type className="h-3 w-3" />
            <span>字号预设</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {fontSizePresetOptions.map(([presetKey, presetMeta]) => {
              const active = fontSizePreset === presetKey

              return (
                <button
                  key={presetKey}
                  type="button"
                  onClick={() => handleFontSizePresetSelect(presetKey)}
                  className={active ? "flex h-7.5 w-full items-center justify-center rounded-full bg-foreground text-background shadow-xs" : "flex h-7.5 w-full items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-accent"}
                  aria-label={presetMeta.label}
                  title={presetMeta.label}
                >
                  <span className={presetKey === "compact" ? "text-[10px] font-semibold leading-none" : presetKey === "relaxed" ? "text-[13px] font-semibold leading-none" : "text-[11px] font-semibold leading-none"}>
                    A
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
