import type { Metadata } from "next"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { ReadingHistoryPanel } from "@/components/post/reading-history-panel"
import { SiteHeader } from "@/components/site-header"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `${settings.siteName} - 足迹`,
    description: "查看当前浏览器保存的本地阅读记录与今日访问。",
  }
}

export default function ReadingHistoryPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-[960px] px-3 py-6 sm:px-4">
        <AddonSlotRenderer slot="history.page.before" />
        <AddonSurfaceRenderer surface="history.page">
          <div className="space-y-4">
            <ReadingHistoryPanel
              variant="page"
              surface="history.panel"
              beforeContent={<AddonSlotRenderer slot="history.panel.before" />}
              afterContent={<AddonSlotRenderer slot="history.panel.after" />}
              title="足迹"
              showClearButton
              emptyDescription="打开帖子详情后会自动写入当前浏览器本地，可用于今日访问和阅读记录扩展。"
            />
          </div>
        </AddonSurfaceRenderer>
        <AddonSlotRenderer slot="history.page.after" />
      </main>
    </div>
  )
}
