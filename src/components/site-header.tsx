import Image from "next/image"
import Link from "next/link"
import { Bell, Sparkles } from "lucide-react"

import { HeaderUserActions } from "@/components/header-user-actions"
import { MobileHeaderQuickActions } from "@/components/mobile-header-quick-actions"
import { ThemeToggle } from "@/components/theme-toggle"
import { getCurrentUser } from "@/lib/auth"
import { getHeaderQuickActionsState, getHeaderUnreadCounts } from "@/lib/header"
import { Button } from "@/components/ui/button"
import { SearchForm } from "@/components/search-form"
import { getSiteSettings } from "@/lib/site-settings"

function SiteLogoMark({ logoPath }: { logoPath?: string | null }) {
  if (logoPath) {
    return (
      <div className="relative h-8 w-8 overflow-hidden rounded-md border border-border bg-background">
        <Image src={logoPath} alt="站点 Logo" fill sizes="32px" unoptimized className="object-contain p-1" />
      </div>
    )
  }

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background">
      <Sparkles className="h-4 w-4" />
    </div>
  )
}

export async function SiteHeader() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSiteSettings()])
  const [{ unreadNotificationCount, unreadMessageCount }, { checkedInToday }] = await Promise.all([
    getHeaderUnreadCounts(user?.id),
    getHeaderQuickActionsState(user?.id),
  ])
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
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-[1200px] px-4">
        <div className="grid h-14 grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="-mr-6 hidden h-14 items-center lg:col-span-2 lg:flex">
            <Link href="/" className="flex items-center gap-2 text-xl leading-none">
              <SiteLogoMark logoPath={settings.siteLogoPath} />
              <div className="hidden font-bold tracking-tight sm:inline-block">{settings.siteLogoText}</div>
            </Link>
          </div>

          <div className="flex h-14 items-center justify-between gap-3 lg:col-span-10">
            <Link href="/" className="flex items-center gap-2 text-base font-bold leading-none lg:hidden">
              <SiteLogoMark logoPath={settings.siteLogoPath} />
              <span>{settings.siteLogoText}</span>
            </Link>

            <div className="hidden flex-1 md:block">
              <div className="ml-4 max-w-md">
                <SearchForm compact />
              </div>
            </div>

            <div className="ml-auto flex h-14 items-center gap-1.5">
              <MobileHeaderQuickActions isLoggedIn={Boolean(user)} checkInEnabled={settings.checkInEnabled} checkedInToday={checkedInToday} />
              <ThemeToggle />
              {user && (user.role === "ADMIN" || user.role === "MODERATOR") ? (
                <Link href="/admin" className="hidden sm:inline-flex">
                  <Button variant="ghost" className="h-8 rounded-md px-3">后台</Button>
                </Link>
              ) : null}
              <Link href="/notifications" className="relative hidden sm:inline-flex">
                <Button variant="ghost" size="icon" className="size-8 rounded-md">
                  <Bell className={unreadNotificationCount > 0 ? "h-4 w-4 text-rose-600" : "h-4 w-4"} />
                </Button>
                {unreadNotificationCount > 0 ? <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-rose-500" /> : null}
              </Link>

              <HeaderUserActions user={headerUser} unreadMessageCount={unreadMessageCount} unreadNotificationCount={unreadNotificationCount} />

            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
