import { unstable_cache } from "next/cache"

import { countPendingSelfServeOrders } from "@/db/self-serve-ads"


import { prisma } from "@/db/client"
import { Prisma, type Prisma as PrismaType } from "@/db/types"
import { BUSINESS_TIME_ZONE, getBusinessDayRange, getLocalDateKey } from "@/lib/formatters"

const ADMIN_DASHBOARD_CACHE_REVALIDATE_SECONDS = 30

type NumericLike = bigint | number | null | undefined

function toNumber(value: NumericLike) {
  if (typeof value === "bigint") {
    return Number(value)
  }

  return Number(value ?? 0)
}

function buildTrendDates(todayStart: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(todayStart)
    date.setUTCDate(date.getUTCDate() - (6 - index))
    return date
  })
}

function getTrendDateKey(date: Date) {
  return getLocalDateKey(date)
}

async function findDailyCreatedTrendCounts(tableName: "User" | "Post" | "Comment" | "Report", rangeStart: Date, rangeEnd: Date) {
  const rows = await prisma.$queryRaw<Array<{ dayKey: string; count: NumericLike }>>(Prisma.sql`
    SELECT
      TO_CHAR(timezone(${BUSINESS_TIME_ZONE}, "createdAt"), 'YYYY-MM-DD') AS "dayKey",
      COUNT(*) AS "count"
    FROM ${Prisma.raw(`"${tableName}"`)}
    WHERE "createdAt" >= ${rangeStart} AND "createdAt" < ${rangeEnd}
    GROUP BY 1
    ORDER BY 1 ASC
  `)

  return new Map(rows.map((row) => [row.dayKey, toNumber(row.count)]))
}

