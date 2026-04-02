"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, MessageSquareMore, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import { getVipLevel, isVipActive } from "@/lib/vip-status"


interface HeaderUserActionsProps {
  user: {
    username: string
    nickname?: string | null
    avatarPath?: string | null
    vipLevel?: number
    vipExpiresAt?: string | null
  } | null
  unreadMessageCount: number
  unreadNotificationCount: number
}

function formatUnreadBadge(count: number) {
  if (count <= 0) {
    return null
  }

  return count > 9 ? "9+" : String(count)
}

function HeaderUnreadBadge({ count, className }: { count: number; className?: string }) {
  const label = formatUnreadBadge(count)

  if (!label) {
    return null
  }

  return (
    <span className={`absolute flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white ${className ?? ""}`}>
      {label}
    </span>
  )
}


export function HeaderUserActions({ user, unreadMessageCount, unreadNotificationCount }: HeaderUserActionsProps) {

  const router = useRouter()
  const mobileMenuRef = useRef<HTMLDivElement | null>(null)
  const desktopMenuRef = useRef<HTMLDivElement | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false)

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      cache: "no-store",
    })
    setMobileMenuOpen(false)
    setDesktopMenuOpen(false)
    router.replace("/")
    router.refresh()
  }


  useEffect(() => {
    if (!mobileMenuOpen && !desktopMenuOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node

      if (mobileMenuOpen && !mobileMenuRef.current?.contains(target)) {
        setMobileMenuOpen(false)
      }

      if (desktopMenuOpen && !desktopMenuRef.current?.contains(target)) {
        setDesktopMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false)
        setDesktopMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [desktopMenuOpen, mobileMenuOpen])

  if (!user) {
    return (
      <>
        <Link href="/login" className="block sm:hidden">
          <Button variant="ghost" size="icon" className="size-8 rounded-md">
            <User className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/login" className="hidden sm:block">
          <Button variant="ghost" size="icon" className="size-8 rounded-md">
            <User className="h-4 w-4" />
          </Button>
        </Link>
      </>
    )
  }

  const vipActive = isVipActive(user)
  const vipLevel = getVipLevel(user)


  return (

    <>
      <div className="flex items-center gap-1 sm:hidden">
        <Link href="/notifications" className="relative">
          <Button variant="ghost" size="icon" className="size-8 rounded-md">
            <Bell className={unreadNotificationCount > 0 ? "h-4 w-4 text-rose-600" : "h-4 w-4"} />
          </Button>
          <HeaderUnreadBadge count={unreadNotificationCount} className="right-0.5 top-0.5 min-h-4 min-w-4" />
        </Link>

        <Link href="/messages" className="relative">
          <Button variant="ghost" size="icon" className="size-8 rounded-md">
            <MessageSquareMore className={unreadMessageCount > 0 ? "h-4 w-4 text-rose-600" : "h-4 w-4"} />
          </Button>
          <HeaderUnreadBadge count={unreadMessageCount} className="right-0.5 top-0.5 min-h-4 min-w-4" />
        </Link>

        <div ref={mobileMenuRef} className="relative">
          <button
            type="button"
            className="flex h-8 items-center rounded-md px-1.5 transition-colors hover:bg-accent"
            onClick={() => setMobileMenuOpen((current) => !current)}
            aria-expanded={mobileMenuOpen}
            aria-haspopup="menu"
          >
            <UserAvatar name={user.nickname ?? user.username} avatarPath={user.avatarPath} size="sm" isVip={vipActive} vipLevel={vipLevel} />
          </button>

          {mobileMenuOpen ? (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-44 rounded-2xl border border-border bg-background p-2 shadow-2xl">
              <Link
                href={`/users/${user.username}`}
                className="flex items-center rounded-xl px-3 py-2 text-sm transition-colors hover:bg-accent"
                onClick={() => setMobileMenuOpen(false)}
              >
                个人主页
              </Link>
         
              <Link href="/settings" className="flex items-center rounded-xl px-3 py-2 text-sm transition-colors hover:bg-accent" onClick={() => setMobileMenuOpen(false)}>
                设置
              </Link>

              <Link href="/vip" className="flex items-center rounded-xl px-3 py-2 text-sm transition-colors hover:bg-accent" onClick={() => setMobileMenuOpen(false)}>
                VIP
              </Link>
              <button
                type="button"
                className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                onClick={async () => {
                  setMobileMenuOpen(false)
                  await handleLogout()
                }}
              >
                退出
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="hidden items-center gap-1.5 sm:flex">
        <Link href="/messages" className="relative">
          <Button variant="ghost" className="h-8 rounded-md px-3 gap-1.5">
            <MessageSquareMore className={unreadMessageCount > 0 ? "h-4 w-4 text-rose-600" : "h-4 w-4"} />
          </Button>
          <HeaderUnreadBadge count={unreadMessageCount} className="right-1 top-0.5 min-h-4 min-w-4" />
        </Link>

  

        <Link href="/vip">
          <Button variant="ghost" className="h-8 rounded-md px-3">
            VIP
          </Button>
        </Link>

        <div ref={desktopMenuRef} className="relative">
  

<Button variant="ghost"  type="button" onClick={() => setDesktopMenuOpen((current) => !current)}
            aria-expanded={desktopMenuOpen}
            aria-haspopup="menu"  size="icon" className="size-8 rounded-md">
            <User className="h-4 w-4" />
          </Button>
          {desktopMenuOpen ? (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-44 rounded-2xl border border-border bg-background p-2 shadow-2xl">

                


 <Link href={`/users/${user.username}`} className="flex items-center rounded-xl px-3 py-2 text-sm transition-colors hover:bg-accent" onClick={() => setDesktopMenuOpen(false)}>
                个人主页
              </Link>

              <Link href="/settings" className="flex items-center rounded-xl px-3 py-2 text-sm transition-colors hover:bg-accent" onClick={() => setDesktopMenuOpen(false)}>
                设置
              </Link>

              <button
                type="button"
                className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                onClick={async () => {
                  setDesktopMenuOpen(false)
                  await handleLogout()
                }}
              >
                退出
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
