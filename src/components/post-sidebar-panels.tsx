import Link from "next/link"
import { Tag } from "lucide-react"

import { SidebarUserCard, type SidebarUserCardData } from "@/components/sidebar-user-card"

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

interface PostSidebarPanelsProps {
  currentUser: SidebarUserCardData | null
  relatedTopics: RelatedTopic[]
  tags: TopicTag[]
}

export function PostSidebarPanels({ currentUser, relatedTopics, tags }: PostSidebarPanelsProps) {
  return (
    <div className="space-y-4">
      <SidebarUserCard user={currentUser} />

      <div className="rounded-[24px] border border-border bg-card p-4 shadow-sm shadow-black/5 dark:shadow-black/30">
        <div className="mb-4 border-b border-border/80 pb-4">
          <h3 className="mb-3 font-semibold">相关主题</h3>
          <div className="space-y-3">
            {relatedTopics.length === 0 ? <p className="text-sm text-muted-foreground">暂无相关主题。</p> : null}
            {relatedTopics.map((topic) => (
              <Link
                key={topic.id}
                href={`/posts/${topic.slug}`}
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
        </div>
      </div>
    </div>
  )
}
