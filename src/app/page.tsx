import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { generateHomeFeedMetadata, HomeFeedPage } from "@/app/home-feed-page"
import { buildHomeFeedHref, normalizeHomeFeedSort, parseHomeFeedPage } from "@/lib/home-feed-route"
import { readSearchParam } from "@/lib/search-params"

export async function generateMetadata(): Promise<Metadata> {
  return generateHomeFeedMetadata("latest")
}

export default async function HomePage(props: PageProps<"/">) {
  const searchParams = await props.searchParams
  const rawSort = readSearchParam(searchParams?.sort)
  const rawPage = readSearchParam(searchParams?.page)

  if (rawSort !== undefined || rawPage !== undefined) {
    redirect(buildHomeFeedHref(normalizeHomeFeedSort(rawSort), parseHomeFeedPage(rawPage)))
  }

  return <HomeFeedPage sort="latest" />
}



