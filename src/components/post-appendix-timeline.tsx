import { Clock3, PenLine } from "lucide-react"

import { MarkdownContent } from "@/components/markdown-content"
import { Card, CardContent } from "@/components/ui/card"
import { formatRelativeTime } from "@/lib/formatters"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"

interface PostAppendixTimelineProps {
  appendices: Array<{
    id: string
    floor: number
    content: string
    createdAt: string
  }>
  markdownEmojiMap?: MarkdownEmojiItem[]
}

export function PostAppendixTimeline({ appendices, markdownEmojiMap }: PostAppendixTimelineProps) {
  if (appendices.length === 0) {
    return null
  }

  return (
    <Card className="rounded-t-none border-t-0">
      <CardContent className="px-4 pb-4 pt-5 sm:px-6 sm:pb-6 md:px-8">
        <div className="space-y-1">
          {appendices.map((appendix, index) => (
            <section key={appendix.id} className="relative pl-7 pb-5 last:pb-0">
              {index < appendices.length - 1 ? <span aria-hidden="true" className="absolute left-[11px] top-8 bottom-0 w-px bg-border/80" /> : null}
              <span aria-hidden="true" className="absolute left-0 top-1 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-accent text-muted-foreground">
                <PenLine className="h-3.5 w-3.5" />
              </span>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 font-semibold text-foreground/90">
                  <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                  第 {appendix.floor} 条附言
                </span>
                <span>·</span>
                <span>{formatRelativeTime(appendix.createdAt)}</span>
              </div>
              <div className="mt-2">
                <MarkdownContent
                  content={appendix.content}
                  className="text-[14px] leading-7 tracking-[0.015em] text-muted-foreground dark:text-muted-foreground/90"
                  markdownEmojiMap={markdownEmojiMap}
                />
              </div>
            </section>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
