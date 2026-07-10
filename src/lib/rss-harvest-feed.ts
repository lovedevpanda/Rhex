import { createHash } from "node:crypto"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

import { XMLParser } from "fast-xml-parser"

import type { Prisma, RssLogLevel } from "@/db/types"
import { toPrismaJsonValue } from "@/lib/shared/prisma-json"
import { safeOutboundFetch } from "@/lib/safe-outbound-http"

const RSS_ACCEPT_HEADER = "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.2"

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: false,
  htmlEntities: false,
})

export type RssFeedLogWriter = (
  level: RssLogLevel,
  stage: string,
  message: string,
  detail?: unknown,
) => void

export type ParsedFeedItem = {
  guid: string | null
  linkUrl: string | null
  title: string
  author: string | null
  summary: string | null
  contentHtml: string | null
  contentText: string | null
  publishedAt: Date | null
  dedupeKey: string
  rawJson: Prisma.InputJsonValue
}

export type ParsedFeed = {
  title: string | null
  items: ParsedFeedItem[]
}

export type FetchFeedResult = {
  finalUrl: string
  httpStatus: number
  contentType: string | null
  responseBytes: number
  body: string
}

function asArray<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value
  }

  if (value === null || typeof value === "undefined") {
    return [] as T[]
  }

  return [value]
}

function decodeBasicXmlEntities(value: string) {
  const decodeCodePoint = (rawCode: string, radix: number, original: string) => {
    const parsed = Number.parseInt(rawCode, radix)
    if (Number.isNaN(parsed) || !Number.isInteger(parsed) || parsed < 0 || parsed > 0x10ffff) {
      return original
    }

    try {
      return String.fromCodePoint(parsed)
    } catch {
      return original
    }
  }

  return value
    .replace(/&#(\d+);/g, (match, code) => decodeCodePoint(code, 10, match))
    .replace(/&#x([0-9a-f]+);/gi, (match, code) => decodeCodePoint(code, 16, match))
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
}

function textFromUnknown(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = decodeBasicXmlEntities(value).trim()
    return trimmed || null
  }

  if (!value || typeof value !== "object") {
    return null
  }

  const record = value as Record<string, unknown>
  const textValue = record["#text"] ?? record._ ?? record.value
  if (typeof textValue === "string") {
    const trimmed = decodeBasicXmlEntities(textValue).trim()
    return trimmed || null
  }

  return null
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const resolved = textFromUnknown(value)
    if (resolved) {
      return resolved
    }
  }

  return null
}

function stripHtmlTags(value: string | null) {
  if (!value) {
    return null
  }

  const normalized = decodeBasicXmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()

  return normalized || null
}

function parseOptionalDate(value: string | null) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function buildDedupeKey(item: {
  guid: string | null
  linkUrl: string | null
  title: string
  contentText: string | null
  publishedAt: Date | null
}) {
  const base = item.guid || item.linkUrl || `${item.title}\n${item.contentText ?? ""}\n${item.publishedAt?.toISOString() ?? ""}`
  return createHash("sha256").update(base).digest("hex")
}

function isPrivateIpv4(ip: string) {
  const [a = 0, b = 0] = ip.split(".").map((item) => Number(item))

  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a >= 224) return true

  return false
}

function isPrivateIpv6(ip: string) {
  const normalized = ip.toLowerCase()

  if (normalized === "::1" || normalized === "::") return true
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true

  return false
}

