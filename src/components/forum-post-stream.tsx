import type { SitePostItem } from "@/lib/posts"
import { getSiteSettings } from "@/lib/site-settings"
import { resolvePostHeatStyle } from "@/lib/post-heat"

import { ForumPostListItem } from "@/components/forum-post-list-item"

interface ForumPostStreamProps {
  posts: SitePostItem[]
  showBoard?: boolean
}

function getVipNameClass(isVip?: boolean, level?: number | null) {
  if (!isVip || !level || level <= 0) {
    return "hover:underline"
  }

  if (level >= 3) {
    return "font-semibold text-amber-700 hover:underline dark:text-amber-300"
  }

  if (level === 2) {
    return "font-semibold text-rose-700 hover:underline dark:text-rose-300"
  }

  return "font-semibold text-violet-700 hover:underline dark:text-violet-300"
}

export async function ForumPostStream({ posts, showBoard = true }: ForumPostStreamProps) {
  const settings = await getSiteSettings()

  return (
    <div className="overflow-hidden rounded-md bg-background">
      <div className="lg:pl-4">
        {posts.map((post, index) => {
          const commentHeat = resolvePostHeatStyle({
            views: post.stats.views,
            comments: post.stats.comments,
            likes: post.stats.likes,
            tipCount: post.stats.tips,
            tipPoints: post.stats.tipPoints,
          }, settings)

          return (
            <ForumPostListItem
              key={post.id}
              item={{
                id: post.id,
                slug: post.slug,
                title: post.title,
                type: post.type,
                typeLabel: post.typeLabel,
                pinScope: post.pinScope,
                minViewLevel: post.minViewLevel,
                isFeatured: post.isFeatured,
                boardName: post.board,
                boardSlug: post.boardSlug,
                boardIcon: post.boardIcon,
                authorName: post.author,
                authorUsername: post.authorUsername ?? post.author,
                authorAvatarPath: post.authorAvatarPath,
                authorStatus: post.authorStatus,
                authorNameClassName: getVipNameClass(post.authorIsVip, post.authorVipLevel),
                authorDisplayedBadges: post.authorDisplayedBadges,
                metaPrimary: post.publishedAt,
                commentCount: post.stats.comments,
                commentAccentColor: commentHeat.color,
              }}
              showBoard={showBoard}
              compactFirstItem={index === 0}
            />
          )
        })}
      </div>
    </div>
  )
}
