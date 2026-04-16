import type {
  AddonExecutionContextBase,
  AddonMaybePromise,
  AddonProviderRegistration,
  LoadedAddonRuntime,
} from "@/addons-host/types"
import type { SiteHeaderAppLinkItem } from "@/lib/site-header-app-links"
import type { FooterLinkItem } from "@/lib/shared/config-parsers"

export const ADDON_NAVIGATION_PLACEMENTS = [
  "header-app",
  "footer",
] as const

export type AddonNavigationPlacement =
  (typeof ADDON_NAVIGATION_PLACEMENTS)[number]

export interface AddonNavigationLink {
  placement: AddonNavigationPlacement
  id?: string
  name?: string
  label?: string
  href: string
  icon?: string
  order?: number
}

interface AddonNavigationProviderRuntimeBaseInput {
  addon: LoadedAddonRuntime
  provider: AddonProviderRegistration
  context: AddonExecutionContextBase
}

export interface AddonNavigationProviderRuntimeHooks {
  listLinks?: (
    input: AddonNavigationProviderRuntimeBaseInput,
  ) => AddonMaybePromise<AddonNavigationLink[] | null | undefined>
}

export interface ResolvedAddonHeaderAppLink extends SiteHeaderAppLinkItem {
  addonId: string
  order: number
  providerCode: string
}

export interface ResolvedAddonFooterLink extends FooterLinkItem {
  addonId: string
  order: number
  providerCode: string
}
