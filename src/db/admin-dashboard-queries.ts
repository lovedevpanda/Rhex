import { PostStatus, ReportStatus } from "@/db/types"

import { countPendingSelfServeOrders } from "@/db/self-serve-ads"


import { prisma } from "@/db/client"
import { getBusinessDayRange } from "@/lib/formatters"

export async function getAdminDashboardRawData() {
  const { start: todayStart, dayKey: todayKey } = getBusinessDayRange()

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    userCount,
    postCount,
    reportCount,
    pendingReportCount,
    pendingPostCount,
    pendingVerificationCount,
    pendingFriendLinkCount,
    pendingAdOrderCount,
    activeUserCount7d,

    newUserCount7d,
    newPostCount7d,
    postAggregates,
    boardAggregates,
    todayCheckInUserCount,
    recentPosts,
    recentReports,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.report.count(),
    prisma.report.count({ where: { status: ReportStatus.PENDING } }),
    prisma.post.count({ where: { status: PostStatus.PENDING } }),
    prisma.userVerification.count({ where: { status: "PENDING" } }),
    prisma.friendLink.count({ where: { status: "PENDING" } }),
    countPendingSelfServeOrders("self-serve-ads"),
    prisma.user.count({

      where: {
        OR: [
          { lastLoginAt: { gte: sevenDaysAgo } },
          { lastPostAt: { gte: sevenDaysAgo } },
          { lastCommentAt: { gte: sevenDaysAgo } },
        ],
      },
    }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.post.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.post.aggregate({
      _sum: {
        viewCount: true,
        likeCount: true,
        favoriteCount: true,
      },
    }),
    prisma.board.aggregate({
      _sum: {
        followerCount: true,
      },
    }),
    prisma.userCheckInLog.count({ where: { checkedInOn: todayKey } }),
    prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        board: { select: { name: true } },
        author: { select: { username: true, nickname: true } },
      },
    }),
    prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reasonType: true,
        reasonDetail: true,
        status: true,
        createdAt: true,
        reporter: { select: { username: true, nickname: true } },
      },
    }),
  ])

  const trendDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(todayStart)
    date.setUTCDate(date.getUTCDate() - (6 - index))
    return date
  })

  const [userTrend, postTrend, commentTrend, reportTrend] = await Promise.all([
    Promise.all(trendDates.map((date) => prisma.user.count({ where: { createdAt: { gte: date, lt: new Date(date.getTime() + 24 * 60 * 60 * 1000) } } }))),
    Promise.all(trendDates.map((date) => prisma.post.count({ where: { createdAt: { gte: date, lt: new Date(date.getTime() + 24 * 60 * 60 * 1000) } } }))),
    Promise.all(trendDates.map((date) => prisma.comment.count({ where: { createdAt: { gte: date, lt: new Date(date.getTime() + 24 * 60 * 60 * 1000) } } }))),
    Promise.all(trendDates.map((date) => prisma.report.count({ where: { createdAt: { gte: date, lt: new Date(date.getTime() + 24 * 60 * 60 * 1000) } } }))),
  ])

  return {
    overview: {
      userCount,
      postCount,
      reportCount,
      pendingReportCount,
      pendingPostCount,
      pendingVerificationCount,
      pendingFriendLinkCount,
      pendingAdOrderCount,
      activeUserCount7d,

      newUserCount7d,
      newPostCount7d,
      totalViewCount: postAggregates._sum.viewCount ?? 0,
      totalLikeCount: postAggregates._sum.likeCount ?? 0,
      totalFavoriteCount: postAggregates._sum.favoriteCount ?? 0,
      totalFollowerCount: boardAggregates._sum.followerCount ?? 0,
      todayCheckInUserCount,
    },

    trends: trendDates.map((date, index) => ({
      date,
      userCount: userTrend[index] ?? 0,
      postCount: postTrend[index] ?? 0,
      commentCount: commentTrend[index] ?? 0,
      reportCount: reportTrend[index] ?? 0,
    })),
    recentPosts,
    recentReports,
  }
}

export async function getAdminStructureRawData() {
  const { start: todayStart } = getBusinessDayRange()

  const [zones, boards, todayBoardPostStats] = await Promise.all([
    prisma.zone.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
        sortOrder: true,
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
        _count: { select: { boards: true } },
      },
    }),
    prisma.board.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 50,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        iconPath: true,
        sortOrder: true,
        status: true,
        allowPost: true,
        postCount: true,
        followerCount: true,
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
        zoneId: true,
        zone: {
          select: { id: true, name: true, postListDisplayMode: true },
        },
      },
    }),
    prisma.post.groupBy({
      by: ["boardId"],
      where: {
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
