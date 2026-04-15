"use client"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Trash2 } from "lucide-react"

import { UserAvatar } from "@/components/user/user-avatar"
import { cn } from "@/lib/utils"
import type { MessageConversationListItem } from "@/lib/message-types"

interface MessageConversationSidebarProps {
  conversations: MessageConversationListItem[]
  activeConversationId?: string
  deletingConversationId?: string
  onDeleteConversation: (conversationId: string) => void
  mobileHidden?: boolean
}

export function MessageConversationSidebar({ conversations, activeConversationId, deletingConversationId, onDeleteConversation, mobileHidden = false }: MessageConversationSidebarProps) {
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
    <div
      className={cn(
        "flex h-full max-h-[calc(100vh-164px)] min-h-[calc(100vh-164px)] flex-col overflow-hidden rounded-[24px] border border-border bg-card shadow-soft",
        "max-sm:min-h-[calc(100dvh-56px)] max-sm:max-h-[calc(100dvh-56px)] max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0 max-sm:shadow-none",
        mobileHidden ? "hidden xl:flex" : "flex",
      )}
    >
      <div className="border-b border-border px-4 py-3.5 max-sm:px-4 max-sm:pt-4 max-sm:pb-3">
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
            className="h-10 w-full rounded-full border border-border bg-background pl-10 pr-4 text-sm outline-hidden transition-colors placeholder:text-muted-foreground focus:border-foreground/20"
          />
        </div>
      </div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-2.5 max-sm:px-3 max-sm:pb-[calc(env(safe-area-inset-bottom)+12px)] max-sm:pt-3">
        {filteredConversations.length === 0 ? <p className="px-3 py-8 text-sm text-muted-foreground">没有匹配的会话。</p> : null}
        {filteredConversations.map((conversation) => {
          const active = conversation.id === activeConversationId
          const hasUnread = conversation.unreadCount > 0
          const mainParticipant = conversation.participants.find((item) => !item.isCurrentUser) ?? conversation.participants[0]
          const isDeleting = deletingConversationId === conversation.id
          const profileHref = `/users/${mainParticipant.username}`

          return (
            <div
              key={conversation.id}
              className={cn(
                "group flex items-center gap-3 rounded-[20px] border px-3.5 py-3 transition-colors",
                active
                  ? "border-foreground/15 bg-secondary/60"
                  : hasUnread
                    ? "border-emerald-200/60 bg-emerald-50/40 hover:border-emerald-200/80 hover:bg-emerald-50/55 dark:border-emerald-400/12 dark:bg-emerald-400/[0.06] dark:hover:border-emerald-400/20 dark:hover:bg-emerald-400/[0.1]"
                    : "border-transparent hover:border-border hover:bg-secondary/40",
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Link
                  href={profileHref}
                  className="relative z-10 shrink-0 rounded-2xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={`查看 ${mainParticipant.displayName} 的主页`}
                >
                  <div className="relative shrink-0">
                    <UserAvatar name={mainParticipant.displayName} avatarPath={mainParticipant.avatarPath} size="md" />
                    {conversation.unreadCount > 0 ? <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border border-background bg-rose-500 px-1 text-[10px] font-semibold text-white shadow-[0_4px_12px_rgba(244,63,94,0.22)] dark:border-card dark:bg-rose-300 dark:text-rose-950 dark:shadow-none">{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}</span> : null}
                  </div>
                </Link>
                <button type="button" onClick={() => handleSelect(conversation.id)} className="flex min-w-0 flex-1 items-center text-left">
                  <div className="min-w-0 flex-1">
                      {conversation.title}
                    <p className={cn("mt-1 truncate text-xs", hasUnread && !active ? "text-foreground/65 dark:text-foreground/60" : "text-muted-foreground")}>{conversation.updatedAt}</p>
                  </div>
                </button>
              </div>
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
