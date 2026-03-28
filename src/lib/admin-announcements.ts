import { AnnouncementStatus } from "@/db/types"
import {
  createAdminAnnouncement,
  deleteAdminAnnouncementById,
  findAdminAnnouncements,
  type AdminAnnouncementRecord,
  updateAdminAnnouncementById,
} from "@/db/admin-announcement-queries"

import { requireAdminUser } from "@/lib/admin"
import { serializeDateTime } from "@/lib/formatters"




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

function mapRequiredDateTime(input: string | Date): string {
  const value = serializeDateTime(input)
  if (!value) {
    throw new Error("公告时间序列化失败")
  }

  return value
}

function mapAnnouncement(item: AdminAnnouncementRecord): AdminAnnouncementItem {

  return {
    id: item.id,
    title: item.title,
    content: item.content,
    status: item.status,
    isPinned: item.isPinned,
    createdAt: mapRequiredDateTime(item.createdAt),
    publishedAt: item.publishedAt ? mapRequiredDateTime(item.publishedAt) : null,
    creatorName: item.creator.nickname ?? item.creator.username,
  }
}


export async function getAdminAnnouncementList(): Promise<AdminAnnouncementItem[]> {
  const currentUser = await requireAdminUser()
  if (!currentUser) {
    throw new Error("无权限访问公告数据")
  }

  const items = await findAdminAnnouncements()


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
    ? await updateAdminAnnouncementById(String(input.id), {
        title,
        content,
        status,
        isPinned,
        publishedAt,
      })
    : await createAdminAnnouncement({
        title,
        content,
        status,
        isPinned,
        publishedAt,
        createdBy: currentUser.id,
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

  await deleteAdminAnnouncementById(id)

}

export async function toggleAdminAnnouncementPin(id: string, isPinned: boolean) {
  const currentUser = await requireAdminUser()
  if (!currentUser) {
    throw new Error("无权更新公告")
  }

  if (!id) {
    throw new Error("公告不存在")
  }

  const updated = await updateAdminAnnouncementById(id, { isPinned })


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
  const updated = await updateAdminAnnouncementById(id, {
    status: normalizedStatus,
    publishedAt: normalizedStatus === AnnouncementStatus.PUBLISHED ? new Date() : normalizedStatus === AnnouncementStatus.DRAFT ? null : undefined,
  })


  return mapAnnouncement(updated)
}
