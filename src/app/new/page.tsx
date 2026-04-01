import type { Metadata } from "next"

import { generateHomeFeedMetadata, HomeFeedPage } from "@/app/home-feed-page"

export async function generateMetadata(): Promise<Metadata> {
  return generateHomeFeedMetadata("new")
}

export default function NewFeedPage(props: PageProps<"/new">) {
  return <HomeFeedPage sort="new" searchParams={props.searchParams} />
}
