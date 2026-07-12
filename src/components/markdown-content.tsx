import { MarkdownContentClient } from "@/components/markdown-content-client"
import { isImageOnlyMarkdownHtml, renderMarkdown } from "@/lib/markdown/render"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import type { PostContentImageMode } from "@/lib/theme"

interface MarkdownContentProps {
  content: string
  html?: string
  className?: string
  emptyText?: string
  markdownEmojiMap?: MarkdownEmojiItem[]
  expandImagesWhenImageOnly?: boolean
  imageDisplayMode?: PostContentImageMode
  imageOnly?: boolean
  collapseLongCodeBlocks?: boolean
}

export function MarkdownContent({ content, html, className, emptyText, markdownEmojiMap = [], expandImagesWhenImageOnly = false, imageDisplayMode = "auto", imageOnly, collapseLongCodeBlocks = false }: MarkdownContentProps) {
  const normalized = content.replace(/\r\n/g, "\n").trim()
  const resolvedHtml = typeof html === "string" ? html : (normalized ? renderMarkdown(normalized, markdownEmojiMap) : "")
  const resolvedImageOnly = expandImagesWhenImageOnly
    ? (typeof imageOnly === "boolean" ? imageOnly : isImageOnlyMarkdownHtml(resolvedHtml))
    : false

  return (
    <MarkdownContentClient
      content={content}
      html={resolvedHtml}
      className={className}
      emptyText={emptyText}
      markdownEmojiMap={markdownEmojiMap}
      expandImagesWhenImageOnly={expandImagesWhenImageOnly}
      imageDisplayMode={imageDisplayMode}
      imageOnly={resolvedImageOnly}
      collapseLongCodeBlocks={collapseLongCodeBlocks}
    />
  )
}
