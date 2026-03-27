import { ChangeType, PostRedPacketGrantMode, PostRedPacketStatus, PostRedPacketTriggerType, type Prisma } from "@/db/types"

import { prisma } from "@/db/client"
import { getBusinessDayRange, formatRelativeTime } from "@/lib/formatters"
import { getSiteSettings } from "@/lib/site-settings"
import { multiplyPositiveSafeIntegers } from "@/lib/shared/safe-integer"



export interface NormalizedPostRedPacketConfig {
  enabled: boolean
  grantMode: PostRedPacketGrantMode
  triggerType: PostRedPacketTriggerType
  totalPoints: number
  packetCount: number
  unitPoints: number
}


export interface PostRedPacketClaimRecord {
  id: string
  userId: number
  username: string
  nickname: string | null
  avatarPath: string | null
  amount: number
  triggerType: PostRedPacketTriggerType
  triggerLabel: string
  createdAt: string
}

export interface PostRedPacketSummary {
  enabled: boolean
  pointName: string
  senderId?: number
  senderName?: string
  grantMode?: PostRedPacketGrantMode
  triggerType?: PostRedPacketTriggerType
  triggerLabel?: string
  totalPoints: number
  packetCount: number
  remainingPoints: number
  remainingCount: number
  claimedCount: number
  claimedPoints: number
  status?: PostRedPacketStatus
  currentUserPoints: number
  currentUserClaimed: boolean
  currentUserClaimAmount?: number
  page: number
  pageSize: number
  totalRecords: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
  records: PostRedPacketClaimRecord[]
}


const RED_PACKET_TRIGGER_LABELS: Record<PostRedPacketTriggerType, string> = {
  REPLY: "回复帖子",
  LIKE: "点赞帖子",
  FAVORITE: "收藏帖子",
}

const RED_PACKET_GRANT_MODE_LABELS: Record<PostRedPacketGrantMode, string> = {
  FIXED: "固定红包",
  RANDOM: "拼手气红包",
}

function toPositiveInteger(value: unknown) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

export function getPostRedPacketTriggerLabel(triggerType: PostRedPacketTriggerType) {
  return RED_PACKET_TRIGGER_LABELS[triggerType]
}

export function getPostRedPacketGrantModeLabel(grantMode: PostRedPacketGrantMode) {
  return RED_PACKET_GRANT_MODE_LABELS[grantMode]
}

export async function normalizePostRedPacketConfig(input: unknown): Promise<{
  success: boolean
  message?: string
  data: NormalizedPostRedPacketConfig | null
}> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { success: true, data: null }
  }

  const settings = await getSiteSettings()
  const config = input as Record<string, unknown>
  const enabled = Boolean(config.enabled)

  if (!enabled) {
    return { success: true, data: null }
  }

  if (!settings.postRedPacketEnabled) {
    return { success: false, message: "当前站点未开启帖子红包功能", data: null }
  }

  const grantMode = String(config.grantMode ?? "FIXED").trim().toUpperCase()
  const triggerType = String(config.triggerType ?? "REPLY").trim().toUpperCase()
  const packetCount = toPositiveInteger(config.packetCount)
  const configuredTotalPoints = toPositiveInteger(config.totalPoints)
  const unitPoints = toPositiveInteger(config.unitPoints ?? config.totalPoints)
  const totalPoints = grantMode === "FIXED"
    ? multiplyPositiveSafeIntegers(unitPoints, packetCount)
    : configuredTotalPoints



  if (!(grantMode in RED_PACKET_GRANT_MODE_LABELS)) {
    return { success: false, message: "红包发放方式不合法", data: null }
  }

  if (!(triggerType in RED_PACKET_TRIGGER_LABELS)) {
    return { success: false, message: "红包领取条件不合法", data: null }
  }

  if (!totalPoints || !packetCount) {
    return { success: false, message: "红包总积分和份数必须为正整数", data: null }
  }

  if (grantMode === "FIXED" && (!unitPoints || unitPoints > settings.postRedPacketMaxPoints)) {
    return { success: false, message: `固定红包单个${settings.pointName}不能超过 ${settings.postRedPacketMaxPoints}`, data: null }
  }


  if (grantMode === "RANDOM" && totalPoints > settings.postRedPacketMaxPoints) {
    return { success: false, message: `拼手气红包总${settings.pointName}不能超过 ${settings.postRedPacketMaxPoints}`, data: null }
  }


  if (packetCount > totalPoints) {
    return { success: false, message: `红包份数不能超过总${settings.pointName}，必须保证每人至少获得 1 ${settings.pointName}`, data: null }
  }

  const normalizedUnitPoints = unitPoints ?? totalPoints

  return {

    success: true,
    data: {
      enabled: true,
      grantMode: grantMode as PostRedPacketGrantMode,
      triggerType: triggerType as PostRedPacketTriggerType,
      totalPoints,
      packetCount,
      unitPoints: normalizedUnitPoints,
    },
  }


}

