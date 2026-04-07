import { NotificationType } from "@/db/types"

import {
  findBoardFollowerUserIds,
  findCommentFollowNotificationContext,
  findPostFollowerUserIds,
  findPostFollowNotificationContext,
  findTagFollowerUserIds,
  findUserFollowerUserIds,
} from "@/db/follow-queries"
import { enqueueBackgroundJob, registerBackgroundJobHandler } from "@/lib/background-jobs"
import { createNotification, createNotifications } from "@/lib/notification-writes"
import { getAnonymousMaskDisplayIdentity } from "@/lib/post-anonymous"
import { getUserDisplayName } from "@/lib/users"

const FOLLOW_NOTIFICATION_BATCH_SIZE = 200

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

async function createNotificationsInBatches(notifications: Parameters<typeof createNotifications>[0]["notifications"]) {
  let count = 0

  for (let index = 0; index < notifications.length; index += FOLLOW_NOTIFICATION_BATCH_SIZE) {
    const batch = notifications.slice(index, index + FOLLOW_NOTIFICATION_BATCH_SIZE)
    const result = await createNotifications({ notifications: batch })
    count += result.count
  }

  return { count }
}

export async function dispatchNewPostFollowNotifications(postId: string) {
  const context = await findPostFollowNotificationContext(postId)

  if (!context || context.status !== "NORMAL") {
    return { count: 0 }
  }

  const tagIds = context.tags.map((item) => item.tag.id)
  const anonymousMaskIdentityPromise = context.isAnonymous ? getAnonymousMaskDisplayIdentity() : Promise.resolve(null)
  const [authorFollowers, boardFollowers, tagFollowers, anonymousMaskIdentity] = await Promise.all([
    context.isAnonymous ? Promise.resolve([]) : findUserFollowerUserIds(context.author.id),
    findBoardFollowerUserIds(context.board.id),
    findTagFollowerUserIds(tagIds),
    anonymousMaskIdentityPromise,
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

  const authorName = context.isAnonymous
    ? (anonymousMaskIdentity?.name ?? anonymousMaskIdentity?.username ?? "匿名用户")
    : getUserDisplayName(context.author)
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

  return createNotificationsInBatches(notifications)
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
  const anonymousMaskIdentity = context.post.isAnonymous && context.post.authorId === context.userId && context.useAnonymousIdentity
    ? await getAnonymousMaskDisplayIdentity()
    : null
  const senderName = anonymousMaskIdentity?.name ?? anonymousMaskIdentity?.username ?? getUserDisplayName(context.user)
  const seenUserIds = new Set<number>()
  const notifications = followers.flatMap((item) => {
    if (excludeUserIds.has(item.userId) || seenUserIds.has(item.userId)) {
      return []
    }

    seenUserIds.add(item.userId)

    return [{
      userId: item.userId,
      type: NotificationType.FOLLOWING_ACTIVITY,
      senderId: context.userId,
      relatedType: "COMMENT" as const,
      relatedId: context.id,
      title: "你关注的帖子有了新回复",
      content: `${senderName} 回复了《${compactText(context.post.title, 72)}》：${compactText(context.content)}`,
    }]
  })

  return createNotificationsInBatches(notifications)
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

registerBackgroundJobHandler("follow.notify-new-post", async (payload) => {
  await dispatchNewPostFollowNotifications(payload.postId)
})

registerBackgroundJobHandler("follow.notify-post-comment", async (payload) => {
  await dispatchPostFollowCommentNotifications({
    commentId: payload.commentId,
    excludeUserIds: payload.excludeUserIds,
  })
})

registerBackgroundJobHandler("follow.notify-user-followed", async (payload) => {
  await createNotification({
    userId: payload.userId,
    type: NotificationType.FOLLOWED_YOU,
    senderId: payload.followerUserId,
    relatedType: "USER",
    relatedId: String(payload.followerUserId),
    title: "你有了新粉丝",
    content: `${payload.followerName} 关注了你`,
  })
})

export function enqueueNewPostFollowNotifications(postId: string) {
  return enqueueBackgroundJob("follow.notify-new-post", { postId })
}

export function enqueuePostFollowCommentNotifications(params: {
  commentId: string
  excludeUserIds?: number[]
}) {
  return enqueueBackgroundJob("follow.notify-post-comment", params)
}

export function enqueueUserFollowedNotification(params: {
  userId: number
  followerUserId: number
  followerName: string
}) {
  return enqueueBackgroundJob("follow.notify-user-followed", params)
}
