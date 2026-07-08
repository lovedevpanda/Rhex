import type { Metadata } from "next"

import { generateHomeFeedMetadata, HomeFeedPage } from "@/app/home-feed-page"

export const revalidate = 30

export async function generateMetadata(): Promise<Metadata> {
  return generateHomeFeedMetadata("featured")
}

export default function FeaturedFeedPage() {
  return <HomeFeedPage sort="featured" />
}
