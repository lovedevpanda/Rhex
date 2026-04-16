import Link from "next/link"
import { Github } from "lucide-react"

import packageJson from "../../package.json"

import { getSiteSettings } from "@/lib/site-settings"
import ShinyText from '@/components/ShinyText';
import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host";

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href)
}



export async function SiteFooter() {
  const settings = await getSiteSettings()
  const fallbackCopyrightText = `${settings.siteName} @ ${new Date().getFullYear()}`
  const footerCopyrightText = settings?.footerCopyrightText?.trim() || fallbackCopyrightText
  const footerBrandingVisible = settings.footerBrandingVisible === undefined || settings.footerBrandingVisible?true:false

  return (
    <footer className="bg-muted/20">
      <div className="mx-auto max-w-[1200px] px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pb-8 lg:px-1">
        <AddonSlotRenderer slot="layout.footer.before" />
        <AddonSurfaceRenderer surface="layout.footer" props={{ footerBrandingVisible, footerCopyrightText, settings }}>
        <div className="rounded-[24px] bg-background px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-lg">
              <div className="flex items-center gap-3">
                <div className="min-w-0">
                   <div className="text-base font-semibold tracking-tight text-foreground sm:text-lg"> <ShinyText
  text={"✨ "+settings.siteName}
  speed={2}
  delay={0}
  color="#b5b5b5"
  shineColor="#ffffff"
  spread={120}
  direction="left"
  yoyo={false}
  pauseOnHover={false}
  disabled={false}
/></div>
                  <p className="mt-1 text-sm text-muted-foreground">
                  
{settings.siteSlogan}
                    </p>
                </div>
              </div>
            </div>

            <div className="w-full md:max-w-md">
              <div className="grid grid-cols-3 gap-3 sm:flex sm:flex-wrap sm:justify-end">
                {settings.footerLinks.map((item) => {
                  const isExternal = isExternalHref(item.href)

                  return (
                    <Link
                      key={`${item.label}-${item.href}`}
                      href={item.href}
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noreferrer noopener" : undefined}
                      className="rounded-[14px] px-3 py-2 text-center text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 pt-2 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground sm:justify-start">
              <span>{footerCopyrightText}</span>
              {footerBrandingVisible ? (
                <>
                  <span className="hidden sm:inline">·</span>
                  <span>Powered by <Link
                  href="https://rhex.im/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >Rhex {packageJson.version}</Link></span>
                </>
              ) : null}
            </div>
            {footerBrandingVisible ? (
              <div className="flex items-center justify-center gap-2 sm:justify-end">
  
                <Link
                  href="https://github.com/lovedevpanda/Rhex"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Rhex GitHub"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Github className="h-4 w-4" />
                </Link>
                <Link
                  href="https://gitee.com/rhex/Rhex"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Rhex Gitee"
                  className="inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <svg className="h-4 w-4" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4761" width="200" height="200"><path d="M512 512m-494.933333 0a494.933333 494.933333 0 1 0 989.866666 0 494.933333 494.933333 0 1 0-989.866666 0Z" fill="#C71D23" p-id="4762"></path><path d="M762.538667 457.045333h-281.088a24.4736 24.4736 0 0 0-24.439467 24.405334v61.098666c-0.034133 13.5168 10.922667 24.439467 24.405333 24.439467h171.1104c13.5168 0 24.439467 10.922667 24.439467 24.439467v12.219733a73.3184 73.3184 0 0 1-73.3184 73.3184h-232.209067a24.439467 24.439467 0 0 1-24.439466-24.439467v-232.174933a73.3184 73.3184 0 0 1 73.3184-73.3184h342.152533c13.482667 0 24.405333-10.922667 24.439467-24.439467l0.034133-61.098666a24.405333 24.405333 0 0 0-24.405333-24.439467H420.352a183.296 183.296 0 0 0-183.296 183.296V762.538667c0 13.482667 10.922667 24.439467 24.405333 24.439466h360.516267a164.9664 164.9664 0 0 0 165.000533-165.000533v-140.526933a24.439467 24.439467 0 0 0-24.439466-24.439467z" fill="#FFFFFF" p-id="4763"></path></svg>
                </Link>
              </div>
            ) : null}
          </div>
        </div>
        </AddonSurfaceRenderer>
        <AddonSlotRenderer slot="layout.footer.after" />
        <div id="site-analytics-hook" data-hook="site-analytics" />
        {settings.analyticsCode ? <div dangerouslySetInnerHTML={{ __html: settings.analyticsCode }} /> : null}
      </div>
    </footer>
  )
}
