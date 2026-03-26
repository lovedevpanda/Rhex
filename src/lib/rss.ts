import { findRssPosts, RSS_POST_LIMIT } from "@/db/rss-queries"
import { getPostPath } from "@/lib/post-links"
import { getPublicPostContentText } from "@/lib/post-content"
import { getSiteSettings } from "@/lib/site-settings"
import { resolveSiteOrigin, toAbsoluteSiteUrl } from "@/lib/site-origin"
import { getUserDisplayName } from "@/lib/users"


interface RssFeedItem {
  title: string
  link: string
  guid: string
  description: string
  author: string
  category: string
  pubDate: string
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function wrapCdata(value: string) {
  return `<![CDATA[${value.replace(/]]>/g, "]]><![CDATA[>") }]]>`
}


function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .trim()
}

function buildDescription(summary: string | null, content: string) {
  const normalizedSummary = normalizeText(summary)
  if (normalizedSummary) {
    return normalizedSummary
  }

  return normalizeText(getPublicPostContentText(content))
    .replace(/\s+/g, " ")
    .slice(0, 200)
}



function formatRssDate(value: Date | string) {
  return new Date(value).toUTCString()
}

async function buildRssItems(): Promise<RssFeedItem[]> {
  const posts = await findRssPosts(RSS_POST_LIMIT)


  return posts.map((post) => {
    const author = getUserDisplayName(post.author)
    const link = toAbsoluteSiteUrl(getPostPath(post))

    const publishedAt = post.publishedAt ?? post.createdAt

    return {
      title: normalizeText(post.title),
      link,
      guid: `${link}#${post.id}`,
      description: buildDescription(post.summary, post.content),
      author,
      category: normalizeText(post.board.name),
      pubDate: formatRssDate(publishedAt),
    }
  })
}

export async function getRssFeedUrl() {
  return toAbsoluteSiteUrl("/rss.xml")
}

export async function generateRssXml() {
  resolveSiteOrigin()
  const [settings, items] = await Promise.all([getSiteSettings(), buildRssItems()])

  const feedUrl = toAbsoluteSiteUrl("/rss.xml")
  const siteUrl = toAbsoluteSiteUrl("/")

  const lastBuildDate = items[0]?.pubDate ?? new Date().toUTCString()

  const itemXml = items
    .map((item) => [
      "    <item>",
      `      <title>${escapeXml(item.title)}</title>`,
      `      <link>${escapeXml(item.link)}</link>`,
      `      <guid isPermaLink=\"true\">${escapeXml(item.guid)}</guid>`,
      `      <description>${wrapCdata(item.description)}</description>`,
      `      <dc:creator>${wrapCdata(item.author)}</dc:creator>`,
      `      <category>${wrapCdata(item.category)}</category>`,
      `      <pubDate>${escapeXml(item.pubDate)}</pubDate>`,
      "    </item>",
    ].join("\n"))
    .join("\n")


  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '  <channel>',
    `    <title>${escapeXml(normalizeText(settings.siteName))}</title>`,
    `    <link>${escapeXml(siteUrl)}</link>`,
    `    <description>${escapeXml(normalizeText(settings.siteDescription || settings.siteSlogan || settings.siteName))}</description>`,
    '    <language>zh-cn</language>',
    '    <generator>Next.js</generator>',
    `    <lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    itemXml,
    '  </channel>',
    '</rss>',
    '',
  ].join("\n")
}

