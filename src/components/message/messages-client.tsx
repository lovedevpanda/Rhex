"use client"

import Link from "next/link"
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AddonSurfaceClientRenderer } from "@/addons-host/client/addon-surface-client-renderer"
import { useInboxRealtime } from "@/components/inbox-realtime-provider"
import { MessageConversationSidebar } from "@/components/message/message-conversation-sidebar"
import { MessageThreadPanel, type LocalMessageSentPayload } from "@/components/message/message-thread-panel"
import { showConfirm } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/rbutton"
import { toast } from "@/components/ui/toast"
import { buildLoginHrefWithRedirect } from "@/lib/auth-redirect"
import { isImageOnlyMessageContent, summarizeMessagePreview } from "@/lib/message-media"
import {
  isSiteChatConversationId,
  SITE_CHAT_CONVERSATION_ID,
  SITE_CHAT_EMPTY_PREVIEW,
  SITE_CHAT_SUBTITLE,
  SITE_CHAT_UPDATED_AT_PLACEHOLDER,
} from "@/lib/site-chat"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
  MessageBubbleItem,
  MessageCenterData,
  MessageConversationDetail,
  MessageConversationListItem,
  MessageDeletedStreamEvent,
  MessageHistoryResult,
  MessageParticipantProfile,
} from "@/lib/message-types"

