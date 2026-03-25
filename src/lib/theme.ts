export const THEME_STORAGE_KEY = "bbs-theme"

export type ThemeMode = "light" | "dark"
export type ThemePreference = ThemeMode | "system"

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

export function applyTheme(preference: ThemePreference) {
  const resolvedTheme = resolveThemeMode(preference)
  const root = document.documentElement

  root.classList.toggle("dark", resolvedTheme === "dark")
  root.style.colorScheme = resolvedTheme
}

export function getThemeInitScript() {
  return `(function(){try{var storageKey="${THEME_STORAGE_KEY}";var storedTheme=window.localStorage.getItem(storageKey);var preference=storedTheme==="dark"||storedTheme==="light"||storedTheme==="system"?storedTheme:"light";var media=window.matchMedia("(prefers-color-scheme: dark)");var resolvedTheme=preference==="system"?(media.matches?"dark":"light"):preference;var root=document.documentElement;root.classList.toggle("dark",resolvedTheme==="dark");root.style.colorScheme=resolvedTheme;}catch(error){document.documentElement.style.colorScheme="light";}})();`
}
