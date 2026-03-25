import Image from "next/image"
import Link from "next/link"
import { Link2 } from "lucide-react"


import { FriendLinkApplicationDialog } from "@/components/friend-link-application-dialog"
import type { FriendLinkItem } from "@/lib/friend-links"

interface FriendLinkPageContentProps {
  links: FriendLinkItem[]
  announcement: string
  applicationEnabled: boolean
}

export function FriendLinkPageContent({ links, announcement, applicationEnabled }: FriendLinkPageContentProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm shadow-black/5 dark:shadow-black/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-sky-500" />
              <h1 className="text-2xl font-semibold">友情链接</h1>
            </div>
          </div>
          <FriendLinkApplicationDialog announcement={announcement} disabled={!applicationEnabled} />
        </div>
      </section>

      <section className="rounded-[28px] border border-border bg-card p-6">
        <h2 className="text-base font-semibold">友情链接公告</h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">{announcement}</p>
      </section>

      <section className="rounded-[28px] border border-border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {links.map((link) => (
            <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="group flex items-center gap-4 rounded-[22px] border border-border bg-background px-4 py-4 transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg hover:shadow-black/5">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white p-2">
                {link.logoPath ? <Image src={link.logoPath} alt={`${link.name} logo`} fill unoptimized className="object-contain p-2" /> : <span className="text-lg font-semibold text-muted-foreground">{link.name.slice(0, 1)}</span>}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground group-hover:text-sky-600">{link.name}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{link.url}</div>

              </div>
            </a>
          ))}
        </div>
        {links.length === 0 ? <p className="text-sm text-muted-foreground">当前还没有已审核通过的友情链接。</p> : null}
      </section>

      <div className="text-sm text-muted-foreground">
        <Link href="/" className="transition hover:text-foreground">返回首页</Link>
      </div>
    </div>
  )
}
