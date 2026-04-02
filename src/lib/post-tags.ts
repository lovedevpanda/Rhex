export const MAX_MANUAL_TAGS = 10

export function normalizeManualTags(tags?: string[]) {
  if (!Array.isArray(tags)) {
    return []
  }

  return tags
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, array) => array.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index)
    .slice(0, MAX_MANUAL_TAGS)
}
