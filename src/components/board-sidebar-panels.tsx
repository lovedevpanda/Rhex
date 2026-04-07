import Link from "next/link"
import { ArrowUpRight, BookText, Ellipsis, Link2 } from "lucide-react"

import { HomeSidebarPanels } from "@/components/home-sidebar-panels"
import { LevelIcon } from "@/components/level-icon"
import { MarkdownContent } from "@/components/markdown-content"
import { UserAvatar } from "@/components/user-avatar"
import type { SiteBoardItem, BoardModeratorItem } from "@/lib/boards"
import type { SidebarUserCardData } from "@/components/sidebar-user-card"
import type { HomeSidebarPanelItem } from "@/lib/home-sidebar-layout"
import type { BoardSidebarLinkItem } from "@/lib/board-sidebar-config"

interface HotTopicItem {
  id: string
  slug: string
  title: string
  lastReplyAuthorName: string | null
  lastRepliedAt: string
  authorName: string
  authorAvatarPath?: string | null
}

interface BoardSidebarPanelsProps {
  user: SidebarUserCardData | null
  hotTopics: HotTopicItem[]
  board: Pick<SiteBoardItem, "name" | "slug" | "sidebarLinks" | "rulesMarkdown">
  moderators: BoardModeratorItem[]
  postLinkDisplayMode?: "SLUG" | "ID"
  createPostHref?: string
  siteName?: string
  siteDescription?: string
}

const DEFAULT_BOARD_RULES_MARKDOWN = [
  "1. 请围绕当前节点主题发帖与回复。",
  "2. 禁止广告、灌水、引战、人身攻击与违法内容。",
  "3. 尊重原作者与讨论对象，引用外部内容请注明来源。",
  "4. 节点版主会根据站点规范与节点规则处理违规内容。",
].join("\n")

function isExternalUrl(url: string) {
  return /^(https?:)?\/\//i.test(url)
}


function BoardLinkCard({ item }: { item: BoardSidebarLinkItem }) {
  const titleStyle = item.titleColor ? { color: item.titleColor } : undefined
  const content = (
    <div className="group flex items-center gap-3 rounded-[16px] px-2 py-2 transition-colors hover:bg-accent/40">
      {item.icon ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-accent text-base">
          <LevelIcon icon={item.icon} className="h-4 w-4 text-sm" svgClassName="[&>svg]:block" />
        </div>
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600">
          <Link2 className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <p className="shrink-0 font-semibold" style={titleStyle}>{item.title}</p>
        </div>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </div>
  )

  if (isExternalUrl(item.url)) {
    return (
      <a href={item.url} target="_blank" rel="noreferrer" className="block">
        {content}
      </a>
    )
  }

  return (
    <Link href={item.url} className="block">
      {content}
    </Link>
  )
}

function BoardModeratorsMenu({ moderators }: { moderators: BoardModeratorItem[] }) {
  if (moderators.length === 0) {
    return null
  }

  return (
    <details className="relative">
      <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&::-webkit-details-marker]:hidden">
        <Ellipsis className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-[20px] border border-border bg-background p-3 shadow-lg shadow-black/10">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-foreground">节点版主</p>
          <p className="text-[11px] text-muted-foreground">{moderators.length} 人</p>
        </div>
        <div className="space-y-1.5">
          {moderators.map((moderator) => (
            <Link key={moderator.id} href={`/users/${moderator.username}`} className="flex items-center gap-3 rounded-[16px] px-2 py-2 transition-colors hover:bg-accent/50">
              <UserAvatar name={moderator.displayName} avatarPath={moderator.avatarPath} size="xs" isVip={moderator.vipLevel > 0} vipLevel={moderator.vipLevel} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{moderator.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">@{moderator.username}{moderator.role === "ADMIN" ? " · 管理员" : ""}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </details>
  )
}

function BoardRulesPanel({ board, moderators }: Pick<BoardSidebarPanelsProps, "board" | "moderators">) {
  return (
    <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm shadow-black/5 dark:shadow-black/30">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <BookText className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold">节点规则</h3>
        </div>
        <BoardModeratorsMenu moderators={moderators} />
      </div>
      <MarkdownContent
        content={board.rulesMarkdown || DEFAULT_BOARD_RULES_MARKDOWN}
        className="text-[13px] leading-6 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1"
      />
    </section>
  )
}

function BoardLinksPanel({ links }: { links: BoardSidebarLinkItem[] }) {
  if (links.length === 0) {
    return null
  }

  return (
    <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm shadow-black/5 dark:shadow-black/30">
      <div className="mb-3 flex items-center gap-2">
        <Link2 className="h-4 w-4 text-sky-600" />
        <h3 className="text-sm font-semibold">节点链接</h3>
      </div>
      <div className="space-y-1">
        {links.map((item, index) => (
          <BoardLinkCard key={`${item.title}-${item.url}-${index}`} item={item} />
        ))}
      </div>
    </section>
  )
}

export function BoardSidebarPanels({ user, hotTopics, board, moderators, postLinkDisplayMode = "SLUG", createPostHref, siteName, siteDescription }: BoardSidebarPanelsProps) {
  const topPanels: HomeSidebarPanelItem[] = []

  if (board.sidebarLinks.length > 0) {
    topPanels.push({
      id: `${board.slug}:board-links`,
      slot: "home-right-top",
      order: 10,
      content: <BoardLinksPanel links={board.sidebarLinks} />,
    })
  }

  topPanels.push({
    id: `${board.slug}:board-rules`,
    slot: "home-right-top",
    order: 20,
    content: <BoardRulesPanel board={board} moderators={moderators} />,
  })

  return (
    <HomeSidebarPanels
      user={user}
      hotTopics={hotTopics}
      postLinkDisplayMode={postLinkDisplayMode}
      showAnnouncements={false}
      createPostHref={createPostHref}
      siteName={siteName}
      siteDescription={siteDescription}
      topPanels={topPanels}
    />
  )
}
