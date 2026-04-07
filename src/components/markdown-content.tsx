"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Lightbox, { type Slide } from "yet-another-react-lightbox"
import { Counter, Zoom,Fullscreen  } from "yet-another-react-lightbox/plugins"

import { useMarkdownEmojiMap } from "@/components/site-settings-provider"
import { bindBase64Inspector, bindBrokenImagePlaceholders, bindImageLightbox, enhanceMarkdown, type LightboxImage } from "@/lib/markdown/enhance"
import { renderMarkdown } from "@/lib/markdown/render"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import { cn } from "@/lib/utils"

interface MarkdownContentProps {
  content: string
  className?: string
  emptyText?: string
  markdownEmojiMap?: MarkdownEmojiItem[]
}

interface MarkdownBodyProps {
  html: string
  className?: string
  onOpenLightbox: (images: LightboxImage[], index: number) => void
}

interface LightboxState {
  images: LightboxImage[]
  index: number
}

interface LightboxPortalProps {
  lightbox: LightboxState
  onClose: () => void
  onChange: (index: number) => void
}

function LightboxPortal({ lightbox, onClose, onChange }: LightboxPortalProps) {
  const slides = useMemo<Slide[]>(
    () => lightbox.images.map((item) => ({ src: item.src, alt: item.alt })),
    [lightbox.images],
  )
  const render = useMemo(
    () => ({
      iconPrev: () => (
        <span className="markdown-lightbox-nav-icon" aria-hidden="true">
          <ChevronLeft size={20} strokeWidth={2.25} />
        </span>
      ),
      iconNext: () => (
        <span className="markdown-lightbox-nav-icon" aria-hidden="true">
          <ChevronRight size={20} strokeWidth={2.25} />
        </span>
      ),
    }),
    [],
  )

  return (
    <Lightbox
      className="markdown-lightbox-viewer"
      open
      close={onClose}
      index={lightbox.index}
      slides={slides}
      plugins={[Counter, Zoom,Fullscreen]}
      counter={{
        container: {
          className: "markdown-lightbox-counter",
        },
        separator: " / ",
      }}
      controller={{
        closeOnBackdropClick: true,
      }}
      carousel={{
        padding: 0,
        spacing: "12px",
      }}
      zoom={{
        maxZoomPixelRatio: 4,
        scrollToZoom: true,
      }}
      render={render}
      labels={{
        Previous: "上一张",
        Next: "下一张",
        Close: "关闭",
      }}
      on={{
        view: ({ index }) => onChange(index),
      }}
    />
  )
}

const MarkdownBody = memo(function MarkdownBody({ html, className, onOpenLightbox }: MarkdownBodyProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !html) {
      return
    }

    const removeBase64Inspector = bindBase64Inspector(container)
    const removeBrokenImagePlaceholders = bindBrokenImagePlaceholders(container)
    let removeImageLightbox = () => {}
    let cancelled = false

    void enhanceMarkdown(container).then(() => {
      if (cancelled) {
        return
      }

      removeImageLightbox = bindImageLightbox(container, onOpenLightbox)
    })

    return () => {
      cancelled = true
      removeBase64Inspector()
      removeBrokenImagePlaceholders()
      removeImageLightbox()
    }
  }, [html, onOpenLightbox])

  return (
    <div
      ref={containerRef}
      className={cn("markdown-body prose prose-sm max-w-none prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})

export function MarkdownContent({ content, className, emptyText, markdownEmojiMap }: MarkdownContentProps) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const normalized = content.replace(/\r\n/g, "\n").trim()
  const resolvedMarkdownEmojiMap = useMarkdownEmojiMap(markdownEmojiMap)
  const html = useMemo(() => (normalized ? renderMarkdown(normalized, resolvedMarkdownEmojiMap) : ""), [normalized, resolvedMarkdownEmojiMap])
  const handleOpenLightbox = useCallback((images: LightboxImage[], index: number) => {
    setLightbox({ images, index })
  }, [])

  if (!normalized) {
    return emptyText ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null
  }

  return (
    <>
      <MarkdownBody html={html} className={className} onOpenLightbox={handleOpenLightbox} />
      {lightbox ? (
        <LightboxPortal
          lightbox={lightbox}
          onClose={() => setLightbox(null)}
          onChange={(index) => setLightbox((previous) => previous ? { ...previous, index } : previous)}
        />
      ) : null}
    </>
  )
}
