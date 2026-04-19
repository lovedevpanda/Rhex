import { Code2, ExternalLink, FileArchive, FileText, Files, Music4, Video, type LucideIcon } from "lucide-react"

import { MarkdownContent } from "@/components/markdown-content"
import { splitMessageContentBlocks } from "@/lib/message-media"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import { cn } from "@/lib/utils"

function resolveMessageFilePresentation(extension: string | null): {
  icon: LucideIcon
  label: string
} {
  switch (extension) {
    case "zip":
    case "rar":
    case "7z":
    case "tar":
    case "gz":
      return {
        icon: FileArchive,
        label: "压缩文件",
      }
    case "pdf":
    case "doc":
    case "docx":
    case "txt":
    case "md":
    case "rtf":
      return {
        icon: FileText,
        label: "文档文件",
      }
    case "mp3":
    case "wav":
    case "ogg":
    case "m4a":
      return {
        icon: Music4,
        label: "音频文件",
      }
    case "mp4":
    case "mov":
    case "avi":
    case "webm":
      return {
        icon: Video,
        label: "视频文件",
      }
    case "json":
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "css":
    case "html":
    case "xml":
    case "yml":
    case "yaml":
      return {
        icon: Code2,
        label: "代码文件",
      }
    default:
      return {
        icon: Files,
        label: "通用文件",
      }
  }
}

interface MessageBubbleContentProps {
  content: string
  isMine: boolean
  markdownEmojiMap: MarkdownEmojiItem[]
}

export function MessageBubbleContent({
  content,
  isMine,
  markdownEmojiMap,
}: MessageBubbleContentProps) {
  const blocks = splitMessageContentBlocks(content)

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-2.5">
      {blocks.map((block, index) => {
        if (block.type === "markdown") {
          return (
            <MarkdownContent
              key={`markdown-${index}`}
              content={block.content}
              markdownEmojiMap={markdownEmojiMap}
              className={cn(
                "[&_p]:!my-0 [&_p]:leading-6 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0 prose-headings:my-0 prose-blockquote:my-2 prose-pre:my-2 prose-p:text-inherit prose-headings:text-inherit prose-strong:text-inherit prose-code:text-inherit prose-blockquote:text-inherit prose-li:text-inherit prose-a:text-inherit",
                isMine && "text-inherit **:text-inherit [&_.md-list]:text-inherit [&_.md-task-list_.task-list-item_label]:text-inherit [&_.md-task-list_.task-list-item:has(input[type='checkbox']:checked)]:text-inherit [&_.md-callout-title]:text-inherit",
              )}
            />
          )
        }

        const presentation = resolveMessageFilePresentation(block.extension)
        const Icon = presentation.icon

        return (
          <a
            key={`file-${block.url}-${index}`}
            href={block.url}
            download={block.name}
            className={cn(
              "flex w-72 max-w-full min-w-0 items-center gap-3 rounded-[18px] border px-3.5 py-3 text-left transition-colors",
              isMine
                ? "border-white/15 bg-white/10 text-inherit hover:bg-white/15"
                : "border-border/80 bg-background/80 text-foreground hover:bg-accent/80",
            )}
          >
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl", isMine ? "bg-white/12" : "bg-secondary text-foreground")}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{block.name}</span>
              <span className={cn("mt-1 flex items-center gap-2 text-xs", isMine ? "text-background/80 dark:text-primary-foreground/80" : "text-muted-foreground")}>
                <span>{presentation.label}</span>
                {block.extension ? <span className="rounded-full border border-current/15 px-2 py-0.5 font-medium uppercase">{block.extension}</span> : null}
              </span>
            </span>
            <ExternalLink className={cn("h-4 w-4 shrink-0", isMine ? "text-background/75 dark:text-primary-foreground/75" : "text-muted-foreground")} />
          </a>
        )
      })}
    </div>
  )
}
