function formatUtcDateKey(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function parseDateKeyParts(dateKey: string) {
  const matched = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!matched) {
    return null
  }

  const [, yearText, monthText, dayText] = matched
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if ([year, month, day].some((value) => Number.isNaN(value))) {
    return null
  }

  return { year, month, day }
}

export function normalizeCheckInMakeUpOldestDayLimit(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.floor(value))
}

export function getCheckInMakeUpEarliestDateKey(todayKey: string, oldestDayLimit: number) {
  const normalizedLimit = normalizeCheckInMakeUpOldestDayLimit(oldestDayLimit)

  if (normalizedLimit === 0) {
    return null
  }

  const parts = parseDateKeyParts(todayKey)
  if (!parts) {
    return null
  }

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  date.setUTCDate(date.getUTCDate() - normalizedLimit)

  return formatUtcDateKey(date)
}
