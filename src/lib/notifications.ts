import { NotificationType, RelatedType } from "@/db/types"

import { countUnreadNotifications, findCommentsWithPostByIds, findNotificationsByUserIdCursor, findPostsByIds, findUsersByIds } from "@/db/notification-read-queries"
import { decodeTimestampCursor, encodeTimestampCursor } from "@/lib/cursor-pagination"
import { formatMonthDayTime } from "@/lib/formatters"
import { getPostCommentPath, getPostPath } from "@/lib/post-links"
import { getSiteSettings } from "@/lib/site-settings"
import { getUserDisplayName } from "@/lib/users"



const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  REPLY_POST: "回复了你的帖子",
  REPLY_COMMENT: "回复了你的评论",
  LIKE: "赞了你的内容",
  MENTION: "提到了你",
  FOLLOWED_YOU: "关注了你",
  FOLLOWING_ACTIVITY: "关注动态",
  SYSTEM: "系统通知",
  REPORT_RESULT: "举报处理结果",
}

export interface SiteNotificationItem {
  id: string
  type: NotificationType
  typeLabel: string
  title: string
  content: string
  isRead: boolean
  createdAt: string
  senderName: string
  relatedUrl: string
}

export interface UserNotificationsResult {
  items: SiteNotificationItem[]
  hasPrevPage: boolean
  hasNextPage: boolean
  prevCursor: string | null
  nextCursor: string | null
}

export async function getUserUnreadNotificationCount(userId: number) {
  try {
    return await countUnreadNotifications(userId)
  } catch (error) {
    console.error(error)
    return 0
  }
}


type NotificationPostTarget = Awaited<ReturnType<typeof findPostsByIds>>[number]
type NotificationCommentTarget = Awaited<ReturnType<typeof findCommentsWithPostByIds>>[number]
type NotificationUserTarget = Awaited<ReturnType<typeof findUsersByIds>>[number]
type NotificationCursorRows = Awaited<ReturnType<typeof findNotificationsByUserIdCursor>>["items"]

async function preloadNotificationTargets(notifications: NotificationCursorRows) {
  const postIds = notifications.filter((item) => item.relatedType === RelatedType.POST).map((item) => item.relatedId)
  const commentIds = notifications.filter((item) => item.relatedType === RelatedType.COMMENT).map((item) => item.relatedId)
  const userIds = notifications.filter((item) => item.relatedType === RelatedType.USER).map((item) => item.relatedId)

  const [posts, comments, users] = await Promise.all([findPostsByIds(postIds), findCommentsWithPostByIds(commentIds), findUsersByIds(userIds)])

  return {
    postMap: new Map<string, NotificationPostTarget>(posts.map((post) => [post.id, post])),
    commentMap: new Map<string, NotificationCommentTarget>(comments.map((comment) => [comment.id, comment])),
    userMap: new Map<string, NotificationUserTarget>(users.map((user) => [String(user.id), user])),
  }
}

function resolveNotificationUrl(
  relatedType: RelatedType,
  relatedId: string,
  settings: Awaited<ReturnType<typeof getSiteSettings>>,
  targets: Awaited<ReturnType<typeof preloadNotificationTargets>>,
) {
  if (relatedType === RelatedType.POST) {
    const post = targets.postMap.get(relatedId)

    return post ? getPostPath({ id: post.id, slug: post.slug }, settings.postLinkDisplayMode) : "/notifications"
  }

  if (relatedType === RelatedType.COMMENT) {
    const comment = targets.commentMap.get(relatedId)

    return comment?.post ? getPostCommentPath({ id: comment.post.id, slug: comment.post.slug }, comment.id, settings.postLinkDisplayMode) : "/notifications"
  }

  if (relatedType === RelatedType.USER) {
    const user = targets.userMap.get(relatedId)

    return user ? `/users/${user.username}` : "/notifications"
  }

  if (relatedType === RelatedType.YINYANG_CHALLENGE) {
    return "/funs/yinyang-contract"
  }

  return "/notifications"
}




export async function getUserNotifications(
  userId: number,
  options: {
    pageSize: number
    after?: string | null
    before?: string | null
  },
): Promise<UserNotificationsResult> {
  try {
    const normalizedPageSize = Math.min(50, Math.max(1, options.pageSize))
    const afterCursor = decodeTimestampCursor(options.after)
    const beforeCursor = decodeTimestampCursor(options.before)

    const [{ items: notifications, hasPrevPage, hasNextPage }, settings] = await Promise.all([
      findNotificationsByUserIdCursor({
        userId,
        take: normalizedPageSize,
        after: beforeCursor ? null : afterCursor,
        before: beforeCursor,
      }),
      getSiteSettings(),
    ])

    const targets = await preloadNotificationTargets(notifications)
    const relatedUrls = notifications.map((notification) => resolveNotificationUrl(notification.relatedType, notification.relatedId, settings, targets))

    return {
      items: notifications.map((notification, index) => ({
        id: notification.id,
        type: notification.type,
        typeLabel: NOTIFICATION_TYPE_LABELS[notification.type],
        title: notification.title,
        content: notification.content,
        isRead: notification.isRead,
        createdAt: formatMonthDayTime(notification.createdAt),
        senderName: getUserDisplayName(notification.sender, "系统"),
        relatedUrl: relatedUrls[index],
      })),
      hasPrevPage,
      hasNextPage,
      prevCursor: notifications.length > 0 ? encodeTimestampCursor({ id: notifications[0].id, createdAt: notifications[0].createdAt.toISOString() }) : null,
      nextCursor: notifications.length > 0 ? encodeTimestampCursor({ id: notifications[notifications.length - 1].id, createdAt: notifications[notifications.length - 1].createdAt.toISOString() }) : null,
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      hasPrevPage: false,
      hasNextPage: false,
      prevCursor: null,
      nextCursor: null,
    }
  }
}
