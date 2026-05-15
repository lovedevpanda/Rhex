import type { CurrentUserRecord } from "@/db/current-user"
import { prisma } from "@/db/client"
import { NotificationType, TargetType } from "@/db/types"

import { toggleCommentLike, togglePostLike } from "@/db/interaction-queries"
import { revalidateContentListCaches } from "@/lib/content-list-cache"
import { handlePostLikeSideEffects } from "@/lib/interaction-side-effects"
import { buildLikeTaskEventDescriptors } from "@/lib/like-task-events"
import { enqueueSyncUserReceivedLikes } from "@/lib/level-system"
import { enqueueNotification } from "@/lib/notification-writes"
import { logRequestSucceeded } from "@/lib/request-log"
import { recordGivenLikeTaskEvent, recordReceivedLikeTaskEvent } from "@/lib/task-center-service"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { withRequestWriteGuard, withWriteGuard } from "@/lib/write-guard"
import { createRequestWriteGuardOptions, createWriteGuardOptions } from "@/lib/write-guard-policies"

type LikeExecutionActor = Pick<CurrentUserRecord, "id" | "username" | "nickname" | "status">

interface InteractionExecutionLogOptions {
  scope: string
  action: string
  extra?: Record<string, unknown>
}

interface PostLikeMutationResult {
  liked: boolean
  targetUserId: number | null
  notificationTargetUserId: number | null
  postTitle: string
}

interface CommentLikeMutationResult {
  liked: boolean
  targetUserId: number | null
  notificationTargetUserId: number | null
  commentPreview: string
}

function assertLikeActorStatus(actor: LikeExecutionActor) {
  if (actor.status === "ACTIVE" || actor.status === "MUTED") {
    return
  }

  if (actor.status === "BANNED") {
    throw new Error("当前账号已被拉黑，无法点赞")
  }

  throw new Error("当前账号状态不可执行该操作")
}

async function runLikeWriteGuard<T>(
  policyName: "posts-like" | "comments-like",
  input: Record<string, unknown>,
  actorId: number,
  request: Request | undefined,
  task: () => Promise<T>,
) {
  if (request) {
    return withRequestWriteGuard(createRequestWriteGuardOptions(policyName, {
      request,
      userId: actorId,
      input,
    }), task)
  }

  return withWriteGuard({
    ...createWriteGuardOptions(policyName, {
      userId: actorId,
      input,
    }),
    identity: {
      userId: actorId,
    },
  }, task)
}

function dispatchLikeTaskEvents(input: {
  actorUserId: number
  targetUserId: number | null
  targetType: TargetType
  targetId: string
  liked: boolean
}) {
  for (const event of buildLikeTaskEventDescriptors(input)) {
    if (event.kind === "given") {
      void recordGivenLikeTaskEvent(event.payload).catch((error) => {
        console.warn(`[interaction-like-execution] failed to record outgoing ${input.targetType.toLowerCase()} like task`, error)
      })
      continue
    }

    void recordReceivedLikeTaskEvent(event.payload).catch((error) => {
      console.warn(`[interaction-like-execution] failed to record incoming ${input.targetType.toLowerCase()} like task`, error)
    })
  }
}

async function applyPostLikeMutationEffects(input: {
  actor: LikeExecutionActor
  postId: string
  result: PostLikeMutationResult
}) {
  await handlePostLikeSideEffects({
    liked: input.result.liked,
    postId: input.postId,
    userId: input.actor.id,
    targetUserId: input.result.targetUserId,
  })

  if (input.result.targetUserId) {
    revalidateUserSurfaceCache(input.result.targetUserId)
  }

  revalidateContentListCaches()

  if (input.result.liked && input.result.notificationTargetUserId) {
    void enqueueNotification({
      userId: input.result.notificationTargetUserId,
      type: NotificationType.LIKE,
      senderId: input.actor.id,
      relatedType: "POST",
      relatedId: input.postId,
      title: "你的帖子收到了赞",
      content: `${input.actor.nickname ?? input.actor.username} 赞了你的帖子：${input.result.postTitle}`,
    })
  }

  dispatchLikeTaskEvents({
    actorUserId: input.actor.id,
    targetUserId: input.result.targetUserId,
    targetType: TargetType.POST,
    targetId: input.postId,
    liked: input.result.liked,
  })
}

async function applyCommentLikeMutationEffects(input: {
  actor: LikeExecutionActor
  commentId: string
  result: CommentLikeMutationResult
}) {
  if (input.result.targetUserId) {
    void enqueueSyncUserReceivedLikes(input.result.targetUserId, { notifyOnUpgrade: true })
    revalidateUserSurfaceCache(input.result.targetUserId)
  }

  if (input.result.liked && input.result.notificationTargetUserId) {
    void enqueueNotification({
      userId: input.result.notificationTargetUserId,
      type: NotificationType.LIKE,
      senderId: input.actor.id,
      relatedType: "COMMENT",
      relatedId: input.commentId,
      title: "你的评论收到了赞",
      content: `${input.actor.nickname ?? input.actor.username} 赞了你的评论：${input.result.commentPreview}`,
    })
  }

  dispatchLikeTaskEvents({
    actorUserId: input.actor.id,
    targetUserId: input.result.targetUserId,
    targetType: TargetType.COMMENT,
    targetId: input.commentId,
    liked: input.result.liked,
  })
}

