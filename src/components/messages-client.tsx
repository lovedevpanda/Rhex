"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { MessageSquareMore } from "lucide-react"

import { MessageConversationSidebar } from "@/components/message-conversation-sidebar"
import { MessageThreadPanel } from "@/components/message-thread-panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { MessageBubbleItem, MessageCenterData, MessageConversationDetail, MessageHistoryResult, MessageStreamEvent } from "@/lib/message-types"

interface MessagesClientProps {
  currentUser: {
    id: number
  } | null
  initialData: MessageCenterData | null
  conversationId?: string
}

export function MessagesClient({ currentUser, initialData, conversationId }: MessagesClientProps) {
  const router = useRouter()
  const reconnectTimerRef = useRef<number | null>(null)
  const connectionStateRef = useRef<"connecting" | "connected" | "closed">("connecting")
  const [deletingConversationId, setDeletingConversationId] = useState("")
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState("")
  const [data, setData] = useState(initialData)

  useEffect(() => {
    setData(initialData)
    setHistoryError("")
    setLoadingHistory(false)
  }, [initialData])

  const activeConversationId = useMemo(() => {
    if (!data?.activeConversation) {
      return undefined
    }

    return data.activeConversation.id
  }, [data])

  function handleLocalMessageSent(message: MessageBubbleItem) {
    setData((current) => {
      if (!current?.activeConversation) {
        return current
      }

      const activeConversation: MessageConversationDetail = {
        ...current.activeConversation,
        subtitle: "实时会话",
        updatedAt: message.createdAt,
        messages: [...current.activeConversation.messages, message],
      }

      const conversations = current.conversations.map((conversation) => {
        if (conversation.id !== activeConversation.id) {
          return conversation
        }

        return {
          ...conversation,
          preview: message.body,
          updatedAt: message.createdAt,
          unreadCount: 0,
        }
      })

      return {
        ...current,
        conversations,
        activeConversation,
      }
    })
  }

  async function handleLoadHistory() {
    const currentConversation = data?.activeConversation
    const oldestMessageId = currentConversation?.messages[0]?.id

    if (!currentConversation || !oldestMessageId || loadingHistory || !currentConversation.hasMoreHistory) {
      return
    }

    setLoadingHistory(true)
    setHistoryError("")

    const response = await fetch("/api/messages/history", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversationId: currentConversation.id,
        beforeMessageId: oldestMessageId,
      }),
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok || payload?.code !== 0) {
      setHistoryError(payload?.message ?? "加载历史消息失败")
      setLoadingHistory(false)
      return
    }

    const result = payload?.data as MessageHistoryResult | undefined

    if (!result) {
      setLoadingHistory(false)
      return
    }

    setData((current) => {
      if (!current?.activeConversation || current.activeConversation.id !== currentConversation.id) {
        return current
      }

      return {
        ...current,
        activeConversation: {
          ...current.activeConversation,
          messages: [...result.messages, ...current.activeConversation.messages],
          hasMoreHistory: result.hasMoreHistory,
        },
      }
    })

    setLoadingHistory(false)
  }

  async function handleDeleteConversation(conversationIdToDelete: string) {
    setDeletingConversationId(conversationIdToDelete)

    const response = await fetch("/api/messages/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ conversationId: conversationIdToDelete }),
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok || payload?.code !== 0) {
      setDeletingConversationId("")
      return
    }

    const nextConversations = data?.conversations.filter((conversation) => conversation.id !== conversationIdToDelete) ?? []
    const nextConversationId = nextConversations[0]?.id

    setData((current) => {
      if (!current) {
        return current
      }

      const conversations = current.conversations.filter((conversation) => conversation.id !== conversationIdToDelete)
      const isDeletingActive = current.activeConversation?.id === conversationIdToDelete

      return {
        ...current,
        conversations,
        activeConversation: isDeletingActive ? null : current.activeConversation,
      }
    })

    setDeletingConversationId("")

    if (activeConversationId === conversationIdToDelete) {
      router.push(nextConversationId ? `/messages?conversation=${nextConversationId}` : "/messages", { scroll: false })
      return
    }

    router.refresh()
  }

  useEffect(() => {
    if (!currentUser || !data || data.usingDemoData) {
      connectionStateRef.current = "closed"
      return
    }

    const eventSource = new EventSource("/api/messages/stream")

    eventSource.onopen = () => {
      connectionStateRef.current = "connected"
    }

    eventSource.onmessage = (event) => {
      const payload = JSON.parse(event.data) as MessageStreamEvent

      if (payload.type === "heartbeat") {
        return
      }

      if (payload.senderId === currentUser.id) {
        return
      }

      const shouldRefresh = !conversationId || payload.conversationId === activeConversationId || payload.recipientId === currentUser.id

      if (shouldRefresh) {
        router.refresh()
      }
    }

    eventSource.onerror = () => {
      connectionStateRef.current = "connecting"
      eventSource.close()

      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
      }

      reconnectTimerRef.current = window.setTimeout(() => {
        router.refresh()
      }, 1200)
    }

    return () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
      }

      connectionStateRef.current = "closed"
      eventSource.close()
    }
  }, [activeConversationId, conversationId, currentUser, data, router])

  const isMobileThreadVisible = Boolean(data?.activeConversation)

  return (
    <main className="mx-auto max-w-[1240px] px-0 py-0 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
      {!currentUser ? (
        <Card>
          <CardHeader>
            <CardTitle>站内私信</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>请先登录后查看私信列表和聊天记录。</p>
            <Link href="/login">
              <Button className="rounded-full">前往登录</Button>
            </Link>
          </CardContent>
        </Card>
      ) : !data ? null : (
        <>
          <div className={isMobileThreadVisible ? "hidden sm:mb-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3" : "mb-4 flex flex-wrap items-center justify-between gap-3"}>
            <div>
              <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold">
                <MessageSquareMore className="h-7 w-7" />
                站内私信
              </h1>
            </div>
    
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <MessageConversationSidebar
              conversations={data.conversations}
              activeConversationId={data.activeConversation?.id}
              deletingConversationId={deletingConversationId}
              onDeleteConversation={handleDeleteConversation}
              mobileHidden={isMobileThreadVisible}
            />
            <div className={isMobileThreadVisible ? "block" : "hidden xl:block"}>
              <MessageThreadPanel
                conversation={data.activeConversation}
                currentUserId={currentUser.id}
                usingDemoData={data.usingDemoData}
                onMessageSent={handleLocalMessageSent}
                onLoadHistory={handleLoadHistory}
                loadingHistory={loadingHistory}
                historyError={historyError}
                onBack={data.activeConversation ? () => router.push("/messages", { scroll: false }) : undefined}
              />
            </div>
          </div>
        </>
      )}
    </main>
  )
}
