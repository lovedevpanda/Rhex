"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Trash2 } from "lucide-react"

import { UserAvatar } from "@/components/user-avatar"
import { cn } from "@/lib/utils"
import type { MessageConversationListItem } from "@/lib/message-types"

interface MessageConversationSidebarProps {
  conversations: MessageConversationListItem[]
  activeConversationId?: string
  deletingConversationId?: string
  onDeleteConversation: (conversationId: string) => void
}

export function MessageConversationSidebar({ conversations, activeConversationId, deletingConversationId, onDeleteConversation }: MessageConversationSidebarProps) {
  const router = useRouter()
  const listRef = useRef<HTMLDivElement | null>(null)
  const [keyword, setKeyword] = useState("")

  const filteredConversations = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()

    if (!normalized) {
      return conversations
    }

    return conversations.filter((item) => {
      return [item.title, item.subtitle, item.preview].some((value) => value.toLowerCase().includes(normalized))
    })
  }, [conversations, keyword])

  function handleSelect(conversationId: string) {
    const currentScrollTop = listRef.current?.scrollTop ?? 0
    router.push(`/messages?conversation=${conversationId}`, { scroll: false })

    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = currentScrollTop
      }
    })
  }

  return (
    <div className="flex h-full max-h-[calc(100vh-164px)] min-h-[calc(100vh-164px)] flex-col overflow-hidden rounded-[24px] border border-border bg-card shadow-soft">
      <div className="border-b border-border px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Message Center</p>
            <h2 className="mt-2 text-[22px] font-semibold">私信</h2>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">{conversations.length} 个会话</span>
        </div>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索会话"
            className="h-10 w-full rounded-full border border-border bg-background pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/20"
          />
        </div>
      </div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-2.5">
        {filteredConversations.length === 0 ? <p className="px-3 py-8 text-sm text-muted-foreground">没有匹配的会话。</p> : null}
        {filteredConversations.map((conversation) => {
          const active = conversation.id === activeConversationId
          const mainParticipant = conversation.participants.find((item) => !item.isCurrentUser) ?? conversation.participants[0]
          const isDeleting = deletingConversationId === conversation.id

          return (
            <div
              key={conversation.id}
              className={cn(
                "group flex items-start gap-3 rounded-[20px] border px-3.5 py-3.5 transition-colors",
                active ? "border-foreground/15 bg-secondary/60" : "border-transparent hover:border-border hover:bg-secondary/40",
              )}
            >
              <button type="button" onClick={() => handleSelect(conversation.id)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                <div className="relative shrink-0">
                  <UserAvatar name={mainParticipant.displayName} avatarPath={mainParticipant.avatarPath} size="md" />
                  {conversation.unreadCount > 0 ? <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}</span> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{conversation.title}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{conversation.subtitle}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{conversation.updatedAt}</span>
                  </div>
                  <p className="mt-2.5 line-clamp-2 text-sm leading-6 text-muted-foreground">{conversation.preview}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => onDeleteConversation(conversation.id)}
                disabled={isDeleting}
                className="mt-1 inline-flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60 group-hover:opacity-100"
                title="删除会话"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
