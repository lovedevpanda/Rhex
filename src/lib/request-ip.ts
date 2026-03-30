function normalizeIpCandidate(value: string | null) {
  if (!value) {
    return null
  }

  const normalized = value.trim()

  if (!normalized || normalized.length > 64) {
    return null
  }

  const withoutPort = normalized.startsWith("[")
    ? normalized.replace(/^\[([^\]]+)\](?::\d+)?$/, "$1")
    : normalized.replace(/:\d+$/, "")

  if (/^[0-9a-fA-F:.]+$/.test(withoutPort)) {
    return withoutPort
  }

  return null
}

export function getRequestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    for (const candidate of forwarded.split(",")) {
      const normalizedForwarded = normalizeIpCandidate(candidate)
      if (normalizedForwarded) {
        return normalizedForwarded
      }
    }
  }

  const realIp = normalizeIpCandidate(request.headers.get("x-real-ip"))
  if (realIp) {
    return realIp
  }

  return normalizeIpCandidate(request.headers.get("cf-connecting-ip"))
}
