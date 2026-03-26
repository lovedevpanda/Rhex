import { generateRssXml } from "@/lib/rss"

export const dynamic = "force-dynamic"

export async function GET() {
  const xml = await generateRssXml()

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  })
}
