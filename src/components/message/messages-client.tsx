"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { MessageSquareMore } from "lucide-react"

import { MessageConversationSidebar } from "@/components/message/message-conversation-sidebar"
import { MessageThreadPanel } from "@/components/message/message-thread-panel"
import { Button } from "@/components/ui/rbutton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
  MessageBubbleItem,
  MessageCenterData,
  MessageConversationListItem,
  MessageHistoryResult,
  MessageParticipantProfile,
  MessageStreamEvent,
} from "@/lib/message-types"

interface MessagesClientProps {
  currentUser: {
    id: number
  } | null
  initialData: MessageCenterData | null
  conversationId?: string
}

interface LiveConversationPatch {
  title?: string
  subtitle?: string
  preview?: string
  updatedAt?: string
  unreadCount?: number
  participants?: MessageParticipantProfile[]
}

export function MessagesClient({ currentUser, initialData, conversationId }: MessagesClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const connectionStateRef = useRef<"connecting" | "connected" | "closed">("connecting")
  const streamCursorRef = useRef<string | null>(null)
  const activeConversationIdRef = useRef<string | undefined>(undefined)
  const selectedConversationIdRef = useRef<string | undefined>(conversationId)
  const dataRef = useRef<MessageCenterData | null>(initialData)
  const messagePromptAudioRef = useRef<HTMLAudioElement | null>(null)
  const previousUnreadConversationCountRef = useRef(0)
  const unreadTitleCountRef = useRef(0)
  const originalTitleRef = useRef("")
  const [deletingConversationId, setDeletingConversationId] = useState("")
  const [deletedConversationIds, setDeletedConversationIds] = useState<string[]>([])
  const [historyLoadingConversationId, setHistoryLoadingConversationId] = useState("")
  const [historyErrors, setHistoryErrors] = useState<Record<string, string>>({})
  const [historyHasMoreByConversation, setHistoryHasMoreByConversation] = useState<Record<string, boolean>>({})
  const [historyMessagesByConversation, setHistoryMessagesByConversation] = useState<Record<string, MessageBubbleItem[]>>({})
  const [incomingMessagesByConversation, setIncomingMessagesByConversation] = useState<Record<string, MessageBubbleItem[]>>({})
  const [optimisticMessagesByConversation, setOptimisticMessagesByConversation] = useState<Record<string, MessageBubbleItem[]>>({})
  const [liveConversationPatches, setLiveConversationPatches] = useState<Record<string, LiveConversationPatch>>({})
  const [promotedConversationIds, setPromotedConversationIds] = useState<string[]>([])

  const data = useMemo(() => buildMessageCenterView(initialData, {
    deletedConversationIds,
    historyHasMoreByConversation,
    historyMessagesByConversation,
    incomingMessagesByConversation,
    liveConversationPatches,
    optimisticMessagesByConversation,
    promotedConversationIds,
  }), [deletedConversationIds, historyHasMoreByConversation, historyMessagesByConversation, incomingMessagesByConversation, initialData, liveConversationPatches, optimisticMessagesByConversation, promotedConversationIds])
  const currentUserId = currentUser?.id
  const shouldConnectMessageStream = Boolean(currentUserId && data && !data.usingDemoData)

  const activeConversationId = useMemo(() => {
    if (!data?.activeConversation) {
      return undefined
    }

    return data.activeConversation.id
  }, [data])

  const loadingHistory = historyLoadingConversationId !== "" && historyLoadingConversationId === activeConversationId
  const historyError = activeConversationId ? (historyErrors[activeConversationId] ?? "") : ""

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
    selectedConversationIdRef.current = conversationId
  }, [activeConversationId, conversationId])

  useEffect(() => {
    if (!conversationId?.startsWith("user-")) {
      return
    }

    if (!activeConversationId || activeConversationId === conversationId) {
      return
    }

    router.replace(`/messages?conversation=${activeConversationId}`, { scroll: false })
  }, [activeConversationId, conversationId, router])

  useEffect(() => {
    dataRef.current = data
  }, [data])

  const promoteConversation = useCallback((conversationIdToPromote: string) => {
    setPromotedConversationIds((current) => [
      conversationIdToPromote,
      ...current.filter((conversationId) => conversationId !== conversationIdToPromote),
    ])
  }, [])

  const markConversationRead = useCallback(async (conversationIdToRead: string) => {
    try {
      await fetch("/api/messages/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ conversationId: conversationIdToRead }),
      })
    } catch {
      // Ignore read sync failures here; the next navigation can still reconcile server state.
    }
  }, [])

  function resetWindowAttention() {
    unreadTitleCountRef.current = 0

    if (typeof document !== "undefined" && originalTitleRef.current) {
      document.title = originalTitleRef.current
    }
  }

  function bumpWindowAttention() {
    if (typeof document === "undefined") {
      return
    }

    if (!originalTitleRef.current) {
      originalTitleRef.current = document.title
    }

    unreadTitleCountRef.current += 1
    document.title = unreadTitleCountRef.current > 1 ? `有新消息（${unreadTitleCountRef.current}）` : "有新消息"
  }

  function handleLocalMessageSent(message: MessageBubbleItem) {
    const activeConversation = data?.activeConversation
    const conversationKey = activeConversation?.id
    if (!activeConversation || !conversationKey) {
      return
    }

    promoteConversation(conversationKey)
    setLiveConversationPatches((current) => ({
      ...current,
      [conversationKey]: {
        ...current[conversationKey],
        title: activeConversation.title,
        subtitle: "实时会话",
        preview: message.body,
        updatedAt: message.createdAt,
        unreadCount: 0,
        participants: activeConversation.participants,
      },
    }))

    setOptimisticMessagesByConversation((current) => ({
      ...current,
      [conversationKey]: mergeMessages(current[conversationKey] ?? [], [message]),
    }))
  }

  async function handleLoadHistory() {
    const currentConversation = data?.activeConversation
    const oldestMessageId = currentConversation?.messages[0]?.id

    if (!currentConversation || !oldestMessageId || historyLoadingConversationId === currentConversation.id || !currentConversation.hasMoreHistory) {
      return
    }

    setHistoryLoadingConversationId(currentConversation.id)
    setHistoryErrors((current) => ({
      ...current,
      [currentConversation.id]: "",
    }))

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
      setHistoryErrors((current) => ({
        ...current,
        [currentConversation.id]: payload?.message ?? "加载历史消息失败",
      }))
      setHistoryLoadingConversationId("")
      return
    }

    const result = payload?.data as MessageHistoryResult | undefined

    if (!result) {
      setHistoryLoadingConversationId("")
      return
    }

    setHistoryMessagesByConversation((current) => ({
      ...current,
      [currentConversation.id]: mergeMessages(result.messages, current[currentConversation.id] ?? []),
    }))
    setHistoryHasMoreByConversation((current) => ({
      ...current,
      [currentConversation.id]: result.hasMoreHistory,
    }))
    setHistoryLoadingConversationId("")
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

    setDeletedConversationIds((current) => current.includes(conversationIdToDelete) ? current : [...current, conversationIdToDelete])

    setDeletingConversationId("")

    if (activeConversationId === conversationIdToDelete) {
      router.push(nextConversationId ? `/messages?conversation=${nextConversationId}` : "/messages", { scroll: false })
      return
    }
  }

  useEffect(() => {
    if (typeof document === "undefined") {
      return
    }

    if (!originalTitleRef.current) {
      originalTitleRef.current = document.title
    }
  }, [])

  useEffect(() => {
    const audio = new Audio("/apps/messages/prompt.mp3")
    audio.preload = "auto"
    messagePromptAudioRef.current = audio

    const unlockAudio = () => {
      const target = messagePromptAudioRef.current
      if (!target) {
        return
      }

      target.muted = true
      target.currentTime = 0
      void target.play()
        .then(() => {
          target.pause()
          target.currentTime = 0
          target.muted = false
        })
        .catch(() => {
          target.muted = false
        })
    }

    window.addEventListener("pointerdown", unlockAudio, { passive: true })
    window.addEventListener("keydown", unlockAudio)

    return () => {
      window.removeEventListener("pointerdown", unlockAudio)
      window.removeEventListener("keydown", unlockAudio)
      audio.pause()
      messagePromptAudioRef.current = null
    }
  }, [])

  useEffect(() => {
    if (pathname === "/messages" && typeof document !== "undefined" && document.visibilityState === "visible" && document.hasFocus()) {
      resetWindowAttention()
    }
  }, [pathname])

  useEffect(() => {
    if (!activeConversationId) {
      return
    }

    void markConversationRead(activeConversationId)
  }, [activeConversationId, markConversationRead])

  useEffect(() => {
    const totalUnreadConversationCount = data?.conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0) ?? 0
    const previousUnreadConversationCount = previousUnreadConversationCountRef.current

    if (totalUnreadConversationCount > previousUnreadConversationCount) {
      const audio = messagePromptAudioRef.current
      if (audio) {
        audio.currentTime = 0
        void audio.play().catch(() => undefined)
      }
    }

    previousUnreadConversationCountRef.current = totalUnreadConversationCount
  }, [data?.conversations])

  useEffect(() => {
    function handleWindowFocus() {
      resetWindowAttention()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        resetWindowAttention()
      }
    }

    window.addEventListener("focus", handleWindowFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("focus", handleWindowFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (!shouldConnectMessageStream || !currentUserId) {
      connectionStateRef.current = "closed"
      reconnectAttemptRef.current = 0
      streamCursorRef.current = null
      return
    }

    let closed = false
    let eventSource: EventSource | null = null

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const scheduleReconnect = () => {
      if (closed || reconnectTimerRef.current) {
        return
      }

      connectionStateRef.current = "connecting"
      const delay = Math.min(30_000, 1_000 * 2 ** reconnectAttemptRef.current)
      reconnectAttemptRef.current += 1

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        connect()
      }, delay)
    }

    const handleMessage = (event: MessageEvent<string>) => {
      let payload: MessageStreamEvent

      try {
        payload = JSON.parse(event.data) as MessageStreamEvent
      } catch {
        return
      }

      if (payload.type === "heartbeat" || payload.senderId === currentUserId) {
        return
      }

      const activeConversation = activeConversationIdRef.current
      const conversationIdFromEvent = payload.conversationId
      if (!conversationIdFromEvent || !payload.messageId) {
        return
      }

      if (!document.hasFocus() || document.visibilityState !== "visible") {
        bumpWindowAttention()
      }

      const latestData = dataRef.current
      const existingConversation = latestData?.conversations.find((conversation) => conversation.id === conversationIdFromEvent)
      const isActiveConversation = conversationIdFromEvent === activeConversation
      const fallbackParticipant = existingConversation?.participants.find((participant) => !participant.isCurrentUser) ?? existingConversation?.participants[0]

      promoteConversation(conversationIdFromEvent)
      setLiveConversationPatches((current) => {
        const currentPatch = current[conversationIdFromEvent]
        const nextUnreadCount = isActiveConversation
          ? 0
          : Math.max(1, (currentPatch?.unreadCount ?? existingConversation?.unreadCount ?? 0) + 1)

        return {
          ...current,
          [conversationIdFromEvent]: {
            title: existingConversation?.title ?? payload.senderDisplayName ?? currentPatch?.title,
            subtitle: isActiveConversation ? "实时会话" : `未读 ${nextUnreadCount} 条`,
            preview: payload.content ?? existingConversation?.preview ?? currentPatch?.preview,
            updatedAt: payload.createdAtLabel ?? existingConversation?.updatedAt ?? currentPatch?.updatedAt,
            unreadCount: nextUnreadCount,
            participants: existingConversation?.participants ?? currentPatch?.participants ?? (
              payload.senderId && (payload.senderDisplayName || fallbackParticipant?.displayName)
                ? [{
                    id: payload.senderId,
                    username: payload.senderUsername ?? fallbackParticipant?.username ?? "",
                    displayName: payload.senderDisplayName ?? fallbackParticipant?.displayName ?? "新消息",
                    avatarPath: payload.senderAvatarPath ?? fallbackParticipant?.avatarPath ?? null,
                  }]
                : undefined
            ),
          },
        }
      })

      if (payload.content && payload.createdAtLabel && payload.senderId) {
        const nextMessage: MessageBubbleItem = {
          id: payload.messageId,
          body: payload.content,
          createdAt: payload.createdAtLabel,
          occurredAt: payload.occurredAt,
          senderId: payload.senderId,
          senderName: payload.senderDisplayName ?? fallbackParticipant?.displayName ?? "新消息",
          senderAvatarPath: payload.senderAvatarPath ?? fallbackParticipant?.avatarPath ?? null,
          isMine: false,
        }

        setIncomingMessagesByConversation((current) => ({
          ...current,
          [conversationIdFromEvent]: mergeMessages(current[conversationIdFromEvent] ?? [], [nextMessage]),
        }))
      }

      if (isActiveConversation) {
        void markConversationRead(conversationIdFromEvent)
      }
    }

    const handleCursor = (event: Event) => {
      let payload: { cursor?: string }

      try {
        payload = JSON.parse((event as MessageEvent<string>).data) as { cursor?: string }
      } catch {
        return
      }

      if (typeof payload.cursor === "string" && payload.cursor) {
        streamCursorRef.current = payload.cursor
      }
    }

    const connect = () => {
      if (closed) {
        return
      }

      clearReconnectTimer()
      connectionStateRef.current = "connecting"

      const streamUrl = new URL("/api/messages/stream", window.location.origin)
      if (streamCursorRef.current) {
        streamUrl.searchParams.set("cursor", streamCursorRef.current)
      }

      eventSource = new EventSource(streamUrl)

      eventSource.onopen = () => {
        reconnectAttemptRef.current = 0
        connectionStateRef.current = "connected"
      }

      eventSource.onmessage = handleMessage
      eventSource.addEventListener("cursor", handleCursor as EventListener)
      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close()
          eventSource = null
        }

        scheduleReconnect()
      }
    }

    connect()

    return () => {
      closed = true
      clearReconnectTimer()
      reconnectAttemptRef.current = 0
      connectionStateRef.current = "closed"
      eventSource?.close()
    }
  }, [currentUserId, markConversationRead, promoteConversation, shouldConnectMessageStream])

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

