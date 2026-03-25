import { AnnouncementStatus, Prisma } from "@/db/types"

import { prisma } from "@/db/client"

export const announcementListSelect = {
  id: true,
  title: true,
  content: true,
  status: true,
  isPinned: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  creator: {
    select: {
      username: true,
      nickname: true,
    },
  },
} satisfies Prisma.AnnouncementSelect

export function findPublishedAnnouncements(limit?: number) {
  return prisma.announcement.findMany({
    where: {
      status: AnnouncementStatus.PUBLISHED,
    },
    orderBy: [
      { isPinned: "desc" },
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
    take: typeof limit === "number" ? limit : undefined,
    select: announcementListSelect,
  })
}
