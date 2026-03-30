import { findUsersByMentionTexts } from "@/db/mention-queries"

const MENTION_PATTERN = /(^|[^\S\r\n]|[\p{P}\p{S}])@([^\s@]{1,20})/gu
const USER_LINK_PATTERN = /\[userLink:([^\]\r\n:]+):([^\]\r\n:]+)\]/gu

export interface MentionUser {
  id: number
  username: string
  nickname: string | null
}

export interface ResolvedMention {
  id: number
  username: string
  nickname: string | null
  matchedText: string
  displayName: string
  token: string
}

function normalizeMentionText(value: string) {
  return value.trim()
}

export function createUserLinkToken(displayName: string, username: string) {
  const normalizedDisplayName = displayName.trim().replace(/[\]\r\n:]/g, "")
  const normalizedUsername = username.trim().replace(/[\]\r\n:]/g, "")

  if (!normalizedDisplayName || !normalizedUsername) {
    return ""
  }

  return `[userLink:${normalizedDisplayName}:${normalizedUsername}]`
}

export function isUserLinkToken(value: string) {
  USER_LINK_PATTERN.lastIndex = 0
  return USER_LINK_PATTERN.test(value)
}

function getUserLinkRanges(content: string) {
  const ranges: Array<{ start: number; end: number }> = []
  let match: RegExpExecArray | null

  USER_LINK_PATTERN.lastIndex = 0
  while ((match = USER_LINK_PATTERN.exec(content)) !== null) {
    ranges.push({
      start: match.index,
      end: match.index + match[0].length,
    })
  }

  USER_LINK_PATTERN.lastIndex = 0
  return ranges
}

function isInsideRanges(index: number, ranges: Array<{ start: number; end: number }>) {
  return ranges.some((range) => index >= range.start && index < range.end)
}

export function stripUserLinkTokens(content: string) {
  USER_LINK_PATTERN.lastIndex = 0
  return content.replace(USER_LINK_PATTERN, (_matched, displayName: string) => `@${displayName}`)
}

export function renderUserLinkTokens(content: string) {
  USER_LINK_PATTERN.lastIndex = 0
  return content.replace(USER_LINK_PATTERN, (_matched, displayName: string, username: string) => `[@${displayName}](/users/${encodeURIComponent(username)})`)
}

export function extractMentionTexts(content: string) {
  const mentionTexts = new Set<string>()
  const userLinkRanges = getUserLinkRanges(content)
  let match: RegExpExecArray | null

  MENTION_PATTERN.lastIndex = 0
  while ((match = MENTION_PATTERN.exec(content)) !== null) {
    const mentionStart = match.index + (match[1]?.length ?? 0)
    if (isInsideRanges(mentionStart, userLinkRanges)) {
      continue
    }

    const mentionText = normalizeMentionText(match[2] ?? "")
    if (mentionText) {
      mentionTexts.add(mentionText)
    }
  }

  return [...mentionTexts]
}

function buildMentionUserLookup(users: MentionUser[]) {
  const lookup = new Map<string, MentionUser>()

  for (const user of users) {
    lookup.set(user.username, user)
    if (user.nickname) {
      lookup.set(user.nickname, user)
    }
  }

  return lookup
}

export async function findMentionUsersByContent(content: string) {
  return findUsersByMentionTexts(extractMentionTexts(content))
}

export async function findMentionUsers(mentionTexts: string[]) {
  return findUsersByMentionTexts(mentionTexts)
}

export function resolveMentionsInText(content: string, users: MentionUser[]) {
  const userLookup = buildMentionUserLookup(users)
  const resolvedMentions: ResolvedMention[] = []
  const seenUserIds = new Set<number>()
  const userLinkRanges = getUserLinkRanges(content)

  MENTION_PATTERN.lastIndex = 0
  const transformedContent = content.replace(MENTION_PATTERN, (matched, prefix: string, rawMentionText: string, offset: number) => {
    const mentionStart = offset + prefix.length
    if (isInsideRanges(mentionStart, userLinkRanges)) {
      return matched
    }

    const mentionText = normalizeMentionText(rawMentionText)
    const matchedUser = userLookup.get(mentionText)

    if (!matchedUser) {
      return matched
    }

    const token = createUserLinkToken(mentionText, matchedUser.username)
    if (!token) {
      return matched
    }

    if (!seenUserIds.has(matchedUser.id)) {
      seenUserIds.add(matchedUser.id)
      resolvedMentions.push({
        id: matchedUser.id,
        username: matchedUser.username,
        nickname: matchedUser.nickname,
        matchedText: mentionText,
        displayName: mentionText,
        token,
      })
    }

    return `${prefix}${token}`
  })

  return {
    content: transformedContent,
    mentions: resolvedMentions,
  }
}

export async function resolveMentionsByContent(content: string) {
  const mentionTexts = extractMentionTexts(content)
  const users = await findMentionUsers(mentionTexts)
  return resolveMentionsInText(content, users)
}
