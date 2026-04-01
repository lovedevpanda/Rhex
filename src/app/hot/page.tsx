import type { Metadata } from "next"

import { generateHomeFeedMetadata, HomeFeedPage } from "@/app/home-feed-page"

export async function generateMetadata(): Promise<Metadata> {
  return generateHomeFeedMetadata("hot")
}

export default function HotFeedPage(props: PageProps<"/hot">) {
  return <HomeFeedPage sort="hot" searchParams={props.searchParams} />
}
