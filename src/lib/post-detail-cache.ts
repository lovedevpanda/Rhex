import "server-only"

import { createHash } from "node:crypto"
import { revalidateTag, unstable_cache } from "next/cache"

import { renderAddonPostContentHtml } from "@/lib/addon-post-content-render"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"

export const POST_SEO_CACHE_TAG = "post-seo"
export const POST_RENDERED_CONTENT_CACHE_TAG = "post-rendered-content"

export const POST_DETAIL_CACHE_REVALIDATE_SECONDS = 60 * 60

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24)
}

function stableJson(value: unknown) {
  return JSON.stringify(value) ?? "null"
}

export function getPostSeoCacheTag(slug: string) {
  return `${POST_SEO_CACHE_TAG}:${digest(slug)}`
}

export function getPostRenderedContentCacheTag(postId: string) {
  return `${POST_RENDERED_CONTENT_CACHE_TAG}:${postId}`
}

function isMissingRevalidateStoreError(error: unknown) {
  return error instanceof Error
    && error.message.startsWith("Invariant: static generation store missing in revalidateTag")
}

function isRenderPhaseRevalidateError(error: unknown) {
  return error instanceof Error
    && error.message.includes('used "revalidateTag ')
    && error.message.includes("during render which is unsupported")
}

function revalidatePostDetailTag(tag: string) {
  try {
    revalidateTag(tag, { expire: 0 })
  } catch (error) {
    if (isMissingRevalidateStoreError(error) || isRenderPhaseRevalidateError(error)) {
      return
    }

    throw error
  }
}

export function revalidatePostDetailCache(input: { postId?: string | null; slug?: string | null }) {
  if (input.slug) {
    revalidatePostDetailTag(getPostSeoCacheTag(input.slug))
  }

  if (input.postId) {
    revalidatePostDetailTag(getPostRenderedContentCacheTag(input.postId))
  }
}

export async function renderCachedPostContentHtml(input: {
  postId: string
  blockId: string
  content: string
  markdownEmojiMap: MarkdownEmojiItem[]
  pathname?: string
  searchParams?: URLSearchParams | string
}) {
  const pathname = input.pathname ?? ""
  const searchParamsString = typeof input.searchParams === "string"
    ? input.searchParams
    : (input.searchParams?.toString() ?? "")
  const contentDigest = digest(input.content)
  const emojiDigest = digest(stableJson(input.markdownEmojiMap))
  const requestContextDigest = digest(`${pathname}\n${searchParamsString}`)

  return unstable_cache(
    async () => renderAddonPostContentHtml({
      content: input.content,
      markdownEmojiMap: input.markdownEmojiMap,
      pathname: pathname || undefined,
      searchParams: searchParamsString ? new URLSearchParams(searchParamsString) : undefined,
    }),
    [
      POST_RENDERED_CONTENT_CACHE_TAG,
      input.postId,
      input.blockId,
      contentDigest,
      emojiDigest,
      requestContextDigest,
    ],
    {
      tags: [POST_RENDERED_CONTENT_CACHE_TAG, getPostRenderedContentCacheTag(input.postId)],
      revalidate: POST_DETAIL_CACHE_REVALIDATE_SECONDS,
    },
  )()
}
