"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { ChevronUp, MessageSquareMore, Send, SmilePlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import { EMOJI_OPTIONS } from "@/lib/emoji"
import { cn } from "@/lib/utils"
import type { MessageBubbleItem, MessageConversationDetail, MessageSendResult } from "@/lib/message-types"

interface MessageThreadPanelProps {
  conversation: MessageConversationDetail | null
  currentUserId: number
  usingDemoData: boolean
  onMessageSent: (message: MessageBubbleItem) => void
  onLoadHistory: () => void
  loadingHistory: boolean
  historyError: string
}

export function MessageThreadPanel({ conversation, currentUserId, usingDemoData, onMessageSent, onLoadHistory, loadingHistory, historyError }: MessageThreadPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const threadRef = useRef<HTMLDivElement | null>(null)
  const shouldStickToBottomRef = useRef(true)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState("")
  const [showEmojiPanel, setShowEmojiPanel] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setDraft("")
    setError("")
    setShowEmojiPanel(false)
    shouldStickToBottomRef.current = true
  }, [conversation?.id])

  useEffect(() => {
    if (!conversation?.id) {
      return
    }

    textareaRef.current?.focus()
  }, [conversation?.id])

  useEffect(() => {
    const container = threadRef.current
    if (!container || !shouldStickToBottomRef.current) {
      return
    }

    container.scrollTop = container.scrollHeight
  }, [conversation?.messages])

  const recipient = useMemo(() => {
    if (conversation?.recipientId) {
      return conversation.participants.find((item) => item.id === conversation.recipientId)
    }

    return conversation?.participants.find((item) => item.id !== currentUserId)
  }, [conversation, currentUserId])

  function insertEmoji(emoji: string) {
    const element = textareaRef.current

    if (!element) {
      setDraft((current) => `${current}${emoji}`)
      setShowEmojiPanel(false)
      return
    }

    const selectionStart = element.selectionStart
    const selectionEnd = element.selectionEnd
    const nextDraft = `${draft.slice(0, selectionStart)}${emoji}${draft.slice(selectionEnd)}`

    setDraft(nextDraft)
    setShowEmojiPanel(false)

    requestAnimationFrame(() => {
      element.focus()
      const nextCursor = selectionStart + emoji.length
      element.setSelectionRange(nextCursor, nextCursor)
    })
  }

  async function handleSend() {
    if (!conversation || !recipient) {
      return
    }

    const content = draft.trim()
    if (!content) {
      setError("请输入消息内容")
      return
    }

    if (usingDemoData) {
      setError("当前会话尚未完成数据库接入")
      return
    }

    setError("")
    shouldStickToBottomRef.current = true

    startTransition(async () => {
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipientId: recipient.id, body: content }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok || payload?.code !== 0) {
        setError(payload?.message ?? "发送失败")
        return
      }

      const result = payload?.data as MessageSendResult | undefined

      if (result) {
        onMessageSent({
          id: result.id,
          body: result.content,
          createdAt: result.createdAt,
          senderId: currentUserId,
          senderName: "我",
          senderAvatarPath: null,
          isMine: true,
        })
      }

      setDraft("")
      setShowEmojiPanel(false)
    })
  }

  async function handleLoadMore() {
    if (!conversation?.hasMoreHistory || loadingHistory) {
      return
    }

    shouldStickToBottomRef.current = false
    await onLoadHistory()
  }

  if (!conversation || !recipient) {
    return (
      <div className="flex min-h-[calc(100vh-164px)] items-center justify-center rounded-[28px] border border-dashed border-border bg-card px-6 text-center shadow-soft">
        <div>
          <MessageSquareMore className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm uppercase tracking-[0.28em] text-muted-foreground">Chat Thread</p>
          <h2 className="mt-3 text-2xl font-semibold">还没有私信会话</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">去用户主页点击“发私信”，或从现有会话列表中选择一个联系人，系统会直接创建真实数据库会话。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex max-h-[calc(100vh-164px)] min-h-[calc(100vh-164px)] flex-col overflow-hidden rounded-[28px] border border-border bg-card shadow-soft">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-4">
          <UserAvatar name={recipient.displayName} avatarPath={recipient.avatarPath} size="md" />
          <div>
            <h2 className="text-[17px] font-semibold">{conversation.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{conversation.subtitle}</p>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>最近更新</p>
          <p className="mt-1">{conversation.updatedAt}</p>
        </div>
      </div>

      <div ref={threadRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4.5">
        {conversation.hasMoreHistory ? (
          <div className="flex justify-center">
            <Button type="button" variant="outline" className="rounded-full" onClick={handleLoadMore} disabled={loadingHistory}>
              <ChevronUp className="mr-2 h-4 w-4" />
              {loadingHistory ? "加载中..." : "加载历史消息"}
            </Button>
          </div>
        ) : null}

        {historyError ? <p className="rounded-[18px] bg-rose-50 px-4 py-3 text-sm text-rose-700">{historyError}</p> : null}

        {conversation.messages.length === 0 ? (
          <div className="flex h-full min-h-[220px] items-center justify-center rounded-[22px] border border-dashed border-border bg-card/80 px-6 text-center dark:bg-secondary/30">
            <div>
              <p className="text-sm font-medium">还没有聊天记录</p>
            </div>
          </div>
        ) : null}

        {conversation.messages.map((message) => (
          <div key={message.id} className={cn("flex gap-3", message.isMine ? "justify-end" : "justify-start")}>
            {!message.isMine ? <UserAvatar name={message.senderName} avatarPath={message.senderAvatarPath} size="sm" /> : null}
            <div className={cn("max-w-[76%]", message.isMine ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "rounded-[22px] px-4 py-3 text-sm leading-7 shadow-sm",
                  message.isMine
                    ? "rounded-br-md bg-foreground text-background dark:bg-primary dark:text-primary-foreground"
                    : "rounded-bl-md border border-border bg-card text-foreground dark:bg-secondary/70 dark:text-foreground",
                )}
              >
                {message.body}
              </div>
              <p className={cn("mt-2 text-xs text-muted-foreground", message.isMine ? "text-right" : "text-left")}>{message.createdAt}</p>
            </div>
            {message.isMine ? <UserAvatar name={message.senderName} avatarPath={message.senderAvatarPath} size="sm" /> : null}
          </div>
        ))}
      </div>

      <div className="border-t border-border px-5 py-3.5">
        {usingDemoData ? <p className="mb-3 rounded-[18px] bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">当前会话尚未完成数据库接入。</p> : null}
        {error ? <p className="mb-3 rounded-[18px] bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</p> : null}
        <div className="rounded-[24px] border border-border bg-background px-4 py-3">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            placeholder="输入消息，按发送投递给对方"
            className="w-full resize-none border-none bg-transparent text-sm leading-7 outline-none placeholder:text-muted-foreground"
          />
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
            <div className="relative flex items-center gap-2 text-xs text-muted-foreground">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent"
                onClick={() => setShowEmojiPanel((current) => !current)}
              >
                <SmilePlus className="h-4 w-4" />
                <span>表情</span>
              </button>
              {showEmojiPanel ? (
                <div className="absolute bottom-[calc(100%+12px)] left-0 z-20 w-[260px] rounded-2xl border border-border bg-background p-3 shadow-2xl">
                  <div className="mb-2 text-xs text-muted-foreground">选择一个表情</div>
                  <div className="grid grid-cols-5 gap-2">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji.value}
                        type="button"
                        className="rounded-xl bg-secondary/40 px-3 py-2 text-lg transition hover:bg-accent"
                        onClick={() => insertEmoji(emoji.value)}
                      >
                        {emoji.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <Button type="button" className="h-10 rounded-full px-5" onClick={handleSend} disabled={isPending}>
              <Send className="mr-2 h-4 w-4" />
              {isPending ? "发送中..." : "发送消息"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
