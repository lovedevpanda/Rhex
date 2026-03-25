import { NotificationType, RelatedType } from "@/db/types"

import { countNotificationsByUserId, countUnreadNotifications, findCommentPostSlugById, findNotificationsByUserId, findPostSlugById } from "@/db/notification-read-queries"
import { formatMonthDayTime } from "@/lib/formatters"
import { getUserDisplayName } from "@/lib/users"


const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  REPLY_POST: "回复了你的帖子",
  REPLY_COMMENT: "回复了你的评论",
  LIKE: "赞了你的内容",
  MENTION: "提到了你",
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
  totalCount: number
}

export async function getUserUnreadNotificationCount(userId: number) {
  try {
    return await countUnreadNotifications(userId)
  } catch (error) {
    console.error(error)
    return 0
  }
}


async function resolveNotificationUrl(relatedType: RelatedType, relatedId: string) {
  if (relatedType === RelatedType.POST) {
    const post = await findPostSlugById(relatedId)

    return post ? `/posts/${post.slug}` : "/notifications"
  }

  if (relatedType === RelatedType.COMMENT) {
    const comment = await findCommentPostSlugById(relatedId)

    return comment?.post?.slug ? `/posts/${comment.post.slug}#comment-${comment.id}` : "/notifications"
  }

  return "/notifications"
}


export async function getUserNotifications(userId: number, page: number, pageSize: number): Promise<UserNotificationsResult> {
  try {
    const skip = (page - 1) * pageSize

    const [notifications, totalCount] = await Promise.all([
      findNotificationsByUserId(userId, skip, pageSize),
      countNotificationsByUserId(userId),
    ])


    const relatedUrls = await Promise.all(notifications.map((notification) => resolveNotificationUrl(notification.relatedType, notification.relatedId)))

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
      totalCount,
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      totalCount: 0,
    }
  }
}
