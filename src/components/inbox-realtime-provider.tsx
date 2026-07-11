"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"

import { applyInboxStreamEvent, shouldPlayInboxPrompt, type InboxUnreadCounts } from "@/lib/inbox-prompt"
import { DEFAULT_MESSAGE_PROMPT_AUDIO_PATH, normalizeMessagePromptAudioPath } from "@/lib/message-prompt-audio"
import {
  DEFAULT_MESSAGE_REALTIME_HEARTBEAT_SECONDS,
  normalizeMessageRealtimeHeartbeatSeconds,
} from "@/lib/message-realtime-settings"
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
const CROSS_TAB_LEADER_HEARTBEAT_MS = 4_000
const CROSS_TAB_LEADER_TTL_MS = 12_000

interface InboxRealtimeLockManager {
  request<T>(
    name: string,
    options: { mode: "exclusive" },
    callback: () => T | Promise<T>,
  ): Promise<T>
}

interface InboxRealtimeLeaderLease {
  ownerId: string
  expiresAt: number
}

type InboxRealtimeChannelMessage =
  | {
    type: "event"
    senderId: string
    event: InboxStreamEvent
  }
  | {
    type: "cursor"
    senderId: string
    cursor: string
  }
  | {
    type: "status"
    senderId: string
    status: InboxConnectionStatus
  }
type InboxRealtimeChannelMessageInput = InboxRealtimeChannelMessage extends infer Message
  ? Message extends unknown
    ? Omit<Message, "senderId">
    : never
  : never

function createInboxRealtimeTabId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `${Date.now()}:${Math.random().toString(36).slice(2)}`
}

function getInboxRealtimeLeaderKey(userId: number) {
  return `bbs:inbox-realtime:leader:${userId}`
}

function getInboxRealtimeChannelName(userId: number) {
  return `bbs:inbox-realtime:${userId}`
}

function getInboxRealtimeLockManager() {
  const locks = (navigator as Navigator & { locks?: InboxRealtimeLockManager }).locks
  return typeof locks?.request === "function" ? locks : null
}

function canUseLeaderStorage(key: string) {
  try {
    const probeKey = `${key}:probe`
    window.localStorage.setItem(probeKey, "1")
    window.localStorage.removeItem(probeKey)
    return true
  } catch {
    return false
  }
}

function readLeaderLease(key: string): InboxRealtimeLeaderLease | null {
  try {
    const rawValue = window.localStorage.getItem(key)
    if (!rawValue) {
      return null
    }

    const parsed = JSON.parse(rawValue) as Partial<InboxRealtimeLeaderLease>
    if (typeof parsed.ownerId !== "string" || typeof parsed.expiresAt !== "number") {
      return null
    }

    return {
      ownerId: parsed.ownerId,
      expiresAt: parsed.expiresAt,
    }
  } catch {
    return null
  }
}

function writeLeaderLease(key: string, ownerId: string) {
  const lease = {
    ownerId,
    expiresAt: Date.now() + CROSS_TAB_LEADER_TTL_MS,
  } satisfies InboxRealtimeLeaderLease

  try {
    window.localStorage.setItem(key, JSON.stringify(lease))
    return readLeaderLease(key)?.ownerId === ownerId
  } catch {
    return false
  }
}

function releaseLeaderLease(key: string, ownerId: string) {
  try {
    if (readLeaderLease(key)?.ownerId === ownerId) {
      window.localStorage.removeItem(key)
    }
  } catch {
    // localStorage may be unavailable in restricted browser modes.
  }
}

function isLeaderLeaseActive(lease: InboxRealtimeLeaderLease | null) {
  return Boolean(lease && lease.expiresAt > Date.now())
}

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
  messageEnabled?: boolean
  messagePromptAudioPath?: string
  messageRealtimeEnabled?: boolean
  messageRealtimeHeartbeatSeconds?: number
}

