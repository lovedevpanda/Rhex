"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"

import type { InboxStreamEvent } from "@/lib/message-types"

type InboxConnectionStatus = "connecting" | "connected" | "closed"

interface InboxRealtimeContextValue {
  currentUserId: number | null
  unreadMessageCount: number
  unreadNotificationCount: number
  connectionStatus: InboxConnectionStatus
  subscribe: (listener: (event: InboxStreamEvent) => void) => () => void
}

const defaultInboxRealtimeContextValue: InboxRealtimeContextValue = {
  currentUserId: null,
  unreadMessageCount: 0,
  unreadNotificationCount: 0,
  connectionStatus: "closed",
  subscribe: () => () => undefined,
}

const InboxRealtimeContext = createContext<InboxRealtimeContextValue>(defaultInboxRealtimeContextValue)

function buildAttentionTitle(pathname: string, unreadMessageCount: number, unreadNotificationCount: number) {
  const visibleUnreadMessageCount = pathname === "/messages" ? 0 : unreadMessageCount
  const visibleUnreadNotificationCount = pathname === "/notifications" ? 0 : unreadNotificationCount

  if (visibleUnreadMessageCount > 0 && visibleUnreadNotificationCount > 0) {
    return "有新消息和通知"
  }

  if (visibleUnreadMessageCount > 0) {
    return visibleUnreadMessageCount > 1 ? `有新消息（${visibleUnreadMessageCount}）` : "有新消息"
  }

  if (visibleUnreadNotificationCount > 0) {
    return visibleUnreadNotificationCount > 1 ? `有新通知（${visibleUnreadNotificationCount}）` : "有新通知"
  }

  return ""
}

interface InboxRealtimeProviderProps {
  children: React.ReactNode
  currentUserId?: number | null
  initialUnreadMessageCount?: number
  initialUnreadNotificationCount?: number
}

export function InboxRealtimeProvider({
  children,
  currentUserId = null,
  initialUnreadMessageCount = 0,
  initialUnreadNotificationCount = 0,
}: InboxRealtimeProviderProps) {
  const pathname = usePathname()
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const streamCursorRef = useRef<string | null>(null)
  const listenersRef = useRef(new Set<(event: InboxStreamEvent) => void>())
  const currentUserIdRef = useRef<number | null>(currentUserId)
  const messagePromptAudioRef = useRef<HTMLAudioElement | null>(null)
  const attentionTitleRef = useRef("")
  const baseTitleRef = useRef("")
  const [connectionStatus, setConnectionStatus] = useState<InboxConnectionStatus>(currentUserId ? "connecting" : "closed")
  const [unreadMessageCount, setUnreadMessageCount] = useState(initialUnreadMessageCount)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(initialUnreadNotificationCount)

  useEffect(() => {
    currentUserIdRef.current = currentUserId
  }, [currentUserId])

  const notifyListeners = useCallback((event: InboxStreamEvent) => {
    for (const listener of listenersRef.current) {
      try {
        listener(event)
      } catch (error) {
        console.error("[inbox-realtime-provider] listener failed", error)
      }
    }
  }, [])

  const subscribe = useCallback((listener: (event: InboxStreamEvent) => void) => {
    listenersRef.current.add(listener)

    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  const restoreDocumentTitle = useCallback(() => {
    if (typeof document === "undefined") {
      return
    }

    attentionTitleRef.current = ""

    if (baseTitleRef.current && document.title !== baseTitleRef.current) {
      document.title = baseTitleRef.current
    }
  }, [])

  useEffect(() => {
    if (typeof document === "undefined") {
      return
    }

    if (!baseTitleRef.current) {
      baseTitleRef.current = document.title
    }

    const titleElement = document.querySelector("title")
    if (!titleElement) {
      return
    }

    const observer = new MutationObserver(() => {
      if (document.title !== attentionTitleRef.current) {
        baseTitleRef.current = document.title
      }
    })

    observer.observe(titleElement, {
      childList: true,
    })

    return () => {
      observer.disconnect()
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
    if (typeof document === "undefined") {
      return
    }

    const nextTitle = currentUserId
      ? buildAttentionTitle(pathname, unreadMessageCount, unreadNotificationCount)
      : ""

    if (!nextTitle) {
      restoreDocumentTitle()
      return
    }

    attentionTitleRef.current = nextTitle

    if (document.title !== nextTitle) {
      document.title = nextTitle
    }
  }, [currentUserId, pathname, restoreDocumentTitle, unreadMessageCount, unreadNotificationCount])

  useEffect(() => {
    if (!currentUserId) {
      reconnectAttemptRef.current = 0
      streamCursorRef.current = null
      restoreDocumentTitle()
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

      setConnectionStatus("connecting")
      const delay = Math.min(30_000, 1_000 * 2 ** reconnectAttemptRef.current)
      reconnectAttemptRef.current += 1

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        connect()
      }, delay)
    }

    const applyEventState = (event: InboxStreamEvent) => {
      const activeUserId = currentUserIdRef.current

      switch (event.type) {
        case "inbox.snapshot":
          setUnreadMessageCount(event.unreadMessageCount)
          setUnreadNotificationCount(event.unreadNotificationCount)
          return
        case "message.created":
          if (activeUserId && event.recipientId === activeUserId && typeof event.recipientUnreadMessageCount === "number") {
            setUnreadMessageCount(event.recipientUnreadMessageCount)
          }
          return
        case "conversation.read":
        case "conversation.deleted":
          if (activeUserId && event.userId === activeUserId) {
            setUnreadMessageCount(event.unreadMessageCount)
          }
          return
        case "notification.count":
          if (activeUserId && event.userId === activeUserId) {
            setUnreadNotificationCount(event.unreadNotificationCount)
          }
          return
        case "heartbeat":
          return
      }
    }

    const handleStreamMessage = (event: MessageEvent<string>) => {
      let payload: InboxStreamEvent

      try {
        payload = JSON.parse(event.data) as InboxStreamEvent
      } catch {
        return
      }

      applyEventState(payload)

      if (
        payload.type === "message.created"
        && payload.recipientId === currentUserIdRef.current
        && payload.senderId !== currentUserIdRef.current
        && document.visibilityState === "visible"
        && document.hasFocus()
      ) {
        const audio = messagePromptAudioRef.current
        if (audio) {
          audio.currentTime = 0
          void audio.play().catch(() => undefined)
        }
      }

      if (payload.type !== "heartbeat") {
        notifyListeners(payload)
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
      setConnectionStatus("connecting")

      const streamUrl = new URL("/api/messages/stream", window.location.origin)
      if (streamCursorRef.current) {
        streamUrl.searchParams.set("cursor", streamCursorRef.current)
      }

      eventSource = new EventSource(streamUrl)

      eventSource.onopen = () => {
        reconnectAttemptRef.current = 0
        setConnectionStatus("connected")
      }

      eventSource.onmessage = handleStreamMessage
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
      setConnectionStatus("closed")
      eventSource?.close()
    }
  }, [currentUserId, notifyListeners, restoreDocumentTitle])

  const value = useMemo<InboxRealtimeContextValue>(() => ({
    currentUserId,
    unreadMessageCount,
    unreadNotificationCount,
    connectionStatus,
    subscribe,
  }), [connectionStatus, currentUserId, subscribe, unreadMessageCount, unreadNotificationCount])

  return <InboxRealtimeContext.Provider value={value}>{children}</InboxRealtimeContext.Provider>
}

export function useInboxRealtime() {
  return useContext(InboxRealtimeContext)
}
