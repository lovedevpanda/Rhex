import { Prisma, NotificationType, TargetType } from "@/db/types"
import { prisma } from "@/db/client"



function isPrismaKnownError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
}

export async function toggleCommentLike(params: {
  userId: number
  commentId: string
  senderName: string
}) {
  const comment = await prisma.comment.findUnique({
    where: { id: params.commentId },
    select: {
      id: true,
      userId: true,
      content: true,
    },
  })

  const targetUserId = comment?.userId ?? null

  try {
    await prisma.$transaction(async (tx) => {
      await tx.like.delete({
        where: {
          userId_targetType_targetId: {
            userId: params.userId,
            targetType: TargetType.COMMENT,
            targetId: params.commentId,
          },
        },
      })

      await tx.comment.update({ where: { id: params.commentId }, data: { likeCount: { decrement: 1 } } })
    })

    return {
      liked: false,
      targetUserId,
    }
  } catch (error) {
    if (!isPrismaKnownError(error, "P2025")) {
      throw error
    }
  }

  await prisma.$transaction(async (tx) => {
    try {
      await tx.like.create({
        data: {
          userId: params.userId,
          targetType: TargetType.COMMENT,
          targetId: params.commentId,
          commentId: params.commentId,
        },
      })
    } catch (error) {
      if (!isPrismaKnownError(error, "P2002")) {
        throw error
      }

      return
    }

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
    targetUserId,
  }
}




export async function togglePostLike(params: {
  userId: number
  postId: string
  senderName: string
}) {
  const post = await prisma.post.findUnique({
    where: { id: params.postId },
    select: {
      id: true,
      authorId: true,
      title: true,
    },
  })

  const targetUserId = post?.authorId ?? null

  try {
    await prisma.$transaction(async (tx) => {
      await tx.like.delete({
        where: {
          userId_targetType_targetId: {
            userId: params.userId,
            targetType: TargetType.POST,
            targetId: params.postId,
          },
        },
      })

      await tx.post.update({ where: { id: params.postId }, data: { likeCount: { decrement: 1 } } })
    })

    return {
      liked: false,
      targetUserId,
    }
  } catch (error) {
    if (!isPrismaKnownError(error, "P2025")) {
      throw error
    }
  }

  await prisma.$transaction(async (tx) => {
    try {
      await tx.like.create({
        data: {
          userId: params.userId,
          targetType: TargetType.POST,
          targetId: params.postId,
          postId: params.postId,
        },
      })
    } catch (error) {
      if (!isPrismaKnownError(error, "P2002")) {
        throw error
      }

      return
    }

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
    targetUserId,
  }
}



export async function togglePostFavorite(params: {
  userId: number
  postId: string
}) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.favorite.delete({
        where: {
          userId_postId: {
            userId: params.userId,
            postId: params.postId,
          },
        },
      })

      await tx.post.update({ where: { id: params.postId }, data: { favoriteCount: { decrement: 1 } } })
    })

    return {
      favored: false,
    }
  } catch (error) {
    if (!isPrismaKnownError(error, "P2025")) {
      throw error
    }
  }

  await prisma.$transaction(async (tx) => {
    try {
      await tx.favorite.create({
        data: {
          userId: params.userId,
          postId: params.postId,
        },
      })
    } catch (error) {
      if (!isPrismaKnownError(error, "P2002")) {
        throw error
      }

      return
    }

    await tx.post.update({ where: { id: params.postId }, data: { favoriteCount: { increment: 1 } } })
  })

  return {
    favored: true,
  }
}



