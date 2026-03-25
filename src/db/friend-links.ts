import { FriendLinkStatus, Prisma } from "@/db/types"

import { prisma } from "@/db/client"

export const friendLinkListSelect = {
  id: true,
  name: true,
  url: true,
  logoPath: true,

  description: true,
  contact: true,
  sortOrder: true,
  clickCount: true,
  status: true,
  reviewNote: true,
  createdAt: true,
  updatedAt: true,
  reviewedAt: true,
} satisfies Prisma.FriendLinkSelect

export async function findApprovedFriendLinks(limit?: number) {
  return prisma.friendLink.findMany({
    where: { status: FriendLinkStatus.APPROVED },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: typeof limit === "number" ? limit : undefined,
    select: friendLinkListSelect,
  })
}

export async function findFriendLinksForAdmin(status?: FriendLinkStatus | "ALL") {
  return prisma.friendLink.findMany({
    where: status && status !== "ALL" ? { status } : undefined,
    orderBy: [
      { status: "asc" },
      { sortOrder: "asc" },
      { createdAt: "desc" },
    ],
    select: friendLinkListSelect,
  })
}

export async function findFriendLinkById(id: string) {
  return prisma.friendLink.findUnique({
    where: { id },
    select: friendLinkListSelect,
  })
}

export async function createFriendLink(data: Prisma.FriendLinkCreateInput) {
  return prisma.friendLink.create({
    data,
    select: friendLinkListSelect,
  })
}

export async function updateFriendLink(id: string, data: Prisma.FriendLinkUpdateInput) {
  return prisma.friendLink.update({
    where: { id },
    data,
    select: friendLinkListSelect,
  })
}

export async function countPendingFriendLinks() {
  return prisma.friendLink.count({
    where: { status: FriendLinkStatus.PENDING },
  })
}