export async function assertPostRedPacketDailyLimit(params: { senderId: number; totalPoints: number }) {
  const settings = await getSiteSettings()
  const { start, end } = getBusinessDayRange()

  const aggregate = await prisma.postRedPacket.aggregate({
    where: {
      senderId: params.senderId,
      createdAt: {
        gte: start,
        lt: end,
      },
      status: {
        in: ["ACTIVE", "COMPLETED", "EXPIRED"],
      },
    },
    _sum: {
      totalPoints: true,
    },
  })

  const usedPoints = aggregate._sum.totalPoints ?? 0
  if (usedPoints + params.totalPoints > settings.postRedPacketDailyLimit) {
    throw new Error(`今日发红包累计${settings.pointName}已超上限（${settings.postRedPacketDailyLimit}）`)
  }
}

export async function buildPostRedPacketCreateInput(params: {
  postId: string
  senderId: number
  config: NormalizedPostRedPacketConfig | null
}): Promise<Prisma.PostRedPacketUncheckedCreateInput | undefined> {
  if (!params.config?.enabled) {
    return undefined
  }

  await assertPostRedPacketDailyLimit({ senderId: params.senderId, totalPoints: params.config.totalPoints })

  return {
    postId: params.postId,
    senderId: params.senderId,
    grantMode: params.config.grantMode,
    triggerType: params.config.triggerType,
    totalPoints: params.config.totalPoints,
    packetCount: params.config.packetCount,
    remainingPoints: params.config.totalPoints,
    remainingCount: params.config.packetCount,
    status: "ACTIVE",
  }
}

function allocateRandomAmount(remainingPoints: number, remainingCount: number) {
  if (remainingCount <= 1) {
    return remainingPoints
  }

  const max = remainingPoints - (remainingCount - 1)
  const amount = Math.floor(Math.random() * max) + 1
  return Math.min(max, Math.max(1, amount))
}

function allocateRedPacketAmount(packet: {
  grantMode: PostRedPacketGrantMode
  remainingPoints: number
  remainingCount: number
  totalPoints: number
  packetCount: number
}) {
  if (packet.remainingCount <= 0 || packet.remainingPoints <= 0) {
    throw new Error("红包已领完")
  }

  if (packet.grantMode === "FIXED") {
    return packet.totalPoints / packet.packetCount
  }

  return allocateRandomAmount(packet.remainingPoints, packet.remainingCount)
}

function buildRedPacketClaimReason(params: {
  amount: number
  pointName: string
  postId: string
  triggerType: PostRedPacketTriggerType
}) {
  return `[post-red-packet] 领取帖子红包（${getPostRedPacketTriggerLabel(params.triggerType)}，${params.amount}${params.pointName}） post=${params.postId}`
}

function buildRedPacketSendReason(params: { amount: number; pointName: string; postId: string }) {
  return `[post-red-packet] 发布帖子红包（${params.amount}${params.pointName}） post=${params.postId}`
}

export async function tryClaimPostRedPacket(input: {
  postId: string
  userId: number
  triggerType: PostRedPacketTriggerType
  triggerCommentId?: string
}) {
  const settings = await getSiteSettings()

  return prisma.$transaction(async (tx) => {
    const [user, post] = await Promise.all([
      tx.user.findUnique({ where: { id: input.userId }, select: { id: true, points: true, status: true, username: true } }),
      tx.post.findUnique({
        where: { id: input.postId },
        select: {
          id: true,
          status: true,
          authorId: true,
          redPacket: {
            include: {
              claims: {
                where: { userId: input.userId },
                select: { id: true, amount: true },
                take: 1,
              },
            },
          },
        },
      }),
    ])

    if (!user || !post || post.status !== "NORMAL") {
      return { claimed: false as const, reason: "帖子不存在或暂不可领取" }
    }

    if (user.status === "MUTED" || user.status === "BANNED") {

      return { claimed: false as const, reason: "当前账号状态不可领取红包" }
    }

    const packet = post.redPacket
    if (!packet || packet.status !== "ACTIVE") {
      return { claimed: false as const, reason: "当前帖子没有可领取红包" }
    }

    if (packet.triggerType !== input.triggerType) {
      return { claimed: false as const, reason: "当前行为不满足红包领取条件" }
    }

    if (packet.claims.length > 0) {
      return { claimed: false as const, reason: "你已经领取过该红包", amount: packet.claims[0]?.amount }
    }

    if (packet.remainingCount <= 0 || packet.remainingPoints <= 0) {
      const nextStatus = packet.claimedCount >= packet.packetCount ? "COMPLETED" : "EXPIRED"
      await tx.postRedPacket.update({ where: { id: packet.id }, data: { status: nextStatus } })
      return { claimed: false as const, reason: "红包已领完" }
    }

    const amount = allocateRedPacketAmount(packet)
    const nextRemainingCount = packet.remainingCount - 1
    const nextRemainingPoints = packet.remainingPoints - amount
    const nextStatus: PostRedPacketStatus = nextRemainingCount === 0 || nextRemainingPoints === 0 ? "COMPLETED" : "ACTIVE"

    await tx.postRedPacketClaim.create({
      data: {
        redPacketId: packet.id,
        postId: post.id,
        userId: user.id,
        triggerType: input.triggerType,
        triggerCommentId: input.triggerCommentId,
        amount,
      },
    })

    await tx.postRedPacket.update({
      where: { id: packet.id },
      data: {
        remainingCount: nextRemainingCount,
        remainingPoints: nextRemainingPoints,
        claimedCount: { increment: 1 },
        claimedPoints: { increment: amount },
        status: nextStatus,
      },
    })

    await tx.user.update({
      where: { id: user.id },
      data: {
        points: { increment: amount },
      },
    })

    await tx.pointLog.create({
      data: {
        userId: user.id,
        changeType: ChangeType.INCREASE,
        changeValue: amount,
        reason: buildRedPacketClaimReason({ amount, pointName: settings.pointName, postId: post.id, triggerType: input.triggerType }),
        relatedType: "POST",
        relatedId: post.id,
      },
    })

    return { claimed: true as const, amount, pointName: settings.pointName }
  })
}

