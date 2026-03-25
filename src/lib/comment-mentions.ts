import { findUsersByUsernames } from "@/db/mention-queries"


const MENTION_PATTERN = /(^|\s)@([a-zA-Z0-9_]{3,20})\b/g

export function extractMentionUsernames(content: string) {
  const usernames = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = MENTION_PATTERN.exec(content)) !== null) {
    if (match[2]) {
      usernames.add(match[2])
    }
  }

  return [...usernames]
}

export async function findMentionUsers(usernames: string[]) {
  return findUsersByUsernames(usernames)
}

