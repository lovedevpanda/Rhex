import Link from "next/link"
import { Eye, MessageCircle, ThumbsUp } from "lucide-react"

import { UserDisplayedBadges } from "@/components/user-displayed-badges"
import { getPostPath } from "@/lib/post-links"
import type { SitePostItem } from "@/lib/posts"


interface PostCardListProps {
  posts: SitePostItem[]
  pointName?: string
  compact?: boolean
  showBoard?: boolean
}

export function PostCardList({ posts, pointName = "积分", compact = false, showBoard = true }: PostCardListProps) {

  return (
    <>
      {posts.map((post) => (
        <div key={post.id} className="rounded-[24px] bg-secondary/60 p-5">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded-full bg-background px-3 py-1 text-xs">{post.typeLabel}</span>
            {showBoard ? (
              <>
                <span>{post.board}</span>
                <span>·</span>
              </>
            ) : null}
            <span>{post.author}</span>
            <UserDisplayedBadges badges={post.authorDisplayedBadges} compact />
            <span>·</span>

            <span>{post.publishedAt}</span>
            {post.bounty ? (
              <>
                <span>·</span>
                <span>悬赏 {post.bounty.points} {pointName}</span>

              </>
            ) : null}
          </div>

          <Link href={getPostPath(post)}>
            <h2 className="text-xl font-semibold leading-8 transition-colors hover:text-primary">{post.title}</h2>
          </Link>
          {compact ? null : <p className="mt-3 text-sm leading-7 text-muted-foreground">{post.excerpt}</p>}
          <div className={`${compact ? "mt-3" : "mt-4"} flex flex-wrap items-center gap-4 text-sm text-muted-foreground`}>
            <span className="flex items-center gap-1"><MessageCircle className="h-4 w-4" />{post.stats.comments}</span>
            <span className="flex items-center gap-1"><ThumbsUp className="h-4 w-4" />{post.stats.likes}</span>
            <span className="flex items-center gap-1"><Eye className="h-4 w-4" />{post.stats.views}</span>
          </div>
        </div>
      ))}
    </>
  )
}