async function getAdminDashboardRawDataUncached() {
  const { start: todayStart, end: todayEnd, dayKey: todayKey } = getBusinessDayRange()

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const trendDates = buildTrendDates(todayStart)
  const trendRangeStart = trendDates[0] ?? todayStart

  const [
    userStats,
    postStats,
    commentStats,
    reportStats,
    siteStats,
    pendingAdOrderCount,
    recentPosts,
    recentComments,
    userTrendMap,
    postTrendMap,
    commentTrendMap,
    reportTrendMap,
  ] = await Promise.all([
    prisma.$queryRaw<Array<{
      userCount: NumericLike
      mutedUserCount: NumericLike
      bannedUserCount: NumericLike
      newUserCount7d: NumericLike
      activeUserCount7d: NumericLike
    }>>(Prisma.sql`
      SELECT
        COUNT(*) AS "userCount",
        COUNT(*) FILTER (WHERE status = 'MUTED') AS "mutedUserCount",
        COUNT(*) FILTER (WHERE status = 'BANNED') AS "bannedUserCount",
        COUNT(*) FILTER (WHERE "createdAt" >= ${sevenDaysAgo}) AS "newUserCount7d",
        COUNT(*) FILTER (
          WHERE "lastLoginAt" >= ${sevenDaysAgo}
            OR "lastPostAt" >= ${sevenDaysAgo}
            OR "lastCommentAt" >= ${sevenDaysAgo}
        ) AS "activeUserCount7d"
      FROM "User"
    `),
    prisma.$queryRaw<Array<{
      postCount: NumericLike
      pendingPostCount: NumericLike
      offlinePostCount: NumericLike
      newPostCount7d: NumericLike
      todayPostCount: NumericLike
      totalViewCount: NumericLike
      totalLikeCount: NumericLike
      totalFavoriteCount: NumericLike
    }>>(Prisma.sql`
      SELECT
        COUNT(*) AS "postCount",
        COUNT(*) FILTER (WHERE status = 'PENDING') AS "pendingPostCount",
        COUNT(*) FILTER (WHERE status = 'OFFLINE') AS "offlinePostCount",
        COUNT(*) FILTER (WHERE "createdAt" >= ${sevenDaysAgo}) AS "newPostCount7d",
        COUNT(*) FILTER (WHERE "createdAt" >= ${todayStart}) AS "todayPostCount",
        COALESCE(SUM("viewCount"), 0) AS "totalViewCount",
        COALESCE(SUM("likeCount"), 0) AS "totalLikeCount",
        COALESCE(SUM("favoriteCount"), 0) AS "totalFavoriteCount"
      FROM "Post"
    `),
    prisma.$queryRaw<Array<{
      commentCount: NumericLike
      newCommentCount7d: NumericLike
      todayCommentCount: NumericLike
    }>>(Prisma.sql`
      SELECT
        COUNT(*) AS "commentCount",
        COUNT(*) FILTER (WHERE "createdAt" >= ${sevenDaysAgo}) AS "newCommentCount7d",
        COUNT(*) FILTER (WHERE "createdAt" >= ${todayStart}) AS "todayCommentCount"
      FROM "Comment"
    `),
    prisma.$queryRaw<Array<{
      reportCount: NumericLike
      pendingReportCount: NumericLike
      processingReportCount: NumericLike
      resolvedReportCount: NumericLike
      todayReportCount: NumericLike
    }>>(Prisma.sql`
      SELECT
        COUNT(*) AS "reportCount",
        COUNT(*) FILTER (WHERE status = 'PENDING') AS "pendingReportCount",
        COUNT(*) FILTER (WHERE status = 'PROCESSING') AS "processingReportCount",
        COUNT(*) FILTER (WHERE status = 'RESOLVED') AS "resolvedReportCount",
        COUNT(*) FILTER (WHERE "createdAt" >= ${todayStart}) AS "todayReportCount"
      FROM "Report"
    `),
    prisma.$queryRaw<Array<{
      boardCount: NumericLike
      zoneCount: NumericLike
      pendingBoardApplicationCount: NumericLike
      pendingVerificationCount: NumericLike
      pendingFriendLinkCount: NumericLike
      totalFollowerCount: NumericLike
      todayCheckInUserCount: NumericLike
    }>>(Prisma.sql`
      SELECT
        (SELECT COUNT(*) FROM "Board") AS "boardCount",
        (SELECT COUNT(*) FROM "Zone") AS "zoneCount",
        (SELECT COUNT(*) FROM "BoardApplication" WHERE status = 'PENDING') AS "pendingBoardApplicationCount",
        (SELECT COUNT(*) FROM "UserVerification" WHERE status = 'PENDING') AS "pendingVerificationCount",
        (SELECT COUNT(*) FROM "FriendLink" WHERE status = 'PENDING') AS "pendingFriendLinkCount",
        (SELECT COALESCE(SUM("followerCount"), 0) FROM "Board") AS "totalFollowerCount",
        (SELECT COUNT(*) FROM "UserCheckInLog" WHERE "checkedInOn" = ${todayKey}) AS "todayCheckInUserCount"
    `),
    countPendingSelfServeOrders("self-serve-ads"),
    prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        board: { select: { name: true } },
        author: { select: { username: true, nickname: true } },
      },
    }),
    prisma.comment.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      where: {
        parentId: null,
      },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        user: {
          select: {
            username: true,
            nickname: true,
          },
        },
      },
    }),
    findDailyCreatedTrendCounts("User", trendRangeStart, todayEnd),
    findDailyCreatedTrendCounts("Post", trendRangeStart, todayEnd),
    findDailyCreatedTrendCounts("Comment", trendRangeStart, todayEnd),
    findDailyCreatedTrendCounts("Report", trendRangeStart, todayEnd),
  ])
  const resolvedUserStats = userStats[0]
  const resolvedPostStats = postStats[0]
  const resolvedCommentStats = commentStats[0]
  const resolvedReportStats = reportStats[0]
  const resolvedSiteStats = siteStats[0]

  return {
    overview: {
      userCount: toNumber(resolvedUserStats?.userCount),
      postCount: toNumber(resolvedPostStats?.postCount),
      commentCount: toNumber(resolvedCommentStats?.commentCount),
      boardCount: toNumber(resolvedSiteStats?.boardCount),
      zoneCount: toNumber(resolvedSiteStats?.zoneCount),
      reportCount: toNumber(resolvedReportStats?.reportCount),
      pendingReportCount: toNumber(resolvedReportStats?.pendingReportCount),
      processingReportCount: toNumber(resolvedReportStats?.processingReportCount),
      resolvedReportCount: toNumber(resolvedReportStats?.resolvedReportCount),
      pendingPostCount: toNumber(resolvedPostStats?.pendingPostCount),
      offlinePostCount: toNumber(resolvedPostStats?.offlinePostCount),
      pendingBoardApplicationCount: toNumber(resolvedSiteStats?.pendingBoardApplicationCount),
      pendingVerificationCount: toNumber(resolvedSiteStats?.pendingVerificationCount),
      pendingFriendLinkCount: toNumber(resolvedSiteStats?.pendingFriendLinkCount),
      pendingAdOrderCount,
      activeUserCount7d: toNumber(resolvedUserStats?.activeUserCount7d),
      mutedUserCount: toNumber(resolvedUserStats?.mutedUserCount),
      bannedUserCount: toNumber(resolvedUserStats?.bannedUserCount),

      newUserCount7d: toNumber(resolvedUserStats?.newUserCount7d),
      newPostCount7d: toNumber(resolvedPostStats?.newPostCount7d),
      newCommentCount7d: toNumber(resolvedCommentStats?.newCommentCount7d),
      todayPostCount: toNumber(resolvedPostStats?.todayPostCount),
      todayCommentCount: toNumber(resolvedCommentStats?.todayCommentCount),
      todayReportCount: toNumber(resolvedReportStats?.todayReportCount),
      totalViewCount: toNumber(resolvedPostStats?.totalViewCount),
      totalLikeCount: toNumber(resolvedPostStats?.totalLikeCount),
      totalFavoriteCount: toNumber(resolvedPostStats?.totalFavoriteCount),
      totalFollowerCount: toNumber(resolvedSiteStats?.totalFollowerCount),
      todayCheckInUserCount: toNumber(resolvedSiteStats?.todayCheckInUserCount),
    },

    trends: trendDates.map((date) => ({
      date,
      userCount: userTrendMap.get(getTrendDateKey(date)) ?? 0,
      postCount: postTrendMap.get(getTrendDateKey(date)) ?? 0,
      commentCount: commentTrendMap.get(getTrendDateKey(date)) ?? 0,
      reportCount: reportTrendMap.get(getTrendDateKey(date)) ?? 0,
    })),
    recentPosts,
    recentComments,
  }
}

