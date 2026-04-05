export interface TimestampCursorPayload {
  id: string
  createdAt: string
}

export interface PinnedTimestampCursorPayload extends TimestampCursorPayload {
  isPinned: boolean
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url")
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}

export function encodeTimestampCursor(payload: TimestampCursorPayload) {
  return encodeBase64Url(JSON.stringify(payload))
}

export function decodeTimestampCursor(value?: string | null): TimestampCursorPayload | null {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(value)) as Partial<TimestampCursorPayload>

    if (typeof parsed.id !== "string" || typeof parsed.createdAt !== "string") {
      return null
    }

    return {
      id: parsed.id,
      createdAt: parsed.createdAt,
    }
  } catch {
    return null
  }
}

export function encodePinnedTimestampCursor(payload: PinnedTimestampCursorPayload) {
  return encodeBase64Url(JSON.stringify(payload))
}

export function decodePinnedTimestampCursor(value?: string | null): PinnedTimestampCursorPayload | null {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(value)) as Partial<PinnedTimestampCursorPayload>

    if (typeof parsed.id !== "string" || typeof parsed.createdAt !== "string" || typeof parsed.isPinned !== "boolean") {
      return null
    }

    return {
      id: parsed.id,
      createdAt: parsed.createdAt,
      isPinned: parsed.isPinned,
    }
  } catch {
    return null
  }
}
