import type { Metadata } from "next"

import { BackToTopButton } from "@/components/back-to-top-button"
import { SiteFooter } from "@/components/site-footer"
import { SiteSettingsProvider } from "@/components/site-settings-provider"
import { ToastProvider } from "@/components/ui/toast"

import { getRssFeedUrl } from "@/lib/rss"

import { resolveSiteOrigin } from "@/lib/site-origin"
import { getSiteSettings } from "@/lib/site-settings"
import { getThemeInitScript } from "@/lib/theme"





import "./globals.css"

const themeInitScript = getThemeInitScript()

export async function generateMetadata(): Promise<Metadata> {
  const [settings, rssUrl, siteOrigin] = await Promise.all([getSiteSettings(), getRssFeedUrl(), Promise.resolve(resolveSiteOrigin())])

  return {
    metadataBase: new URL(siteOrigin),
    title: `${settings.siteName} - ${settings.siteSlogan}`,
    description: settings.siteDescription,
    keywords: settings.siteSeoKeywords,
    alternates: {
      types: {
        "application/rss+xml": rssUrl,
      },
    },
  }
}



export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSiteSettings()

  return (

    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <SiteSettingsProvider markdownEmojiMap={settings.markdownEmojiMap}>
          <ToastProvider>
            {children}
            <SiteFooter />
            <BackToTopButton />
          </ToastProvider>
        </SiteSettingsProvider>



      </body>

    </html>
  )
}
