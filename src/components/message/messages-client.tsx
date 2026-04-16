"use client"

import Link from "next/link"
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { MessageSquareMore } from "lucide-react"

import { AddonSurfaceClientRenderer } from "@/addons-host/client/addon-surface-client-renderer"
import { useInboxRealtime } from "@/components/inbox-realtime-provider"
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
} from "@/lib/message-types"

interface MessagesClientProps {
  currentUser: {
    id: number
  } | null
  initialData: MessageCenterData | null
  conversationId?: string
  pageBefore?: ReactNode
  pageAfter?: ReactNode
  headerBefore?: ReactNode
  headerAfter?: ReactNode
  sidebarBefore?: ReactNode
  sidebarAfter?: ReactNode
  threadBefore?: ReactNode
  threadAfter?: ReactNode
}

interface LiveConversationPatch {
  title?: string
  subtitle?: string
  preview?: string
  updatedAt?: string
  unreadCount?: number
  participants?: MessageParticipantProfile[]
}

export function MessagesClient({
  currentUser,
  initialData,
  conversationId,
  pageBefore,
  pageAfter,
  headerBefore,
  headerAfter,
  sidebarBefore,
  sidebarAfter,
  threadBefore,
  threadAfter,
}: MessagesClientProps) {
  const router = useRouter()
  const { subscribe } = useInboxRealtime()
  const activeConversationIdRef = useRef<string | undefined>(undefined)
  const dataRef = useRef<MessageCenterData | null>(initialData)
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
  const shouldUseLiveInboxEvents = Boolean(currentUserId && data && !data.usingDemoData)
  const pageError = data?.errorMessage?.trim() ?? ""

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
    if (!activeConversationId) {
      return
    }

    void markConversationRead(activeConversationId)
  }, [activeConversationId, markConversationRead])

  useEffect(() => {
    if (!shouldUseLiveInboxEvents || !currentUserId) {
      return
    }

    return subscribe((payload) => {
      if (payload.type === "heartbeat" || payload.type === "inbox.snapshot" || payload.type === "notification.count") {
        return
      }

      if (payload.type === "conversation.read") {
        if (!payload.conversationId) {
          return
        }

        setLiveConversationPatches((current) => ({
          ...current,
          [payload.conversationId]: {
            ...current[payload.conversationId],
            subtitle: activeConversationIdRef.current === payload.conversationId ? "实时会话" : "最近互动",
            unreadCount: 0,
          },
        }))
        return
      }

      if (payload.type === "conversation.deleted") {
        setDeletedConversationIds((current) => current.includes(payload.conversationId) ? current : [...current, payload.conversationId])

        if (activeConversationIdRef.current === payload.conversationId) {
          const latestData = dataRef.current
          const nextConversations = latestData?.conversations.filter((conversation) => conversation.id !== payload.conversationId) ?? []
          const nextConversationId = nextConversations[0]?.id
          router.push(nextConversationId ? `/messages?conversation=${nextConversationId}` : "/messages", { scroll: false })
        }

        return
      }

      const activeConversation = activeConversationIdRef.current
      const conversationIdFromEvent = payload.conversationId
      if (!conversationIdFromEvent || !payload.messageId) {
        return
      }

      const isOwnMessage = payload.senderId === currentUserId

      const latestData = dataRef.current
      const existingConversation = latestData?.conversations.find((conversation) => conversation.id === conversationIdFromEvent)
      const isActiveConversation = conversationIdFromEvent === activeConversation
      const fallbackParticipant = existingConversation?.participants.find((participant) => !participant.isCurrentUser) ?? existingConversation?.participants[0]

      promoteConversation(conversationIdFromEvent)
      setLiveConversationPatches((current) => {
        const currentPatch = current[conversationIdFromEvent]
        const nextUnreadCount = isActiveConversation || isOwnMessage
          ? 0
          : Math.max(1, (currentPatch?.unreadCount ?? existingConversation?.unreadCount ?? 0) + 1)

        return {
          ...current,
          [conversationIdFromEvent]: {
            title: existingConversation?.title ?? payload.senderDisplayName ?? currentPatch?.title,
            subtitle: isActiveConversation ? "实时会话" : nextUnreadCount > 0 ? `未读 ${nextUnreadCount} 条` : "最近互动",
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
          senderName: isOwnMessage ? "我" : payload.senderDisplayName ?? fallbackParticipant?.displayName ?? "新消息",
          senderAvatarPath: isOwnMessage ? null : payload.senderAvatarPath ?? fallbackParticipant?.avatarPath ?? null,
          isMine: isOwnMessage,
        }

        setIncomingMessagesByConversation((current) => ({
          ...current,
          [conversationIdFromEvent]: mergeMessages(current[conversationIdFromEvent] ?? [], [nextMessage]),
        }))
      }

      if (isActiveConversation && !isOwnMessage) {
        void markConversationRead(conversationIdFromEvent)
      }
    })
  }, [currentUserId, markConversationRead, promoteConversation, router, shouldUseLiveInboxEvents, subscribe])

  const isMobileThreadVisible = Boolean(data?.activeConversation)

  const headerContent = !currentUser || !data ? null : (
    <>
      {headerBefore}
      <AddonSurfaceClientRenderer
        surface="messages.header"
        surfaceProps={{
          activeConversationId,
          conversationId,
          currentUser,
          data,
          isMobileThreadVisible,
        }}
        fallback={(
          <div className={isMobileThreadVisible ? "hidden sm:mb-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3" : "mb-4 flex flex-wrap items-center justify-between gap-3"}>
            <div>
              <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold">
                <MessageSquareMore className="h-7 w-7" />
                站内私信
              </h1>
            </div>
          </div>
        )}
      />
      {headerAfter}
    </>
  )

  const sidebarContent = !currentUser || !data ? null : (
    <AddonSurfaceClientRenderer
      surface="messages.sidebar"
      surfaceProps={{
        activeConversationId,
        conversationId,
        currentUser,
        data,
        deletingConversationId,
        onDeleteConversation: handleDeleteConversation,
        isMobileThreadVisible,
      }}
      fallback={(
        <>
          {sidebarBefore}
          <MessageConversationSidebar
            conversations={data.conversations}
            activeConversationId={data.activeConversation?.id}
            deletingConversationId={deletingConversationId}
            onDeleteConversation={handleDeleteConversation}
            mobileHidden={isMobileThreadVisible}
          />
          {sidebarAfter}
        </>
      )}
    />
  )

  const threadContent = !currentUser || !data ? null : (
    <AddonSurfaceClientRenderer
      surface="messages.thread"
      surfaceProps={{
        activeConversationId,
        conversationId,
        currentUser,
        data,
        handleLoadHistory,
        handleLocalMessageSent,
        historyError,
        loadingHistory,
      }}
      fallback={(
        <>
          {threadBefore}
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
          {threadAfter}
        </>
      )}
    />
  )

  const pageContent = !currentUser ? (
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
      {headerContent}
      {pageError ? <p className="mb-4 rounded-[20px] border border-rose-200/70 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">{pageError}</p> : null}
      <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          {sidebarContent}
        </div>
        <div className={isMobileThreadVisible ? "block" : "hidden xl:block"}>
          {threadContent}
        </div>
      </div>
    </>
  )

  return (
    <main className="mx-auto max-w-[1240px] px-0 py-0 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
      {pageBefore}
      <AddonSurfaceClientRenderer
        surface="messages.page"
        surfaceProps={{
          activeConversationId,
          conversationId,
          currentUser,
          data,
          deletingConversationId,
          handleDeleteConversation,
          handleLoadHistory,
          handleLocalMessageSent,
          historyError,
          isMobileThreadVisible,
          loadingHistory,
        }}
        fallback={pageContent}
      />
      {pageAfter}
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
