import type { Prisma } from "@prisma/client"

import { prisma } from "@/db/client"
import { syncGiftDefinitions } from "@/db/post-gift-queries"

export function findSiteSettingsRecordForUpdate() {
  return prisma.siteSetting.findFirst({
    orderBy: { createdAt: "asc" },
  })
}

export function createSiteSettingsRecordWithFullData(data: Prisma.SiteSettingCreateInput) {
  return prisma.siteSetting.create({
    data,
  })
}

export function updateSiteSettingsRecord(id: string, data: Prisma.SiteSettingUpdateInput) {
  return prisma.siteSetting.update({
    where: { id },
    data,
  })
}

export function updateSiteSettingsHeaderApps(id: string, headerAppLinksJson: string, headerAppIconName: string) {
  return prisma.siteSetting.update({
    where: { id },
    data: {
      headerAppLinksJson,
      headerAppIconName,
    },
  })
}

export function updateSiteSettingsMarkdownEmoji(id: string, markdownEmojiMapJson: string) {
  return prisma.siteSetting.update({
    where: { id },
    data: {
      markdownEmojiMapJson,
    },
  })
}

export async function updateSiteSettingsRecordWithGiftDefinitions(
  id: string,
  data: Prisma.SiteSettingUpdateInput,
  giftDefinitions: Parameters<typeof syncGiftDefinitions>[0],
) {
  return prisma.$transaction(async (tx) => {
    const settings = await tx.siteSetting.update({
      where: { id },
      data,
    })

    await syncGiftDefinitions(giftDefinitions, tx)

    return settings
  })
}
