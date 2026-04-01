import { NotificationType } from "@/db/types"

import {
  findBoardFollowerUserIds,
  findCommentFollowNotificationContext,
  findPostFollowerUserIds,
  findPostFollowNotificationContext,
  findTagFollowerUserIds,
  findUserFollowerUserIds,
} from "@/db/follow-queries"
import { createNotification, createNotifications } from "@/lib/notification-writes"
import { getUserDisplayName } from "@/lib/users"

function compactText(value: string, maxLength = 80) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength)
}

function createReasonLabel(params: {
  followsAuthor: boolean
  followsBoard: boolean
  boardName: string
  tagNames: string[]
}) {
  const reasons: string[] = []

  if (params.followsAuthor) {
    reasons.push("关注的用户")
  }

  if (params.followsBoard) {
    reasons.push(`节点 ${params.boardName}`)
  }

  if (params.tagNames.length > 0) {
    reasons.push(params.tagNames.slice(0, 2).map((name) => `#${name}`).join("、"))
  }

  return reasons.join(" / ")
}

export async function dispatchNewPostFollowNotifications(postId: string) {
  const context = await findPostFollowNotificationContext(postId)

  if (!context || context.status !== "NORMAL") {
    return { count: 0 }
  }

  const tagIds = context.tags.map((item) => item.tag.id)
  const [authorFollowers, boardFollowers, tagFollowers] = await Promise.all([
    findUserFollowerUserIds(context.author.id),
    findBoardFollowerUserIds(context.board.id),
    findTagFollowerUserIds(tagIds),
  ])

  const recipients = new Map<number, {
    followsAuthor: boolean
    followsBoard: boolean
    tagNames: Set<string>
  }>()

  for (const item of authorFollowers) {
    if (item.followerId === context.author.id) {
      continue
    }

    recipients.set(item.followerId, {
      followsAuthor: true,
      followsBoard: recipients.get(item.followerId)?.followsBoard ?? false,
      tagNames: recipients.get(item.followerId)?.tagNames ?? new Set<string>(),
    })
  }

  for (const item of boardFollowers) {
    if (item.userId === context.author.id) {
      continue
    }

    const current = recipients.get(item.userId)
    recipients.set(item.userId, {
      followsAuthor: current?.followsAuthor ?? false,
      followsBoard: true,
      tagNames: current?.tagNames ?? new Set<string>(),
    })
  }

  for (const item of tagFollowers) {
    if (item.userId === context.author.id) {
      continue
    }

    const current = recipients.get(item.userId)
    const tagNames = current?.tagNames ?? new Set<string>()
    tagNames.add(item.tag.name)
    recipients.set(item.userId, {
      followsAuthor: current?.followsAuthor ?? false,
      followsBoard: current?.followsBoard ?? false,
      tagNames,
    })
  }

  const authorName = getUserDisplayName(context.author)
  const notifications = [...recipients.entries()].map(([userId, reason]) => {
    const tagNames = [...reason.tagNames]
    const reasonLabel = createReasonLabel({
      followsAuthor: reason.followsAuthor,
      followsBoard: reason.followsBoard,
      boardName: context.board.name,
      tagNames,
    })

    return {
      userId,
      type: NotificationType.FOLLOWING_ACTIVITY,
      senderId: context.author.id,
      relatedType: "POST" as const,
      relatedId: context.id,
      title: "你关注的内容有了新动态",
      content: `${authorName} 发布了新帖子：${compactText(context.title, 96)}${reasonLabel ? `（来源：${reasonLabel}）` : ""}`,
    }
  })

  return createNotifications({ notifications })
}

export async function dispatchPostFollowCommentNotifications(params: {
  commentId: string
  excludeUserIds?: number[]
}) {
  const context = await findCommentFollowNotificationContext(params.commentId)

  if (!context || context.status !== "NORMAL" || context.post.status !== "NORMAL") {
    return { count: 0 }
  }

  const excludeUserIds = new Set([context.userId, ...(params.excludeUserIds ?? [])])
  const followers = await findPostFollowerUserIds(context.post.id)
  const senderName = getUserDisplayName(context.user)
  const notifications = followers
    .map((item) => item.userId)
    .filter((userId, index, list) => !excludeUserIds.has(userId) && list.indexOf(userId) === index)
    .map((userId) => ({
      userId,
      type: NotificationType.FOLLOWING_ACTIVITY,
      senderId: context.userId,
      relatedType: "COMMENT" as const,
      relatedId: context.id,
      title: "你关注的帖子有了新回复",
      content: `${senderName} 回复了《${compactText(context.post.title, 72)}》：${compactText(context.content)}`,
    }))

  return createNotifications({ notifications })
}

export async function dispatchNewPostFollowNotificationsBestEffort(postId: string) {
  try {
    return await dispatchNewPostFollowNotifications(postId)
  } catch (error) {
    console.warn("[follow-notifications] failed to dispatch post follow notifications", error)
    return { count: 0 }
  }
}

export async function dispatchPostFollowCommentNotificationsBestEffort(params: {
  commentId: string
  excludeUserIds?: number[]
}) {
  try {
    return await dispatchPostFollowCommentNotifications(params)
  } catch (error) {
    console.warn("[follow-notifications] failed to dispatch post comment notifications", error)
    return { count: 0 }
  }
}

export async function dispatchUserFollowedNotificationBestEffort(params: {
  userId: number
  followerUserId: number
  followerName: string
}) {
  try {
    await createNotification({
      userId: params.userId,
      type: NotificationType.FOLLOWED_YOU,
      senderId: params.followerUserId,
      relatedType: "USER",
      relatedId: String(params.followerUserId),
      title: "你有了新粉丝",
      content: `${params.followerName} 关注了你`,
    })
  } catch (error) {
    console.warn("[follow-notifications] failed to dispatch user follow notification", error)
  }
}
