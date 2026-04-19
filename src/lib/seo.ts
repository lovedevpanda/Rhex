import { executeAddonWaterfallHook } from "@/addons-host/runtime/hooks"

export function buildMetadataKeywords(siteKeywords: string[], ...keywordGroups: Array<Array<string | null | undefined> | string | null | undefined>) {
  const normalizedGroups = keywordGroups.flatMap((group) => {
    if (Array.isArray(group)) {
      return group
    }

    return [group]
  })

  return [...siteKeywords, ...normalizedGroups]
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .filter((item, index, items) => items.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index)
}

export async function buildArticleJsonLd({
  title,
  description,
  publishedAt,
  author,
  url,
}: {
  title: string
  description: string
  publishedAt: string
  author: string
  url: string
}) {
  const [titleResult, descriptionResult] = await Promise.all([
    executeAddonWaterfallHook("seo.meta.title", title),
    executeAddonWaterfallHook("seo.meta.description", description),
  ])

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: titleResult.value,
    description: descriptionResult.value,
    datePublished: publishedAt,
    author: {
      "@type": "Person",
      name: author,
    },
    mainEntityOfPage: url,
  }
}

