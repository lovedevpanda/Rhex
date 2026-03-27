export interface InteractionEffectHooks {
  onPostLike?: (input: {
    postId: string
    userId: number
    targetUserId: number | null
    liked: boolean
  }) => Promise<void>
  onPostFavorite?: (input: {
    postId: string
    userId: number
    favored: boolean
  }) => Promise<void>
  onCommentCreate?: (input: {
    postId: string
    userId: number
    commentId: string
  }) => Promise<void>
}

const interactionEffectHooks: InteractionEffectHooks[] = []

export function registerInteractionEffectHooks(hooks: InteractionEffectHooks) {
  interactionEffectHooks.push(hooks)
}

export async function dispatchPostLikeEffects(input: {
  postId: string
  userId: number
  targetUserId: number | null
  liked: boolean
}) {
  for (const hooks of interactionEffectHooks) {
    await hooks.onPostLike?.(input)
  }
}

export async function dispatchPostFavoriteEffects(input: {
  postId: string
  userId: number
  favored: boolean
}) {
  for (const hooks of interactionEffectHooks) {
    await hooks.onPostFavorite?.(input)
  }
}

export async function dispatchCommentCreateEffects(input: {
  postId: string
  userId: number
  commentId: string
}) {
  for (const hooks of interactionEffectHooks) {
    await hooks.onCommentCreate?.(input)
  }
}
