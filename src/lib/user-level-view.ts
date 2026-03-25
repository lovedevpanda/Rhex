import { getLevelBadgeData } from "@/lib/level-badge"
import { getCurrentUser } from "@/lib/auth"
import { getLevelDefinitions, getLevelGrowthSnapshot } from "@/lib/level-system"

export interface UserLevelProgressView {
  currentLevel: {
    level: number
    name: string
    color: string
    icon: string
  }
  nextLevel: {
    level: number
    name: string
    color: string
    icon: string
    requireCheckInDays: number
    requirePostCount: number
    requireCommentCount: number
    requireLikeCount: number
  } | null
  snapshot: {
    postCount: number
    commentCount: number
    likeReceivedCount: number
    checkInDays: number
  }
  completion: {
    checkInDays: { current: number; required: number; remaining: number; completed: boolean }
    postCount: { current: number; required: number; remaining: number; completed: boolean }
    commentCount: { current: number; required: number; remaining: number; completed: boolean }
    likeReceivedCount: { current: number; required: number; remaining: number; completed: boolean }
  } | null
}

export async function getCurrentUserLevelProgressView(): Promise<UserLevelProgressView | null> {
  const user = await getCurrentUser()

  if (!user) {
    return null
  }

  const [snapshot, levels, currentBadge] = await Promise.all([
    getLevelGrowthSnapshot(user.id),
    getLevelDefinitions(),
    getLevelBadgeData(user.level),
  ])

  if (!snapshot) {
    return null
  }

  const nextLevel = levels.find((item) => item.level > snapshot.level) ?? null

  return {
    currentLevel: {
      level: snapshot.level,
      name: currentBadge.name,
      color: currentBadge.color,
      icon: currentBadge.icon,
    },
    nextLevel,
    snapshot: {
      postCount: snapshot.postCount,
      commentCount: snapshot.commentCount,
      likeReceivedCount: snapshot.likeReceivedCount,
      checkInDays: snapshot.checkInDays,
    },
    completion: nextLevel
      ? {
          checkInDays: buildCompletionItem(snapshot.checkInDays, nextLevel.requireCheckInDays),
          postCount: buildCompletionItem(snapshot.postCount, nextLevel.requirePostCount),
          commentCount: buildCompletionItem(snapshot.commentCount, nextLevel.requireCommentCount),
          likeReceivedCount: buildCompletionItem(snapshot.likeReceivedCount, nextLevel.requireLikeCount),
        }
      : null,
  }
}

function buildCompletionItem(current: number, required: number) {
  const normalizedRequired = Math.max(0, required)
  return {
    current,
    required: normalizedRequired,
    remaining: Math.max(0, normalizedRequired - current),
    completed: current >= normalizedRequired,
  }
}
