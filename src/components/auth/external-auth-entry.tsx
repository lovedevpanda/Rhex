"use client"

import Link from "next/link"
import { Chrome, Github, KeyRound, Link2 } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { AddonExternalAuthEntry } from "@/lib/addon-external-auth-providers"
import { cn } from "@/lib/utils"
import type { SiteSettingsData } from "@/lib/site-settings"

interface ExternalAuthEntryProps {
  settings: Pick<SiteSettingsData, "authGithubEnabled" | "authGoogleEnabled" | "authPasskeyEnabled">
  mode: "login" | "register"
  addonEntries?: AddonExternalAuthEntry[]
  className?: string
}

function EntryLink({ href, children, useDocumentNavigation = false }: { href: string; children: React.ReactNode; useDocumentNavigation?: boolean }) {
  const className = cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")

  if (useDocumentNavigation) {
    return (
      <a
        href={href}
        className={className}
      >
        {children}
      </a>
    )
  }

  return (
    <Link
      href={href}
      className={className}
    >
      {children}
    </Link>
  )
}

export function ExternalAuthEntry({ settings, mode, addonEntries = [], className }: ExternalAuthEntryProps) {
  const items = [
    settings.authGithubEnabled ? {
      key: "github",
      label: mode === "login" ? "GitHub" : "GitHub",
      href: `/api/auth/oauth/github/start?mode=${mode}`,
      icon: <Github data-icon="inline-start" />,
      useDocumentNavigation: true,
    } : null,
    settings.authGoogleEnabled ? {
      key: "google",
      label: mode === "login" ? "Google" : "Google",
      href: `/api/auth/oauth/google/start?mode=${mode}`,
      icon: <Chrome data-icon="inline-start" />,
      useDocumentNavigation: true,
    } : null,
    settings.authPasskeyEnabled ? {
      key: "passkey",
      label: mode === "login" ? "Passkey" : "Passkey",
      href: `/auth/passkey?mode=${mode}`,
      icon: <KeyRound data-icon="inline-start" />,
      useDocumentNavigation: false,
    } : null,
    ...addonEntries.map((entry) => {
      const href = mode === "login" ? entry.loginUrl : entry.registerUrl
      if (!href) {
        return null
      }

      return {
        key: entry.provider,
        label: entry.label,
        href,
        icon: <Link2 data-icon="inline-start" />,
        useDocumentNavigation: true,
      }
    }),
  ].filter(Boolean) as Array<{ key: string; label: string; href: string; icon: React.ReactNode; useDocumentNavigation: boolean }>

  if (items.length === 0) {
    return null
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Separator />
        <span>{mode === "login" ? "其它登录方式" : "快捷注册方式"}</span>
        <Separator />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <EntryLink key={item.key} href={item.href} useDocumentNavigation={item.useDocumentNavigation}>
            {item.icon}
            {item.label}
          </EntryLink>
        ))}
      </div>
    </div>
  )
}