export async function getPostRedPacketSummary(postId: string, currentUserId?: number, page = 1, pageSize = 20): Promise<PostRedPacketSummary | undefined> {
  const settings = await getSiteSettings()
  const normalizedPageSize = Math.min(100, Math.max(10, Number(pageSize) || 20))
  const normalizedPage = Math.max(1, Number(page) || 1)

  const [packet, currentUser] = await Promise.all([

    prisma.postRedPacket.findUnique({
      where: { postId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            nickname: true,
          },
        },
        claims: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
                avatarPath: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
          take: 50,
        },
      },
    }),
    currentUserId ? prisma.user.findUnique({ where: { id: currentUserId }, select: { points: true } }) : Promise.resolve(null),
  ])

  if (!packet) {
    return undefined
  }

  const totalRecords = packet.claimedCount
  const totalPages = Math.max(1, Math.ceil(totalRecords / normalizedPageSize))
  const safePage = Math.min(normalizedPage, totalPages)
  const currentUserClaim = currentUserId
    ? await prisma.postRedPacketClaim.findFirst({
        where: {
          redPacketId: packet.id,
          userId: currentUserId,
        },
        select: {
          amount: true,
        },
      })
    : undefined

  return {

    enabled: settings.postRedPacketEnabled,
    pointName: settings.pointName,
    senderId: packet.sender.id,
    senderName: packet.sender.nickname ?? packet.sender.username,
    grantMode: packet.grantMode,
    triggerType: packet.triggerType,
    triggerLabel: getPostRedPacketTriggerLabel(packet.triggerType),
    totalPoints: packet.totalPoints,
    packetCount: packet.packetCount,
    remainingPoints: packet.remainingPoints,
    remainingCount: packet.remainingCount,
    claimedCount: packet.claimedCount,
    claimedPoints: packet.claimedPoints,
    status: packet.status,
    currentUserPoints: currentUser?.points ?? 0,
    currentUserClaimed: Boolean(currentUserClaim),
    currentUserClaimAmount: currentUserClaim?.amount,
    page: safePage,
    pageSize: normalizedPageSize,
    totalRecords,
    totalPages,
    hasPrevPage: safePage > 1,
    hasNextPage: safePage < totalPages,
    records: packet.claims.map((item) => ({

      id: item.id,
      userId: item.user.id,
      username: item.user.username,
      nickname: item.user.nickname,
      avatarPath: item.user.avatarPath,
      amount: item.amount,
      triggerType: item.triggerType,
      triggerLabel: getPostRedPacketTriggerLabel(item.triggerType),
      createdAt: formatRelativeTime(item.createdAt),
    })),
  }
}

export async function createPostRedPacketAfterPostCreated(params: {
  tx: Prisma.TransactionClient
  postId: string
  senderId: number
  config: NormalizedPostRedPacketConfig | null
  pointName: string
}) {
  if (!params.config?.enabled) {
    return 0
  }

  await assertPostRedPacketDailyLimit({ senderId: params.senderId, totalPoints: params.config.totalPoints })

  await params.tx.postRedPacket.create({
    data: {
      postId: params.postId,
      senderId: params.senderId,
      grantMode: params.config.grantMode,
      triggerType: params.config.triggerType,
      totalPoints: params.config.totalPoints,
      packetCount: params.config.packetCount,
      remainingPoints: params.config.totalPoints,
      remainingCount: params.config.packetCount,
      status: "ACTIVE",
    },
  })

  await params.tx.pointLog.create({
    data: {
      userId: params.senderId,
      changeType: ChangeType.DECREASE,
      changeValue: params.config.totalPoints,
      reason: buildRedPacketSendReason({ amount: params.config.totalPoints, pointName: params.pointName, postId: params.postId }),
      relatedType: "POST",
      relatedId: params.postId,
    },
  })

  return params.config.totalPoints
}
