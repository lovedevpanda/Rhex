import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { SiteHeader } from "@/components/site-header"
import { TopupResultPage } from "@/components/topup-result-page"
import { getCurrentUser } from "@/lib/auth"
import { getPaymentOrderStatusForUser } from "@/lib/payment-gateway"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `充值结果 - ${settings.siteName}`,
    description: `查看 ${settings.siteName} ${settings.pointName} 充值订单的支付与到账状态。`,
  }
}

export default async function TopupResultRoute(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const merchantOrderNo = typeof searchParams?.merchantOrderNo === "string"
    ? searchParams.merchantOrderNo.trim()
    : ""

  if (!merchantOrderNo) {
    redirect("/topup")
  }

  const [currentUser, settings] = await Promise.all([
    getCurrentUser(),
    getSiteSettings(),
  ])

  if (!currentUser) {
    redirect(`/login?redirect=/topup/result?merchantOrderNo=${encodeURIComponent(merchantOrderNo)}`)
  }

  const status = await getPaymentOrderStatusForUser(currentUser.id, merchantOrderNo)

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[900px] px-4 py-8">
        <AddonSlotRenderer slot="topup.result.page.before" />
        <AddonSurfaceRenderer surface="topup.result.page" props={{ merchantOrderNo, pointName: settings.pointName, status }}>
          <>
            <AddonSlotRenderer slot="topup.result.panel.before" />
            <AddonSurfaceRenderer surface="topup.result.panel" props={{ merchantOrderNo, pointName: settings.pointName, status }}>
              <TopupResultPage
                merchantOrderNo={merchantOrderNo}
                pointName={settings.pointName}
                initialStatus={status}
              />
            </AddonSurfaceRenderer>
            <AddonSlotRenderer slot="topup.result.panel.after" />
          </>
        </AddonSurfaceRenderer>
        <AddonSlotRenderer slot="topup.result.page.after" />
      </main>
    </div>
  )
}
