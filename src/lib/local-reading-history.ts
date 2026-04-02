import { getLocalDateKey } from "@/lib/formatters"

export interface ReadingHistoryEntry {
  postId: string | null
  postSlug: string | null
  postPath: string
  title: string
  boardName: string | null
  boardSlug: string | null
  postCreatedAt: string | null
  viewedAt: string
}

export interface ReadingHistoryRecordInput {
  postId?: string | null
  postSlug?: string | null
  postPath: string
  title: string
  boardName?: string | null
  boardSlug?: string | null
  postCreatedAt?: string | null
  viewedAt?: string | null
}

export const READING_HISTORY_STORAGE_KEY = "rhex:reading-history:v1"
export const READING_HISTORY_CHANGE_EVENT = "rhex:reading-history-change"
export const MAX_READING_HISTORY_ITEMS = 2000
export const DEFAULT_READING_HISTORY_SNAPSHOT: ReadingHistoryEntry[] = []

let cachedSnapshot: ReadingHistoryEntry[] = DEFAULT_READING_HISTORY_SNAPSHOT
let cacheHydrated = false

declare global {
  interface Window {
    __RHEX_PRELOADED_READING_HISTORY__?: ReadingHistoryEntry[]
  }
}

function isBrowser() {
  return typeof window !== "undefined"
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeDateTime(value: unknown) {
  const text = normalizeText(value)
  if (!text) {
    return null
  }

  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function buildHistoryIdentity(entry: Pick<ReadingHistoryEntry, "postId" | "postSlug" | "postPath">) {
  if (entry.postId) {
    return `id:${entry.postId}`
  }

  if (entry.postSlug) {
    return `slug:${entry.postSlug}`
  }

  return `path:${entry.postPath}`
}

function normalizeReadingHistoryEntry(value: unknown): ReadingHistoryEntry | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const candidate = value as Record<string, unknown>
  const postPath = normalizeText(candidate.postPath)
  const title = normalizeText(candidate.title)

  if (!postPath || !title) {
    return null
  }

  const viewedAt = normalizeDateTime(candidate.viewedAt) ?? new Date().toISOString()

  return {
    postId: normalizeText(candidate.postId),
    postSlug: normalizeText(candidate.postSlug),
    postPath,
    title,
    boardName: normalizeText(candidate.boardName),
    boardSlug: normalizeText(candidate.boardSlug),
    postCreatedAt: normalizeDateTime(candidate.postCreatedAt),
    viewedAt,
  }
}

export function normalizeReadingHistoryPath(path: string) {
  const trimmed = path.trim()
  if (!trimmed) {
    return ""
  }

  const [pathWithoutHash] = trimmed.split("#", 1)
  const [pathWithoutSearch] = pathWithoutHash.split("?", 1)

  return pathWithoutSearch || ""
}

function normalizeReadingHistoryList(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  const dedupedEntries: ReadingHistoryEntry[] = []
  const seenIdentities = new Set<string>()

  for (const item of value) {
    const normalizedItem = normalizeReadingHistoryEntry(item)
    if (!normalizedItem) {
      continue
    }

    const identity = buildHistoryIdentity(normalizedItem)
    if (seenIdentities.has(identity)) {
      continue
    }

    seenIdentities.add(identity)
    dedupedEntries.push(normalizedItem)

    if (dedupedEntries.length >= MAX_READING_HISTORY_ITEMS) {
      break
    }
  }

  return dedupedEntries
}

function readSnapshotFromStorage() {
  if (!isBrowser()) {
    return []
  }

  if (Array.isArray(window.__RHEX_PRELOADED_READING_HISTORY__)) {
    return normalizeReadingHistoryList(window.__RHEX_PRELOADED_READING_HISTORY__)
  }

  try {
    const raw = window.localStorage.getItem(READING_HISTORY_STORAGE_KEY)
    return normalizeReadingHistoryList(raw ? JSON.parse(raw) : [])
  } catch {
    return []
  }
}

function updateSnapshot(entries: ReadingHistoryEntry[], syncStorage = true) {
  cachedSnapshot = entries
  cacheHydrated = true

  if (!isBrowser()) {
    return
  }

  if (syncStorage) {
    try {
      window.localStorage.setItem(READING_HISTORY_STORAGE_KEY, JSON.stringify(entries))
    } catch {
      // Ignore quota or storage failures and still keep the in-memory snapshot available.
    }
  }

  window.__RHEX_PRELOADED_READING_HISTORY__ = entries

  window.dispatchEvent(new Event(READING_HISTORY_CHANGE_EVENT))
}

export function readReadingHistorySnapshot() {
  if (!isBrowser()) {
    return []
  }

  if (!cacheHydrated) {
    cachedSnapshot = readSnapshotFromStorage()
    cacheHydrated = true
  }

  return cachedSnapshot
}

export function subscribeReadingHistory(onStoreChange: () => void) {
  if (!isBrowser()) {
    return () => undefined
  }

  const handleChange = () => {
    cachedSnapshot = readSnapshotFromStorage()
    cacheHydrated = true
    onStoreChange()
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === READING_HISTORY_STORAGE_KEY) {
      handleChange()
    }
  }

  window.addEventListener(READING_HISTORY_CHANGE_EVENT, handleChange)
  window.addEventListener("storage", handleStorage)

  return () => {
    window.removeEventListener(READING_HISTORY_CHANGE_EVENT, handleChange)
    window.removeEventListener("storage", handleStorage)
  }
}

