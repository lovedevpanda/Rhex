import { findUsersByMentionTexts } from "@/db/mention-queries"

const MENTION_PATTERN = /(^|[\s\p{P}\p{S}])@([^\s@]{1,20})/gu

export function extractMentionTexts(content: string) {
  const mentionTexts = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = MENTION_PATTERN.exec(content)) !== null) {
    const mentionText = match[2]?.trim()
    if (mentionText) {
      mentionTexts.add(mentionText)
    }
  }

  return [...mentionTexts]
}

export async function findMentionUsers(mentionTexts: string[]) {
  return findUsersByMentionTexts(mentionTexts)
}
