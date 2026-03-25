import { findPublishedAnnouncements } from "@/db/announcement-queries"
import { formatMonthDayTime } from "@/lib/formatters"

export interface AnnouncementItem {
  id: string
  title: string
  content: string
  isPinned: boolean
  publishedAt: string
  publishedAtText: string
  creatorName: string
}

function mapAnnouncement(item: Awaited<ReturnType<typeof findPublishedAnnouncements>>[number]): AnnouncementItem {
  const publishedAt = (item.publishedAt ?? item.createdAt).toISOString()

  return {
    id: item.id,
    title: item.title,
    content: item.content,
    isPinned: item.isPinned,
    publishedAt,
    publishedAtText: formatMonthDayTime(publishedAt),
    creatorName: item.creator.nickname ?? item.creator.username,
  }
}

export async function getHomeAnnouncements(limit = 3): Promise<AnnouncementItem[]> {
  const items = await findPublishedAnnouncements(limit)
  return items.map(mapAnnouncement)
}

export async function getAnnouncementPageData(): Promise<{ items: AnnouncementItem[] }> {
  const items = await findPublishedAnnouncements()
  return {
    items: items.map(mapAnnouncement),
  }
}
