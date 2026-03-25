import Link from "next/link"


import { getSiteSettings } from "@/lib/site-settings"

export async function SiteFooter() {
  const settings = await getSiteSettings()

  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-[1200px] px-4 py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-semibold text-foreground">{settings.siteName}</div>
            <div className="mt-1 text-sm text-muted-foreground">{settings.siteSlogan}</div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {settings.footerLinks.map((item) => (
              <Link key={`${item.label}-${item.href}`} href={item.href} className="transition-colors hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </div>

        </div>
        <div className="mt-6 border-t pt-6 text-center text-xs text-muted-foreground md:text-left">{settings.siteName} © 2026</div>
        <div id="site-analytics-hook" data-hook="site-analytics" className="sr-only" aria-hidden="true" />
        {settings.analyticsCode ? settings.analyticsCode : null}
      </div>
    </footer>
  )
}
