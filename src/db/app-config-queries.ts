import { prisma } from "@/db/client"

import { defaultSiteSettingsCreateInput } from "@/lib/site-settings-defaults"

const siteSettingsAppStateSelect = {
  id: true,
  appStateJson: true,
} as const

export function findSiteSettingsAppStateRecord() {
  return prisma.siteSetting.findFirst({
    orderBy: { createdAt: "asc" },
    select: siteSettingsAppStateSelect,
  })
}

export function createSiteSettingsAppStateRecord() {
  return prisma.siteSetting.create({
    data: defaultSiteSettingsCreateInput,
    select: siteSettingsAppStateSelect,
  })
}

export function updateSiteSettingsAppState(id: string, appStateJson: string) {
  return prisma.siteSetting.update({
    where: { id },
    data: { appStateJson },
    select: siteSettingsAppStateSelect,
  })
}