async function assertSafeOutboundUrl(rawUrl: string) {
  const url = new URL(rawUrl)

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("仅允许抓取 http 或 https 地址")
  }

  if (url.username || url.password) {
    throw new Error("抓取地址不允许包含账号密码")
  }

  const hostname = url.hostname.trim().toLowerCase()
  if (!hostname) {
    throw new Error("抓取地址缺少主机名")
  }

  if (hostname === "localhost" || hostname.endsWith(".local")) {
    throw new Error("禁止抓取本地或局域网地址")
  }

  const ipVersion = isIP(hostname)
  if (ipVersion === 4) {
    if (isPrivateIpv4(hostname)) {
      throw new Error("禁止抓取内网 IPv4 地址")
    }
    return
  }

  if (ipVersion === 6) {
    if (isPrivateIpv6(hostname)) {
      throw new Error("禁止抓取内网 IPv6 地址")
    }
    return
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true })
  if (addresses.length === 0) {
    throw new Error("主机名解析失败")
  }

  for (const address of addresses) {
    if ((address.family === 4 && isPrivateIpv4(address.address)) || (address.family === 6 && isPrivateIpv6(address.address))) {
      throw new Error("目标主机解析到了内网地址，已拒绝访问")
    }
  }
}

async function readResponseText(response: Response, maxResponseBytes: number) {
  const reader = response.body?.getReader()
  if (!reader) {
    return { body: "", responseBytes: 0 }
  }

  let total = 0
  let body = ""
  const decoder = new TextDecoder()

  while (true) {
    const chunk = await reader.read()
    if (chunk.done) {
      break
    }

    total += chunk.value.byteLength
    if (total > maxResponseBytes) {
      throw new Error(`响应体超过上限 ${maxResponseBytes} 字节`)
    }

    body += decoder.decode(chunk.value, { stream: true })
  }

  body += decoder.decode()

  return {
    body,
    responseBytes: total,
  }
}

export async function fetchFeedXml(params: {
  feedUrl: string
  fetchTimeoutMs: number
  maxResponseBytes: number
  maxRedirects: number
  userAgent: string
  onLog: RssFeedLogWriter
}): Promise<FetchFeedResult> {
  let currentUrl = params.feedUrl

  for (let redirectCount = 0; redirectCount <= params.maxRedirects; redirectCount += 1) {
    await assertSafeOutboundUrl(currentUrl)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), params.fetchTimeoutMs)

    try {
      params.onLog("INFO", "fetch", "开始抓取 RSS 源", { url: currentUrl })

      const response = await safeOutboundFetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: RSS_ACCEPT_HEADER,
          "User-Agent": params.userAgent,
        },
      })

      const status = response.status
      const location = response.headers.get("location")

      if (status >= 300 && status < 400) {
        if (!location) {
          throw new Error(`收到 ${status} 重定向但缺少 Location`)
        }

        currentUrl = new URL(location, currentUrl).toString()
        params.onLog("INFO", "fetch", "检测到重定向，继续校验并抓取", {
          status,
          nextUrl: currentUrl,
        })
        continue
      }

      if (!response.ok) {
        throw new Error(`抓取失败，HTTP ${status}`)
      }

      const contentType = response.headers.get("content-type")
      const { body, responseBytes } = await readResponseText(response, params.maxResponseBytes)

      params.onLog("INFO", "fetch", "RSS 响应读取完成", {
        status,
        contentType,
        responseBytes,
      })

      return {
        finalUrl: currentUrl,
        httpStatus: status,
        contentType,
        responseBytes,
        body,
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  throw new Error(`重定向次数超过上限 ${params.maxRedirects}`)
}

function resolveRssItemLink(rawValue: unknown, baseUrl: string) {
  const value = firstText(rawValue)
  if (!value) {
    return null
  }

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

function resolveAtomLink(rawValue: unknown, baseUrl: string) {
  const candidates = asArray(rawValue as Record<string, unknown> | Array<Record<string, unknown>>)

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue
    }

    const href = typeof candidate.href === "string" ? candidate.href.trim() : ""
    const rel = typeof candidate.rel === "string" ? candidate.rel.trim() : ""
    if (!href) {
      continue
    }

    if (rel && rel !== "alternate") {
      continue
    }

    try {
      return new URL(href, baseUrl).toString()
    } catch {
      continue
    }
  }

  return null
}

