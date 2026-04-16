import Image from "next/image"
import Link from "next/link"
import { Suspense } from "react"

import { HeaderUserActions } from "@/components/header-user-actions"
import { MobileHeaderQuickActions } from "@/components/mobile-header-quick-actions"
import { ThemeToggle } from "@/components/theme-toggle"
import { getCurrentUser } from "@/lib/auth"
import { getBoards } from "@/lib/boards"
import { Button } from "@/components/ui/rbutton"
import { SearchForm } from "@/components/search-form"
import { resolveSiteIconPath } from "@/lib/site-branding"
import { getSiteSettings } from "@/lib/site-settings"
import { resolveUserSurfaceSnapshot } from "@/lib/user-surface"
import { getZones } from "@/lib/zones"
import { AddonSlotRenderer } from "@/addons-host"

function SiteLogoMark({ logoPath, iconPath }: { logoPath?: string | null; iconPath?: string | null }) {
  if (logoPath) {
    return (
      <div className="relative h-8 w-8 overflow-hidden rounded-md border border-border bg-background">
        <Image src={logoPath} alt="站点 Logo" fill sizes="32px" unoptimized className="object-contain p-1" />
      </div>
    )
  }

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-md">
      <Image src={resolveSiteIconPath(iconPath)} alt="" width={16} height={16} className="h-8 w-8" />
    </div>
  )
}

export async function SiteHeader() {
  const [user, settings, zones, boards] = await Promise.all([getCurrentUser(), getSiteSettings(), getZones(), getBoards()])
  const surfaceSnapshot = await resolveUserSurfaceSnapshot(user)
  const checkedInToday = surfaceSnapshot?.checkedInToday ?? false
  const headerUser = user
    ? {
        username: user.username,
        nickname: user.nickname,
        avatarPath: user.avatarPath,
        vipLevel: (user as { vipLevel?: number }).vipLevel,
        vipExpiresAt: (user as { vipExpiresAt?: Date | string | null }).vipExpiresAt?.toString?.() ?? null,
      }
    : null

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/80 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
      <div className="mx-auto max-w-[1200px] px-1">
        <div className="grid h-14 grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="-mr-6 hidden h-14 items-center lg:col-span-2 lg:flex">
            <AddonSlotRenderer slot="layout.header.left" />
            <Link href="/" className="flex items-center gap-2 text-xl leading-none">
              <SiteLogoMark logoPath={settings.siteLogoPath} iconPath={settings.siteIconPath} />
              <div className="hidden font-bold tracking-tight sm:inline-block">{settings.siteLogoText}</div>
            </Link>
          </div>

          <div className="flex h-14 items-center justify-between gap-3 lg:col-span-10">
            <div className="flex items-center gap-2 lg:hidden">
              <Link href="/" className="flex items-center gap-2 text-base font-bold leading-none">
                <SiteLogoMark logoPath={settings.siteLogoPath} iconPath={settings.siteIconPath} />
                <span className="sr-only">{settings.siteLogoText}</span>
              </Link>
              <MobileHeaderQuickActions
                isLoggedIn={Boolean(user)}
                checkInEnabled={settings.checkInEnabled}
                checkedInToday={checkedInToday}
                appLinks={settings.headerAppLinks}
                search={settings.search}
                zones={zones}
                boards={boards}
              />
            </div>

            <div className="hidden flex-1 md:block">
              <div className="ml-4 max-w-md">
                <Suspense fallback={<div className="h-9 w-full rounded-full border border-border bg-muted/50" aria-hidden="true" />}>
                  <SearchForm compact appLinks={settings.headerAppLinks} appIconName={settings.headerAppIconName} search={settings.search} />
                </Suspense>
              </div>
              <AddonSlotRenderer slot="layout.header.center" />

            </div>

            <div className="ml-auto flex h-14 items-center gap-1.5">
              <AddonSlotRenderer slot="layout.header.right" />
              <ThemeToggle />
              {user && (user.role === "ADMIN" || user.role === "MODERATOR") ? (
                <Link href="/admin" className="hidden sm:inline-flex">
                  <Button variant="ghost" className="h-8 rounded-md px-3">后台</Button>
                </Link>
              ) : null}
              <HeaderUserActions user={headerUser} />

            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
