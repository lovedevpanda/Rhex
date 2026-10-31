type HeaderStore = Pick<Headers, "get">

/**
 * Trusted proxy CIDRs. By default we trust loopback and RFC1918 private ranges,
 * which covers the common deployment where a reverse proxy (Nginx, Caddy,
 * Cloudflare Tunnel, the Docker bridge gateway, …) appends the real client IP to
 * `X-Forwarded-For`.
 *
 * Operators behind a different topology can override this with the
 * `TRUSTED_PROXIES` environment variable (comma-separated CIDRs). Set it to `*`
 * to trust everything (discouraged — it reverts to trusting client-supplied
 * headers) or to an empty string to disable XFF handling entirely.
 */
const DEFAULT_TRUSTED_CIDRS = [
  "127.0.0.0/8",
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "169.254.0.0/16",
  "::1/128",
  "fc00::/7",
  "fe80::/10",
]

function parseTrustedCidrs(): string[] {
  const raw = process.env.TRUSTED_PROXIES?.trim()
  if (!raw) {
    return DEFAULT_TRUSTED_CIDRS
  }
  if (raw === "*") {
    return []
  }
  return raw.split(",").map((item) => item.trim()).filter(Boolean)
}

function ipToLong(ip: string): number | null {
  const parts = ip.split(".")
  if (parts.length !== 4) {
    return null
  }
  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null
    }
    const n = Number(part)
    if (n > 255) {
      return null
    }
    value = (value << 8) | n
  }
  return value >>> 0
}

function isIpInCidr(ip: string, cidr: string): boolean {
  const [base, bitsValue] = cidr.split("/")
  const bits = Number(bitsValue)
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) {
    return false
  }
  const ipLong = ipToLong(ip)
  const baseLong = ipToLong(base ?? "")
  if (ipLong === null || baseLong === null) {
    return false
  }
  if (bits === 0) {
    return true
  }
  const mask = (0xffffffff << (32 - bits)) >>> 0
  return (ipLong & mask) === (baseLong & mask)
}

function isTrustedProxy(ip: string, cidrs: string[]): boolean {
  return cidrs.some((cidr) => isIpInCidr(ip, cidr))
}

export function normalizeIp(value: string | null) {
  if (!value) {
    return null
  }

  const normalized = value.trim()

  if (!normalized || normalized.length > 64) {
    return null
  }

  const bracketedMatch = normalized.match(/^\[([^\]]+)\](?::\d+)?$/)
  const ipv4WithPortMatch = normalized.match(/^((?:\d{1,3}\.){3}\d{1,3}):\d+$/)

  const withoutPort = bracketedMatch
    ? bracketedMatch[1]
    : (ipv4WithPortMatch ? ipv4WithPortMatch[1] : normalized)

  if (/^[0-9a-fA-F:.]+$/.test(withoutPort)) {
    return withoutPort.toLowerCase()
  }

  return null
}

/**
 * Resolve the real client IP from request headers.
 *
 * Security fix: previously the **leftmost** `X-Forwarded-For` value was used,
 * which is fully attacker-controlled and allowed bypassing login rate limits
 * and brute-force protections. We now walk the XFF list from the right (the hop
 * appended by our trusted edge proxy, closest to the server) and return the
 * first entry that is NOT a trusted proxy. An external attacker can prepend any
 * value they like, but the trusted proxy overwrites/extends the list after it,
 * so the rightmost untrusted entry is always the genuine client IP.
 */
export function getRequestIpFromHeaders(
  headers: HeaderStore,
  options: { trustedCidrs?: string[] } = {},
) {
  const trustedCidrs = options.trustedCidrs ?? parseTrustedCidrs()

  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const candidates = forwarded
      .split(",")
      .map((candidate) => normalizeIp(candidate))
      .filter((value): value is string => Boolean(value))

    if (candidates.length > 0) {
      for (let index = candidates.length - 1; index >= 0; index--) {
        if (!isTrustedProxy(candidates[index]!, trustedCidrs)) {
          return candidates[index]
        }
      }
      // Entire chain is trusted proxies (e.g. internal forwarding hops).
      return candidates[candidates.length - 1]!
    }
  }

  // XFF absent — fall back to headers set by the edge proxy. These remain
  // spoofable if a client can reach the app directly without a trusted proxy,
  // so they are only authoritative behind one (the default deployment).
  const realIp = normalizeIp(headers.get("x-real-ip"))
  if (realIp) {
    return realIp
  }

  return normalizeIp(headers.get("cf-connecting-ip"))
}

export function getRequestIp(request: Pick<Request, "headers">) {
  return getRequestIpFromHeaders(request.headers)
}