interface MessagesClientProps {
  currentUser: {
    id: number
    role?: "USER" | "MODERATOR" | "ADMIN"
  } | null
  initialData: MessageCenterData | null
  conversationId?: string
  messageImageUploadEnabled: boolean
  messageFileUploadEnabled: boolean
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
  kind?: MessageConversationListItem["kind"]
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
  messageImageUploadEnabled,
  messageFileUploadEnabled,
  pageBefore,
  pageAfter,
  headerBefore,
  headerAfter,
  sidebarBefore,
  sidebarAfter,
  threadBefore,
  threadAfter,
}: MessagesClientProps) {
  const searchParams = useSearchParams()
  const { subscribe } = useInboxRealtime()
  const activeConversationIdRef = useRef<string | undefined>(undefined)
  const dataRef = useRef<MessageCenterData | null>(initialData)
  const conversationRequestTokenRef = useRef(0)
  const conversationRequestsRef = useRef(new Map<string, Promise<MessageConversationDetail | null>>())
  const [deletingConversationId, setDeletingConversationId] = useState("")
  const [deletingSiteChatMessageId, setDeletingSiteChatMessageId] = useState("")
  const [loadingConversationId, setLoadingConversationId] = useState("")
  const [conversationErrors, setConversationErrors] = useState<Record<string, string>>({})
  const [conversationDetailsById, setConversationDetailsById] = useState<Record<string, MessageConversationDetail>>(() => {
    const activeConversation = initialData?.activeConversation

    return activeConversation
      ? {
          [activeConversation.id]: activeConversation,
        }
      : {}
  })
  const [deletedConversationIds, setDeletedConversationIds] = useState<string[]>([])
  const [historyLoadingConversationId, setHistoryLoadingConversationId] = useState("")
  const [historyErrors, setHistoryErrors] = useState<Record<string, string>>({})
  const [historyHasMoreByConversation, setHistoryHasMoreByConversation] = useState<Record<string, boolean>>({})
  const [historyMessagesByConversation, setHistoryMessagesByConversation] = useState<Record<string, MessageBubbleItem[]>>({})
  const [incomingMessagesByConversation, setIncomingMessagesByConversation] = useState<Record<string, MessageBubbleItem[]>>({})
  const [optimisticMessagesByConversation, setOptimisticMessagesByConversation] = useState<Record<string, MessageBubbleItem[]>>({})
  const [liveConversationPatches, setLiveConversationPatches] = useState<Record<string, LiveConversationPatch>>({})
  const [promotedConversationIds, setPromotedConversationIds] = useState<string[]>([])
  const currentUserId = currentUser?.id
  const canManageSiteChatMessages = currentUser?.role === "ADMIN"
  const requestedConversationId = useMemo(() => {
    const value = searchParams.get("conversation")?.trim() ?? ""
    return value || conversationId
  }, [conversationId, searchParams])

  const resolveConversationDetail = useCallback((requestedId?: string) => {
    if (!requestedId) {
      return null
    }

    const directMatch = conversationDetailsById[requestedId]
    if (directMatch) {
      return directMatch
    }

    const initialActiveConversation = initialData?.activeConversation
    if (requestedId === conversationId && initialActiveConversation) {
      return conversationDetailsById[initialActiveConversation.id] ?? initialActiveConversation
    }

    const requestedRecipientId = requestedId.startsWith("user-")
      ? Number(requestedId.slice("user-".length))
      : Number.NaN

    if (!Number.isFinite(requestedRecipientId)) {
      return null
    }

    return Object.values(conversationDetailsById).find((detail) => detail.recipientId === requestedRecipientId) ?? null
  }, [conversationDetailsById, conversationId, initialData])

  const activeConversationSource = useMemo(
    () => resolveConversationDetail(requestedConversationId),
    [requestedConversationId, resolveConversationDetail],
  )

  const data = useMemo(() => buildMessageCenterView(initialData, activeConversationSource, {
    deletedConversationIds,
    historyHasMoreByConversation,
    historyMessagesByConversation,
    incomingMessagesByConversation,
    liveConversationPatches,
    optimisticMessagesByConversation,
    promotedConversationIds,
  }), [activeConversationSource, deletedConversationIds, historyHasMoreByConversation, historyMessagesByConversation, incomingMessagesByConversation, initialData, liveConversationPatches, optimisticMessagesByConversation, promotedConversationIds])
  const shouldUseLiveInboxEvents = Boolean(currentUserId && data && !data.usingDemoData)
  const pageError = data?.errorMessage?.trim() ?? ""

  const activeConversationId = useMemo(() => {
    if (!data?.activeConversation) {
      return undefined
    }

    return data.activeConversation.id
  }, [data])

  const activeConversationError = requestedConversationId ? (conversationErrors[requestedConversationId] ?? "") : ""
  const loadingConversation = Boolean(requestedConversationId && loadingConversationId === requestedConversationId && !activeConversationSource)
  const loadingHistory = historyLoadingConversationId !== "" && historyLoadingConversationId === activeConversationId
  const historyError = activeConversationId ? (historyErrors[activeConversationId] ?? "") : ""

  useEffect(() => {
    const activeConversation = initialData?.activeConversation
    if (!activeConversation) {
      return
    }

    queueMicrotask(() => {
      setConversationDetailsById((current) => ({
        ...current,
        [activeConversation.id]: activeConversation,
      }))
    })
  }, [initialData])

  const updateConversationUrl = useCallback((nextConversationId?: string, options?: { replace?: boolean }) => {
    if ((requestedConversationId ?? "") === (nextConversationId ?? "") && !options?.replace) {
      return
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString())
    if (nextConversationId) {
      nextSearchParams.set("conversation", nextConversationId)
    } else {
      nextSearchParams.delete("conversation")
    }

    const nextQuery = nextSearchParams.toString()
    const nextUrl = nextQuery ? `/messages?${nextQuery}` : "/messages"

    if (options?.replace) {
      window.history.replaceState(null, "", nextUrl)
      return
    }

    window.history.pushState(null, "", nextUrl)
  }, [requestedConversationId, searchParams])

  const requestConversationDetail = useCallback(async (requestedId: string) => {
    const cachedConversation = resolveConversationDetail(requestedId)
    if (cachedConversation) {
      return cachedConversation
    }

    const currentRequest = conversationRequestsRef.current.get(requestedId)
    if (currentRequest) {
      return currentRequest
    }

    const nextRequest = (async () => {
      const response = await fetch(`/api/messages/conversation?conversationId=${encodeURIComponent(requestedId)}`, {
        cache: "no-store",
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok || payload?.code !== 0) {
        throw new Error(payload?.message ?? "加载会话失败")
      }

      const detail = (payload?.data ?? null) as MessageConversationDetail | null
      if (detail) {
        setConversationDetailsById((current) => ({
          ...current,
          [detail.id]: detail,
        }))
      }

      return detail
    })()

    conversationRequestsRef.current.set(requestedId, nextRequest)

    try {
      return await nextRequest
    } finally {
      conversationRequestsRef.current.delete(requestedId)
    }
  }, [resolveConversationDetail])

  const prefetchConversation = useCallback((requestedId: string) => {
    if (!requestedId || resolveConversationDetail(requestedId)) {
      return
    }

    void requestConversationDetail(requestedId).catch(() => undefined)
  }, [requestConversationDetail, resolveConversationDetail])

  const handleSelectConversation = useCallback((nextConversationId: string, options?: { replace?: boolean }) => {
    prefetchConversation(nextConversationId)
    updateConversationUrl(nextConversationId, options)
  }, [prefetchConversation, updateConversationUrl])

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
  }, [activeConversationId, requestedConversationId])

  useEffect(() => {
    if (!requestedConversationId?.startsWith("user-")) {
      return
    }

    if (!activeConversationId || activeConversationId === requestedConversationId) {
      return
    }

    updateConversationUrl(activeConversationId, { replace: true })
  }, [activeConversationId, requestedConversationId, updateConversationUrl])

  useEffect(() => {
    queueMicrotask(() => {
        if (!requestedConversationId || activeConversationSource || !currentUserId) {
          setLoadingConversationId("")
          return
        }

        const requestToken = ++conversationRequestTokenRef.current
        setLoadingConversationId(requestedConversationId)
        setConversationErrors((current) => ({
          ...current,
          [requestedConversationId]: "",
        }))

        void requestConversationDetail(requestedConversationId)
          .then((detail) => {
            if (conversationRequestTokenRef.current !== requestToken) {
              return
            }

            setLoadingConversationId("")
            if (!detail) {
              setConversationErrors((current) => ({
                ...current,
                [requestedConversationId]: "会话不存在或已不可用",
              }))
            }
          })
          .catch((error) => {
            if (conversationRequestTokenRef.current !== requestToken) {
              return
            }

            setLoadingConversationId("")
            setConversationErrors((current) => ({
              ...current,
              [requestedConversationId]: error instanceof Error ? error.message : "加载会话失败",
            }))
          })
    })
  }, [activeConversationSource, currentUserId, requestConversationDetail, requestedConversationId])

  useEffect(() => {
    if (!requestedConversationId || !activeConversationSource) {
      return
    }

    queueMicrotask(() => {
      setConversationErrors((current) => {
        if (!current[requestedConversationId]) {
          return current
        }

        return {
          ...current,
          [requestedConversationId]: "",
        }
      })
    })
  }, [activeConversationSource, requestedConversationId])

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

  function handleLocalMessageSent({ conversationId: conversationKey, message, previousConversationId }: LocalMessageSentPayload) {
    const sourceConversation = resolveConversationDetail(previousConversationId ?? conversationKey) ?? data?.activeConversation
    if (!sourceConversation) {
      return
    }

    if (previousConversationId && previousConversationId !== conversationKey) {
      setConversationDetailsById((current) => {
        const previousConversation = current[previousConversationId] ?? sourceConversation
        const next = {
          ...current,
          [conversationKey]: {
            ...previousConversation,
            id: conversationKey,
            subtitle: previousConversation.kind === "SITE_CHAT" ? SITE_CHAT_SUBTITLE : "实时会话",
            updatedAt: message.createdAt,
            messages: mergeMessages(previousConversation.messages, [message]),
          },
        }

        if (previousConversationId in next) {
          delete next[previousConversationId]
        }

        return next
      })
      updateConversationUrl(conversationKey, { replace: true })
    }

    promoteConversation(conversationKey)
    setLiveConversationPatches((current) => ({
      ...current,
      [conversationKey]: {
        ...current[conversationKey],
        kind: sourceConversation.kind,
        title: sourceConversation.title,
        subtitle: sourceConversation.kind === "SITE_CHAT" ? SITE_CHAT_SUBTITLE : "实时会话",
        preview: summarizeMessagePreview(message.body),
        updatedAt: message.createdAt,
        unreadCount: 0,
        participants: sourceConversation.participants,
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
    setConversationDetailsById((current) => {
      if (!current[conversationIdToDelete]) {
        return current
      }

      const next = { ...current }
      delete next[conversationIdToDelete]
      return next
    })

    setDeletingConversationId("")

    if (activeConversationId === conversationIdToDelete) {
      updateConversationUrl(nextConversationId, { replace: true })
      return
    }
  }

  const removeMessageFromConversationState = useCallback((conversationIdToUpdate: string, messageId: string) => {
    const removeMessage = (message: MessageBubbleItem) => message.id !== messageId

    setConversationDetailsById((current) => {
      const conversation = current[conversationIdToUpdate]
      if (!conversation) {
        return current
      }

      return {
        ...current,
        [conversationIdToUpdate]: {
          ...conversation,
          messages: conversation.messages.filter(removeMessage),
        },
      }
    })

    setHistoryMessagesByConversation((current) => filterMessageMapById(current, conversationIdToUpdate, messageId))
    setIncomingMessagesByConversation((current) => filterMessageMapById(current, conversationIdToUpdate, messageId))
    setOptimisticMessagesByConversation((current) => filterMessageMapById(current, conversationIdToUpdate, messageId))
  }, [])

  const applySiteChatDeletedEvent = useCallback((event: MessageDeletedStreamEvent) => {
    const conversationIdToUpdate = event.conversationId

    removeMessageFromConversationState(conversationIdToUpdate, event.messageId)
    setLiveConversationPatches((current) => {
      const latestMessage = event.latestMessage

      return {
        ...current,
        [conversationIdToUpdate]: {
          ...current[conversationIdToUpdate],
          subtitle: SITE_CHAT_SUBTITLE,
          preview: latestMessage ? summarizeMessagePreview(latestMessage.content) : SITE_CHAT_EMPTY_PREVIEW,
          updatedAt: latestMessage?.createdAtLabel ?? SITE_CHAT_UPDATED_AT_PLACEHOLDER,
        },
      }
    })
  }, [removeMessageFromConversationState])

  async function handleDeleteSiteChatMessage(messageId: string) {
    if (!canManageSiteChatMessages || deletingSiteChatMessageId) {
      return
    }

    const confirmed = await showConfirm({
      title: "删除聊天消息",
      description: "确认删除这条全站聊天室消息？删除后会立即从其他在线客户端同步移除。",
      confirmText: "删除",
      cancelText: "取消",
      variant: "danger",
    })

    if (!confirmed) {
      return
    }

    setDeletingSiteChatMessageId(messageId)

    try {
      const response = await fetch("/api/messages/site-chat/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messageId }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok || payload?.code !== 0) {
        throw new Error(payload?.message ?? "删除消息失败")
      }

      const deleted = payload.data as Pick<MessageDeletedStreamEvent, "messageId" | "latestMessage"> | undefined
      applySiteChatDeletedEvent({
        type: "message.deleted",
        conversationId: SITE_CHAT_CONVERSATION_ID,
        messageId: deleted?.messageId ?? messageId,
        deletedByUserId: currentUserId ?? 0,
        latestMessage: deleted?.latestMessage,
        broadcast: "site-chat",
        occurredAt: new Date().toISOString(),
      })
      toast.success("聊天室消息已删除", "删除成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除消息失败", "删除失败")
    } finally {
      setDeletingSiteChatMessageId("")
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
            subtitle: activeConversationIdRef.current === payload.conversationId
              ? (isSiteChatConversationId(payload.conversationId) ? SITE_CHAT_SUBTITLE : "实时会话")
              : isSiteChatConversationId(payload.conversationId)
                ? SITE_CHAT_SUBTITLE
                : "最近互动",
            unreadCount: 0,
          },
        }))
        return
      }

      if (payload.type === "conversation.deleted") {
        setDeletedConversationIds((current) => current.includes(payload.conversationId) ? current : [...current, payload.conversationId])
        setConversationDetailsById((current) => {
          if (!current[payload.conversationId]) {
            return current
          }

          const next = { ...current }
          delete next[payload.conversationId]
          return next
        })

        if (activeConversationIdRef.current === payload.conversationId) {
          const latestData = dataRef.current
          const nextConversations = latestData?.conversations.filter((conversation) => conversation.id !== payload.conversationId) ?? []
          const nextConversationId = nextConversations[0]?.id
          updateConversationUrl(nextConversationId, { replace: true })
        }

        return
      }

      if (payload.type === "message.deleted") {
        applySiteChatDeletedEvent(payload)
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
      const isSiteChatConversation = isSiteChatConversationId(conversationIdFromEvent) || existingConversation?.kind === "SITE_CHAT"

      promoteConversation(conversationIdFromEvent)
      setLiveConversationPatches((current) => {
        const currentPatch = current[conversationIdFromEvent]
        const nextUnreadCount = isActiveConversation || isOwnMessage
          ? 0
          : Math.max(1, (currentPatch?.unreadCount ?? existingConversation?.unreadCount ?? 0) + 1)

        return {
          ...current,
          [conversationIdFromEvent]: {
            kind: existingConversation?.kind ?? currentPatch?.kind,
            title: existingConversation?.title ?? payload.senderDisplayName ?? currentPatch?.title,
            subtitle: isActiveConversation
              ? (isSiteChatConversation ? SITE_CHAT_SUBTITLE : "实时会话")
              : nextUnreadCount > 0
                ? `未读 ${nextUnreadCount} 条`
                : isSiteChatConversation
                  ? SITE_CHAT_SUBTITLE
                  : "最近互动",
            preview: payload.content ? summarizeMessagePreview(payload.content) : (existingConversation?.preview ?? currentPatch?.preview),
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
          senderUsername: payload.senderUsername ?? fallbackParticipant?.username ?? "",
          senderName: isOwnMessage && !isSiteChatConversation ? "我" : payload.senderDisplayName ?? fallbackParticipant?.displayName ?? "新消息",
          senderAvatarPath: payload.senderAvatarPath ?? fallbackParticipant?.avatarPath ?? null,
          isMine: isOwnMessage,
          bodyImageOnly: isImageOnlyMessageContent(payload.content),
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
  }, [applySiteChatDeletedEvent, currentUserId, markConversationRead, promoteConversation, shouldUseLiveInboxEvents, subscribe, updateConversationUrl])

  const isMobileThreadVisible = Boolean(requestedConversationId)

  const headerContent = !currentUser || !data ? null : (
    <>
      {headerBefore}
      <AddonSurfaceClientRenderer
        surface="messages.header"
        surfaceProps={{
          activeConversationId,
          conversationId: requestedConversationId,
          currentUser,
          data,
          isMobileThreadVisible,
        }}
        fallback={(
          <div>
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
        conversationId: requestedConversationId,
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
            activeConversationId={activeConversationId}
            deletingConversationId={deletingConversationId}
            onSelectConversation={handleSelectConversation}
            onPrefetchConversation={prefetchConversation}
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
        conversationId: requestedConversationId,
        currentUser,
        data,
        canManageSiteChatMessages,
        deletingSiteChatMessageId,
        handleLoadHistory,
        handleLocalMessageSent,
        handleDeleteSiteChatMessage,
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
            messageImageUploadEnabled={messageImageUploadEnabled}
            messageFileUploadEnabled={messageFileUploadEnabled}
            loadingConversation={loadingConversation}
            conversationError={activeConversationError}
            onMessageSent={handleLocalMessageSent}
            canManageSiteChatMessages={canManageSiteChatMessages}
            deletingMessageId={deletingSiteChatMessageId}
            onDeleteMessage={handleDeleteSiteChatMessage}
            onLoadHistory={handleLoadHistory}
            loadingHistory={loadingHistory}
            historyError={historyError}
            onBack={requestedConversationId ? () => updateConversationUrl(undefined) : undefined}
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
        <Link href={buildLoginHrefWithRedirect("/messages")}>
          <Button className="rounded-full">前往登录</Button>
        </Link>
      </CardContent>
    </Card>
  ) : !data ? null : (
    <>
      {headerContent}
      {pageError ? <p className="mb-4 rounded-xl border border-rose-200/70 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">{pageError}</p> : null}
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
    <main className="mx-auto max-w-[1200px] px-0 py-0 sm:px-1 sm:py-4 lg:py-5">
      {pageBefore}
      <AddonSurfaceClientRenderer
        surface="messages.page"
        surfaceProps={{
          activeConversationId,
          conversationId: requestedConversationId,
          currentUser,
          data,
          canManageSiteChatMessages,
          deletingConversationId,
          deletingSiteChatMessageId,
          handleDeleteConversation,
          handleDeleteSiteChatMessage,
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

function buildMessageCenterView(initialData: MessageCenterData | null, activeConversation: MessageConversationDetail | null, patches: {
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
  const activeConversationId = activeConversation?.id
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
      kind: patch.kind ?? "DIRECT",
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
        ...(conversation.id === activeConversationId ? { subtitle: conversation.kind === "SITE_CHAT" ? SITE_CHAT_SUBTITLE : "实时会话", unreadCount: 0 } : {}),
        ...(latestRuntimeMessage
          ? {
              preview: summarizeMessagePreview(latestRuntimeMessage.body),
              updatedAt: latestRuntimeMessage.createdAt,
              unreadCount: conversation.id === activeConversationId ? 0 : latestRuntimeMessage.isMine ? 0 : (livePatch?.unreadCount ?? conversation.unreadCount),
            }
          : {}),
      }
    }),
    patches.promotedConversationIds,
  )

  if (!activeConversation || deletedConversationIdSet.has(activeConversation.id)) {
    return {
      ...initialData,
      conversations,
      activeConversation: null,
    }
  }

  const resolvedActiveConversationId = activeConversation.id
  const historyMessages = patches.historyMessagesByConversation[resolvedActiveConversationId] ?? []
  const incomingMessages = patches.incomingMessagesByConversation[resolvedActiveConversationId] ?? []
  const optimisticMessages = patches.optimisticMessagesByConversation[resolvedActiveConversationId] ?? []
  const livePatch = patches.liveConversationPatches[resolvedActiveConversationId]
  const messages = mergeMessages(historyMessages, activeConversation.messages, incomingMessages, optimisticMessages)

  return {
    ...initialData,
    conversations,
    activeConversation: {
      ...activeConversation,
      subtitle: livePatch?.subtitle ?? (messages.length > 0 ? activeConversation.kind === "SITE_CHAT" ? SITE_CHAT_SUBTITLE : "实时会话" : activeConversation.subtitle),
      updatedAt: livePatch?.updatedAt ?? messages.at(-1)?.createdAt ?? activeConversation.updatedAt,
      messages,
      hasMoreHistory: patches.historyHasMoreByConversation[resolvedActiveConversationId] ?? activeConversation.hasMoreHistory,
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

function filterMessageMapById(
  current: Record<string, MessageBubbleItem[]>,
  conversationId: string,
  messageId: string,
) {
  const messages = current[conversationId]
  if (!messages?.length || !messages.some((message) => message.id === messageId)) {
    return current
  }

  return {
    ...current,
    [conversationId]: messages.filter((message) => message.id !== messageId),
  }
}