export function InboxRealtimeProvider({
  children,
  currentUserId = null,
  initialUnreadMessageCount = 0,
  initialUnreadNotificationCount = 0,
  messageEnabled = true,
  messagePromptAudioPath = DEFAULT_MESSAGE_PROMPT_AUDIO_PATH,
  messageRealtimeEnabled = true,
  messageRealtimeHeartbeatSeconds = DEFAULT_MESSAGE_REALTIME_HEARTBEAT_SECONDS,
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
  const [connectionStatus, setConnectionStatus] = useState<InboxConnectionStatus>(currentUserId && messageRealtimeEnabled ? "connecting" : "closed")
  const [unreadMessageCount, setUnreadMessageCount] = useState(initialUnreadMessageCount)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(initialUnreadNotificationCount)
  const resolvedMessagePromptAudioPath = useMemo(
    () => normalizeMessagePromptAudioPath(messagePromptAudioPath, DEFAULT_MESSAGE_PROMPT_AUDIO_PATH),
    [messagePromptAudioPath],
  )
  const resolvedRealtimeHeartbeatSeconds = normalizeMessageRealtimeHeartbeatSeconds(messageRealtimeHeartbeatSeconds)

  useEffect(() => {
    currentUserIdRef.current = currentUserId
  }, [currentUserId])

  useEffect(() => {
    const nextCounts = {
      unreadMessageCount: messageEnabled ? initialUnreadMessageCount : 0,
      unreadNotificationCount: initialUnreadNotificationCount,
    }

    unreadCountsRef.current = nextCounts
    queueMicrotask(() => {
      setUnreadMessageCount((current) =>
        current === nextCounts.unreadMessageCount
          ? current
          : nextCounts.unreadMessageCount,
      )
      setUnreadNotificationCount((current) =>
        current === nextCounts.unreadNotificationCount
          ? current
          : nextCounts.unreadNotificationCount,
      )
    })
  }, [
    initialUnreadMessageCount,
    initialUnreadNotificationCount,
    messageEnabled,
  ])

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
    if (!currentUserId || !messageEnabled || !messageRealtimeEnabled) {
      return
    }

    const browserWindow = window as Window & typeof globalThis & {
      webkitAudioContext?: typeof AudioContext
    }
    const AudioContextConstructor = browserWindow.AudioContext ?? browserWindow.webkitAudioContext
    const audioElement = new Audio(resolvedMessagePromptAudioPath)
    const abortController = new AbortController()
    const audioContext = AudioContextConstructor ? new AudioContextConstructor() : null

    audioElement.preload = "auto"
    audioElement.setAttribute("playsinline", "true")
    audioElement.crossOrigin = "anonymous"
    messagePromptAudioRef.current = audioElement
    messagePromptAudioContextRef.current = audioContext

    void fetch(resolvedMessagePromptAudioPath, {
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
  }, [currentUserId, messageEnabled, messageRealtimeEnabled, resolvedMessagePromptAudioPath])

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
    if (!currentUserId || !messageRealtimeEnabled) {
      reconnectAttemptRef.current = 0
      streamCursorRef.current = null
      queueMicrotask(() => {
        setConnectionStatus("closed")
      })
      restoreDocumentTitle()
      return
    }

    let closed = false
    let eventSource: EventSource | null = null
    let isLeader = false
    let leaderStatus: InboxConnectionStatus = "connecting"
    let leaderTimer: number | null = null
    let releaseWebLock: (() => void) | null = null
    const tabId = createInboxRealtimeTabId()
    const leaderKey = getInboxRealtimeLeaderKey(currentUserId)
    const canCreateChannel = typeof BroadcastChannel === "function"
    const availableLockManager = canCreateChannel ? getInboxRealtimeLockManager() : null
    const canUseStorageLeader = Boolean(canCreateChannel && canUseLeaderStorage(leaderKey))
    const channel = canCreateChannel && (availableLockManager || canUseStorageLeader)
      ? new BroadcastChannel(getInboxRealtimeChannelName(currentUserId))
      : null
    const lockManager = channel ? availableLockManager : null

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const closeEventSource = () => {
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }
    }

    const postChannelMessage = (message: InboxRealtimeChannelMessageInput) => {
      channel?.postMessage({
        ...message,
        senderId: tabId,
      } as InboxRealtimeChannelMessage)
    }

    const setSharedConnectionStatus = (status: InboxConnectionStatus) => {
      leaderStatus = status
      setConnectionStatus(status)
      postChannelMessage({
        type: "status",
        status,
      })
    }

    const scheduleReconnect = () => {
      if (closed || reconnectTimerRef.current) {
        return
      }

      setSharedConnectionStatus("connecting")
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
      const visibleNextCounts = messageEnabled
        ? nextCounts
        : { ...nextCounts, unreadMessageCount: 0 }

      unreadCountsRef.current = visibleNextCounts

      if (visibleNextCounts.unreadMessageCount !== previousCounts.unreadMessageCount) {
        setUnreadMessageCount(visibleNextCounts.unreadMessageCount)
      }

      if (visibleNextCounts.unreadNotificationCount !== previousCounts.unreadNotificationCount) {
        setUnreadNotificationCount(visibleNextCounts.unreadNotificationCount)
      }

      return previousCounts
    }

    const handleInboxEvent = (payload: InboxStreamEvent) => {
      const previousCounts = applyEventState(payload)

      if (messageEnabled && shouldPlayInboxPrompt(payload, currentUserIdRef.current, previousCounts)) {
        playPromptAudio()
      }

      if (payload.type !== "heartbeat") {
        notifyListeners(payload)
      }
    }

    const handleStreamMessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as InboxStreamEvent
        handleInboxEvent(payload)

        if (payload.type !== "heartbeat") {
          postChannelMessage({
            type: "event",
            event: payload,
          })
        }
      } catch {
        return
      }
    }

    const handleCursorPayload = (payload: { cursor?: string }) => {
      if (typeof payload.cursor === "string" && payload.cursor) {
        streamCursorRef.current = payload.cursor
        postChannelMessage({
          type: "cursor",
          cursor: payload.cursor,
        })
      }
    }

    const handleCursor = (event: Event) => {
      try {
        handleCursorPayload(JSON.parse((event as MessageEvent<string>).data) as { cursor?: string })
      } catch {
        return
      }
    }

    const connect = () => {
      if (closed || (channel && !isLeader)) {
        return
      }

      clearReconnectTimer()
      setSharedConnectionStatus("connecting")

      const streamUrl = new URL("/api/messages/stream", window.location.origin)
      if (streamCursorRef.current) {
        streamUrl.searchParams.set("cursor", streamCursorRef.current)
      }
      streamUrl.searchParams.set("heartbeat", String(resolvedRealtimeHeartbeatSeconds))

      eventSource = new EventSource(streamUrl)

      eventSource.onopen = () => {
        reconnectAttemptRef.current = 0
        setSharedConnectionStatus("connected")
      }

      eventSource.onmessage = handleStreamMessage
      eventSource.addEventListener("cursor", handleCursor as EventListener)
      eventSource.onerror = () => {
        closeEventSource()
        scheduleReconnect()
      }
    }

    const stopLeading = () => {
      if (!isLeader) {
        return
      }

      isLeader = false
      clearReconnectTimer()
      closeEventSource()
      if (!lockManager) {
        releaseLeaderLease(leaderKey, tabId)
      }
      setConnectionStatus("connecting")
    }

    const refreshLeaderLease = () => {
      if (!isLeader) {
        return false
      }

      if (!writeLeaderLease(leaderKey, tabId)) {
        stopLeading()
        return false
      }

      postChannelMessage({
        type: "status",
        status: leaderStatus,
      })
      return true
    }

    const startLeading = () => {
      if (closed || isLeader || !writeLeaderLease(leaderKey, tabId)) {
        return
      }

      isLeader = true
      leaderStatus = "connecting"
      connect()
    }

    const requestWebLockLeadership = () => {
      if (!lockManager) {
        return
      }

      let resolveLockLifetime: (() => void) | null = null
      const lockLifetime = new Promise<void>((resolve) => {
        resolveLockLifetime = resolve
      })
      releaseWebLock = () => {
        resolveLockLifetime?.()
        resolveLockLifetime = null
      }

      void lockManager.request(leaderKey, { mode: "exclusive" }, async () => {
        if (closed) {
          return
        }

        isLeader = true
        leaderStatus = "connecting"
        connect()

        await lockLifetime

        if (isLeader) {
          isLeader = false
          clearReconnectTimer()
          closeEventSource()
        }
      }).catch((error) => {
        console.error("[inbox-realtime-provider] failed to acquire realtime lock", error)
        if (!closed && canUseStorageLeader) {
          startLeading()
        }
      })
    }

    const checkLeadership = () => {
      if (closed) {
        return
      }

      if (!channel) {
        if (!eventSource && !reconnectTimerRef.current) {
          connect()
        }
        return
      }

      if (lockManager) {
        return
      }

      if (isLeader) {
        refreshLeaderLease()
        return
      }

      if (!isLeaderLeaseActive(readLeaderLease(leaderKey))) {
        startLeading()
      }
    }

    if (channel) {
      channel.onmessage = (event: MessageEvent<InboxRealtimeChannelMessage>) => {
        const message = event.data
        if (!message || message.senderId === tabId) {
          return
        }

        if (message.type === "event") {
          handleInboxEvent(message.event)
          return
        }

        if (message.type === "cursor") {
          streamCursorRef.current = message.cursor
          return
        }

        if (message.type === "status") {
          setConnectionStatus(message.status)
        }
      }

      if (lockManager) {
        requestWebLockLeadership()
      } else if (canUseStorageLeader) {
        window.addEventListener("storage", checkLeadership)
        leaderTimer = window.setInterval(checkLeadership, CROSS_TAB_LEADER_HEARTBEAT_MS)
        checkLeadership()
      } else {
        connect()
      }
    } else {
      connect()
    }

    return () => {
      closed = true
      if (leaderTimer) {
        window.clearInterval(leaderTimer)
      }
      window.removeEventListener("storage", checkLeadership)
      clearReconnectTimer()
      reconnectAttemptRef.current = 0
      setConnectionStatus("closed")
      closeEventSource()
      releaseWebLock?.()
      releaseLeaderLease(leaderKey, tabId)
      channel?.close()
    }
  }, [currentUserId, messageEnabled, messageRealtimeEnabled, notifyListeners, playPromptAudio, resolvedRealtimeHeartbeatSeconds, restoreDocumentTitle])

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
