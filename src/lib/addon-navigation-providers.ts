import "server-only"

import type {
  ResolvedAddonFooterLink,
  ResolvedAddonHeaderAppLink,
  AddonNavigationLink,
  AddonNavigationPlacement,
  AddonNavigationProviderRuntimeHooks,
} from "@/addons-host/navigation-types"
import type { FooterLinkItem } from "@/lib/shared/config-parsers"
import type { SiteHeaderAppLinkItem } from "@/lib/site-header-app-links"
import {
  isRecord,
  normalizeOptionalString,
  normalizeProviderOrder,
} from "@/lib/addon-provider-helpers"
import {
  invokeAddonProviderRuntime,
  listAddonProviderRuntimeItems,
} from "@/lib/addon-provider-registry"

interface ResolvedAddonNavigationLinkBase {
  addonId: string
  order: number
  providerCode: string
}

interface ResolvedAddonHeaderAppLinkEntry extends ResolvedAddonNavigationLinkBase {
  item: SiteHeaderAppLinkItem
}

interface ResolvedAddonFooterLinkEntry extends ResolvedAddonNavigationLinkBase {
  item: FooterLinkItem
}

function normalizeNavigationPlacement(value: unknown) {
  const normalizedValue = normalizeOptionalString(value).toLowerCase()

  return normalizedValue === "header-app" || normalizedValue === "footer"
    ? normalizedValue as AddonNavigationPlacement
    : null
}

function normalizeNavigationLink(
  value: unknown,
  input: {
    addonId: string
    fallbackOrder: number
    index: number
    providerCode: string
  },
) {
  if (!isRecord(value)) {
    return null
  }

  const placement = normalizeNavigationPlacement(value.placement)
  const href = normalizeOptionalString(value.href)
  const name = normalizeOptionalString(value.name)
  const label = normalizeOptionalString(value.label) || name
  const icon = normalizeOptionalString(value.icon) || "⭐"
  const order = typeof value.order === "number" && Number.isFinite(value.order)
    ? normalizeProviderOrder(value.order)
    : input.fallbackOrder

  if (!placement || !href) {
    return null
  }

  if (placement === "header-app") {
    if (!label) {
      return null
    }

    return {
      addonId: input.addonId,
      order,
      providerCode: input.providerCode,
      item: {
        id: normalizeOptionalString(value.id)
          || `${input.addonId}:${input.providerCode}:header-app:${input.index + 1}`,
        name: label,
        href,
        icon,
      },
      placement,
    } satisfies ResolvedAddonHeaderAppLinkEntry & {
      placement: "header-app"
    }
  }

  if (!label) {
    return null
  }

  return {
    addonId: input.addonId,
    order,
    providerCode: input.providerCode,
    item: {
      label,
      href,
    },
    placement,
  } satisfies ResolvedAddonFooterLinkEntry & {
    placement: "footer"
  }
}

async function collectAddonNavigationLinks() {
  const providers = await listAddonProviderRuntimeItems<AddonNavigationProviderRuntimeHooks>("navigation")
  const headerAppLinks: Array<ResolvedAddonHeaderAppLinkEntry> = []
  const footerLinks: Array<ResolvedAddonFooterLinkEntry> = []

  for (const item of providers) {
    const data = isRecord(item.provider.data) ? item.provider.data : null
    const staticLinks = Array.isArray(data?.links) ? data.links : []
    let runtimeLinks: AddonNavigationLink[] | null | undefined = null

    try {
      runtimeLinks = await invokeAddonProviderRuntime(
        item,
        "listLinks",
        () => ({
          addon: item.addon,
          provider: item.provider,
          context: item.context,
        }),
      ) as AddonNavigationLink[] | null
    } catch (error) {
      console.error(
        "[addon-navigation-providers] failed to list addon navigation links",
        item.provider.code,
        error,
      )
    }
    const allLinks = [
      ...staticLinks,
      ...(Array.isArray(runtimeLinks) ? runtimeLinks : []),
    ]

    for (const [index, candidate] of allLinks.entries()) {
      const normalized = normalizeNavigationLink(candidate, {
        addonId: item.addon.manifest.id,
        fallbackOrder: item.order,
        index,
        providerCode: item.provider.code,
      })

      if (!normalized) {
        continue
      }

      if (normalized.placement === "header-app") {
        headerAppLinks.push(normalized)
      } else {
        footerLinks.push(normalized)
      }
    }
  }

  const compareEntries = <
    TEntry extends ResolvedAddonNavigationLinkBase & {
      item: { href: string }
    },
  >(
    left: TEntry,
    right: TEntry,
  ) => {
    if (left.order !== right.order) {
      return left.order - right.order
    }

    const byHref = left.item.href.localeCompare(right.item.href, "zh-CN")
    if (byHref !== 0) {
      return byHref
    }

    return `${left.addonId}:${left.providerCode}`.localeCompare(
      `${right.addonId}:${right.providerCode}`,
      "zh-CN",
    )
  }

  return {
    headerAppLinks: headerAppLinks.sort(compareEntries),
    footerLinks: footerLinks.sort(compareEntries),
  }
}

export async function mergeAddonNavigationLinks(input: {
  footerLinks: FooterLinkItem[]
  headerAppLinks: SiteHeaderAppLinkItem[]
}) {
  const { headerAppLinks, footerLinks } = await collectAddonNavigationLinks()

  return {
    headerAppLinks: [
      ...input.headerAppLinks,
      ...headerAppLinks.map((item) => ({
        id: item.item.id,
        name: item.item.name,
        href: item.item.href,
        icon: item.item.icon,
      })),
    ],
    footerLinks: [
      ...input.footerLinks,
      ...footerLinks.map((item) => ({
        label: item.item.label,
        href: item.item.href,
      })),
    ],
  }
}

export async function listAddonHeaderAppLinks(): Promise<ResolvedAddonHeaderAppLink[]> {
  const { headerAppLinks } = await collectAddonNavigationLinks()

  return headerAppLinks.map((item) => ({
    ...item.item,
    addonId: item.addonId,
    order: item.order,
    providerCode: item.providerCode,
  }))
}

export async function listAddonFooterLinks(): Promise<ResolvedAddonFooterLink[]> {
  const { footerLinks } = await collectAddonNavigationLinks()

  return footerLinks.map((item) => ({
    ...item.item,
    addonId: item.addonId,
    order: item.order,
    providerCode: item.providerCode,
  }))
}

export async function mergeHeaderAppLinks(baseLinks: SiteHeaderAppLinkItem[]) {
  return (await mergeAddonNavigationLinks({
    footerLinks: [],
    headerAppLinks: baseLinks,
  })).headerAppLinks
}

export async function mergeFooterLinks(baseLinks: FooterLinkItem[]) {
  return (await mergeAddonNavigationLinks({
    footerLinks: baseLinks,
    headerAppLinks: [],
  })).footerLinks
}
