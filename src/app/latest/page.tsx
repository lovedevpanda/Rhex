import type { Metadata } from "next"

import { generateHomeFeedMetadata, HomeFeedPage } from "@/app/home-feed-page"

export async function generateMetadata(): Promise<Metadata> {
  return generateHomeFeedMetadata("latest")
}

export default function LatestFeedPage(props: PageProps<"/latest">) {
  return <HomeFeedPage sort="latest" searchParams={props.searchParams} />
}
