import Link from "next/link"
import { FolderOpen, Tag } from "lucide-react"

import { SidebarUserCard, type SidebarUserCardData } from "@/components/user/sidebar-user-card"
import { getPostPath } from "@/lib/post-links"
import { AddonSlotRenderer } from "@/addons-host"

interface RelatedTopic {
  id: string
  slug: string
  title: string
}

interface TopicTag {
  id: string
  name: string
  slug: string
}

interface FavoriteCollectionTag {
  id: string
  title: string
  visibility: "PUBLIC" | "PRIVATE"
}

interface PostSidebarPanelsProps {
  currentUser: SidebarUserCardData | null
  relatedTopics: RelatedTopic[]
  tags: TopicTag[]
  collections: FavoriteCollectionTag[]
  postLinkDisplayMode?: "SLUG" | "ID"
  siteName?: string
  siteDescription?: string
  siteLogoPath?: string | null
  siteIconPath?: string | null
}

export function PostSidebarPanels({
  currentUser,
  relatedTopics,
  tags,
  collections,
  postLinkDisplayMode = "SLUG",
  siteName,
  siteDescription,
  siteLogoPath,
  siteIconPath,
}: PostSidebarPanelsProps) {
  return (
    <div className="post-sidebar-panels mobile-sidebar-stack flex min-w-0 w-full max-w-full flex-col gap-4">
      <AddonSlotRenderer slot="post.sidebar.top" />
      <SidebarUserCard user={currentUser} siteName={siteName} siteDescription={siteDescription} siteLogoPath={siteLogoPath} siteIconPath={siteIconPath} />

      <div className="mobile-sidebar-section rounded-[24px] border border-border bg-card p-4 shadow-xs shadow-black/5 dark:shadow-black/30">
        <div className="mb-4 border-b border-border/80 pb-4">
          <h3 className="mb-3 font-semibold">相关主题</h3>
          <div className="space-y-3">
            {relatedTopics.length === 0 ? <p className="text-sm text-muted-foreground">暂无相关主题。</p> : null}
            {relatedTopics.map((topic) => (
              <Link
                key={topic.id}
                href={getPostPath({ id: topic.id, slug: topic.slug }, { mode: postLinkDisplayMode }) as string}
                className="block truncate rounded-xl px-2 py-1 text-sm transition-colors hover:bg-accent/70 hover:text-primary"
                title={topic.title}
              >
                {topic.title}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              <h3 className="font-semibold">主题标签</h3>
            </div>
            <Link href="/tags" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              全部标签
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.length === 0 ? <span className="text-sm text-muted-foreground">暂无标签</span> : null}
            {tags.map((tag) => (
              <Link key={tag.id} href={`/tags/${tag.slug}`} className="rounded-full border border-border bg-background px-3 py-1 text-xs transition-colors hover:border-primary hover:bg-accent">
                {tag.name}
              </Link>
            ))}
          </div>

          {collections.length > 0 ? (
            <div className="mt-4 border-t border-border/70 pt-4">
              <div className="mb-3 flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                <h4 className="font-semibold">收录合集</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {collections.map((collection) => (
                  <Link
                    key={collection.id}
                    href={`/collections/${collection.id}`}
                    className="inline-flex max-w-full items-center rounded-full border border-border bg-background px-3 py-1 text-xs transition-colors hover:border-primary hover:bg-accent"
                    title={collection.title}
                  >
                    <span className="truncate">{collection.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <AddonSlotRenderer slot="post.sidebar.bottom" />
    </div>
  )
}
