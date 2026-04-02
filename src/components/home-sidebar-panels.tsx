import Link from "next/link"
import { Flame, Link2 } from "lucide-react"

import { HomeAnnouncementPanel } from "@/components/home-announcement-panel"
import { PostListLink } from "@/components/post-list-link"
import { ReadingHistoryPanel } from "@/components/reading-history-panel"
import { HomeSiteStatsCard } from "@/components/home-site-stats-card"
import { SidebarUserCard, type SidebarUserCardData } from "@/components/sidebar-user-card"
import { UserAvatar } from "@/components/user-avatar"
import type { AnnouncementItem } from "@/lib/announcements"
import type { FriendLinkItem } from "@/lib/friend-links"
import type { HomeSidebarPanelItem } from "@/lib/home-sidebar-layout"
import type { HomeSidebarStatsData } from "@/lib/home-sidebar-stats"
import { getPostPath } from "@/lib/post-links"

interface HotTopicItem {
  id: string
  slug: string
  title: string
  lastReplyAuthorName: string | null
  lastRepliedAt: string
  authorName: string
  authorAvatarPath?: string | null
}

interface HomeSidebarPanelsProps {
  user: SidebarUserCardData | null
  hotTopics: HotTopicItem[]
  postLinkDisplayMode?: "SLUG" | "ID"
  announcements?: AnnouncementItem[]
  showAnnouncements?: boolean
  friendLinks?: FriendLinkItem[]
  friendLinksEnabled?: boolean
  createPostHref?: string
  topPanels?: HomeSidebarPanelItem[]
  middlePanels?: HomeSidebarPanelItem[]
  bottomPanels?: HomeSidebarPanelItem[]
  stats?: HomeSidebarStatsData | null
  siteName?: string
  siteDescription?: string
}

export function HomeSidebarPanels({ user, hotTopics, postLinkDisplayMode = "SLUG", announcements = [], showAnnouncements = true, friendLinks = [], friendLinksEnabled = false, createPostHref, topPanels = [], middlePanels = [], bottomPanels = [], stats = null, siteName, siteDescription }: HomeSidebarPanelsProps) {
  return (
    <div className="sticky top-20 min-w-0 w-full max-w-full space-y-4">
      <SidebarUserCard user={user} createPostHref={createPostHref} siteName={siteName} siteDescription={siteDescription} />
      {user ? <ReadingHistoryPanel variant="sidebar" title="今日访问" limit={5} moreHref="/settings?tab=follows&followTab=history" showOnlyToday requireLoggedIn isLoggedIn hideWhenEmpty stabilizeLayoutOnHydration /> : null}

      {topPanels.map((panel) => <div key={panel.id}>{panel.content}</div>)}

      {showAnnouncements ? <HomeAnnouncementPanel announcements={announcements} /> : null}

      <div className="rounded-[20px] border border-border bg-card p-3 shadow-sm shadow-black/5 dark:shadow-black/30">
        <div className="mb-3 flex items-center gap-1.5">
          <Flame className="h-4 w-4 text-orange-500 dark:text-orange-400" />
          <h3 className="text-sm font-semibold">今日热帖</h3>
        </div>
        <div className="space-y-1.5">
          {hotTopics.map((topic) => {
            const postPath = getPostPath({ id: topic.id, slug: topic.slug }, { mode: postLinkDisplayMode })

            return (
            <PostListLink key={topic.id} href={postPath} visitedPath={postPath} dimWhenRead className="-mx-1 flex items-start gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-accent/70">
              <UserAvatar name={topic.authorName} avatarPath={topic.authorAvatarPath} size="xs" />
              <div className="min-w-0 flex-1">
                <div title={topic.title} className="truncate whitespace-nowrap text-[13px] leading-snug">{topic.title}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">最后回复：{topic.lastReplyAuthorName ?? topic.authorName} · {topic.lastRepliedAt}</div>
              </div>
            </PostListLink>
          )})}
        </div>
      </div>


      {middlePanels.map((panel) => <div key={panel.id}>{panel.content}</div>)}

      {friendLinksEnabled ? (

        <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm shadow-black/5 dark:shadow-black/30">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-sky-500" />
              <div>
                <h3 className="font-semibold">友情链接</h3>
              </div>
            </div>
            <Link href="/link" className="text-xs text-muted-foreground transition hover:text-foreground">全部链接</Link>
          </div>
          {friendLinks.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              {friendLinks.map((link) => (
                <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="truncate rounded-lg px-2 py-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground" title={link.name}>
                  {link.name}
                </a>
              ))}
            </div>
          ) : (
            <div className="rounded-[18px] border border-dashed border-border px-3 py-4 text-xs leading-6 text-muted-foreground">
              当前还没有已通过的友情链接，审核通过后会显示在这里。
            </div>
          )}
        </section>
      ) : null}

      {bottomPanels.map((panel) => <div key={panel.id}>{panel.content}</div>)}

      {stats ? <HomeSiteStatsCard stats={stats} /> : null}
    </div>
  )
}
