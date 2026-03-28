import type { Prisma } from "@prisma/client"

import { prisma } from "@/db/client"

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

export function updateSiteSettingsMarkdownEmoji(id: string, markdownEmojiMapJson: string) {
  return prisma.$executeRaw`
    UPDATE "SiteSetting"
    SET "markdownEmojiMapJson" = ${markdownEmojiMapJson},
        "updatedAt" = NOW()
    WHERE "id" = ${id}
  `
}
