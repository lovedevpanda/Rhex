export function extractSummaryFromContent(content: string, maxLength = 140) {
  const normalized = content.replace(/\s+/g, " ").trim()

  if (!normalized) {
    return ""
  }

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength).trimEnd()}…`
}
