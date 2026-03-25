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

export function buildArticleJsonLd({
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
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    datePublished: publishedAt,
    author: {
      "@type": "Person",
      name: author,
    },
    mainEntityOfPage: url,
  }
}

