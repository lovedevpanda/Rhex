import { AnnouncementStatus } from "@/db/types"

import { prisma } from "@/db/client"

import { requireAdminUser } from "@/lib/admin"

export interface AdminAnnouncementItem {
  id: string
  title: string
  content: string
  status: AnnouncementStatus
  isPinned: boolean
  createdAt: string
  publishedAt: string | null
  creatorName: string
}

export interface AdminAnnouncementInput {
  id?: string
  title: string
  content: string
  status: string
  isPinned?: boolean
}

function normalizeText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength)
}

function normalizeStatus(value: unknown): AnnouncementStatus {
  if (value === AnnouncementStatus.DRAFT || value === AnnouncementStatus.PUBLISHED || value === AnnouncementStatus.OFFLINE) {
    return value
  }

  return AnnouncementStatus.DRAFT
}

function mapAnnouncement(item: Awaited<ReturnType<typeof prisma.announcement.findMany>>[number] & {
  creator: {
    username: string
    nickname: string | null
  }
}): AdminAnnouncementItem {
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    status: item.status,
    isPinned: item.isPinned,
    createdAt: item.createdAt.toISOString(),
    publishedAt: item.publishedAt?.toISOString() ?? null,
    creatorName: item.creator.nickname ?? item.creator.username,
  }
}

export async function getAdminAnnouncementList(): Promise<AdminAnnouncementItem[]> {
  const currentUser = await requireAdminUser()
  if (!currentUser) {
    throw new Error("无权限访问公告数据")
  }

  const items = await prisma.announcement.findMany({
    orderBy: [
      { isPinned: "desc" },
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
    include: {
      creator: {
        select: {
          username: true,
          nickname: true,
        },
      },
    },
  })

  return items.map(mapAnnouncement)
}

export async function saveAdminAnnouncement(input: AdminAnnouncementInput): Promise<AdminAnnouncementItem> {
  const currentUser = await requireAdminUser()
  if (!currentUser) {
    throw new Error("无权操作公告")
  }

  const title = normalizeText(input.title, 120)
  const content = String(input.content ?? "").trim()
  const status = normalizeStatus(input.status)
  const isPinned = Boolean(input.isPinned)

  if (!title) {
    throw new Error("公告标题不能为空")
  }

  if (!content) {
    throw new Error("公告内容不能为空")
  }

  const publishedAt = status === AnnouncementStatus.PUBLISHED ? new Date() : null

  const record = input.id
    ? await prisma.announcement.update({
        where: { id: String(input.id) },
        data: {
          title,
          content,
          status,
          isPinned,
          publishedAt,
        },
        include: {
          creator: {
            select: {
              username: true,
              nickname: true,
            },
          },
        },
      })
    : await prisma.announcement.create({
        data: {
          title,
          content,
          status,
          isPinned,
          publishedAt,
          createdBy: currentUser.id,
        },
        include: {
          creator: {
            select: {
              username: true,
              nickname: true,
            },
          },
        },
      })

  return mapAnnouncement(record)
}

export async function removeAdminAnnouncement(id: string) {
  const currentUser = await requireAdminUser()
  if (!currentUser) {
    throw new Error("无权删除公告")
  }

  if (!id) {
    throw new Error("公告不存在")
  }

  await prisma.announcement.delete({ where: { id } })
}

export async function toggleAdminAnnouncementPin(id: string, isPinned: boolean) {
  const currentUser = await requireAdminUser()
  if (!currentUser) {
    throw new Error("无权更新公告")
  }

  if (!id) {
    throw new Error("公告不存在")
  }

  const updated = await prisma.announcement.update({
    where: { id },
    data: { isPinned },
    include: {
      creator: {
        select: {
          username: true,
          nickname: true,
        },
      },
    },
  })

  return mapAnnouncement(updated)
}

export async function updateAdminAnnouncementStatus(id: string, status: string) {
  const currentUser = await requireAdminUser()
  if (!currentUser) {
    throw new Error("无权更新公告")
  }

  if (!id) {
    throw new Error("公告不存在")
  }

  const normalizedStatus = normalizeStatus(status)
  const updated = await prisma.announcement.update({
    where: { id },
    data: {
      status: normalizedStatus,
      publishedAt: normalizedStatus === AnnouncementStatus.PUBLISHED ? new Date() : normalizedStatus === AnnouncementStatus.DRAFT ? null : undefined,
    },
    include: {
      creator: {
        select: {
          username: true,
          nickname: true,
        },
      },
    },
  })

  return mapAnnouncement(updated)
}