function mapRssItem(item: Record<string, unknown>, baseUrl: string): ParsedFeedItem | null {
  const title = firstText(item.title) ?? firstText(item.link)
  if (!title) {
    return null
  }

  const contentHtml = firstText(item["content:encoded"], item.description, item.content)
  const contentText = stripHtmlTags(contentHtml)
  const guid = firstText(item.guid)
  const linkUrl = resolveRssItemLink(item.link, baseUrl)
  const publishedAt = parseOptionalDate(firstText(item.pubDate, item["dc:date"], item.published))

  return {
    guid,
    linkUrl,
    title,
    author: firstText(item.author, item["dc:creator"], item.creator),
    summary: firstText(item.description, item.summary) ?? contentText,
    contentHtml,
    contentText,
    publishedAt,
    dedupeKey: buildDedupeKey({
      guid,
      linkUrl,
      title,
      contentText,
      publishedAt,
    }),
    rawJson: toPrismaJsonValue(item) ?? {},
  }
}

function mapAtomEntry(entry: Record<string, unknown>, baseUrl: string): ParsedFeedItem | null {
  const title = firstText(entry.title) ?? resolveAtomLink(entry.link, baseUrl)
  if (!title) {
    return null
  }

  const contentHtml = firstText(entry.content, entry.summary)
  const contentText = stripHtmlTags(contentHtml)
  const guid = firstText(entry.id)
  const linkUrl = resolveAtomLink(entry.link, baseUrl)
  const authorValue = typeof entry.author === "object" && entry.author
    ? firstText((entry.author as Record<string, unknown>).name, entry.author)
    : firstText(entry.author)
  const publishedAt = parseOptionalDate(firstText(entry.updated, entry.published))

  return {
    guid,
    linkUrl,
    title,
    author: authorValue,
    summary: firstText(entry.summary) ?? contentText,
    contentHtml,
    contentText,
    publishedAt,
    dedupeKey: buildDedupeKey({
      guid,
      linkUrl,
      title,
      contentText,
      publishedAt,
    }),
    rawJson: toPrismaJsonValue(entry) ?? {},
  }
}

export function parseFeedXml(xml: string, baseUrl: string): ParsedFeed {
  const parsed = xmlParser.parse(xml) as Record<string, unknown>

  if (parsed.rss && typeof parsed.rss === "object") {
    const channel = (parsed.rss as Record<string, unknown>).channel as Record<string, unknown> | undefined
    if (!channel) {
      throw new Error("RSS 文档缺少 channel")
    }

    return {
      title: firstText(channel.title),
      items: asArray(channel.item as Record<string, unknown> | Array<Record<string, unknown>>)
        .map((item) => mapRssItem(item, baseUrl))
        .filter((item): item is ParsedFeedItem => Boolean(item)),
    }
  }

  if (parsed.feed && typeof parsed.feed === "object") {
    const feed = parsed.feed as Record<string, unknown>
    return {
      title: firstText(feed.title),
      items: asArray(feed.entry as Record<string, unknown> | Array<Record<string, unknown>>)
        .map((entry) => mapAtomEntry(entry, baseUrl))
        .filter((item): item is ParsedFeedItem => Boolean(item)),
    }
  }

  if (parsed["rdf:RDF"] && typeof parsed["rdf:RDF"] === "object") {
    const feed = parsed["rdf:RDF"] as Record<string, unknown>
    const channel = typeof feed.channel === "object" && feed.channel ? feed.channel as Record<string, unknown> : null

    return {
      title: firstText(channel?.title),
      items: asArray(feed.item as Record<string, unknown> | Array<Record<string, unknown>>)
        .map((item) => mapRssItem(item, baseUrl))
        .filter((item): item is ParsedFeedItem => Boolean(item)),
    }
  }

  throw new Error("无法识别 RSS/Atom 文档结构")
}

export function resolveRssHarvestErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return "RSS 抓取失败"
}