function buildMessageCenterView(initialData: MessageCenterData | null, patches: {
  deletedConversationIds: string[]
  historyHasMoreByConversation: Record<string, boolean>
  historyMessagesByConversation: Record<string, MessageBubbleItem[]>
  incomingMessagesByConversation: Record<string, MessageBubbleItem[]>
  liveConversationPatches: Record<string, LiveConversationPatch>
  optimisticMessagesByConversation: Record<string, MessageBubbleItem[]>
  promotedConversationIds: string[]
}): MessageCenterData | null {
  if (!initialData) {
    return null
  }

  const deletedConversationIdSet = new Set(patches.deletedConversationIds)
  const initialActiveConversation = initialData.activeConversation
  const activeConversationId = initialActiveConversation?.id
  const conversationsById = new Map<string, MessageConversationListItem>()

  for (const conversation of initialData.conversations) {
    if (!deletedConversationIdSet.has(conversation.id)) {
      conversationsById.set(conversation.id, conversation)
    }
  }

  for (const [conversationId, patch] of Object.entries(patches.liveConversationPatches)) {
    if (deletedConversationIdSet.has(conversationId)) {
      continue
    }

    const currentConversation = conversationsById.get(conversationId)
    if (currentConversation) {
      conversationsById.set(conversationId, {
        ...currentConversation,
        ...(patch.title ? { title: patch.title } : {}),
        ...(patch.subtitle ? { subtitle: patch.subtitle } : {}),
        ...(patch.preview ? { preview: patch.preview } : {}),
        ...(patch.updatedAt ? { updatedAt: patch.updatedAt } : {}),
        ...(typeof patch.unreadCount === "number" ? { unreadCount: patch.unreadCount } : {}),
        ...(patch.participants ? { participants: patch.participants } : {}),
      })
      continue
    }

    if (!patch.participants?.length) {
      continue
    }

    conversationsById.set(conversationId, {
      id: conversationId,
      title: patch.title ?? patch.participants[0].displayName,
      subtitle: patch.subtitle ?? "新消息",
      preview: patch.preview ?? "收到一条新消息",
      updatedAt: patch.updatedAt ?? "",
      unreadCount: patch.unreadCount ?? 0,
      participants: patch.participants,
    })
  }

  const conversations = sortConversationsByPromotion(
    Array.from(conversationsById.values()).map((conversation) => {
      const livePatch = patches.liveConversationPatches[conversation.id]
      const optimisticMessages = patches.optimisticMessagesByConversation[conversation.id] ?? []
      const incomingMessages = patches.incomingMessagesByConversation[conversation.id] ?? []
      const latestRuntimeMessage = mergeMessages(optimisticMessages, incomingMessages).at(-1)

      if (!livePatch && !latestRuntimeMessage) {
        return conversation
      }

      return {
        ...conversation,
        ...(livePatch?.title ? { title: livePatch.title } : {}),
        ...(livePatch?.subtitle ? { subtitle: livePatch.subtitle } : {}),
        ...(livePatch?.preview ? { preview: livePatch.preview } : {}),
        ...(livePatch?.updatedAt ? { updatedAt: livePatch.updatedAt } : {}),
        ...(typeof livePatch?.unreadCount === "number" ? { unreadCount: livePatch.unreadCount } : {}),
        ...(conversation.id === activeConversationId ? { subtitle: "实时会话", unreadCount: 0 } : {}),
        ...(latestRuntimeMessage
          ? {
              preview: latestRuntimeMessage.body,
              updatedAt: latestRuntimeMessage.createdAt,
              unreadCount: conversation.id === activeConversationId ? 0 : latestRuntimeMessage.isMine ? 0 : (livePatch?.unreadCount ?? conversation.unreadCount),
            }
          : {}),
      }
    }),
    patches.promotedConversationIds,
  )

  if (!initialActiveConversation || deletedConversationIdSet.has(initialActiveConversation.id)) {
    return {
      ...initialData,
      conversations,
      activeConversation: null,
    }
  }

  const resolvedActiveConversationId = initialActiveConversation.id
  const historyMessages = patches.historyMessagesByConversation[resolvedActiveConversationId] ?? []
  const incomingMessages = patches.incomingMessagesByConversation[resolvedActiveConversationId] ?? []
  const optimisticMessages = patches.optimisticMessagesByConversation[resolvedActiveConversationId] ?? []
  const livePatch = patches.liveConversationPatches[resolvedActiveConversationId]
  const messages = mergeMessages(historyMessages, initialActiveConversation.messages, incomingMessages, optimisticMessages)

  return {
    ...initialData,
    conversations,
    activeConversation: {
      ...initialActiveConversation,
      subtitle: livePatch?.subtitle ?? (messages.length > 0 ? "实时会话" : initialActiveConversation.subtitle),
      updatedAt: livePatch?.updatedAt ?? messages.at(-1)?.createdAt ?? initialActiveConversation.updatedAt,
      messages,
      hasMoreHistory: patches.historyHasMoreByConversation[resolvedActiveConversationId] ?? initialActiveConversation.hasMoreHistory,
    },
  }
}

