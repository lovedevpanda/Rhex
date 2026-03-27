import {
  dispatchCommentCreateEffects,
  dispatchPostFavoriteEffects,
  dispatchPostLikeEffects,
  registerInteractionEffectHooks,
} from "@/lib/background-task"
import { syncUserReceivedLikes } from "@/lib/level-system"
import { logError } from "@/lib/logger"
import { enrollUserInLotteryPool } from "@/lib/lottery"
import { tryClaimPostRedPacket } from "@/lib/post-red-packets"

function logSideEffectError(scope: string, error: unknown) {
  logError({ scope: "side-effect", metadata: { effect: scope } }, error)
}


async function swallowSideEffect<T>(scope: string, task: () => Promise<T>) {
  try {
    return await task()
  } catch (error) {
    logSideEffectError(scope, error)
    return null
  }
}

registerInteractionEffectHooks({
  async onPostLike(input) {
    const targetUserId = input.targetUserId

    await Promise.all([
      targetUserId
        ? swallowSideEffect(`post-like:sync-likes:${input.postId}:${input.userId}`, () => syncUserReceivedLikes(targetUserId))
        : Promise.resolve(null),
      input.liked
        ? swallowSideEffect(`post-like:lottery:${input.postId}:${input.userId}`, () => enrollUserInLotteryPool({ postId: input.postId, userId: input.userId }))
        : Promise.resolve(null),
    ])
  },

  async onPostFavorite(input) {
    if (!input.favored) {
      return
    }

    await swallowSideEffect(`post-favorite:lottery:${input.postId}:${input.userId}`, () => enrollUserInLotteryPool({
      postId: input.postId,
      userId: input.userId,
    }))
  },
  async onCommentCreate(input) {
    await swallowSideEffect(`comment-create:lottery:${input.commentId}`, () => enrollUserInLotteryPool({
      postId: input.postId,
      userId: input.userId,
      replyCommentId: input.commentId,
    }))
  },
})

export async function handlePostLikeSideEffects(input: {
  liked: boolean
  postId: string
  userId: number
  targetUserId: number | null
}) {
  const redPacketClaim = input.liked
    ? await swallowSideEffect(`post-like:red-packet:${input.postId}:${input.userId}`, () => tryClaimPostRedPacket({
        postId: input.postId,
        userId: input.userId,
        triggerType: "LIKE",
      }))
    : null

  await dispatchPostLikeEffects({
    postId: input.postId,
    userId: input.userId,
    targetUserId: input.targetUserId,
    liked: input.liked,
  })

  return {
    redPacketClaim,
  }
}

export async function handlePostFavoriteSideEffects(input: {
  favored: boolean
  postId: string
  userId: number
}) {
  if (!input.favored) {
    return {
      redPacketClaim: null,
    }
  }

  const redPacketClaim = await swallowSideEffect(`post-favorite:red-packet:${input.postId}:${input.userId}`, () => tryClaimPostRedPacket({
    postId: input.postId,
    userId: input.userId,
    triggerType: "FAVORITE",
  }))

  await dispatchPostFavoriteEffects({
    postId: input.postId,
    userId: input.userId,
    favored: input.favored,
  })

  return {
    redPacketClaim,
  }
}

export async function handleCommentCreateSideEffects(input: {
  postId: string
  userId: number
  commentId: string
}) {
  const redPacketClaim = await swallowSideEffect(`comment-create:red-packet:${input.commentId}`, () => tryClaimPostRedPacket({
    postId: input.postId,
    userId: input.userId,
    triggerType: "REPLY",
    triggerCommentId: input.commentId,
  }))

  await dispatchCommentCreateEffects({
    postId: input.postId,
    userId: input.userId,
    commentId: input.commentId,
  })

  return {
    redPacketClaim,
  }
}
