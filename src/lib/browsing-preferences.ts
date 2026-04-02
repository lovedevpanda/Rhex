export interface BrowsingPreferencesSnapshot {
  dimReadPostTitles: boolean
  openPostLinksInNewTab: boolean
}

export const BROWSING_PREFERENCES_STORAGE_KEY = "rhex:browsing-preferences:v1"
export const BROWSING_PREFERENCES_CHANGE_EVENT = "rhex:browsing-preferences-change"
export const DEFAULT_BROWSING_PREFERENCES: BrowsingPreferencesSnapshot = {
  dimReadPostTitles: false,
  openPostLinksInNewTab: false,
}

let cachedSnapshot: BrowsingPreferencesSnapshot = DEFAULT_BROWSING_PREFERENCES
let cacheHydrated = false

function isBrowser() {
  return typeof window !== "undefined"
}

function normalizeBrowsingPreferences(value: unknown): BrowsingPreferencesSnapshot {
  if (!value || typeof value !== "object") {
    return DEFAULT_BROWSING_PREFERENCES
  }

  const candidate = value as Record<string, unknown>

  return {
    dimReadPostTitles: Boolean(candidate.dimReadPostTitles),
    openPostLinksInNewTab: Boolean(candidate.openPostLinksInNewTab),
  }
}

function readSnapshotFromStorage() {
  if (!isBrowser()) {
    return DEFAULT_BROWSING_PREFERENCES
  }

  try {
    const raw = window.localStorage.getItem(BROWSING_PREFERENCES_STORAGE_KEY)
    return raw ? normalizeBrowsingPreferences(JSON.parse(raw)) : DEFAULT_BROWSING_PREFERENCES
  } catch {
    return DEFAULT_BROWSING_PREFERENCES
  }
}

function updateSnapshot(nextSnapshot: BrowsingPreferencesSnapshot, syncStorage = true) {
  cachedSnapshot = nextSnapshot
  cacheHydrated = true

  if (!isBrowser()) {
    return
  }

  if (syncStorage) {
    try {
      window.localStorage.setItem(BROWSING_PREFERENCES_STORAGE_KEY, JSON.stringify(nextSnapshot))
    } catch {
      // Ignore storage failures and still update the in-memory snapshot.
    }
  }

  window.dispatchEvent(new Event(BROWSING_PREFERENCES_CHANGE_EVENT))
}

export function readBrowsingPreferencesSnapshot() {
  if (!isBrowser()) {
    return DEFAULT_BROWSING_PREFERENCES
  }

  if (!cacheHydrated) {
    cachedSnapshot = readSnapshotFromStorage()
    cacheHydrated = true
  }

  return cachedSnapshot
}

export function subscribeBrowsingPreferences(onStoreChange: () => void) {
  if (!isBrowser()) {
    return () => undefined
  }

  const handleChange = () => {
    cachedSnapshot = readSnapshotFromStorage()
    cacheHydrated = true
    onStoreChange()
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === BROWSING_PREFERENCES_STORAGE_KEY) {
      handleChange()
    }
  }

  window.addEventListener(BROWSING_PREFERENCES_CHANGE_EVENT, handleChange)
  window.addEventListener("storage", handleStorage)

  return () => {
    window.removeEventListener(BROWSING_PREFERENCES_CHANGE_EVENT, handleChange)
    window.removeEventListener("storage", handleStorage)
  }
}

export function updateBrowsingPreferences(patch: Partial<BrowsingPreferencesSnapshot>) {
  const currentSnapshot = readBrowsingPreferencesSnapshot()

  updateSnapshot({
    ...currentSnapshot,
    ...patch,
  })
}
