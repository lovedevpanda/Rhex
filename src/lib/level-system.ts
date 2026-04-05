import { countLevelDefinitions, countUserCommentLikes, countUserPostLikes, createManyLevelDefinitions, findAllLevelDefinitions, findAllUserIdsForLevelRefresh, findLevelDefinitionByLevel, findUserLevelGrowthUser, findUserLevelProgressByUserId, saveLevelDefinitionsInTransaction, syncUserReceivedLikesInTransaction, updateUserLevel, upsertUserCheckInGrowth } from "@/db/level-system-queries"


type LevelDefinitionRecord = {
  id: string
  level: number
  name: string
  color: string
  icon: string
  requireCheckInDays: number
  requirePostCount: number
  requireCommentCount: number
  requireLikeCount: number
  createdAt: Date
  updatedAt: Date
}



const DEFAULT_LEVEL_DEFINITIONS = [
  {
    level: 1,
    name: "旅人",
    color: "#64748b",
    icon: "🌱",
    requireCheckInDays: 0,
    requirePostCount: 0,
    requireCommentCount: 0,
    requireLikeCount: 0,
  },
  {
    level: 2,
    name: "初见",
    color: "#3b82f6",
    icon: "🪴",
    requireCheckInDays: 1,
    requirePostCount: 1,
    requireCommentCount: 1,
    requireLikeCount: 0,
  },
  {
    level: 3,
    name: "常客",
    color: "#06b6d4",
    icon: "☕",
    requireCheckInDays: 7,
    requirePostCount: 3,
    requireCommentCount: 10,
    requireLikeCount: 5,
  },
  {
    level: 4,
    name: "活跃者",
    color: "#14b8a6",
    icon: "🔥",
    requireCheckInDays: 15,
    requirePostCount: 8,
    requireCommentCount: 25,
    requireLikeCount: 15,
  },
  {
    level: 5,
    name: "同好",
    color: "#22c55e",
    icon: "🌿",
    requireCheckInDays: 30,
    requirePostCount: 15,
    requireCommentCount: 50,
    requireLikeCount: 40,
  },
  {
    level: 6,
    name: "砥柱",
    color: "#eab308",
    icon: "🛠️",
    requireCheckInDays: 90,
    requirePostCount: 30,
    requireCommentCount: 100,
    requireLikeCount: 100,
  },
  {
    level: 7,
    name: "达人",
    color: "#f97316",
    icon: "🏹",
    requireCheckInDays: 180,
    requirePostCount: 60,
    requireCommentCount: 180,
    requireLikeCount: 220,
  },
  {
    level: 8,
    name: "名士",
    color: "#a855f7",
    icon: "👑",
    requireCheckInDays: 365,
    requirePostCount: 100,
    requireCommentCount: 300,
    requireLikeCount: 400,
  },
  {
    level: 9,
    name: "传奇",
    color: "#ef4444",
    icon: "🐉",
    requireCheckInDays: 720,
    requirePostCount: 180,
    requireCommentCount: 500,
    requireLikeCount: 800,
  },
]

export interface LevelDefinitionItem {
  id: string
  level: number
  name: string
  color: string
  icon: string
  requireCheckInDays: number
  requirePostCount: number
  requireCommentCount: number
  requireLikeCount: number
  createdAt: string
  updatedAt: string
}

export interface UserLevelGrowthSnapshot {
  userId: number
  level: number
  postCount: number
  commentCount: number
  likeReceivedCount: number
  checkInDays: number
}

export async function ensureLevelDefinitions() {
  const count = await countLevelDefinitions()

  if (count > 0) {
    return
  }

  await createManyLevelDefinitions(DEFAULT_LEVEL_DEFINITIONS)
}

export async function getLevelDefinitions(): Promise<LevelDefinitionItem[]> {
  await ensureLevelDefinitions()

  const levels = await findAllLevelDefinitions()

  return levels.map((item: LevelDefinitionRecord) => ({
    id: item.id,
    level: item.level,
    name: item.name,
    color: item.color,
    icon: item.icon,
    requireCheckInDays: item.requireCheckInDays,
    requirePostCount: item.requirePostCount,
    requireCommentCount: item.requireCommentCount,
    requireLikeCount: item.requireLikeCount,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }))
}

