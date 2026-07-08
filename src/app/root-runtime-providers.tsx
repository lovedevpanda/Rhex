import type { Metadata } from "next"
import { Suspense, type CSSProperties } from "react"

import { RhexGlobalSdkBootstrap } from "@/addons-host/client/rhex-global-sdk"
import { AddonRuntimeProvider } from "@/addons-host/client/addon-runtime-provider"
import { GlobalLayoutAddonSlotsBoundary } from "@/addons-host/runtime/global-layout-addon-slots-boundary"
import { BackToTopButton } from "@/components/back-to-top-button"
import { ConditionalSiteFooter } from "@/components/conditional-site-footer"
import { CurrentUserInboxProvider, CurrentUserProvider } from "@/components/current-user-provider"
import { DeferredToaster } from "@/components/deferred-toaster"
import { GlobalNavigationProgress } from "@/components/global-navigation-progress"
import { NavigationStaleRefresh } from "@/components/navigation-stale-refresh"
import { RootBootstrap } from "@/components/root-bootstrap"
import { SiteFooter } from "@/components/site-footer"
import { SiteSettingsProvider } from "@/components/site-settings-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  listAddonEditorProviderDescriptors,
  listAddonEditorToolbarItemDescriptors,
} from "@/lib/addon-editor-providers"
import { listAddonSurfaceOverrideDescriptors } from "@/lib/addon-surface-overrides"
import { getPublishedCustomPageFooterHiddenPaths } from "@/lib/custom-pages"
import { hasDatabaseUrl } from "@/lib/db-status"
import { DEFAULT_SITE_ICON_PATH, resolveSiteIconPath } from "@/lib/site-branding"
import { defaultSiteSettingsCreateInput } from "@/lib/site-settings-defaults"
import { getConfiguredSiteOrigin } from "@/lib/site-origin"
import { getSiteSettings } from "@/lib/site-settings"
import { buildVipNameColorStyleVariables } from "@/lib/vip-name-colors"

function serializeCssVariables(style: CSSProperties) {
  const declarations = Object.entries(style)
    .filter((entry): entry is [string, string | number] => {
      const [, value] = entry
      return typeof value === "string" || typeof value === "number"
    })
    .map(([key, value]) => `${key}:${String(value)};`)
    .join("")

  return declarations ? `:root{${declarations}}` : ""
}

function buildMetadataFromSettings(settings: {
  siteDescription: string
  siteIconPath?: string | null
  siteName: string
  siteSeoKeywords: string | string[]
  siteSlogan: string
}): Metadata {
  const rssUrl = "/rss.xml"
  const configuredSiteOrigin = getConfiguredSiteOrigin()
  const resolvedSiteIconPath = resolveSiteIconPath(settings.siteIconPath ?? DEFAULT_SITE_ICON_PATH)
  const supportsAppleIcon = !/\.svg(?:$|[?#])/i.test(resolvedSiteIconPath)

  return {
    ...(configuredSiteOrigin ? { metadataBase: new URL(configuredSiteOrigin) } : {}),
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

export async function generateRootMetadata(): Promise<Metadata> {
  if (!hasDatabaseUrl()) {
    return buildMetadataFromSettings({
      siteDescription: defaultSiteSettingsCreateInput.siteDescription,
      siteIconPath: DEFAULT_SITE_ICON_PATH,
      siteName: defaultSiteSettingsCreateInput.siteName,
      siteSeoKeywords: defaultSiteSettingsCreateInput.siteSeoKeywords,
      siteSlogan: defaultSiteSettingsCreateInput.siteSlogan,
    })
  }

  return buildMetadataFromSettings(await getSiteSettings())
}

export async function RootRuntimeProviders({ children }: { children: React.ReactNode }) {
  const [settings, editorProviders, editorToolbarItems, addonSurfaceOverrides, footerHiddenPaths] = await Promise.all([
    getSiteSettings(),
    listAddonEditorProviderDescriptors(),
    listAddonEditorToolbarItemDescriptors(),
    listAddonSurfaceOverrideDescriptors(),
    getPublishedCustomPageFooterHiddenPaths(),
  ])
  const vipNameColorCss = serializeCssVariables(buildVipNameColorStyleVariables(settings.vipNameColors) as CSSProperties)
  const rhexSession = {
    isAuthenticated: false,
    user: null,
  }
  const rhexSite = settings

  return (
    <>
      {vipNameColorCss ? <style dangerouslySetInnerHTML={{ __html: vipNameColorCss }} /> : null}
      <RhexGlobalSdkBootstrap session={rhexSession} site={rhexSite} />
      <RootBootstrap />
      <NavigationStaleRefresh />
      <Suspense fallback={null}>
        <GlobalLayoutAddonSlotsBoundary />
      </Suspense>
      <ThemeProvider settings={settings.theme}>
        <CurrentUserProvider>
          <CurrentUserInboxProvider
            messageEnabled={settings.messageEnabled}
            messagePromptAudioPath={settings.messagePromptAudioPath}
            messageRealtimeEnabled={settings.messageRealtimeEnabled}
            messageRealtimeHeartbeatSeconds={settings.messageRealtimeHeartbeatSeconds}
          >
            <SiteSettingsProvider
              markdownEmojiMap={settings.markdownEmojiMap}
              markdownImageUploadEnabled={settings.markdownImageUploadEnabled}
              leftSidebarDisplayMode={settings.leftSidebarDisplayMode}
              leftSidebarNavigationMode={settings.leftSidebarNavigationMode}
              leftSidebarHome={settings.leftSidebarHome}
              vipLevelIcons={settings.vipLevelIcons}
              editorToolbar={settings.editorToolbar}
            >
              <AddonRuntimeProvider editorProviders={editorProviders} editorToolbarItems={editorToolbarItems} surfaceOverrides={addonSurfaceOverrides}>
                <TooltipProvider>
                  <Suspense fallback={null}>
                    <GlobalNavigationProgress />
                  </Suspense>
                  {children}
                  <ConditionalSiteFooter hiddenPaths={footerHiddenPaths}>
                    <>
                      <SiteFooter />
                    </>
                  </ConditionalSiteFooter>
                  <BackToTopButton />
                  <DeferredToaster />
                </TooltipProvider>
              </AddonRuntimeProvider>
            </SiteSettingsProvider>
          </CurrentUserInboxProvider>
        </CurrentUserProvider>
      </ThemeProvider>
    </>
  )
}
