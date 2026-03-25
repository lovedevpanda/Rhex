import type { MetadataRoute } from "next"

import { getBoards } from "@/lib/boards"
import { getPostPath } from "@/lib/post-links"
import { getHomepagePosts } from "@/lib/posts"
import { getZones } from "@/lib/zones"


export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [boards, posts, zones] = await Promise.all([getBoards(), getHomepagePosts(), getZones()])

  const boardUrls = boards.map((board) => ({
    url: `/boards/${board.slug}`,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }))

  const zoneUrls = zones.map((zone) => ({
    url: `/zones/${zone.slug}`,
    changeFrequency: "daily" as const,
    priority: 0.85,
  }))

  const postUrls = posts.map((post) => ({
    url: getPostPath(post),
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }))


  return [
    {
      url: "/",
      changeFrequency: "daily",
      priority: 1,
    },
    ...zoneUrls,
    ...boardUrls,
    ...postUrls,
  ]
}

