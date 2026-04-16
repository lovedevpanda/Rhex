import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, Link2, ShieldCheck, Sparkles } from "lucide-react"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { FriendLinkApplicationDialog } from "@/components/friend-links/friend-link-application-dialog"
import type { FriendLinkItem } from "@/lib/friend-links"

interface FriendLinkPageContentProps {
  links: FriendLinkItem[]
  announcement: string
  applicationEnabled: boolean
}

export function FriendLinkPageContent({ links, announcement, applicationEnabled }: FriendLinkPageContentProps) {
  const uniqueHostCount = new Set(links.map((link) => getDisplayHost(link.url))).size

  return (
    <div className="space-y-4 sm:space-y-6">
      <AddonSlotRenderer slot="friend-links.hero.before" />
      <AddonSurfaceRenderer surface="friend-links.hero" props={{ announcement, applicationEnabled, links }}>
        <section className="overflow-hidden rounded-[28px] border border-border bg-card shadow-xs shadow-black/5 dark:shadow-black/30">
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.12),transparent_30%)] px-4 py-5 sm:px-6 sm:py-6">
            <div className="flex items-start justify-between gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-300">
                <Link2 className="h-5 w-5" />
              </div>
              <Link href="/" className="inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-background/80 px-4 py-2 text-sm text-muted-foreground transition hover:bg-background hover:text-foreground">
                返回首页
              </Link>
            </div>

            <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">友情链接</h1>

                </div>
                <div className="flex flex-wrap gap-2">
                  <MetaChip icon={ShieldCheck} label="已收录" value={`${links.length} 个站点`} />
                  <MetaChip icon={Sparkles} label="独立域名" value={`${uniqueHostCount} 个`} />
                  <MetaChip icon={Link2} label="申请入口" value={applicationEnabled ? "开放中" : "暂未开放"} highlighted={applicationEnabled} />
                </div>
              </div>

              <div className="w-full xl:w-auto">
                <FriendLinkApplicationDialog announcement={announcement} disabled={!applicationEnabled} buttonClassName="w-full sm:w-auto" />
              </div>
            </div>
          </div>
        </section>
      </AddonSurfaceRenderer>
      <AddonSlotRenderer slot="friend-links.hero.after" />

      <AddonSlotRenderer slot="friend-links.content.before" />
      <AddonSurfaceRenderer surface="friend-links.content" props={{ announcement, applicationEnabled, links }}>
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <section className="rounded-[28px] border border-border bg-card p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-500" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">申请说明</h2>
            </div>
            <p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted-foreground">{announcement}</p>
            <div className="mt-4 space-y-2 rounded-[20px] border border-border bg-background/70 p-4 text-xs leading-6 text-muted-foreground">
              <p>提交前请先确认站点链接可访问，并建议提供清晰的 LOGO 图片地址。</p>
              <p>系统会自动拦截重复链接；审核通过后才会出现在友情链接目录中。</p>
              <p>{applicationEnabled ? "当前站点已开放友情链接申请入口。" : "当前站点暂未开放友情链接申请入口。"}</p>
            </div>
          </section>

          <section className="rounded-[28px] border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">友链目录</h2>
                <p className="mt-1 text-sm text-muted-foreground">按紧凑卡片展示站点名称和域名，移动端默认压缩尺寸以提高可见数量。</p>
              </div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{links.length} Links</p>
            </div>

            {links.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {links.map((link) => (
                  <FriendLinkDirectoryCard key={link.id} link={link} />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[22px] border border-dashed border-border bg-background/70 px-4 py-8 text-center text-sm leading-7 text-muted-foreground">
                当前还没有已审核通过的友情链接。
              </div>
            )}
          </section>
        </div>
      </AddonSurfaceRenderer>
      <AddonSlotRenderer slot="friend-links.content.after" />
    </div>
  )
}

function FriendLinkDirectoryCard({ link }: { link: FriendLinkItem }) {
  const displayHost = getDisplayHost(link.url)

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      title={`${link.name} · ${link.url}`}
      className="group flex min-w-0 items-center gap-2.5 rounded-[18px] border border-border bg-background px-2.5 py-2.5 transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md hover:shadow-black/5"
    >
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white p-1.5">
        {link.logoPath ? (
          <Image src={link.logoPath} alt={`${link.name} logo`} fill sizes="40px" unoptimized className="object-contain p-1.5" />
        ) : (
          <span className="text-sm font-semibold text-muted-foreground">{link.name.slice(0, 1)}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold leading-5 text-foreground group-hover:text-sky-600">{link.name}</div>
        <div className="truncate text-[11px] leading-4 text-muted-foreground">{displayHost}</div>
      </div>

      <ArrowUpRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:text-foreground sm:block" />
    </a>
  )
}

function MetaChip({
  icon: Icon,
  label,
  value,
  highlighted = false,
}: {
  icon: typeof Link2
  label: string
  value: string
  highlighted?: boolean
}) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs ${highlighted ? "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-200" : "border-border bg-background/80 text-muted-foreground"}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
      <span className="font-semibold text-foreground dark:text-foreground">{value}</span>
    </div>
  )
}

function getDisplayHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "")
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/\/.*$/, "")
  }
}
