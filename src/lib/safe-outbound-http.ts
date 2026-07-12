import "server-only"

import { lookup as dnsLookup } from "node:dns/promises"
import http from "node:http"
import https from "node:https"
import { isIP } from "node:net"
import { Readable } from "node:stream"

export type SafeOutboundTarget = {
  url: URL
  address: string
  family: 4 | 6
}

type SafeOutboundFetchInit = Omit<RequestInit, "redirect"> & {
  /** Redirects are intentionally never followed automatically. */
  redirect?: "manual"
}

function isBlockedIpv4(address: string) {
  const parts = address.split(".").map((part) => Number.parseInt(part, 10))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }

  const [first, second] = parts as [number, number, number, number]
  return first === 0
    || first === 10
    || first === 100 && second >= 64 && second <= 127
    || first === 127
    || first === 169 && second === 254
    || first === 172 && second >= 16 && second <= 31
    || first === 192 && (second === 0 || second === 168)
    || first === 198 && (second === 18 || second === 19 || second === 51)
    || first === 203 && second === 0
    || first >= 224
}

function isBlockedIpv6(address: string) {
  const normalized = address.toLowerCase()

  if (normalized === "::" || normalized === "::1" || normalized.startsWith("::ffff:")) {
    return true
  }

  // Globally routable IPv6 is 2000::/3. Rejecting the rest covers ULA,
  // link-local, multicast, documentation, IPv4-mapped, and reserved ranges.
  const firstNibble = normalized[0]
  return firstNibble !== "2" && firstNibble !== "3"
}

export function isPublicOutboundIp(address: string) {
  const family = isIP(address)
  if (family === 4) {
    return !isBlockedIpv4(address)
  }

  if (family === 6) {
    return !isBlockedIpv6(address)
  }

  return false
}

function normalizeUrlHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase()
  return normalized.startsWith("[") && normalized.endsWith("]")
    ? normalized.slice(1, -1)
    : normalized
}

function parseOutboundUrl(input: string | URL) {
  const url = new URL(input)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("仅允许 http 或 https 出网地址")
  }

  if (url.username || url.password) {
    throw new Error("出网地址不允许包含账号密码")
  }

  const hostname = normalizeUrlHostname(url.hostname)
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("禁止访问本地或局域网地址")
  }

  return url
}

/**
 * Resolves a public target once. The resulting address is used by safeOutboundFetch,
 * preventing a second DNS resolution from turning into a DNS-rebinding SSRF.
 */
export async function resolveSafeOutboundTarget(input: string | URL): Promise<SafeOutboundTarget> {
  const url = parseOutboundUrl(input)
  const hostname = normalizeUrlHostname(url.hostname)
  const ipFamily = isIP(hostname)

  if (ipFamily === 4 || ipFamily === 6) {
    if (!isPublicOutboundIp(hostname)) {
      throw new Error("禁止访问内网或保留 IP 地址")
    }
    return { url, address: hostname, family: ipFamily }
  }

  const addresses = await dnsLookup(hostname, { all: true, verbatim: true })
  if (addresses.length === 0) {
    throw new Error("目标主机解析失败")
  }

  if (addresses.some((entry) => !isPublicOutboundIp(entry.address))) {
    throw new Error("目标主机解析到了内网或保留 IP 地址")
  }

  const selected = addresses[0]
  if (!selected || (selected.family !== 4 && selected.family !== 6)) {
    throw new Error("目标主机解析到了不支持的地址")
  }

  return { url, address: selected.address, family: selected.family }
}

function headersToNodeHeaders(headers: HeadersInit | undefined) {
  const resolved = new Headers(headers)
  // The Host header must remain aligned with URL hostname and TLS SNI; callers
  // must not override it after the target has been validated.
  resolved.delete("host")
  return Object.fromEntries(resolved.entries())
}

function toRequestBody(body: BodyInit | null | undefined) {
  if (body === null || typeof body === "undefined") {
    return undefined
  }
  if (typeof body === "string" || body instanceof Uint8Array) {
    return body
  }
  if (body instanceof ArrayBuffer) {
    return Buffer.from(body)
  }
  throw new Error("安全出网请求仅支持字符串、Uint8Array 或 ArrayBuffer 请求体")
}

/**
 * Performs one explicitly validated request. It never follows redirects. A custom
 * DNS lookup pins the TCP connection to the address verified above while keeping
 * the original hostname for Host and HTTPS SNI.
 */
export async function safeOutboundFetch(input: string | URL, init: SafeOutboundFetchInit = {}): Promise<Response> {
  const target = await resolveSafeOutboundTarget(input)
  const requestModule = target.url.protocol === "https:" ? https : http
  const requestBody = toRequestBody(init.body)
  const signal = init.signal

  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("The operation was aborted", "AbortError")
  }

  return new Promise<Response>((resolve, reject) => {
    let settled = false
    const settleReject = (error: Error) => {
      if (!settled) {
        settled = true
        reject(error)
      }
    }

    const request = requestModule.request({
      protocol: target.url.protocol,
      hostname: target.url.hostname,
      port: target.url.port || undefined,
      path: `${target.url.pathname}${target.url.search}`,
      method: init.method ?? "GET",
      headers: headersToNodeHeaders(init.headers),
      lookup: (_hostname, _options, callback) => callback(null, target.address, target.family),
      servername: target.url.hostname,
    }, (response) => {
      if (settled) {
        response.resume()
        return
      }
      settled = true

      const body = Readable.toWeb(response) as unknown as ReadableStream<Uint8Array>
      resolve(new Response(body, {
        status: response.statusCode ?? 502,
        statusText: response.statusMessage ?? "",
        headers: response.headers as HeadersInit,
      }))
    })

    const abort = () => request.destroy(signal?.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError"))
    signal?.addEventListener("abort", abort, { once: true })
    request.once("error", settleReject)
    request.once("close", () => signal?.removeEventListener("abort", abort))

    if (requestBody) {
      request.end(requestBody)
    } else {
      request.end()
    }
  })
}
