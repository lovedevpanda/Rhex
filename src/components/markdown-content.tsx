"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

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

interface LightboxState {
  images: LightboxImage[]
  index: number
}

interface LightboxPortalProps {
  lightbox: LightboxState
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}

function LightboxPortal({ lightbox, onClose, onPrev, onNext }: LightboxPortalProps) {
  const touchStartX = useRef<number | null>(null)
  const current = lightbox.images[lightbox.index]!
  const hasPrev = lightbox.index > 0
  const hasNext = lightbox.index < lightbox.images.length - 1
  const isMultiple = lightbox.images.length > 1

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null
  }

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current
    touchStartX.current = null
    if (Math.abs(delta) < 50) return
    if (delta > 0 && hasPrev) onPrev()
    else if (delta < 0 && hasNext) onNext()
  }

  return (
    <div
      key={current.src}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        type="button"
        className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-opacity hover:opacity-80 sm:right-4 sm:top-4 sm:h-10 sm:w-10"
        onClick={(event) => { event.stopPropagation(); onClose() }}
        aria-label="关闭图片预览"
      >
        <X className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>

      {hasPrev && (
        <button
          type="button"
          className="absolute bottom-4 left-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-opacity hover:opacity-80 sm:bottom-auto sm:left-4 sm:top-1/2 sm:h-10 sm:w-10 sm:-translate-y-1/2"
          onClick={(event) => { event.stopPropagation(); onPrev() }}
          aria-label="上一张"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {hasNext && (
        <button
          type="button"
          className="absolute bottom-4 right-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-opacity hover:opacity-80 sm:bottom-auto sm:right-4 sm:top-1/2 sm:h-10 sm:w-10 sm:-translate-y-1/2"
          onClick={(event) => { event.stopPropagation(); onNext() }}
          aria-label="下一张"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      <div
        className="relative h-full w-full sm:h-[90vh] sm:w-[90vw] sm:max-w-[1400px]"
        onClick={(event) => event.stopPropagation()}
      >
        <Image
          src={current.src}
          alt={current.alt}
          fill
          unoptimized
          className="object-contain sm:rounded-2xl sm:shadow-2xl"
          sizes="100vw"
        />
      </div>

      {isMultiple && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs text-white/80 backdrop-blur-sm sm:bottom-4 sm:text-sm">
          {lightbox.index + 1} / {lightbox.images.length}
        </div>
      )}
    </div>
  )
}

export function MarkdownContent({ content, className, emptyText, markdownEmojiMap }: MarkdownContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const normalized = content.replace(/\r\n/g, "\n").trim()
  const resolvedMarkdownEmojiMap = useMarkdownEmojiMap(markdownEmojiMap)
  const html = useMemo(() => (normalized ? renderMarkdown(normalized, resolvedMarkdownEmojiMap) : ""), [normalized, resolvedMarkdownEmojiMap])

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

      removeImageLightbox = bindImageLightbox(container, (images, index) => {
        setLightbox({ images, index })
      })
    })

    return () => {
      cancelled = true
      removeBase64Inspector()
      removeBrokenImagePlaceholders()
      removeImageLightbox()
    }
  }, [html])

  useEffect(() => {
    if (!lightbox) {
      return
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightbox(null)
      } else if (event.key === "ArrowLeft") {
        setLightbox((previous) => previous && previous.index > 0 ? { ...previous, index: previous.index - 1 } : previous)
      } else if (event.key === "ArrowRight") {
        setLightbox((previous) => previous && previous.index < previous.images.length - 1 ? { ...previous, index: previous.index + 1 } : previous)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [lightbox])

  if (!normalized) {
    return emptyText ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null
  }

  return (
    <>
      <div
        ref={containerRef}
        className={cn("markdown-body prose prose-sm max-w-none prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1", className)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {lightbox ? createPortal(
        <LightboxPortal
          lightbox={lightbox}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox((previous) => previous && previous.index > 0 ? { ...previous, index: previous.index - 1 } : previous)}
          onNext={() => setLightbox((previous) => previous && previous.index < previous.images.length - 1 ? { ...previous, index: previous.index + 1 } : previous)}
        />,
        document.body,
      ) : null}
    </>
  )
}
