"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"

import { applyInboxStreamEvent, shouldPlayInboxPrompt, type InboxUnreadCounts } from "@/lib/inbox-prompt"
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
  const unreadCountsRef = useRef<InboxUnreadCounts>({
    unreadMessageCount: initialUnreadMessageCount,
    unreadNotificationCount: initialUnreadNotificationCount,
  })
  const messagePromptAudioRef = useRef<HTMLAudioElement | null>(null)
  const messagePromptAudioUnlockedRef = useRef(false)
  const messagePromptAudioContextRef = useRef<AudioContext | null>(null)
  const messagePromptAudioBufferRef = useRef<AudioBuffer | null>(null)
  const attentionTitleRef = useRef("")
  const baseTitleRef = useRef("")
  const [connectionStatus, setConnectionStatus] = useState<InboxConnectionStatus>(currentUserId ? "connecting" : "closed")
  const [unreadMessageCount, setUnreadMessageCount] = useState(initialUnreadMessageCount)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(initialUnreadNotificationCount)

  useEffect(() => {
    currentUserIdRef.current = currentUserId
  }, [currentUserId])

  useEffect(() => {
    unreadCountsRef.current = {
      unreadMessageCount,
      unreadNotificationCount,
    }
  }, [unreadMessageCount, unreadNotificationCount])

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

    const currentAttentionTitle = attentionTitleRef.current
    attentionTitleRef.current = ""

    if (currentAttentionTitle && baseTitleRef.current && document.title === currentAttentionTitle) {
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

    const observer = new MutationObserver(() => {
      if (!document.title || document.title === attentionTitleRef.current) {
        return
      }

      baseTitleRef.current = document.title

      if (attentionTitleRef.current) {
        document.title = attentionTitleRef.current
      }
    })

    observer.observe(document.head, {
      childList: true,
      characterData: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!currentUserId) {
      return
    }

    const browserWindow = window as Window & typeof globalThis & {
      webkitAudioContext?: typeof AudioContext
    }
    const AudioContextConstructor = browserWindow.AudioContext ?? browserWindow.webkitAudioContext
    const audioElement = new Audio("/apps/messages/prompt.mp3")
    const abortController = new AbortController()
    const audioContext = AudioContextConstructor ? new AudioContextConstructor() : null

    audioElement.preload = "auto"
    audioElement.setAttribute("playsinline", "true")
    messagePromptAudioRef.current = audioElement
    messagePromptAudioContextRef.current = audioContext

    void fetch("/apps/messages/prompt.mp3", {
      cache: "force-cache",
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`failed to load prompt audio: ${response.status}`)
        }

        return response.arrayBuffer()
      })
      .then((arrayBuffer) => audioContext ? audioContext.decodeAudioData(arrayBuffer.slice(0)) : null)
      .then((buffer) => {
        if (buffer && messagePromptAudioContextRef.current === audioContext) {
          messagePromptAudioBufferRef.current = buffer
        }
      })
      .catch(() => undefined)

    const unlockAudioContext = () => {
      if (audioContext && audioContext.state !== "closed" && audioContext.state !== "running") {
        void audioContext.resume()
          .then(() => {
            const oscillator = audioContext.createOscillator()
            const gain = audioContext.createGain()

            gain.gain.value = 0
            oscillator.connect(gain)
            gain.connect(audioContext.destination)
            oscillator.start()
            oscillator.stop(audioContext.currentTime + 0.01)
          })
          .catch(() => undefined)
      }
    }

    const unlockPromptAudio = () => {
      // Avoid pre-playing the real prompt clip here. Mobile Safari can leak
      // an audible burst even when volume is set to zero.
      messagePromptAudioUnlockedRef.current = true
      unlockAudioContext()
    }

    window.addEventListener("pointerdown", unlockPromptAudio, { passive: true })
    window.addEventListener("keydown", unlockPromptAudio)

    return () => {
      abortController.abort()
      window.removeEventListener("pointerdown", unlockPromptAudio)
      window.removeEventListener("keydown", unlockPromptAudio)
      messagePromptAudioBufferRef.current = null
      messagePromptAudioUnlockedRef.current = false
      audioElement.pause()
      messagePromptAudioRef.current = null

      if (messagePromptAudioContextRef.current === audioContext) {
        messagePromptAudioContextRef.current = null
      }

      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close().catch(() => undefined)
      }
    }
  }, [currentUserId])

  const playPromptAudio = useCallback(() => {
    const audioContext = messagePromptAudioContextRef.current
    const audioBuffer = messagePromptAudioBufferRef.current
    const fallbackAudio = messagePromptAudioRef.current

    const playFallbackAudio = () => {
      if (!fallbackAudio || !messagePromptAudioUnlockedRef.current) {
        return
      }

      fallbackAudio.currentTime = 0
      void fallbackAudio.play().catch(() => undefined)
    }

    const playBufferAudio = () => {
      if (!audioContext || !audioBuffer || audioContext.state !== "running") {
        playFallbackAudio()
        return
      }

      const source = audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContext.destination)
      source.start(0)
    }

    if (!audioContext || !audioBuffer) {
      playFallbackAudio()
      return
    }

    if (audioContext.state === "running") {
      playBufferAudio()
      return
    }

    if (audioContext.state === "suspended") {
      void audioContext.resume()
        .then(() => {
          playBufferAudio()
        })
        .catch(() => {
          playFallbackAudio()
        })
      return
    }

    playFallbackAudio()
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
      const previousCounts = unreadCountsRef.current
      const nextCounts = applyInboxStreamEvent(previousCounts, event, currentUserIdRef.current)

      unreadCountsRef.current = nextCounts

      if (nextCounts.unreadMessageCount !== previousCounts.unreadMessageCount) {
        setUnreadMessageCount(nextCounts.unreadMessageCount)
      }

      if (nextCounts.unreadNotificationCount !== previousCounts.unreadNotificationCount) {
        setUnreadNotificationCount(nextCounts.unreadNotificationCount)
      }

      return previousCounts
    }

    const handleStreamMessage = (event: MessageEvent<string>) => {
      let payload: InboxStreamEvent

      try {
        payload = JSON.parse(event.data) as InboxStreamEvent
      } catch {
        return
      }

      const previousCounts = applyEventState(payload)

      if (shouldPlayInboxPrompt(payload, currentUserIdRef.current, previousCounts)) {
        playPromptAudio()
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
  }, [currentUserId, notifyListeners, playPromptAudio, restoreDocumentTitle])

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
