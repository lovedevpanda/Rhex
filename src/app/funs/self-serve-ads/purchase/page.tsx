import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { SiteHeader } from "@/components/site-header"

import { SelfServeAdsPurchasePage } from "@/components/self-serve-ads-purchase-page"
import { getSelfServeAdsAppConfig } from "@/lib/self-serve-ads"
import { buildSelfServeAdPriceMap, toSelfServeAdConfig } from "@/lib/self-serve-ads.shared"
import { readSearchParam } from "@/lib/search-params"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `购买广告位 - ${settings.siteName}`,
  }
}




export default async function SelfServeAdsPurchaseRoute(props: PageProps<"/funs/self-serve-ads/purchase">) {
  const searchParams = await props.searchParams;
  const slotTypeValue = readSearchParam(searchParams?.slotType)
  const slotType = slotTypeValue === "IMAGE" ? "IMAGE" : slotTypeValue === "TEXT" ? "TEXT" : null
  const slotIndex = Math.max(0, Number(readSearchParam(searchParams?.slotIndex) ?? 0) || 0)

  if (!slotType) {
    notFound()
  }

  const [rawConfig, settings] = await Promise.all([
    getSelfServeAdsAppConfig(),
    getSiteSettings(),
  ])
  const config = toSelfServeAdConfig(rawConfig)


  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[960px] px-4 py-8">
        <SelfServeAdsPurchasePage
          slotType={slotType}
          slotIndex={slotIndex}
          pointName={settings.pointName}
          prices={buildSelfServeAdPriceMap(config)}
        />
      </div>
    </div>
  )
}
