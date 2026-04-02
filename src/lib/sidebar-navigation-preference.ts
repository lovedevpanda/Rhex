export const SIDEBAR_COLLAPSED_STORAGE_KEY = "rhex:sidebar-navigation-collapsed"
const SIDEBAR_COLLAPSED_CHANGE_EVENT = "rhex:sidebar-navigation-collapsed-change"

export function getSidebarNavigationInitScript() {
  return `
    try {
      var collapsed = window.localStorage.getItem(${JSON.stringify(SIDEBAR_COLLAPSED_STORAGE_KEY)}) === "1";
      document.documentElement.dataset.sidebarCollapsed = collapsed ? "true" : "false";
    } catch (_error) {
      document.documentElement.dataset.sidebarCollapsed = "false";
    }
  `
}

export function readSidebarNavigationCollapsedSnapshot() {
  if (typeof document === "undefined") {
    return false
  }

  return document.documentElement.dataset.sidebarCollapsed === "true"
}

export function subscribeSidebarNavigationPreference(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined
  }

  const handleChange = () => {
    onStoreChange()
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === SIDEBAR_COLLAPSED_STORAGE_KEY) {
      onStoreChange()
    }
  }

  window.addEventListener(SIDEBAR_COLLAPSED_CHANGE_EVENT, handleChange)
  window.addEventListener("storage", handleStorage)

  return () => {
    window.removeEventListener(SIDEBAR_COLLAPSED_CHANGE_EVENT, handleChange)
    window.removeEventListener("storage", handleStorage)
  }
}

export function setSidebarNavigationCollapsedPreference(collapsed: boolean) {
  if (typeof document === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0")
  } catch {
    // Ignore storage failures and still update the in-memory DOM snapshot.
  }

  document.documentElement.dataset.sidebarCollapsed = collapsed ? "true" : "false"

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_CHANGE_EVENT))
  }
}
