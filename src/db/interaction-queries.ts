import { NotificationType, TargetType } from "@/db/types"
import { prisma } from "@/db/client"

export async function toggleCommentLike(params: {
  userId: number
  commentId: string
  senderName: string
}) {
  const existing = await prisma.like.findUnique({
    where: {
      userId_targetType_targetId: {
        userId: params.userId,
        targetType: TargetType.COMMENT,
        targetId: params.commentId,
      },
    },
  })

  if (existing) {
    const deletedLike = await prisma.like.delete({ where: { id: existing.id } })
    await prisma.comment.update({ where: { id: params.commentId }, data: { likeCount: { decrement: 1 } } })

    const targetComment = deletedLike.commentId
      ? await prisma.comment.findUnique({ where: { id: deletedLike.commentId }, select: { userId: true } })
      : null

    return {
      liked: false,
      targetUserId: targetComment?.userId ?? null,
    }
  }

  const comment = await prisma.comment.findUnique({
    where: { id: params.commentId },
    select: {
      id: true,
      userId: true,
      content: true,
    },
  })

  await prisma.$transaction(async (tx) => {
    await tx.like.create({
      data: {
        userId: params.userId,
        targetType: TargetType.COMMENT,
        targetId: params.commentId,
        commentId: params.commentId,
      },
    })

    await tx.comment.update({ where: { id: params.commentId }, data: { likeCount: { increment: 1 } } })

    if (comment && comment.userId !== params.userId) {
      await tx.notification.create({
        data: {
          userId: comment.userId,
          type: NotificationType.LIKE,
          senderId: params.userId,
          relatedType: "COMMENT",
          relatedId: comment.id,
          title: "你的评论收到了赞",
          content: `${params.senderName} 赞了你的评论：${comment.content.slice(0, 80)}`,
        },
      })
    }
  })

  return {
    liked: true,
    targetUserId: comment?.userId ?? null,
  }
}

export async function togglePostLike(params: {
  userId: number
  postId: string
  senderName: string
}) {
  const existing = await prisma.like.findUnique({
    where: {
      userId_targetType_targetId: {
        userId: params.userId,
        targetType: TargetType.POST,
        targetId: params.postId,
      },
    },
  })

  if (existing) {
    const deletedLike = await prisma.like.delete({ where: { id: existing.id } })
    await prisma.post.update({ where: { id: params.postId }, data: { likeCount: { decrement: 1 } } })

    const targetPost = deletedLike.postId
      ? await prisma.post.findUnique({ where: { id: deletedLike.postId }, select: { authorId: true } })
      : null

    return {
      liked: false,
      targetUserId: targetPost?.authorId ?? null,
    }
  }

  const post = await prisma.post.findUnique({
    where: { id: params.postId },
    select: {
      id: true,
      authorId: true,
      title: true,
    },
  })

  await prisma.$transaction(async (tx) => {
    await tx.like.create({
      data: {
        userId: params.userId,
        targetType: TargetType.POST,
        targetId: params.postId,
        postId: params.postId,
      },
    })

    await tx.post.update({ where: { id: params.postId }, data: { likeCount: { increment: 1 } } })

    if (post && post.authorId !== params.userId) {
      await tx.notification.create({
        data: {
          userId: post.authorId,
          type: NotificationType.LIKE,
          senderId: params.userId,
          relatedType: "POST",
          relatedId: post.id,
          title: "你的帖子收到了赞",
          content: `${params.senderName} 赞了你的帖子：${post.title}`,
        },
      })
    }
  })

  return {
    liked: true,
    targetUserId: post?.authorId ?? null,
  }
}

export async function togglePostFavorite(params: {
  userId: number
  postId: string
}) {
  const existing = await prisma.favorite.findUnique({
    where: {
      userId_postId: {
        userId: params.userId,
        postId: params.postId,
      },
    },
  })

  if (existing) {
    await prisma.$transaction(async (tx) => {
      await tx.favorite.delete({ where: { id: existing.id } })
      await tx.post.update({ where: { id: params.postId }, data: { favoriteCount: { decrement: 1 } } })
    })

    return {
      favored: false,
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.favorite.create({
      data: {
        userId: params.userId,
        postId: params.postId,
      },
    })
    await tx.post.update({ where: { id: params.postId }, data: { favoriteCount: { increment: 1 } } })
  })


  return {
    favored: true,
  }
}
