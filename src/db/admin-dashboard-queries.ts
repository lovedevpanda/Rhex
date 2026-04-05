import { PostStatus, ReportStatus, UserStatus } from "@/db/types"

import { countPendingSelfServeOrders } from "@/db/self-serve-ads"


import { prisma } from "@/db/client"
import type { Prisma } from "@/db/types"
import { getBusinessDayRange } from "@/lib/formatters"

export async function getAdminDashboardRawData() {
  const { start: todayStart, dayKey: todayKey } = getBusinessDayRange()

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    userCount,
    postCount,
    commentCount,
    boardCount,
    zoneCount,
    reportCount,
    pendingReportCount,
    processingReportCount,
    resolvedReportCount,
    pendingPostCount,
    offlinePostCount,
    pendingVerificationCount,
    pendingFriendLinkCount,
    pendingAdOrderCount,
    activeUserCount7d,
    mutedUserCount,
    bannedUserCount,

    newUserCount7d,
    newPostCount7d,
    newCommentCount7d,
    todayPostCount,
    todayCommentCount,
    todayReportCount,
    postAggregates,
    boardAggregates,
    todayCheckInUserCount,
    recentPosts,
    recentComments,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.comment.count(),
    prisma.board.count(),
    prisma.zone.count(),
    prisma.report.count(),
    prisma.report.count({ where: { status: ReportStatus.PENDING } }),
    prisma.report.count({ where: { status: ReportStatus.PROCESSING } }),
    prisma.report.count({ where: { status: ReportStatus.RESOLVED } }),
    prisma.post.count({ where: { status: PostStatus.PENDING } }),
    prisma.post.count({ where: { status: PostStatus.OFFLINE } }),
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
    prisma.user.count({ where: { status: UserStatus.MUTED } }),
    prisma.user.count({ where: { status: UserStatus.BANNED } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.post.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.comment.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.post.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.comment.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.report.count({ where: { createdAt: { gte: todayStart } } }),
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
      commentCount,
      boardCount,
      zoneCount,
      reportCount,
      pendingReportCount,
      processingReportCount,
      resolvedReportCount,
      pendingPostCount,
      offlinePostCount,
      pendingVerificationCount,
      pendingFriendLinkCount,
      pendingAdOrderCount,
      activeUserCount7d,
      mutedUserCount,
      bannedUserCount,

      newUserCount7d,
      newPostCount7d,
      newCommentCount7d,
      todayPostCount,
      todayCommentCount,
      todayReportCount,
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
    recentComments,
  }
}

export async function getAdminStructureRawData(options?: {
  zoneWhere?: Prisma.ZoneWhereInput
  boardWhere?: Prisma.BoardWhereInput
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
      where: options?.boardWhere,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
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
