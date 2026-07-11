import { prisma } from "@/db/client"
import type { Prisma } from "@/db/types"

export const postAttachmentSelect = {
  id: true,
  postId: true,
  uploadId: true,
  sourceType: true,
  name: true,
  fileExt: true,
  mimeType: true,
  fileSize: true,
  externalUrl: true,
  externalCode: true,
  minDownloadLevel: true,
  minDownloadVipLevel: true,
  pointsCost: true,
  requireReplyUnlock: true,
  downloadCount: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  upload: {
    select: {
      id: true,
      originalName: true,
      fileName: true,
      fileExt: true,
      mimeType: true,
      fileSize: true,
      storagePath: true,
      urlPath: true,
    },
  },
} satisfies Prisma.PostAttachmentSelect

export const postAttachmentPurchaseSelect = {
  id: true,
  postId: true,
  attachmentId: true,
  buyerId: true,
  sellerId: true,
  pointsCost: true,
  createdAt: true,
} satisfies Prisma.PostAttachmentPurchaseSelect

const postAttachmentActionSelect = {
  ...postAttachmentSelect,
  post: {
    select: {
      id: true,
      title: true,
      status: true,
      authorId: true,
      boardId: true,
      board: {
        select: {
          zoneId: true,
        },
      },
    },
  },
} satisfies Prisma.PostAttachmentSelect

const attachmentPurchaseUserSelect = {
  id: true,
  username: true,
  points: true,
  level: true,
  vipLevel: true,
  vipExpiresAt: true,
  status: true,
} satisfies Prisma.UserSelect

export function findPostAttachmentsByPostId(postId: string, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma
  return client.postAttachment.findMany({
    where: { postId },
    orderBy: {
      sortOrder: "asc",
    },
    select: postAttachmentSelect,
  })
}

export function findPostAttachmentById(attachmentId: string, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma
  return client.postAttachment.findUnique({
    where: { id: attachmentId },
    select: postAttachmentActionSelect,
  })
}

export function createPostAttachment(
  data: Prisma.PostAttachmentUncheckedCreateInput,
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma
  return client.postAttachment.create({
    data,
    select: postAttachmentSelect,
  })
}

export function updatePostAttachment(
  attachmentId: string,
  data: Prisma.PostAttachmentUncheckedUpdateInput,
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma
  return client.postAttachment.update({
    where: { id: attachmentId },
    data,
    select: postAttachmentSelect,
  })
}

export function deletePostAttachmentsByIds(attachmentIds: string[], tx?: Prisma.TransactionClient) {
  if (attachmentIds.length === 0) {
    return Promise.resolve({ count: 0 })
  }

  const client = tx ?? prisma
  return client.postAttachment.deleteMany({
    where: {
      id: {
        in: attachmentIds,
      },
    },
  })
}

export function incrementPostAttachmentDownloadCount(attachmentId: string, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma
  return client.postAttachment.update({
    where: { id: attachmentId },
    data: {
      downloadCount: {
        increment: 1,
      },
    },
    select: {
      id: true,
      downloadCount: true,
    },
  })
}

export function findPurchasedPostAttachmentPurchase(input: {
  userId: number
  attachmentId: string
}, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma
  return client.postAttachmentPurchase.findUnique({
    where: {
      attachmentId_buyerId: {
        attachmentId: input.attachmentId,
        buyerId: input.userId,
      },
    },
    select: postAttachmentPurchaseSelect,
  })
}

export function listPurchasedPostAttachmentPurchases(postId: string, userId: number, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma
  return client.postAttachmentPurchase.findMany({
    where: {
      postId,
      buyerId: userId,
    },
    select: postAttachmentPurchaseSelect,
  })
}

export function createPostAttachmentPurchase(
  data: Prisma.PostAttachmentPurchaseUncheckedCreateInput,
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma
  return client.postAttachmentPurchase.createMany({
    data,
    skipDuplicates: true,
  })
}

export function findAttachmentPurchaseUserById(userId: number, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma
  return client.user.findUnique({
    where: { id: userId },
    select: attachmentPurchaseUserSelect,
  })
}
