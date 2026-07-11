import { safeOutboundFetch } from "@/lib/safe-outbound-http"

const FRIEND_LINK_VERIFY_ACCEPT_HEADER = "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5,*/*;q=0.1"
const FRIEND_LINK_VERIFY_USER_AGENT = "Rhex FriendLink Verifier/1.0"
const FRIEND_LINK_VERIFY_TIMEOUT_MS = 8_000
const FRIEND_LINK_VERIFY_MAX_RESPONSE_BYTES = 1_048_576
const FRIEND_LINK_VERIFY_MAX_REDIRECTS = 3

async function readResponseText(response: Response, maxResponseBytes: number) {
  const reader = response.body?.getReader()
  if (!reader) {
    return ""
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
  return body
}

function normalizeComparableHostname(hostname: string) {
  return hostname.trim().toLowerCase().replace(/^www\./, "")
}

function decodeHtmlAttributeValue(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .trim()
}

export function hrefPointsToSite(href: string, pageUrl: string, siteOrigin: string) {
  const normalizedHref = decodeHtmlAttributeValue(href)
  if (!normalizedHref || normalizedHref.startsWith("#")) {
    return false
  }

  if (/^(javascript|mailto|tel):/i.test(normalizedHref)) {
    return false
  }

  let resolvedHref: URL
  let resolvedSiteOrigin: URL

  try {
    resolvedHref = new URL(normalizedHref, pageUrl)
    resolvedSiteOrigin = new URL(siteOrigin)
  } catch {
    return false
  }

  if (!["http:", "https:"].includes(resolvedHref.protocol)) {
    return false
  }

  return normalizeComparableHostname(resolvedHref.hostname) === normalizeComparableHostname(resolvedSiteOrigin.hostname)
}

export function pageContainsSiteLink(html: string, pageUrl: string, siteOrigin: string) {
  const anchorHrefPattern = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/gi

  for (const match of html.matchAll(anchorHrefPattern)) {
    const href = match[1] ?? match[2] ?? match[3] ?? ""
    if (hrefPointsToSite(href, pageUrl, siteOrigin)) {
      return true
    }
  }

  return false
}

async function fetchPlacementPage(pageUrl: string) {
  let currentUrl = pageUrl

  for (let redirectCount = 0; redirectCount <= FRIEND_LINK_VERIFY_MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FRIEND_LINK_VERIFY_TIMEOUT_MS)

    try {
      const response = await safeOutboundFetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: FRIEND_LINK_VERIFY_ACCEPT_HEADER,
          "User-Agent": FRIEND_LINK_VERIFY_USER_AGENT,
        },
      })

      const status = response.status
      const location = response.headers.get("location")

      if (status >= 300 && status < 400) {
        if (!location) {
          throw new Error(`收到 ${status} 重定向但缺少 Location`)
        }

        currentUrl = new URL(location, currentUrl).toString()
        continue
      }

      if (!response.ok) {
        throw new Error(`抓取失败，HTTP ${status}`)
      }

      return {
        finalUrl: currentUrl,
        html: await readResponseText(response, FRIEND_LINK_VERIFY_MAX_RESPONSE_BYTES),
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  throw new Error(`重定向次数超过上限 ${FRIEND_LINK_VERIFY_MAX_REDIRECTS}`)
}

export interface FriendLinkPlacementReviewResult {
  autoApproved: boolean
  matched: boolean
  reviewNote: string
}

export async function reviewFriendLinkPlacement(pageUrl: string, siteOrigin: string): Promise<FriendLinkPlacementReviewResult> {
  try {
    const { finalUrl, html } = await fetchPlacementPage(pageUrl)
    const matched = pageContainsSiteLink(html, finalUrl, siteOrigin)

    if (matched) {
      return {
        autoApproved: true,
        matched: true,
        reviewNote: "系统自动审核通过：已检测到本站链接。",
      }
    }

    return {
      autoApproved: false,
      matched: false,
      reviewNote: "系统自动检查未发现本站链接，已转人工审核。",
    }
  } catch (error) {
    console.warn("[friend-links] auto review skipped", error)

    return {
      autoApproved: false,
      matched: false,
      reviewNote: "系统自动检查失败，已转人工审核。",
    }
  }
}
