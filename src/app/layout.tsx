import type { Metadata } from "next"
import Script from "next/script"
import { cookies } from "next/headers"
import { Suspense, type CSSProperties } from "react"

import { BackToTopButton } from "@/components/back-to-top-button"
import { ConditionalSiteFooter } from "@/components/conditional-site-footer"
import { GlobalNavigationProgress } from "@/components/global-navigation-progress"
import { InboxRealtimeProvider } from "@/components/inbox-realtime-provider"
import { SiteFooter } from "@/components/site-footer"
import { SiteSettingsProvider } from "@/components/site-settings-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { ConfirmProvider } from "@/components/ui/alert-dialog"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AddonRuntimeProvider } from "@/addons-host/client/addon-runtime-provider"
import { RhexGlobalSdkBootstrap } from "@/addons-host/client/rhex-global-sdk"
import { getCurrentUser } from "@/lib/auth"
import {
  listAddonEditorProviderDescriptors,
  listAddonEditorToolbarItemDescriptors,
} from "@/lib/addon-editor-providers"
import { listAddonSurfaceOverrideDescriptors } from "@/lib/addon-surface-overrides"


import { getRssFeedUrl } from "@/lib/rss"

import { getReadingHistoryInitScript } from "@/lib/local-reading-history"
import { resolveSiteIconPath } from "@/lib/site-branding"
import { resolveSiteOrigin } from "@/lib/site-origin"
import { getSidebarNavigationDisplayModeAttribute, getSidebarNavigationInitScript } from "@/lib/sidebar-navigation-preference"
import { getSiteSettings } from "@/lib/site-settings"
import { getThemeInitScript, resolveThemeDocumentPropsFromCookieString } from "@/lib/theme"
import { resolveUserSurfaceSnapshot } from "@/lib/user-surface"
import { buildVipNameColorStyleVariables } from "@/lib/vip-name-colors"
import { AddonRenderBlock, executeAddonSlot } from "@/addons-host"





import "./globals.css"
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const sidebarNavigationInitScript = getSidebarNavigationInitScript()
const readingHistoryInitScript = getReadingHistoryInitScript()
const themeInitScript = getThemeInitScript()
const noScriptRootInitStyles = `
  html[data-root-init="pending"] {
    overflow: auto;
  }

  html[data-root-init="pending"] body {
    visibility: visible;
    overflow: visible;
  }

  html[data-root-init="pending"]::before,
  html[data-root-init="pending"]::after {
    display: none;
  }
`
const rootInitScript = `
  (function () {
    try {
      ${themeInitScript}
      ${sidebarNavigationInitScript}
      ${readingHistoryInitScript}
    } finally {
      try {
        document.documentElement.setAttribute("data-root-init", "ready");
      } catch (_error) {
        // Ignore root init cleanup failures.
      }
    }
  })();
`

