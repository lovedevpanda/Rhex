import type { Metadata } from "next"

import { generateHomeFeedMetadata, HomeFeedPage } from "@/app/home-feed-page"

export const revalidate = 30

interface HomeFeedPageRouteProps {
  params: Promise<{ page: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  return generateHomeFeedMetadata("featured")
}

export default async function FeaturedFeedPageRoute(
  props: HomeFeedPageRouteProps,
) {
  const params = await props.params

  return <HomeFeedPage sort="featured" page={params.page} />
}
