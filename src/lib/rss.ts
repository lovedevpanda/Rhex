import { findBoardRssPosts, findRssPosts, RSS_POST_LIMIT, type RssPostRecord, findTagRssPosts, findUserRssPosts, findZoneRssPosts } from "@/db/rss-queries"
import { getAnonymousMaskDisplayIdentity } from "@/lib/post-anonymous"
import { getCanonicalPostPath } from "@/lib/post-links"
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

interface RssFeedChannel {
  title: string
  link: string
  description: string
  feedPath: string
}

interface RssFeedSource {
  channel: RssFeedChannel
  posts: RssPostRecord[]
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

async function buildRssItems(posts: RssPostRecord[]): Promise<RssFeedItem[]> {
  const anonymousMaskIdentity = await getAnonymousMaskDisplayIdentity()

  return Promise.all(posts.map(async (post) => {
    const author = post.isAnonymous
      ? (anonymousMaskIdentity?.name ?? anonymousMaskIdentity?.username ?? "匿名用户")
      : getUserDisplayName(post.author)
    const link = await toAbsoluteSiteUrl(getCanonicalPostPath(post))
    const publishedAt = post.publishedAt ?? post.createdAt

    return {
      title: normalizeText(post.title),
      link,
      guid: link,
      description: buildDescription(post.summary, post.content),
      author,
      category: normalizeText(post.board.name),
      pubDate: formatRssDate(publishedAt),
    }
  }))
}

async function buildDefaultChannel(): Promise<RssFeedChannel> {
  const settings = await getSiteSettings()

  return {
    title: normalizeText(settings.siteName),
    link: await toAbsoluteSiteUrl("/"),
    description: normalizeText(settings.siteDescription || settings.siteSlogan || settings.siteName),
    feedPath: "/rss.xml",
  }
}

export async function getRssFeedUrl() {
  return toAbsoluteSiteUrl("/rss.xml")
}

async function generateRssXmlBySource(sourcePromise: Promise<RssFeedSource>) {
  await resolveSiteOrigin()
  const source = await sourcePromise
  const items = await buildRssItems(source.posts)
  const feedUrl = await toAbsoluteSiteUrl(source.channel.feedPath)
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
    "  <channel>",
    `    <title>${escapeXml(source.channel.title)}</title>`,
    `    <link>${escapeXml(source.channel.link)}</link>`,
    `    <description>${escapeXml(source.channel.description)}</description>`,
    "    <language>zh-cn</language>",
    "    <generator>Next.js</generator>",
    `    <lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    itemXml,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n")
}

export async function generateRssXml() {
  return generateRssXmlBySource((async () => {
    const [channel, posts] = await Promise.all([
      buildDefaultChannel(),
      findRssPosts(RSS_POST_LIMIT),
    ])

    return {
      channel,
      posts,
    }
  })())
}

export async function generateZoneRssXml(zone: { slug: string; name: string; description?: string | null }) {
  return generateRssXmlBySource((async () => {
    const [settings, posts] = await Promise.all([
      getSiteSettings(),
      findZoneRssPosts(zone.slug, RSS_POST_LIMIT),
    ])

    return {
      channel: {
        title: `${normalizeText(zone.name)} - ${normalizeText(settings.siteName)}`,
        link: await toAbsoluteSiteUrl(`/zones/${encodeURIComponent(zone.slug)}`),
        description: normalizeText(zone.description || `${zone.name} 分区最新帖子订阅`),
        feedPath: `/zones/${encodeURIComponent(zone.slug)}/rss.xml`,
      },
      posts,
    }
  })())
}

export async function generateBoardRssXml(board: { slug: string; name: string; description?: string | null }) {
  return generateRssXmlBySource((async () => {
    const [settings, posts] = await Promise.all([
      getSiteSettings(),
      findBoardRssPosts(board.slug, RSS_POST_LIMIT),
    ])

    return {
      channel: {
        title: `${normalizeText(board.name)} - ${normalizeText(settings.siteName)}`,
        link: await toAbsoluteSiteUrl(`/boards/${encodeURIComponent(board.slug)}`),
        description: normalizeText(board.description || `${board.name} 节点最新帖子订阅`),
        feedPath: `/boards/${encodeURIComponent(board.slug)}/rss.xml`,
      },
      posts,
    }
  })())
}

export async function generateUserRssXml(user: { username: string; displayName?: string; bio?: string | null }) {
  return generateRssXmlBySource((async () => {
    const [settings, posts] = await Promise.all([
      getSiteSettings(),
      findUserRssPosts(user.username, RSS_POST_LIMIT),
    ])
    const displayName = normalizeText(user.displayName || user.username)

    return {
      channel: {
        title: `${displayName} - ${normalizeText(settings.siteName)}`,
        link: await toAbsoluteSiteUrl(`/users/${encodeURIComponent(user.username)}`),
        description: normalizeText(user.bio || `${displayName} 发布的最新帖子订阅`),
        feedPath: `/users/${encodeURIComponent(user.username)}/rss.xml`,
      },
      posts,
    }
  })())
}

export async function generateTagRssXml(tag: { slug: string; name: string; description?: string | null }) {
  return generateRssXmlBySource((async () => {
    const [settings, posts] = await Promise.all([
      getSiteSettings(),
      findTagRssPosts(tag.slug, RSS_POST_LIMIT),
    ])

    return {
      channel: {
        title: `#${normalizeText(tag.name)} - ${normalizeText(settings.siteName)}`,
        link: await toAbsoluteSiteUrl(`/tags/${encodeURIComponent(tag.slug)}`),
        description: normalizeText(tag.description || `标签 ${tag.name} 下的最新帖子订阅`),
        feedPath: `/tags/${encodeURIComponent(tag.slug)}/rss.xml`,
      },
      posts,
    }
  })())
}


