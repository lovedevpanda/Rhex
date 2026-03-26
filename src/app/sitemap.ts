import type { MetadataRoute } from "next"

import { getBoards } from "@/lib/boards"
import { getPostPath } from "@/lib/post-links"
import { getHomepagePosts } from "@/lib/posts"
import { toAbsoluteSiteUrl } from "@/lib/site-origin"
import { getZones } from "@/lib/zones"



export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [boards, posts, zones] = await Promise.all([getBoards(), getHomepagePosts(), getZones()])

  const boardUrls = boards.map((board) => ({
    url: toAbsoluteSiteUrl(`/boards/${board.slug}`),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }))

  const zoneUrls = zones.map((zone) => ({
    url: toAbsoluteSiteUrl(`/zones/${zone.slug}`),
    changeFrequency: "daily" as const,
    priority: 0.85,
  }))

  const postUrls = posts.map((post) => ({
    url: toAbsoluteSiteUrl(getPostPath(post)),
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }))


  return [
    {
      url: toAbsoluteSiteUrl("/"),
      changeFrequency: "daily",
      priority: 1,
    },

    ...zoneUrls,
    ...boardUrls,
    ...postUrls,
  ]
}