export async function executePostLikeToggle(input: {
  actor: LikeExecutionActor
  postId: string
  request?: Request
  log?: InteractionExecutionLogOptions
}) {
  assertLikeActorStatus(input.actor)

  return runLikeWriteGuard("posts-like", {
    postId: input.postId,
  }, input.actor.id, input.request, async () => {
    const result = await togglePostLike({
      userId: input.actor.id,
      postId: input.postId,
      senderName: input.actor.nickname ?? input.actor.username,
    })

    await applyPostLikeMutationEffects({
      actor: input.actor,
      postId: input.postId,
      result,
    })

    if (input.log) {
      logRequestSucceeded({
        scope: input.log.scope,
        action: input.log.action,
        userId: input.actor.id,
        targetId: input.postId,
      }, {
        liked: result.liked,
        changed: true,
        ...(input.log.extra ?? {}),
      })
    }

    return {
      postId: input.postId,
      liked: result.liked,
      changed: true,
      targetUserId: result.targetUserId,
    }
  })
}

export async function executeCommentLikeToggle(input: {
  actor: LikeExecutionActor
  commentId: string
  request?: Request
  log?: InteractionExecutionLogOptions
}) {
  assertLikeActorStatus(input.actor)

  return runLikeWriteGuard("comments-like", {
    commentId: input.commentId,
  }, input.actor.id, input.request, async () => {
    const result = await toggleCommentLike({
      userId: input.actor.id,
      commentId: input.commentId,
      senderName: input.actor.nickname ?? input.actor.username,
    })

    await applyCommentLikeMutationEffects({
      actor: input.actor,
      commentId: input.commentId,
      result,
    })

    if (input.log) {
      logRequestSucceeded({
        scope: input.log.scope,
        action: input.log.action,
        userId: input.actor.id,
        targetId: input.commentId,
      }, {
        liked: result.liked,
        changed: true,
        ...(input.log.extra ?? {}),
      })
    }

    return {
      commentId: input.commentId,
      liked: result.liked,
      changed: true,
      targetUserId: result.targetUserId,
    }
  })
}

export async function ensurePostLiked(input: {
  actor: LikeExecutionActor
  postId: string
  request?: Request
  log?: InteractionExecutionLogOptions
}) {
  assertLikeActorStatus(input.actor)

  return runLikeWriteGuard("posts-like", {
    postId: input.postId,
  }, input.actor.id, input.request, async () => {
    const [post, existingLike] = await Promise.all([
      prisma.post.findUnique({
        where: { id: input.postId },
        select: {
          id: true,
          authorId: true,
          title: true,
        },
      }),
      prisma.like.findUnique({
        where: {
          userId_targetType_targetId: {
            userId: input.actor.id,
            targetType: TargetType.POST,
            targetId: input.postId,
          },
        },
        select: {
          id: true,
        },
      }),
    ])

    if (!post) {
      throw new Error("帖子不存在或暂不可点赞")
    }

    if (existingLike) {
      if (input.log) {
        logRequestSucceeded({
          scope: input.log.scope,
          action: input.log.action,
          userId: input.actor.id,
          targetId: input.postId,
        }, {
          liked: true,
          changed: false,
          ...(input.log.extra ?? {}),
        })
      }

      return {
        postId: input.postId,
        liked: true as const,
        changed: false,
        targetUserId: post.authorId ?? null,
      }
    }

    const result = await togglePostLike({
      userId: input.actor.id,
      postId: input.postId,
      senderName: input.actor.nickname ?? input.actor.username,
    })

    if (!result.liked) {
      throw new Error("帖子点赞失败")
    }

    await applyPostLikeMutationEffects({
      actor: input.actor,
      postId: input.postId,
      result,
    })

    if (input.log) {
      logRequestSucceeded({
        scope: input.log.scope,
        action: input.log.action,
        userId: input.actor.id,
        targetId: input.postId,
      }, {
        liked: true,
        changed: true,
        ...(input.log.extra ?? {}),
      })
    }

    return {
      postId: input.postId,
      liked: true as const,
      changed: true,
      targetUserId: result.targetUserId,
    }
  })
}

export async function ensureCommentLiked(input: {
  actor: LikeExecutionActor
  commentId: string
  request?: Request
  log?: InteractionExecutionLogOptions
}) {
  assertLikeActorStatus(input.actor)

  return runLikeWriteGuard("comments-like", {
    commentId: input.commentId,
  }, input.actor.id, input.request, async () => {
    const [comment, existingLike] = await Promise.all([
      prisma.comment.findUnique({
        where: { id: input.commentId },
        select: {
          id: true,
          userId: true,
          content: true,
        },
      }),
      prisma.like.findUnique({
        where: {
          userId_targetType_targetId: {
            userId: input.actor.id,
            targetType: TargetType.COMMENT,
            targetId: input.commentId,
          },
        },
        select: {
          id: true,
        },
      }),
    ])

    if (!comment) {
      throw new Error("评论不存在或暂不可点赞")
    }

    if (existingLike) {
      if (input.log) {
        logRequestSucceeded({
          scope: input.log.scope,
          action: input.log.action,
          userId: input.actor.id,
          targetId: input.commentId,
        }, {
          liked: true,
          changed: false,
          ...(input.log.extra ?? {}),
        })
      }

      return {
        commentId: input.commentId,
        liked: true as const,
        changed: false,
        targetUserId: comment.userId ?? null,
      }
    }

    const result = await toggleCommentLike({
      userId: input.actor.id,
      commentId: input.commentId,
      senderName: input.actor.nickname ?? input.actor.username,
    })

    if (!result.liked) {
      throw new Error("评论点赞失败")
    }

    await applyCommentLikeMutationEffects({
      actor: input.actor,
      commentId: input.commentId,
      result,
    })

    if (input.log) {
      logRequestSucceeded({
        scope: input.log.scope,
        action: input.log.action,
        userId: input.actor.id,
        targetId: input.commentId,
      }, {
        liked: true,
        changed: true,
        ...(input.log.extra ?? {}),
      })
    }

    return {
      commentId: input.commentId,
      liked: true as const,
      changed: true,
      targetUserId: result.targetUserId,
    }
  })
}
