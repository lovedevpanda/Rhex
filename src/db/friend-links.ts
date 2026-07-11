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

export async function findFriendLinkByUrl(url: string) {
  return prisma.friendLink.findFirst({
    where: { url: { equals: url, mode: "insensitive" } },
    select: friendLinkListSelect,
  })
}

export async function createFriendLink(data: Prisma.FriendLinkCreateInput) {
  return prisma.friendLink.create({
    data,
    select: friendLinkListSelect,
  })
}

export async function createFriendLinkIfAbsent(data: Prisma.FriendLinkCreateInput) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      SELECT pg_advisory_xact_lock(
        hashtext('friend-link-submit'),
        hashtext(${data.url.toLowerCase()})
      )
    `)

    const existing = await tx.friendLink.findFirst({
      where: { url: { equals: data.url, mode: "insensitive" } },
      select: { id: true },
    })
    if (existing) {
      return null
    }

    return tx.friendLink.create({
      data,
      select: friendLinkListSelect,
    })
  })
}

export async function updateFriendLinkIfStatus(
  id: string,
  expectedStatuses: FriendLinkStatus[],
  data: Prisma.FriendLinkUpdateInput,
) {
  const updated = await prisma.friendLink.updateMany({
    where: { id, status: { in: expectedStatuses } },
    data,
  })
  if (updated.count !== 1) {
    return null
  }

  return prisma.friendLink.findUnique({
    where: { id },
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

export async function deleteFriendLink(id: string) {
  return prisma.friendLink.delete({
    where: { id },
    select: friendLinkListSelect,
  })
}

export async function countPendingFriendLinks() {
  return prisma.friendLink.count({
    where: { status: FriendLinkStatus.PENDING },
  })
}
