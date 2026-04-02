import Link from "next/link"
import { Github } from "lucide-react"

import packageJson from "../../package.json"

import { getSiteSettings } from "@/lib/site-settings"

export async function SiteFooter() {
  const settings = await getSiteSettings()

  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-[1200px] px-1 py-8">
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
        <div className="mt-6 border-t pt-6 text-center text-xs text-muted-foreground md:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
            <span>{settings.siteName} © 2026</span>
            <span>·</span>
            <Link href="https://rhex.im/" target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">
              POWERED BY Rhex {packageJson.version}
            </Link>
            <Link href="https://github.com/lovedevpanda/Rhex" target="_blank" rel="noreferrer" aria-label="Rhex GitHub" className="inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-accent hover:text-foreground">
              <Github className="h-4 w-4" />
            </Link>
            <Link href="https://gitee.com/rhex/Rhex" target="_blank" rel="noreferrer" aria-label="Rhex Gitee" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors hover:bg-accent hover:text-foreground">
              <svg className="h-4 w-4" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4761" width="200" height="200"><path d="M512 512m-494.933333 0a494.933333 494.933333 0 1 0 989.866666 0 494.933333 494.933333 0 1 0-989.866666 0Z" fill="#C71D23" p-id="4762"></path><path d="M762.538667 457.045333h-281.088a24.4736 24.4736 0 0 0-24.439467 24.405334v61.098666c-0.034133 13.5168 10.922667 24.439467 24.405333 24.439467h171.1104c13.5168 0 24.439467 10.922667 24.439467 24.439467v12.219733a73.3184 73.3184 0 0 1-73.3184 73.3184h-232.209067a24.439467 24.439467 0 0 1-24.439466-24.439467v-232.174933a73.3184 73.3184 0 0 1 73.3184-73.3184h342.152533c13.482667 0 24.405333-10.922667 24.439467-24.439467l0.034133-61.098666a24.405333 24.405333 0 0 0-24.405333-24.439467H420.352a183.296 183.296 0 0 0-183.296 183.296V762.538667c0 13.482667 10.922667 24.439467 24.405333 24.439466h360.516267a164.9664 164.9664 0 0 0 165.000533-165.000533v-140.526933a24.439467 24.439467 0 0 0-24.439466-24.439467z" fill="#FFFFFF" p-id="4763"></path></svg>
            </Link>
          </div>
        </div>
        <div id="site-analytics-hook" data-hook="site-analytics" />
        {settings.analyticsCode ? <div dangerouslySetInnerHTML={{ __html: settings.analyticsCode }} /> : null}
      </div>
    </footer>
  )
}