export async function getLevelDefinitionByLevel(level: number) {
  await ensureLevelDefinitions()
  return findLevelDefinitionByLevel(level)
}

export async function getLevelGrowthSnapshot(userId: number): Promise<UserLevelGrowthSnapshot | null> {
  const [user, progress] = await Promise.all([
    findUserLevelGrowthUser(userId),
    findUserLevelProgressByUserId(userId),
  ])

  if (!user) {
    return null
  }

  return {
    userId: user.id,
    level: user.level,
    postCount: user.postCount,
    commentCount: user.commentCount,
    likeReceivedCount: user.likeReceivedCount,
    checkInDays: progress?.checkInDays ?? 0,
  }
}

function meetsLevelRequirements(snapshot: UserLevelGrowthSnapshot, level: Pick<LevelDefinitionItem, "requireCheckInDays" | "requirePostCount" | "requireCommentCount" | "requireLikeCount">) {
  return snapshot.checkInDays >= level.requireCheckInDays
    && snapshot.postCount >= level.requirePostCount
    && snapshot.commentCount >= level.requireCommentCount
    && snapshot.likeReceivedCount >= level.requireLikeCount
}

export async function evaluateUserLevelProgress(userId: number) {
  const [snapshot, levels] = await Promise.all([getLevelGrowthSnapshot(userId), getLevelDefinitions()])

  if (!snapshot) {
    return null
  }

  let nextLevel = 1

  for (const level of levels) {
    if (meetsLevelRequirements(snapshot, level)) {
      nextLevel = level.level
      continue
    }

    break
  }

  if (nextLevel !== snapshot.level) {
    await updateUserLevel(userId, nextLevel)
  }

  const currentDefinition = levels.find((item) => item.level === nextLevel) ?? levels[0] ?? null
  const maxLevel = levels.at(-1)?.level ?? 1

  return {
    level: nextLevel,
    previousLevel: snapshot.level,
    changed: nextLevel !== snapshot.level,
    maxLevel,
    currentDefinition,
    levels,
    snapshot,
  }
}

export async function recordUserCheckInGrowth(userId: number) {
  await upsertUserCheckInGrowth(userId)

  return evaluateUserLevelProgress(userId)
}

export async function syncUserReceivedLikes(userId: number) {
  const [postLikes, commentLikes] = await Promise.all([
    countUserPostLikes(userId),
    countUserCommentLikes(userId),
  ])

  await syncUserReceivedLikesInTransaction(userId, postLikes, commentLikes)

  return evaluateUserLevelProgress(userId)
}


export async function saveLevelDefinitions(input: Array<{
  id?: string
  level?: number
  name: string
  color?: string
  icon?: string
  requireCheckInDays?: number
  requirePostCount?: number
  requireCommentCount?: number
  requireLikeCount?: number
}>) {
  const normalized = input
    .map((item, index) => ({
      id: item.id,
      level: index + 1,
      name: item.name.trim(),
      color: (item.color ?? "#64748b").trim() || "#64748b",
      icon: (item.icon ?? "⭐").trim() || "⭐",
      requireCheckInDays: Math.max(0, Number(item.requireCheckInDays ?? 0) || 0),
      requirePostCount: Math.max(0, Number(item.requirePostCount ?? 0) || 0),
      requireCommentCount: Math.max(0, Number(item.requireCommentCount ?? 0) || 0),
      requireLikeCount: Math.max(0, Number(item.requireLikeCount ?? 0) || 0),
    }))
    .filter((item) => item.name)

  if (normalized.length === 0) {
    throw new Error("至少需要保留一个等级")
  }

  normalized[0] = {
    ...normalized[0],
    level: 1,
    requireCheckInDays: 0,
    requirePostCount: 0,
    requireCommentCount: 0,
    requireLikeCount: 0,
  }

  await saveLevelDefinitionsInTransaction(normalized)

  const users = await findAllUserIdsForLevelRefresh()
  await Promise.all(users.map((user) => evaluateUserLevelProgress(user.id)))

  return getLevelDefinitions()
}

