export type { SiteDocumentItem as AnnouncementItem } from "@/lib/site-documents"

import { getPublishedSiteDocumentItems } from "@/lib/site-documents"

export async function getHomeAnnouncements(limit = 3) {
  return getPublishedSiteDocumentItems("ANNOUNCEMENT", limit)
}

export async function getAnnouncementPageData() {
  return {
    items: await getPublishedSiteDocumentItems("ANNOUNCEMENT"),
  }
}