function sortConversationsByPromotion(conversations: MessageConversationListItem[], promotedConversationIds: string[]) {
  if (promotedConversationIds.length === 0) {
    return conversations
  }

  const promotionOrder = new Map(promotedConversationIds.map((conversationId, index) => [conversationId, index]))

  return [...conversations].sort((left, right) => {
    const leftPriority = promotionOrder.get(left.id)
    const rightPriority = promotionOrder.get(right.id)

    if (typeof leftPriority === "number" && typeof rightPriority === "number") {
      return leftPriority - rightPriority
    }

    if (typeof leftPriority === "number") {
      return -1
    }

    if (typeof rightPriority === "number") {
      return 1
    }

    return 0
  })
}

function mergeMessages(...messageGroups: MessageBubbleItem[][]) {
  const seenMessageIds = new Set<string>()
  const mergedMessages: MessageBubbleItem[] = []

  for (const group of messageGroups) {
    for (const message of group) {
      if (seenMessageIds.has(message.id)) {
        continue
      }

      seenMessageIds.add(message.id)
      mergedMessages.push(message)
    }
  }

  return mergedMessages
    .map((message, index) => ({ message, index }))
    .sort((left, right) => {
      const leftOccurredAt = left.message.occurredAt
      const rightOccurredAt = right.message.occurredAt

      if (leftOccurredAt && rightOccurredAt) {
        const occurredAtComparison = leftOccurredAt.localeCompare(rightOccurredAt)
        if (occurredAtComparison !== 0) {
          return occurredAtComparison
        }
      }

      return left.index - right.index
    })
    .map((entry) => entry.message)
}
