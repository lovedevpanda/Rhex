import type { Metadata } from "next"

import { BackToTopButton } from "@/components/back-to-top-button"
import { SiteFooter } from "@/components/site-footer"
import { ToastProvider } from "@/components/ui/toast"
import { getSiteSettings } from "@/lib/site-settings"
import { getThemeInitScript } from "@/lib/theme"



import "./globals.css"

const themeInitScript = getThemeInitScript()

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `${settings.siteName} - ${settings.siteSlogan}`,
    description: settings.siteDescription,
    keywords: settings.siteSeoKeywords,
  }
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ToastProvider>
          {children}
          <SiteFooter />
          <BackToTopButton />
        </ToastProvider>

      </body>

    </html>
  )
}