export async function generateMetadata(): Promise<Metadata> {
  const [settings, rssUrl, siteOrigin] = await Promise.all([getSiteSettings(), getRssFeedUrl(), resolveSiteOrigin()])
  const resolvedSiteIconPath = resolveSiteIconPath(settings.siteIconPath)
  const supportsAppleIcon = !/\.svg(?:$|[?#])/i.test(resolvedSiteIconPath)

  return {
    metadataBase: new URL(siteOrigin),
    title: `${settings.siteName} - ${settings.siteSlogan}`,
    description: settings.siteDescription,
    keywords: settings.siteSeoKeywords,
    icons: supportsAppleIcon
      ? {
          icon: resolvedSiteIconPath,
          shortcut: resolvedSiteIconPath,
          apple: resolvedSiteIconPath,
        }
      : {
          icon: resolvedSiteIconPath,
          shortcut: resolvedSiteIconPath,
        },
    alternates: {
      types: {
        "application/rss+xml": rssUrl,
      },
    },
  }
}



export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const currentUserPromise = getCurrentUser()
  const cookieStorePromise = cookies()
  const [settings, currentUser, surfaceSnapshot, editorProviders, editorToolbarItems, addonSurfaceOverrides, headBeforeBlocks, headAfterBlocks, bodyStartBlocks, bodyEndBlocks, cookieStore] = await Promise.all([
    getSiteSettings(),
    currentUserPromise,
    currentUserPromise.then((user) => resolveUserSurfaceSnapshot(user)),
    listAddonEditorProviderDescriptors(),
    listAddonEditorToolbarItemDescriptors(),
    listAddonSurfaceOverrideDescriptors(),
    executeAddonSlot("layout.head.before"),
    executeAddonSlot("layout.head.after"),
    executeAddonSlot("layout.body.start"),
    executeAddonSlot("layout.body.end"),
    cookieStorePromise,
  ])
  const vipNameColorStyle = buildVipNameColorStyleVariables(settings.vipNameColors) as CSSProperties
  const sidebarDisplayMode = getSidebarNavigationDisplayModeAttribute(settings.leftSidebarDisplayMode)
  const themeDocument = resolveThemeDocumentPropsFromCookieString(cookieStore.toString())
  const rhexSession = currentUser
    ? {
        isAuthenticated: true,
        user: {
          id: currentUser.id,
          username: currentUser.username,
          nickname: currentUser.nickname,
          avatarPath: currentUser.avatarPath,
          role: currentUser.role,
          status: currentUser.status,
          level: currentUser.level,
          points: currentUser.points,
          vipLevel: currentUser.vipLevel,
          vipExpiresAt: currentUser.vipExpiresAt?.toString?.() ?? null,
        },
      }
    : {
        isAuthenticated: false,
        user: null,
      }
  const rhexSite = {
    siteName: settings.siteName,
    pointName: settings.pointName,
    leftSidebarDisplayMode: settings.leftSidebarDisplayMode,
    markdownImageUploadEnabled: settings.markdownImageUploadEnabled,
  }

  return (

    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={cn("font-sans", geist.variable, themeDocument.rootClassName)}
      style={themeDocument.rootStyle as CSSProperties}
      data-root-init={themeDocument.requiresBootGuard ? "pending" : "ready"}
      data-sidebar-display-mode={sidebarDisplayMode}
      data-theme-preset={themeDocument.dataThemePreset}
      data-font-size-preset={themeDocument.dataFontSizePreset}
    >
      <head>
        {headBeforeBlocks.map((block) => (
          <AddonRenderBlock
            key={`${block.addon.manifest.id}:${block.key}:head-before`}
            addonId={block.addon.manifest.id}
            blockKey={`${block.addon.manifest.id}:${block.key}:head-before`}
            result={block.result}
          />
        ))}
        <Script id="site-root-init" strategy="beforeInteractive">
          {rootInitScript}
        </Script>
        <noscript>
          <style>{noScriptRootInitStyles}</style>
        </noscript>
        {headAfterBlocks.map((block) => (
          <AddonRenderBlock
            key={`${block.addon.manifest.id}:${block.key}:head-after`}
            addonId={block.addon.manifest.id}
            blockKey={`${block.addon.manifest.id}:${block.key}:head-after`}
            result={block.result}
          />
        ))}
      </head>
      <body style={vipNameColorStyle}>
        <RhexGlobalSdkBootstrap session={rhexSession} site={rhexSite} />
        {bodyStartBlocks.map((block) => (
          <AddonRenderBlock
            key={`${block.addon.manifest.id}:${block.key}:body-start`}
            addonId={block.addon.manifest.id}
            blockKey={`${block.addon.manifest.id}:${block.key}:body-start`}
            result={block.result}
          />
        ))}
        <ThemeProvider>
          <InboxRealtimeProvider
            key={currentUser?.id ?? "guest"}
            currentUserId={currentUser?.id ?? null}
            initialUnreadMessageCount={surfaceSnapshot?.unreadMessageCount ?? 0}
            initialUnreadNotificationCount={surfaceSnapshot?.unreadNotificationCount ?? 0}
          >
            <SiteSettingsProvider
              markdownEmojiMap={settings.markdownEmojiMap}
              markdownImageUploadEnabled={settings.markdownImageUploadEnabled}
              leftSidebarDisplayMode={settings.leftSidebarDisplayMode}
              vipLevelIcons={settings.vipLevelIcons}
            >
              <AddonRuntimeProvider editorProviders={editorProviders} editorToolbarItems={editorToolbarItems} surfaceOverrides={addonSurfaceOverrides}>
                <TooltipProvider>
                  <Suspense fallback={null}>
                    <GlobalNavigationProgress />
                  </Suspense>
                  <ConfirmProvider>
                    {children}
                    <ConditionalSiteFooter>
                      <>
                        <SiteFooter />
                        {bodyEndBlocks.map((block) => (
                          <AddonRenderBlock
                            key={`${block.addon.manifest.id}:${block.key}:body-end`}
                            addonId={block.addon.manifest.id}
                            blockKey={`${block.addon.manifest.id}:${block.key}:body-end`}
                            result={block.result}
                          />
                        ))}
                      </>
                    </ConditionalSiteFooter>
                    <BackToTopButton />
                  </ConfirmProvider>
                  <Toaster richColors position="top-right" />
                </TooltipProvider>
              </AddonRuntimeProvider>
            </SiteSettingsProvider>
          </InboxRealtimeProvider>
        </ThemeProvider>




      </body>

    </html>
  )
}
