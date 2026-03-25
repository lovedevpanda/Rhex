import { redirect } from "next/navigation"

interface PointsPageProps {
  searchParams?: {
    page?: string
  }
}

export default function PointsPage({ searchParams }: PointsPageProps) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1)
  redirect(`/settings?tab=points&page=${page}`)
}
