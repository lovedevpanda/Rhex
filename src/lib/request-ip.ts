type HeaderStore = Pick<Headers, "get">

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

export function getRequestIpFromHeaders(headers: HeaderStore) {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    for (const candidate of forwarded.split(",")) {
      const normalizedForwarded = normalizeIp(candidate)
      if (normalizedForwarded) {
        return normalizedForwarded
      }
    }
  }

  const realIp = normalizeIp(headers.get("x-real-ip"))
  if (realIp) {
    return realIp
  }

  return normalizeIp(headers.get("cf-connecting-ip"))
}

export function getRequestIp(request: Pick<Request, "headers">) {
  return getRequestIpFromHeaders(request.headers)
}