const getCachedAdminDashboardRawData = unstable_cache(
  async () => getAdminDashboardRawDataUncached(),
  ["admin-dashboard-raw-data"],
  { revalidate: ADMIN_DASHBOARD_CACHE_REVALIDATE_SECONDS },
)

export async function getAdminDashboardRawData() {
  return getCachedAdminDashboardRawData()
}

export async function getAdminStructureRawData(options?: {
  zoneWhere?: PrismaType.ZoneWhereInput
  boardWhere?: PrismaType.BoardWhereInput
}) {
  const { start: todayStart } = getBusinessDayRange()

  const [zones, boards, todayBoardPostStats] = await Promise.all([
    prisma.zone.findMany({
      where: options?.zoneWhere,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
        sortOrder: true,
        hiddenFromSidebar: true,
        requirePostReview: true,
        postPointDelta: true,
        replyPointDelta: true,
        postIntervalSeconds: true,
        replyIntervalSeconds: true,
        allowedPostTypes: true,
        minViewPoints: true,
        minViewLevel: true,
        minPostPoints: true,
        minPostLevel: true,
        minReplyPoints: true,
        minReplyLevel: true,
        minViewVipLevel: true,
        minPostVipLevel: true,
        minReplyVipLevel: true,
        postListDisplayMode: true,
        postListLoadMode: true,
        _count: { select: { boards: true } },
      },
    }),
    prisma.board.findMany({
      where: options?.boardWhere,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        iconPath: true,
        configJson: true,
        sortOrder: true,
        status: true,
        allowPost: true,
        postCount: true,
        followerCount: true,
        treasuryPoints: true,
        requirePostReview: true,
        postPointDelta: true,
        replyPointDelta: true,
        postIntervalSeconds: true,
        replyIntervalSeconds: true,
        allowedPostTypes: true,
        minViewPoints: true,
        minViewLevel: true,
        minPostPoints: true,
        minPostLevel: true,
        minReplyPoints: true,
        minReplyLevel: true,
        minViewVipLevel: true,
        minPostVipLevel: true,
        minReplyVipLevel: true,
        postListDisplayMode: true,
        postListLoadMode: true,
        zoneId: true,
        zone: {
          select: { id: true, name: true, postListDisplayMode: true, postListLoadMode: true },
        },
      },
    }),
    prisma.post.groupBy({
      by: ["boardId"],
      where: {
        ...(options?.boardWhere ? { board: options.boardWhere } : {}),
        createdAt: {
          gte: todayStart,
        },
      },
      _count: {
        boardId: true,
      },
    }),
  ])

  return {
    zones,
    boards,
    todayBoardPostStats,
  }
}
