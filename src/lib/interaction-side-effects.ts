import {
  enqueueCommentCreateEffects,
  enqueuePostFavoriteEffects,
  enqueuePostLikeEffects,
  registerInteractionEffectHooks,
} from "@/lib/background-task"
import { syncUserReceivedLikes } from "@/lib/level-system"
import { logError } from "@/lib/logger"
import { enrollUserInLotteryPool } from "@/lib/lottery"
import { tryTriggerPostRewardPool } from "@/lib/post-red-packets"

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
        ? swallowSideEffect(`post-like:sync-likes:${input.postId}:${input.userId}`, () => syncUserReceivedLikes(targetUserId, { notifyOnUpgrade: true }))
        : Promise.resolve(null),
      input.liked
        ? swallowSideEffect(`post-like:red-packet:${input.postId}:${input.userId}`, () => tryTriggerPostRewardPool({
            postId: input.postId,
            userId: input.userId,
            triggerType: "LIKE",
          }))
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

    await Promise.all([
      swallowSideEffect(`post-favorite:red-packet:${input.postId}:${input.userId}`, () => tryTriggerPostRewardPool({
        postId: input.postId,
        userId: input.userId,
        triggerType: "FAVORITE",
      })),
      swallowSideEffect(`post-favorite:lottery:${input.postId}:${input.userId}`, () => enrollUserInLotteryPool({
        postId: input.postId,
        userId: input.userId,
      })),
    ])
  },
  async onCommentCreate(input) {
    await Promise.all([
      swallowSideEffect(`comment-create:red-packet:${input.commentId}`, () => tryTriggerPostRewardPool({
        postId: input.postId,
        userId: input.userId,
        triggerType: "REPLY",
        triggerCommentId: input.commentId,
      })),
      swallowSideEffect(`comment-create:lottery:${input.commentId}`, () => enrollUserInLotteryPool({
        postId: input.postId,
        userId: input.userId,
        replyCommentId: input.commentId,
      })),
    ])
  },
})

export async function handlePostLikeSideEffects(input: {
  liked: boolean
  postId: string
  userId: number
  targetUserId: number | null
}) {
  void enqueuePostLikeEffects({
    postId: input.postId,
    userId: input.userId,
    targetUserId: input.targetUserId,
    liked: input.liked,
  })
}

export async function handlePostFavoriteSideEffects(input: {
  favored: boolean
  postId: string
  userId: number
}) {
  if (input.favored) {
    void enqueuePostFavoriteEffects({
      postId: input.postId,
      userId: input.userId,
      favored: input.favored,
    })
  }
}

export async function handleCommentCreateSideEffects(input: {
  postId: string
  userId: number
  commentId: string
}) {
  void enqueueCommentCreateEffects({
    postId: input.postId,
    userId: input.userId,
    commentId: input.commentId,
  })
}
