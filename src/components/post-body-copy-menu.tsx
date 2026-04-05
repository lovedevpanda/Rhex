"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Copy, Ellipsis, Flag } from "lucide-react"

import { ReportDialog } from "@/components/report-dialog"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

interface PostBodyCopyMenuProps {
  copyPath: string
  canReport?: boolean
  reportTargetId?: string
  reportLabel?: string
  children: ReactNode
}

export function PostBodyCopyMenu({ copyPath, canReport = false, reportTargetId, reportLabel = "当前帖子", children }: PostBodyCopyMenuProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const copyLink = useMemo(() => {
    if (typeof window === "undefined") {
      return copyPath
    }

    return `${window.location.origin}${copyPath}`
  }, [copyPath])

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(copyLink)
      toast.success("已复制帖子链接", "复制成功")
      setIsMenuOpen(false)
    } catch {
      toast.error("复制失败，请手动复制", "复制失败")
    }
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        setIsMenuOpen(false)
      }}
    >
      <div
        className={cn(
          "absolute right-4 top-4 z-20 flex items-start gap-2 transition-opacity duration-150",
          isHovered ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {isMenuOpen ? (
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-accent"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>复制链接</span>
            </button>
            {canReport && reportTargetId ? (
              <ReportDialog
                targetType="POST"
                targetId={reportTargetId}
                targetLabel={reportLabel}
                buttonText="举报帖子"
                icon={<Flag className="h-3.5 w-3.5" />}
                showLabelWithIcon
                buttonClassName="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-accent"
              />
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          aria-label="帖子操作"
          title="帖子操作"
          onClick={() => setIsMenuOpen((current) => !current)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/95 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-accent hover:text-foreground"
        >
          <Ellipsis className="h-4 w-4" />
        </button>
      </div>

      {children}
    </div>
  )
}
