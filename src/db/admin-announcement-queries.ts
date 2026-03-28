import { AnnouncementStatus, Prisma } from "@/db/types"

import { prisma } from "@/db/client"

export const adminAnnouncementInclude = {
  creator: {
    select: {
      username: true,
      nickname: true,
    },
  },
} satisfies Prisma.AnnouncementInclude

export type AdminAnnouncementRecord = Prisma.AnnouncementGetPayload<{
  include: typeof adminAnnouncementInclude
}>

export function findAdminAnnouncements() {
  return prisma.announcement.findMany({
    orderBy: [
      { isPinned: "desc" },
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
    include: adminAnnouncementInclude,
  })
}

export function createAdminAnnouncement(data: {
  title: string
  content: string
  status: AnnouncementStatus
  isPinned: boolean
  publishedAt: Date | null
  createdBy: number
}) {
  return prisma.announcement.create({
    data,
    include: adminAnnouncementInclude,
  })
}

export function updateAdminAnnouncementById(id: string, data: {
  title?: string
  content?: string
  status?: AnnouncementStatus
  isPinned?: boolean
  publishedAt?: Date | null
}) {
  return prisma.announcement.update({
    where: { id },
    data,
    include: adminAnnouncementInclude,
  })
}

export function deleteAdminAnnouncementById(id: string) {
  return prisma.announcement.delete({ where: { id } })
}
