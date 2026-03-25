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
    const firstForwarded = forwarded.split(",")[0] ?? null
    const normalizedForwarded = normalizeIpCandidate(firstForwarded)

    if (normalizedForwarded) {
      return normalizedForwarded
    }
  }

  return normalizeIpCandidate(request.headers.get("x-real-ip"))
}
