"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { THEME_STORAGE_KEY, type ThemePreference, applyTheme, resolveStoredThemePreference } from "@/lib/theme"

const themeMeta: Record<ThemePreference, { label: string; description: string; icon: typeof Sun }> = {
  light: {
    label: "白天模式",
    description: "使用浅色界面",
    icon: Sun,
  },
  dark: {
    label: "黑夜模式",
    description: "使用深色界面",
    icon: Moon,
  },
  system: {
    label: "跟随系统",
    description: "跟随设备主题",
    icon: Monitor,
  },
}

const themeOptions: ThemePreference[] = ["light", "dark", "system"]

export function ThemeToggle() {
  const [themePreference, setThemePreference] = useState<ThemePreference>("light")
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const nextThemePreference = resolveStoredThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY))

    applyTheme(nextThemePreference)
    setThemePreference(nextThemePreference)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || themePreference !== "system") {
      return
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => applyTheme("system")

    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [mounted, themePreference])

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

  function handleSelect(preference: ThemePreference) {
    applyTheme(preference)
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
    setThemePreference(preference)
    setMenuOpen(false)
  }

  const currentTheme = mounted ? themePreference : "light"
  const currentMeta = themeMeta[currentTheme]
  const CurrentIcon = currentMeta.icon

  return (
    <div ref={menuRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        className="h-8 gap-1.5 rounded-md border border-border bg-background/80 px-3 backdrop-blur hover:bg-accent"
        onClick={() => setMenuOpen((current) => !current)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={mounted ? `当前${currentMeta.label}` : "切换主题"}
        title={mounted ? `当前${currentMeta.label}` : "切换主题"}
      >
        <CurrentIcon className="h-4 w-4" />
      </Button>

      {menuOpen ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-48 rounded-2xl border border-border bg-background p-2 shadow-2xl" role="menu" aria-label="主题模式">
          {themeOptions.map((option) => {
            const meta = themeMeta[option]
            const Icon = meta.icon
            const active = currentTheme === option

            return (
              <button
                key={option}
                type="button"
                className={active ? "flex w-full items-center gap-3 rounded-xl bg-accent px-3 py-2 text-left" : "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-accent"}
                onClick={() => handleSelect(option)}
                role="menuitemradio"
                aria-checked={active}
              >
                <div className={active ? "flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background" : "flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground"}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{meta.label}</div>
                  <div className="text-xs text-muted-foreground">{meta.description}</div>
                </div>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
