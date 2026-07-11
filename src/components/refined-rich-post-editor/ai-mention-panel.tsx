"use client"

import { useEffect, useMemo, useState } from "react"
import { Bot, Loader2, UserRound } from "lucide-react"

import { cn } from "@/lib/utils"

export type MentionChoice = {
  kind: "bot" | "staff" | "user"
  id: number
  label: string
  displayName: string
  username: string
  nickname: string | null
  roleLabel?: string | null
}

export type MentionSearchResponse = {
  bots: MentionChoice[]
  staff: MentionChoice[]
  users: MentionChoice[]
}

export type ActiveMentionQuery = {
  start: number
  end: number
  query: string
}

export type MentionPanelPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
}

type AiMentionPanelProps = {
  open: boolean
  query: string
  position: MentionPanelPosition | null
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  onChoicesChange: (choices: MentionChoice[]) => void
  onSelect: (choice: MentionChoice) => void
  onClose: () => void
}

const DEFAULT_MENTION_DATA: MentionSearchResponse = {
  bots: [],
  staff: [],
  users: [],
}

const MENTION_BOUNDARY_PATTERN = /(^|[\s\p{P}\p{S}])@([^\s@]{0,40})$/u

export function findActiveMentionQuery(value: string, selectionStart: number, selectionEnd: number): ActiveMentionQuery | null {
  if (selectionStart !== selectionEnd) {
    return null
  }

  const lineStart = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1
  const beforeCursor = value.slice(lineStart, selectionStart)
  const match = beforeCursor.match(MENTION_BOUNDARY_PATTERN)
  if (!match) {
    return null
  }

  const query = match[2] ?? ""
  const start = selectionStart - query.length - 1
  return {
    start,
    end: selectionStart,
    query,
  }
}

function getMentionChoices(data: MentionSearchResponse, query: string) {
  return query.trim()
    ? data.users
    : [...data.bots, ...data.staff, ...data.users]
}

function getMentionChoiceKey(choice: MentionChoice) {
  return `${choice.kind}:${choice.id}`
}

export function buildMentionInsertText(choice: MentionChoice) {
  return `@${choice.nickname?.trim() || choice.username} `
}

export function AiMentionPanel(props: AiMentionPanelProps) {
  if (!props.open) {
    return null
  }

  return <AiMentionPanelContent key={props.query} {...props} />
}

function AiMentionPanelContent({
  open,
  query,
  position,
  activeIndex,
  onActiveIndexChange,
  onChoicesChange,
  onSelect,
  onClose,
}: AiMentionPanelProps) {
  const [data, setData] = useState<MentionSearchResponse>(DEFAULT_MENTION_DATA)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      setMessage("")
      fetch(`/api/mentions/search?q=${encodeURIComponent(query)}`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const result = await response.json()
          if (!response.ok || !result?.data) {
            throw new Error(result?.message ?? "加载失败")
          }

          setData({
            bots: Array.isArray(result.data.bots) ? result.data.bots : [],
            staff: Array.isArray(result.data.staff) ? result.data.staff : [],
            users: Array.isArray(result.data.users) ? result.data.users : [],
          })
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            return
          }
          setData(DEFAULT_MENTION_DATA)
          setMessage(error instanceof Error ? error.message : "加载失败")
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false)
          }
        })
    }, query ? 220 : 0)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, query])

  const choices = useMemo(() => getMentionChoices(data, query), [data, query])

  useEffect(() => {
    onChoicesChange(choices)
  }, [choices, onChoicesChange])

  useEffect(() => {
    if (!open) {
      return
    }

    if (choices.length === 0) {
      onActiveIndexChange(0)
      return
    }

    if (activeIndex < 0 || activeIndex >= choices.length) {
      onActiveIndexChange(0)
    }
  }, [activeIndex, choices.length, onActiveIndexChange, open])

  if (!open || !position) {
    return null
  }

  const emptyText = query.trim()
    ? "没有匹配的用户"
    : "暂无可快捷 @ 的机器人或管理成员"

  return (
    <div
      ref={(node) => {
        if (!node) {
          return
        }

        node.dataset.mentionPanel = "true"
      }}
      className="fixed z-[230] flex flex-col gap-2 rounded-lg bg-popover p-2 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight: position.maxHeight,
      }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="flex items-center justify-between gap-3 px-2 py-1">
        <span className="text-xs font-medium text-muted-foreground">
          {query.trim() ? `搜索：${query}` : "默认 @ 推荐"}
        </span>
        {loading ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="animate-spin" />
            加载中
          </span>
        ) : null}
      </div>

      <div className="min-h-0 overflow-y-auto">
        {choices.length > 0 ? (
          <div className="flex flex-col gap-1">
            {choices.map((choice, index) => (
              <button
                key={getMentionChoiceKey(choice)}
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted",
                  index === activeIndex && "bg-muted",
                )}
                onMouseEnter={() => onActiveIndexChange(index)}
                onClick={() => onSelect(choice)}
              >
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border [&_svg]:size-4">
                  {choice.kind === "bot" ? <Bot /> : <UserRound />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">{choice.label}</span>
                    {choice.roleLabel ? <span className="shrink-0 text-xs text-muted-foreground">{choice.roleLabel}</span> : null}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">@{choice.username}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            {loading ? "正在搜索..." : message || emptyText}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-2 pt-2 text-xs text-muted-foreground">
        <span>Enter 选择，Esc 关闭</span>
        <button type="button" className="hover:text-foreground" onClick={onClose}>关闭</button>
      </div>
    </div>
  )
}
