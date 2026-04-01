import type { Metadata } from "next"

import { generateHomeFeedMetadata, HomeFeedPage } from "@/app/home-feed-page"

export async function generateMetadata(): Promise<Metadata> {
  return generateHomeFeedMetadata("following")
}

export default function FollowingFeedPage(props: PageProps<"/following">) {
  return <HomeFeedPage sort="following" searchParams={props.searchParams} />
}
