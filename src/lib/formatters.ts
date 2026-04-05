const BUSINESS_TIME_ZONE = "Asia/Shanghai"
const BUSINESS_TIME_ZONE_OFFSET_MINUTES = 8 * 60

type SupportedDateInput = string | Date

function getDateParts(date = new Date(), timeZone = BUSINESS_TIME_ZONE) {

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  const parts = formatter.formatToParts(date)
  const year = parts.find((item) => item.type === "year")?.value
  const month = parts.find((item) => item.type === "month")?.value
  const day = parts.find((item) => item.type === "day")?.value

  if (!year || !month || !day) {
    throw new Error("无法解析日期")
  }

  return { year, month, day }
}

function getTimeParts(date = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const hour = parts.find((item) => item.type === "hour")?.value
  const minute = parts.find((item) => item.type === "minute")?.value

  if (!hour || !minute) {
    throw new Error("无法解析时间")
  }

  return {
    hour: Number(hour),
    minute: Number(minute),
  }
}

function parseBusinessDateTimeInput(input: string) {
  const normalized = input.trim()
  const matched = normalized.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/)

  if (!matched) {
    return null
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "00"] = matched
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)

  if ([year, month, day, hour, minute, second].some((value) => Number.isNaN(value))) {
    return null
  }

  const utcTime = Date.UTC(year, month - 1, day, hour, minute, second) - BUSINESS_TIME_ZONE_OFFSET_MINUTES * 60 * 1000
  const date = new Date(utcTime)

  return Number.isNaN(date.getTime()) ? null : date
}


export function parseBusinessDateTime(input: string | null | undefined) {
  if (!input) {
    return null
  }

  return parseBusinessDateTimeInput(String(input))
}

function normalizeDate(input: SupportedDateInput) {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input
  }

  const businessDate = parseBusinessDateTimeInput(input)
  if (businessDate) {
    return businessDate
  }

  const date = new Date(input)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatWithOptions(input: string | Date, options: Intl.DateTimeFormatOptions, locale = "zh-CN") {

  const date = normalizeDate(input)

  if (!date) {
    return typeof input === "string" ? input : "-"
  }

  return new Intl.DateTimeFormat(locale, {
    timeZone: BUSINESS_TIME_ZONE,
    ...options,
  }).format(date)
}

function formatToParts(input: SupportedDateInput, options: Intl.DateTimeFormatOptions, locale = "zh-CN") {

  const date = normalizeDate(input)
  if (!date) {
    return null
  }

  return new Intl.DateTimeFormat(locale, {
    timeZone: BUSINESS_TIME_ZONE,
    ...options,
  }).formatToParts(date)
}

export function getLocalDateKey(date = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const { year, month, day } = getDateParts(date, timeZone)
  return `${year}-${month}-${day}`
}

export function getMonthKey(date = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const { year, month } = getDateParts(date, timeZone)
  return `${year}-${month}`
}

export function getMonthTitle(monthKey: string) {
  const [year, month] = monthKey.split("-")
  return `${year} 年 ${Number(month)} 月`
}

export function formatDateTime(input: SupportedDateInput, locale = "zh-CN") {

  return formatWithOptions(input, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }, locale)
}

export function serializeDateTime(input: string | Date | null | undefined) {
  if (!input) {
    return null
  }

  const parts = formatToParts(input, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  if (!parts) {
    return null
  }

  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""

  return `${getPart("year")}-${getPart("month")}-${getPart("day")} ${getPart("hour")}:${getPart("minute")}:${getPart("second")}`
}

export function formatPreciseDateTime(input: string | Date | null | undefined) {
  const serialized = serializeDateTime(input)
  return serialized ? serialized.slice(0, 16) : null
}

export function serializeDate(input: string | Date | null | undefined) {
  if (!input) {
    return null
  }

  const parts = formatToParts(input, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  if (!parts) {
    return null
  }

  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`
}

export function getBusinessDayRange(date = new Date()) {
  const dayKey = serializeDate(date)
  if (!dayKey) {
    throw new Error("无法计算业务日期边界")
  }

  const [year, month, day] = dayKey.split("-").map(Number)
  const start = new Date(Date.UTC(year, month - 1, day, 0 - 8, 0, 0, 0))
  const end = new Date(Date.UTC(year, month - 1, day + 1, 0 - 8, 0, 0, 0))

  return { start, end, dayKey }
}

export function getBusinessMinuteOfDay(date = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const { hour, minute } = getTimeParts(date, timeZone)
  return hour * 60 + minute
}

export function formatMonthDayTime(input: string | Date, locale = "zh-CN") {

  return formatWithOptions(input, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }, locale)
}

export function formatRelativeTime(input: SupportedDateInput, locale = "zh-CN") {

  const date = normalizeDate(input)

  if (!date) {
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

export function formatBusinessMonthDayTime(input: SupportedDateInput, locale = "zh-CN") {
  return formatMonthDayTime(input, locale)
}

export { BUSINESS_TIME_ZONE }


