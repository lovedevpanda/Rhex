export const MAX_MANUAL_TAGS = 10
export const MAX_VISIBLE_AUTO_TAGS = 10
export const AUTO_EXTRACTED_TAG_POOL_SIZE = 30

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