export function recordReadingHistory(input: ReadingHistoryRecordInput) {
  const title = normalizeText(input.title)
  const postPath = normalizeText(input.postPath)

  if (!title || !postPath) {
    return readReadingHistorySnapshot()
  }

  const nextEntry: ReadingHistoryEntry = {
    postId: normalizeText(input.postId),
    postSlug: normalizeText(input.postSlug),
    postPath,
    title,
    boardName: normalizeText(input.boardName),
    boardSlug: normalizeText(input.boardSlug),
    postCreatedAt: normalizeDateTime(input.postCreatedAt),
    viewedAt: normalizeDateTime(input.viewedAt) ?? new Date().toISOString(),
  }
  const nextIdentity = buildHistoryIdentity(nextEntry)
  const currentEntries = readReadingHistorySnapshot()
  const nextEntries = [nextEntry, ...currentEntries.filter((item) => buildHistoryIdentity(item) !== nextIdentity)]
    .slice(0, MAX_READING_HISTORY_ITEMS)

  updateSnapshot(nextEntries)

  return nextEntries
}

export function clearReadingHistory() {
  if (isBrowser()) {
    try {
      window.localStorage.removeItem(READING_HISTORY_STORAGE_KEY)
    } catch {
      // Ignore storage failures and still clear the in-memory snapshot.
    }
  }

  updateSnapshot([], false)
}

export function filterReadingHistoryByDate(entries: ReadingHistoryEntry[], dayKey: string) {
  return entries.filter((entry) => getLocalDateKey(new Date(entry.viewedAt)) === dayKey)
}

export function hasVisitedPostPath(entries: ReadingHistoryEntry[], path: string) {
  const normalizedPath = normalizeReadingHistoryPath(path)

  if (!normalizedPath) {
    return false
  }

  return entries.some((entry) => normalizeReadingHistoryPath(entry.postPath) === normalizedPath)
}

export function getReadingHistoryInitScript() {
  return `
    (function () {
      try {
        var raw = window.localStorage.getItem(${JSON.stringify(READING_HISTORY_STORAGE_KEY)});
        var parsed = raw ? JSON.parse(raw) : [];
        window.__RHEX_PRELOADED_READING_HISTORY__ = Array.isArray(parsed) ? parsed : [];
      } catch (_error) {
        window.__RHEX_PRELOADED_READING_HISTORY__ = [];
      }
    })();
  `
}

export function listReadingHistory(limit?: number) {
  const entries = readReadingHistorySnapshot()

  if (!limit || limit < 1) {
    return entries
  }

  return entries.slice(0, limit)
}

export function listTodayReadingHistory(limit?: number) {
  const todayEntries = filterReadingHistoryByDate(readReadingHistorySnapshot(), getLocalDateKey())

  if (!limit || limit < 1) {
    return todayEntries
  }

  return todayEntries.slice(0, limit)
}
