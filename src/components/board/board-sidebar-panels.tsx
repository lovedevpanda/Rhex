import Link from "next/link"
import { ArrowUpRight, BookText, Link2 } from "lucide-react"

import { AddonSlotRenderer } from "@/addons-host"
import { BoardModeratorsActions } from "@/components/board/board-moderators-dialog"
import { HomeSidebarPanels } from "@/components/home/home-sidebar-panels"
import { LevelIcon } from "@/components/level-icon"
import { MarkdownContent } from "@/components/markdown-content"
import type { AnnouncementItem } from "@/lib/announcements"
import type { SiteBoardItem, BoardModeratorItem } from "@/lib/boards"
import type { SidebarUserCardData } from "@/components/user/sidebar-user-card"
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
  zoneModerators?: BoardModeratorItem[]
  boardManagementHref?: string
  announcements?: AnnouncementItem[]
  showAnnouncements?: boolean
  postLinkDisplayMode?: "SLUG" | "ID"
  createPostHref?: string
  siteName?: string
  siteDescription?: string
  siteLogoPath?: string | null
  siteIconPath?: string | null
}

const DEFAULT_BOARD_RULES_MARKDOWN = [
  "1. 请围绕当前节点主题发帖与回复",
  "2. 禁止广告、灌水、引战、人身攻击与违法内容",
  "3. 尊重作者与社友，引用外部内容请注明来源",
  "4. 节点版主会根据站点规范与节点规则处理违规内容",
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

function BoardRulesPanel({
  board,
  moderators,
  zoneModerators = [],
  boardManagementHref,
}: Pick<BoardSidebarPanelsProps, "board" | "moderators" | "zoneModerators" | "boardManagementHref">) {
  return (
    <section className="mobile-sidebar-section rounded-xl border border-border bg-card p-4 shadow-xs shadow-black/5 dark:shadow-black/30">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <BookText className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold">节点规则</h3>
        </div>
        <BoardModeratorsActions
          boardName={board.name}
          zoneModerators={zoneModerators}
          boardModerators={moderators}
          managementHref={boardManagementHref}
        />
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
    <section className="mobile-sidebar-section rounded-xl border border-border bg-card p-4 shadow-xs shadow-black/5 dark:shadow-black/30">
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

export function BoardSidebarPanels({ user, hotTopics, board, moderators, zoneModerators, boardManagementHref, announcements = [], showAnnouncements = true, postLinkDisplayMode = "SLUG", createPostHref, siteName, siteDescription, siteLogoPath, siteIconPath }: BoardSidebarPanelsProps) {
  const boardSlotProps = {
    boardSlug: board.slug,
    boardName: board.name,
  }
  const topPanels: HomeSidebarPanelItem[] = [
    {
      id: `${board.slug}:addon-board-right-top`,
      slot: "home-right-top",
      order: 0,
      content: <AddonSlotRenderer slot="board.right.top" props={boardSlotProps} />,
    },
  ]
  const middlePanels: HomeSidebarPanelItem[] = [
    {
      id: `${board.slug}:addon-board-right-middle`,
      slot: "home-right-middle",
      order: 0,
      content: <AddonSlotRenderer slot="board.right.middle" props={boardSlotProps} />,
    },
  ]
  const bottomPanels: HomeSidebarPanelItem[] = [
    {
      id: `${board.slug}:addon-board-right-bottom`,
      slot: "home-right-bottom",
      order: 0,
      content: <AddonSlotRenderer slot="board.right.bottom" props={boardSlotProps} />,
    },
  ]

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
    content: <BoardRulesPanel board={board} moderators={moderators} zoneModerators={zoneModerators} boardManagementHref={boardManagementHref} />,
  })

  return (
    <HomeSidebarPanels
      user={user}
      hotTopics={hotTopics}
      postLinkDisplayMode={postLinkDisplayMode}
      announcements={announcements}
      showAnnouncements={showAnnouncements}
      createPostHref={createPostHref}
      siteName={siteName}
      siteDescription={siteDescription}
      siteLogoPath={siteLogoPath}
      siteIconPath={siteIconPath}
      topPanels={topPanels}
      middlePanels={middlePanels}
      bottomPanels={bottomPanels}
    />
  )
}
