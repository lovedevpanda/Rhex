function formatWithOptions(input: string | Date, options: Intl.DateTimeFormatOptions, locale = "zh-CN") {
  const date = input instanceof Date ? input : new Date(input)

  if (Number.isNaN(date.getTime())) {
    return typeof input === "string" ? input : "-"
  }

  return new Intl.DateTimeFormat(locale, options).format(date)
}

export function formatDateTime(input: string | Date, locale = "zh-CN") {
  return formatWithOptions(input, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }, locale)
}

export function formatMonthDayTime(input: string | Date, locale = "zh-CN") {
  return formatWithOptions(input, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }, locale)
}

export function formatRelativeTime(input: string | Date, locale = "zh-CN") {
  const date = input instanceof Date ? input : new Date(input)

  if (Number.isNaN(date.getTime())) {
    return typeof input === "string" ? input : "-"
  }

  const now = Date.now()
  const diffSeconds = Math.round((date.getTime() - now) / 1000)
  const absSeconds = Math.abs(diffSeconds)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

  if (absSeconds < 60) {
    return formatter.format(diffSeconds, "second")
  }

  const diffMinutes = Math.round(diffSeconds / 60)
  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute")
  }

  const diffHours = Math.round(diffSeconds / 3600)
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour")
  }

  const diffDays = Math.round(diffSeconds / 86400)
  if (Math.abs(diffDays) < 30) {
    return formatter.format(diffDays, "day")
  }

  return formatDateTime(date, locale)
}
