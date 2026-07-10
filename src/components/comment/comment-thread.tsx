"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { GitBranch, List } from "lucide-react"

import { CommentThreadCommentItem, CommentThreadReplyItem, type CommentThreadTippingConfig } from "@/components/comment/comment-thread-items"
import { CommentThreadReplyBox } from "@/components/comment/comment-thread-shared"

import { updateBrowsingPreferences } from "@/lib/browsing-preferences"
import type { SiteCommentItem, SiteCommentReplyItem, SiteFlatCommentItem } from "@/lib/comments"
import { COMMENT_REPLY_TOGGLE_EVENT, emitCommentReplyState, type CommentReplyTarget, type CommentReplyToggleDetail } from "@/lib/comment-reply-box-events"
import { COMMENT_LOAD_MODE_INFINITE, COMMENT_LOAD_MODE_PAGINATION, type CommentLoadMode } from "@/lib/comment-load-mode"
import { buildCommentNavigationUrl } from "@/lib/comment-navigation"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import { dispatchPostBountyResolved } from "@/lib/post-discussion-events"

interface CommentThreadProps {
  threadId: string
  comments: SiteCommentItem[]
  flatComments?: SiteFlatCommentItem[]
  postId: string
  postPath: string
  pointName?: string
  tipping?: CommentThreadTippingConfig
  canReply: boolean
  currentPage: number
  pageSize: number
  total: number
  currentSort: "oldest" | "newest"
  currentDisplayMode: "tree" | "flat"
  commentLoadMode?: CommentLoadMode
  currentUserId?: number
  canAcceptAnswer?: boolean
  commentsVisibleToAuthorOnly?: boolean
  canOfflineOwnComment?: boolean
  canOfflineUserComment?: boolean
  anonymousReplyEnabled?: boolean
  anonymousReplyDefaultChecked?: boolean
  anonymousReplySwitchVisible?: boolean
  isAdmin?: boolean
  adminRole?: "ADMIN" | "MODERATOR" | null
  canPinComment?: boolean
  markdownEmojiMap?: MarkdownEmojiItem[]
  commentEditWindowMinutes?: number
  initialVisibleReplies?: number
}

const REPLY_BOX_FOLLOW_ENTER_OFFSET = 72
const REPLY_BOX_FOLLOW_EXIT_OFFSET = 20
const COMMENT_ANCHOR_SCROLL_RETRY_MS = 120
const COMMENT_ANCHOR_SCROLL_MIN_SETTLE_MS = 1200
const COMMENT_ANCHOR_SCROLL_MAX_MS = 3200
const COMMENT_ANCHOR_SCROLL_TOLERANCE = 2
const COMMENT_ANCHOR_SCROLL_STABLE_ATTEMPTS = 3
const COMMENT_HIGHLIGHT_CLEAR_DELAY_MS = 4200

type PaginationToken = number | "ellipsis"

interface CommentListApiPayload {
  items: SiteCommentItem[]
  flatItems: SiteFlatCommentItem[]
  total: number
  page: number
  pageSize: number
  hasNextPage: boolean
  viewMode: "tree" | "flat"
}

interface GodCommentApiPayload {
  message?: string
  data?: {
    isGodComment?: boolean
    page?: number
  }
}

function buildPageTokens(page: number, totalPages: number): PaginationToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const tokens = new Set<number>([1, totalPages, page, page - 1, page + 1])
  const visiblePages = Array.from(tokens)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right)

  const result: PaginationToken[] = []

  for (const current of visiblePages) {
    const previous = typeof result.at(-1) === "number" ? (result.at(-1) as number) : null

    if (previous !== null && current - previous > 1) {
      result.push("ellipsis")
    }

    result.push(current)
  }

  return result
}

function getFlatEntryId(entry: SiteFlatCommentItem) {
  return entry.type === "comment" ? entry.comment.id : entry.reply.id
}

function appendUniqueComments(current: SiteCommentItem[], nextItems: SiteCommentItem[]) {
  const knownIds = new Set(current.map((comment) => comment.id))
  return [
    ...current,
    ...nextItems.filter((comment) => !knownIds.has(comment.id)),
  ]
}

function appendUniqueFlatComments(current: SiteFlatCommentItem[], nextItems: SiteFlatCommentItem[]) {
  const knownIds = new Set(current.map(getFlatEntryId))
  return [
    ...current,
    ...nextItems.filter((entry) => !knownIds.has(getFlatEntryId(entry))),
  ]
}

function shouldIgnoreReplyShortcut(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  if (target.closest("[contenteditable='true'], [role='dialog'], [data-ignore-reply-shortcut='true']")) {
    return true
  }

  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

function getCommentAnchorScrollTop(target: HTMLElement) {
  const scrollElement = document.scrollingElement ?? document.documentElement
  const targetTop = target.getBoundingClientRect().top + scrollElement.scrollTop
  const scrollMarginTop = Number.parseFloat(window.getComputedStyle(target).scrollMarginTop)
  const targetMarginTop = Number.isFinite(scrollMarginTop) ? scrollMarginTop : 0
  const maxScrollTop = Math.max(0, scrollElement.scrollHeight - window.innerHeight)

  return Math.min(Math.max(0, targetTop - targetMarginTop), maxScrollTop)
}

function scrollCommentAnchorIntoView(target: HTMLElement, behavior: ScrollBehavior) {
  const scrollElement = document.scrollingElement ?? document.documentElement
  const nextScrollTop = getCommentAnchorScrollTop(target)

  if (Math.abs(scrollElement.scrollTop - nextScrollTop) <= COMMENT_ANCHOR_SCROLL_TOLERANCE) {
    return true
  }

  window.scrollTo({
    top: nextScrollTop,
    behavior,
  })

  return false
}

function getCommentThreadStateKey({
  threadId,
  comments,
  flatComments = [],
  currentPage,
  pageSize,
  total,
  canAcceptAnswer = false,
}: CommentThreadProps) {
  return JSON.stringify([threadId, comments, flatComments, currentPage, pageSize, total, canAcceptAnswer])
}

export function CommentThread(props: CommentThreadProps) {
  return <CommentThreadContent key={getCommentThreadStateKey(props)} {...props} />
}

function CommentThreadContent({ threadId, comments, flatComments = [], postId, postPath, pointName, tipping, canReply, currentPage, pageSize, total, currentSort, currentDisplayMode, commentLoadMode = COMMENT_LOAD_MODE_PAGINATION, currentUserId, canAcceptAnswer = false, commentsVisibleToAuthorOnly = false, canOfflineOwnComment = false, canOfflineUserComment = false, anonymousReplyEnabled = false, anonymousReplyDefaultChecked = false, anonymousReplySwitchVisible = false, isAdmin = false, adminRole = null, canPinComment = false, markdownEmojiMap, commentEditWindowMinutes = 5, initialVisibleReplies = 10 }: CommentThreadProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [localComments, setLocalComments] = useState(comments)
  const [localFlatComments, setLocalFlatComments] = useState(flatComments)
  const [localTotal, setLocalTotal] = useState(total)
  const [loadedPage, setLoadedPage] = useState(currentPage)
  const [hasNextInfinitePage, setHasNextInfinitePage] = useState(currentPage * pageSize < total)
  const [isLoadingMoreComments, setIsLoadingMoreComments] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState("")
  const [canAcceptAnswerState, setCanAcceptAnswerState] = useState(canAcceptAnswer)
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  const [submittingAnswerId, setSubmittingAnswerId] = useState<string | null>(null)
  const [pinningCommentId, setPinningCommentId] = useState<string | null>(null)
  const [markingGodCommentId, setMarkingGodCommentId] = useState<string | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState("")
  const [replyTarget, setReplyTarget] = useState<CommentReplyTarget | null>(null)
  const [showOnlyAuthorComments, setShowOnlyAuthorComments] = useState(false)
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null)
  const [isReplyBoxPinned, setIsReplyBoxPinned] = useState(false)
  const [isReplyBoxFollowing, setIsReplyBoxFollowing] = useState(false)
  const [replyBoxPinnedLayout, setReplyBoxPinnedLayout] = useState({ left: 0, width: 0 })
  const totalPages = Math.max(1, Math.ceil(localTotal / pageSize))
  const replyBoxContainerRef = useRef<HTMLDivElement | null>(null)
  const replyBoxFollowRafRef = useRef<number | null>(null)
  const infiniteSentinelRef = useRef<HTMLDivElement | null>(null)

  const filteredComments = useMemo(() => {
    if (!showOnlyAuthorComments) {
      return localComments
    }

    return localComments
      .filter((comment) => comment.isPostAuthor || comment.replies.some((reply) => reply.isPostAuthor))
      .map((comment) => ({
        ...comment,
        replies: comment.replies.filter((reply) => reply.isPostAuthor),
      }))
  }, [localComments, showOnlyAuthorComments])
  const filteredFlatComments = useMemo(() => {
    if (!showOnlyAuthorComments) {
      return localFlatComments
    }

    return localFlatComments.filter((entry) => entry.type === "comment" ? entry.comment.isPostAuthor : entry.reply.isPostAuthor)
  }, [localFlatComments, showOnlyAuthorComments])
  const buildCommentHref = useCallback((patch: { sort?: "oldest" | "newest"; page?: number; view?: "tree" | "flat" }) => {
    return buildCommentNavigationUrl({
      pathname,
      searchParams,
      commentLoadMode,
      navigation: {
        sort: patch.sort ?? currentSort,
        page: patch.page ?? currentPage,
        view: patch.view ?? currentDisplayMode,
      },
    })
  }, [commentLoadMode, currentDisplayMode, currentPage, currentSort, pathname, searchParams])

  const buildCommentHighlightHref = useCallback((commentId: string, patch: { sort?: "oldest" | "newest"; page?: number; view?: "tree" | "flat" }) => {
    return buildCommentNavigationUrl({
      pathname,
      searchParams,
      commentLoadMode,
      navigation: {
        sort: patch.sort ?? currentSort,
        page: patch.page ?? currentPage,
        view: patch.view ?? currentDisplayMode,
        anchor: `comment-${commentId}`,
      },
    })
  }, [commentLoadMode, currentDisplayMode, currentPage, currentSort, pathname, searchParams])

  const loadMoreComments = useCallback(async () => {
    if (commentLoadMode !== COMMENT_LOAD_MODE_INFINITE || isLoadingMoreComments || !hasNextInfinitePage) {
      return
    }

    setIsLoadingMoreComments(true)
    setLoadMoreError("")

    try {
      const nextUrl = new URL("/api/comments/list", window.location.origin)
      nextUrl.searchParams.set("postId", postId)
      nextUrl.searchParams.set("page", String(loadedPage + 1))
      nextUrl.searchParams.set("sort", currentSort)
      nextUrl.searchParams.set("view", currentDisplayMode)

      const response = await fetch(nextUrl.toString(), {
        credentials: "same-origin",
      })
      const result = await response.json().catch(() => null) as { data?: CommentListApiPayload; message?: string } | null

      if (!response.ok || !result?.data) {
        setLoadMoreError(result?.message || "评论加载失败")
        return
      }

      if (result.data.viewMode !== currentDisplayMode) {
        return
      }

      if (currentDisplayMode === "tree") {
        setLocalComments((current) => appendUniqueComments(current, result.data!.items))
      } else {
        setLocalFlatComments((current) => appendUniqueFlatComments(current, result.data!.flatItems))
      }

      setLocalTotal(result.data.total)
      setLoadedPage(result.data.page)
      setHasNextInfinitePage(result.data.hasNextPage)
    } catch {
      setLoadMoreError("评论加载失败")
    } finally {
      setIsLoadingMoreComments(false)
    }
  }, [commentLoadMode, currentDisplayMode, currentSort, hasNextInfinitePage, isLoadingMoreComments, loadedPage, postId])

  useEffect(() => {
    if (commentLoadMode !== COMMENT_LOAD_MODE_INFINITE || !hasNextInfinitePage || !infiniteSentinelRef.current) {
      return
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMoreComments()
      }
    }, { rootMargin: "240px 0px" })

    observer.observe(infiniteSentinelRef.current)

    return () => observer.disconnect()
  }, [commentLoadMode, hasNextInfinitePage, loadMoreComments])

  const replyHint = replyTarget ? `正在回复 @${replyTarget.replyToUserName}` : null

  const findRootCommentByCommentId = useCallback((commentId: string) => {
    for (const comment of localComments) {
      if (comment.id === commentId || comment.replies.some((reply) => reply.id === commentId)) {
        return comment
      }
    }

    return null
  }, [localComments])

  const ensureHighlightedCommentVisible = useCallback((commentId: string) => {
    if (currentDisplayMode !== "tree") {
      return
    }

    const rootComment = findRootCommentByCommentId(commentId)
    if (!rootComment || rootComment.id === commentId || rootComment.replies.length <= initialVisibleReplies) {
      return
    }

    setExpandedReplies((current) => {
      if (current[rootComment.id]) {
        return current
      }

      return {
        ...current,
        [rootComment.id]: true,
      }
    })
  }, [currentDisplayMode, findRootCommentByCommentId, initialVisibleReplies])

  const triggerCommentHighlight = useCallback((commentId: string) => {
    window.requestAnimationFrame(() => {
      ensureHighlightedCommentVisible(commentId)
      setHighlightedCommentId(null)
      window.requestAnimationFrame(() => {
        setHighlightedCommentId(commentId)
      })
    })
  }, [ensureHighlightedCommentVisible])

  const clearCommentHighlightSearchParam = useCallback((commentId: string) => {
    const currentUrl = new URL(window.location.href)

    if (currentUrl.searchParams.get("highlight") !== commentId) {
      return
    }

    currentUrl.searchParams.delete("highlight")
    window.history.replaceState(window.history.state, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`)
  }, [])

  useEffect(() => {
    function syncHighlightedCommentFromLocation() {
      const highlightedFromSearch = searchParams.get("highlight")
      if (highlightedFromSearch) {
        triggerCommentHighlight(highlightedFromSearch)
        return
      }

      const hash = typeof window === "undefined" ? "" : window.location.hash
      if (!hash.startsWith("#comment-")) {
        setHighlightedCommentId(null)
        return
      }

      triggerCommentHighlight(hash.slice("#comment-".length))
    }

    syncHighlightedCommentFromLocation()
    window.addEventListener("hashchange", syncHighlightedCommentFromLocation)

    return () => {
      window.removeEventListener("hashchange", syncHighlightedCommentFromLocation)
    }
  }, [searchParams, triggerCommentHighlight])

  useEffect(() => {
    if (!highlightedCommentId) {
      return
    }

    let cancelled = false
    let rafId: number | null = null
    let retryTimeoutId: number | null = null
    let stableAttempts = 0
    let hasUsedSmoothScroll = false
    const startedAt = window.performance.now()
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const scheduleScrollAttempt = (delay = 0) => {
      if (cancelled) {
        return
      }

      if (delay > 0) {
        retryTimeoutId = window.setTimeout(() => {
          retryTimeoutId = null
          scheduleScrollAttempt()
        }, delay)
        return
      }

      rafId = window.requestAnimationFrame(scrollToHighlightedComment)
    }

    const scrollToHighlightedComment = () => {
      rafId = null

      if (cancelled) {
        return
      }

      const target = document.getElementById(`comment-${highlightedCommentId}`)
      if (target) {
        const elapsed = window.performance.now() - startedAt
        const behavior: ScrollBehavior = hasUsedSmoothScroll || prefersReducedMotion ? "auto" : "smooth"
        const isSettled = scrollCommentAnchorIntoView(target, behavior)
        hasUsedSmoothScroll = true
        stableAttempts = isSettled ? stableAttempts + 1 : 0

        if (stableAttempts >= COMMENT_ANCHOR_SCROLL_STABLE_ATTEMPTS && elapsed >= COMMENT_ANCHOR_SCROLL_MIN_SETTLE_MS) {
          clearCommentHighlightSearchParam(highlightedCommentId)
          return
        }

        if (elapsed < COMMENT_ANCHOR_SCROLL_MAX_MS) {
          scheduleScrollAttempt(COMMENT_ANCHOR_SCROLL_RETRY_MS)
        }

        return
      }

      if (window.performance.now() - startedAt >= COMMENT_ANCHOR_SCROLL_MAX_MS) {
        return
      }

      scheduleScrollAttempt(COMMENT_ANCHOR_SCROLL_RETRY_MS)
    }

    scheduleScrollAttempt()

    const timeoutId = window.setTimeout(() => {
      setHighlightedCommentId((current) => current === highlightedCommentId ? null : current)
    }, COMMENT_HIGHLIGHT_CLEAR_DELAY_MS)

    return () => {
      cancelled = true
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
      if (retryTimeoutId !== null) {
        window.clearTimeout(retryTimeoutId)
      }
      window.clearTimeout(timeoutId)
    }
  }, [clearCommentHighlightSearchParam, ensureHighlightedCommentVisible, highlightedCommentId])

  const updateReplyBoxPinnedLayout = useCallback(() => {
    const element = replyBoxContainerRef.current
    if (!element) {
      return
    }

    const rect = element.getBoundingClientRect()
    setReplyBoxPinnedLayout((current) => {
      if (Math.abs(current.left - rect.left) < 1 && Math.abs(current.width - rect.width) < 1) {
        return current
      }

      return {
        left: rect.left,
        width: rect.width,
      }
    })
  }, [])

  const syncPinnedReplyBoxState = useCallback(() => {
    const element = replyBoxContainerRef.current
    if (!element) {
      return
    }

    const rect = element.getBoundingClientRect()
    setReplyBoxPinnedLayout((current) => {
      if (Math.abs(current.left - rect.left) < 1 && Math.abs(current.width - rect.width) < 1) {
        return current
      }

      return {
        left: rect.left,
        width: rect.width,
      }
    })

    setIsReplyBoxFollowing((current) => {
      if (current) {
        return rect.bottom > window.innerHeight - REPLY_BOX_FOLLOW_EXIT_OFFSET
      }

      return rect.bottom > window.innerHeight + REPLY_BOX_FOLLOW_ENTER_OFFSET
    })
  }, [])

  const enableReplyBox = useCallback((nextTarget?: CommentReplyTarget | null) => {
    if (nextTarget !== undefined) {
      setReplyTarget(nextTarget)
    }

    setIsReplyBoxPinned(true)
    requestAnimationFrame(() => {
      syncPinnedReplyBoxState()
    })
  }, [syncPinnedReplyBoxState])

  const disableReplyBox = useCallback(() => {
    setIsReplyBoxPinned(false)
    setIsReplyBoxFollowing(false)
  }, [])

  const finishTargetedReply = useCallback(() => {
    setReplyTarget(null)
    disableReplyBox()
  }, [disableReplyBox])

  const toggleReplyBox = useCallback(() => {
    setIsReplyBoxPinned((current) => {
      const next = !current
      if (next) {
        requestAnimationFrame(() => {
          syncPinnedReplyBoxState()
        })
      } else {
        setIsReplyBoxFollowing(false)
      }

      return next
    })
  }, [syncPinnedReplyBoxState])

  useEffect(() => {
    if (!canReply) {
      return
    }

    updateReplyBoxPinnedLayout()

    const element = replyBoxContainerRef.current
    const handleResize = () => updateReplyBoxPinnedLayout()
    window.addEventListener("resize", handleResize)

    let observer: ResizeObserver | null = null
    if (element && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        updateReplyBoxPinnedLayout()
      })
      observer.observe(element)
    }

    return () => {
      window.removeEventListener("resize", handleResize)
      observer?.disconnect()
    }
  }, [canReply, updateReplyBoxPinnedLayout])

  useEffect(() => {
    if (!canReply || !isReplyBoxPinned) {
      if (replyBoxFollowRafRef.current !== null) {
        window.cancelAnimationFrame(replyBoxFollowRafRef.current)
        replyBoxFollowRafRef.current = null
      }
      return
    }

    syncPinnedReplyBoxState()

    const scheduleSync = () => {
      if (replyBoxFollowRafRef.current !== null) {
        return
      }

      replyBoxFollowRafRef.current = window.requestAnimationFrame(() => {
        replyBoxFollowRafRef.current = null
        syncPinnedReplyBoxState()
      })
    }

    window.addEventListener("scroll", scheduleSync, { passive: true })
    window.addEventListener("resize", scheduleSync)

    return () => {
      window.removeEventListener("scroll", scheduleSync)
      window.removeEventListener("resize", scheduleSync)
      if (replyBoxFollowRafRef.current !== null) {
        window.cancelAnimationFrame(replyBoxFollowRafRef.current)
        replyBoxFollowRafRef.current = null
      }
    }
  }, [canReply, isReplyBoxPinned, syncPinnedReplyBoxState])

  useEffect(() => {
    if (!canReply) {
      return
    }

    function handleReplyToggle(event: Event) {
      const detail = (event as CustomEvent<CommentReplyToggleDetail>).detail
      if (!detail || detail.threadId !== threadId) {
        return
      }

      if (detail.nextTarget !== undefined) {
        enableReplyBox(detail.nextTarget)
        return
      }

      toggleReplyBox()
    }

    window.addEventListener(COMMENT_REPLY_TOGGLE_EVENT, handleReplyToggle as EventListener)

    return () => {
      window.removeEventListener(COMMENT_REPLY_TOGGLE_EVENT, handleReplyToggle as EventListener)
    }
  }, [canReply, enableReplyBox, threadId, toggleReplyBox])

  useEffect(() => {
    if (!canReply) {
      return
    }

    emitCommentReplyState({
      threadId,
      active: isReplyBoxPinned,
      target: replyTarget,
    })
  }, [canReply, isReplyBoxPinned, replyTarget, threadId])

  useEffect(() => {
    if (!canReply) {
      return
    }

    function handleReplyShortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (shouldIgnoreReplyShortcut(event.target)) {
        return
      }

      if (event.key === "Escape" && isReplyBoxPinned) {
        event.preventDefault()
        disableReplyBox()
        return
      }

      if (event.key.toLowerCase() !== "r") {
        return
      }

      event.preventDefault()
      toggleReplyBox()
    }

    window.addEventListener("keydown", handleReplyShortcut)

    return () => {
      window.removeEventListener("keydown", handleReplyShortcut)
    }
  }, [canReply, disableReplyBox, isReplyBoxPinned, toggleReplyBox])

  function toggleReplies(commentId: string) {
    setExpandedReplies((current) => ({
      ...current,
      [commentId]: !current[commentId],
    }))
  }

  function sortRootComments(items: SiteCommentItem[]) {
    return [...items].sort((left, right) => {
      if (left.isGodComment !== right.isGodComment) {
        return left.isGodComment ? -1 : 1
      }

      if (left.isPinnedByAuthor !== right.isPinnedByAuthor) {
        return left.isPinnedByAuthor ? -1 : 1
      }

      if (left.createdAtRaw !== right.createdAtRaw) {
        return currentSort === "newest"
          ? right.createdAtRaw.localeCompare(left.createdAtRaw)
          : left.createdAtRaw.localeCompare(right.createdAtRaw)
      }

      return currentSort === "newest"
        ? right.id.localeCompare(left.id)
        : left.id.localeCompare(right.id)
    })
  }

  function sortFlatCommentItems(items: SiteFlatCommentItem[]) {
    return [...items].sort((left, right) => {
      const leftGodComment = left.type === "comment" ? left.comment.isGodComment : false
      const rightGodComment = right.type === "comment" ? right.comment.isGodComment : false

      if (leftGodComment !== rightGodComment) {
        return leftGodComment ? -1 : 1
      }

      const leftPinned = left.type === "comment" ? left.comment.isPinnedByAuthor : false
      const rightPinned = right.type === "comment" ? right.comment.isPinnedByAuthor : false

      if (leftPinned !== rightPinned) {
        return leftPinned ? -1 : 1
      }

      const leftCreatedAt = left.type === "comment" ? left.comment.createdAtRaw : left.reply.createdAtRaw
      const rightCreatedAt = right.type === "comment" ? right.comment.createdAtRaw : right.reply.createdAtRaw

      if (leftCreatedAt !== rightCreatedAt) {
        return currentSort === "newest"
          ? rightCreatedAt.localeCompare(leftCreatedAt)
          : leftCreatedAt.localeCompare(rightCreatedAt)
      }

      const leftId = left.type === "comment" ? left.comment.id : left.reply.id
      const rightId = right.type === "comment" ? right.comment.id : right.reply.id

      return currentSort === "newest"
        ? rightId.localeCompare(leftId)
        : leftId.localeCompare(rightId)
    })
  }

  function patchCommentThreadEntries(params: {
    targetId?: string
    targetAuthorId?: number
    rootUpdater?: (comment: SiteCommentItem) => SiteCommentItem
    replyUpdater?: (reply: SiteCommentReplyItem) => SiteCommentReplyItem
  }) {
    const hasTargetFilter = Boolean(params.targetId) || typeof params.targetAuthorId === "number"

    setLocalComments((current) => sortRootComments(current.map((comment) => {
      const shouldUpdateComment = !hasTargetFilter || params.targetId === comment.id || (typeof params.targetAuthorId === "number" && comment.authorId === params.targetAuthorId)
      const nextComment = shouldUpdateComment
        ? params.rootUpdater?.(comment) ?? comment
        : comment

      let repliesChanged = false
      const nextReplies = nextComment.replies.map((reply) => {
        const shouldUpdateReply = !hasTargetFilter || params.targetId === reply.id || (typeof params.targetAuthorId === "number" && reply.authorId === params.targetAuthorId)
        if (!shouldUpdateReply) {
          return reply
        }

        const updatedReply = params.replyUpdater?.(reply) ?? reply
        repliesChanged = repliesChanged || updatedReply !== reply
        return updatedReply
      })

      return !repliesChanged
        ? nextComment
        : {
            ...nextComment,
            replies: nextReplies,
          }
    })))

    setLocalFlatComments((current) => sortFlatCommentItems(current.map((entry) => {
      if (entry.type === "comment") {
        if (hasTargetFilter && params.targetId !== entry.comment.id && !(typeof params.targetAuthorId === "number" && entry.comment.authorId === params.targetAuthorId)) {
          return entry
        }

        return {
          ...entry,
          comment: params.rootUpdater?.(entry.comment) ?? entry.comment,
        }
      }

      if (hasTargetFilter && params.targetId !== entry.reply.id && !(typeof params.targetAuthorId === "number" && entry.reply.authorId === params.targetAuthorId)) {
        return entry
      }

      return {
        ...entry,
        reply: params.replyUpdater?.(entry.reply) ?? entry.reply,
      }
    })))
  }

  async function acceptAnswer(commentId: string) {
    const acceptedComment = localComments.find((comment) => comment.id === commentId)
    setSubmittingAnswerId(commentId)
    setActionMessage("")

    const response = await fetch("/api/posts/accept-answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ postId, commentId }),
    })

    const result = await response.json()
    setSubmittingAnswerId(null)
    setActionMessage(result.message ?? (response.ok ? "操作成功" : "操作失败"))

    if (response.ok) {
      patchCommentThreadEntries({
        rootUpdater: (comment) => ({
          ...comment,
          isAcceptedAnswer: comment.id === commentId,
        }),
      })
      setCanAcceptAnswerState(false)
      dispatchPostBountyResolved({
        postId,
        acceptedAnswerAuthor: acceptedComment?.author ?? null,
      })
    }
  }

  async function runAdminAction(action: string, targetId: string, extra?: Record<string, unknown>) {
    setActionMessage("")

    const response = await fetch("/api/admin/actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, targetId, postId, ...extra }),
    })

    const result = await response.json()
    setActionMessage(result.message ?? (response.ok ? "操作成功" : "操作失败"))

    if (!response.ok) {
      return
    }

    if (action === "comment.delete") {
      router.refresh()
      return
    }

    if (action === "comment.hide" || action === "comment.show" || action === "comment.approve" || action === "comment.reject") {
      const nextStatus = action === "comment.hide" || action === "comment.reject"
        ? "HIDDEN"
        : "NORMAL"
      const nextReviewNote = action === "comment.hide"
        ? "管理员下线评论"
        : action === "comment.reject"
          ? "审核未通过"
          : null

      patchCommentThreadEntries({
        targetId,
        rootUpdater: (comment) => ({
          ...comment,
          status: nextStatus,
          reviewNote: nextReviewNote,
        }),
        replyUpdater: (reply) => ({
          ...reply,
          status: nextStatus,
          reviewNote: nextReviewNote,
        }),
      })
      return
    }

    if (action === "user.mute" || action === "user.ban" || action === "user.activate") {
      const targetAuthorId = Number(targetId)
      if (Number.isInteger(targetAuthorId) && targetAuthorId > 0) {
        const nextAuthorStatus = action === "user.mute"
          ? "MUTED"
          : action === "user.ban"
            ? "BANNED"
            : "ACTIVE"

        patchCommentThreadEntries({
          targetAuthorId,
          rootUpdater: (comment) => ({
            ...comment,
            authorStatus: nextAuthorStatus,
          }),
          replyUpdater: (reply) => ({
            ...reply,
            authorStatus: nextAuthorStatus,
          }),
        })
        return
      }
    }

    router.refresh()
  }

  async function offlineComment(commentId: string) {
    setActionMessage("")

    const response = await fetch("/api/comments/offline", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ commentId }),
    })

    const result = await response.json().catch(() => null) as { message?: string; data?: { reviewNote?: string | null } } | null
    setActionMessage(result?.message ?? (response.ok ? "评论已下线" : "操作失败"))

    if (!response.ok) {
      return
    }

    patchCommentThreadEntries({
      targetId: commentId,
      rootUpdater: (comment) => ({
        ...comment,
        status: "HIDDEN",
        reviewNote: result?.data?.reviewNote ?? "评论已下线",
      }),
      replyUpdater: (reply) => ({
        ...reply,
        status: "HIDDEN",
        reviewNote: result?.data?.reviewNote ?? "评论已下线",
      }),
    })
    router.refresh()
  }

  async function togglePinnedComment(commentId: string, nextAction: "pin" | "unpin") {
    setPinningCommentId(commentId)
    setActionMessage("")

    const response = await fetch("/api/posts/pin-comment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ postId, commentId, action: nextAction }),
    })

    const result = await response.json()
    setPinningCommentId(null)
    setActionMessage(result.message ?? (response.ok ? "操作成功" : "操作失败"))

    if (response.ok) {
      patchCommentThreadEntries({
        rootUpdater: (comment) => ({
          ...comment,
          isPinnedByAuthor: nextAction === "pin" ? comment.id === commentId : false,
        }),
      })
    }
  }

  function startEdit(commentId: string) {
    setEditingCommentId(commentId)
    setActionMessage("")
  }

  function stopEdit() {
    setEditingCommentId(null)
  }

  function canEditComment(comment: SiteCommentItem | SiteCommentReplyItem) {
    return Boolean(currentUserId && currentUserId === comment.authorId)
  }

  function getEditButtonLabel(comment: SiteCommentItem | SiteCommentReplyItem) {
    return editingCommentId === comment.id ? "取消编辑" : "编辑"
  }

  function changeDisplayMode(nextView: "tree" | "flat") {
    updateBrowsingPreferences({ commentThreadDisplayMode: nextView })
    router.replace(buildCommentHref({ page: 1, view: nextView }))
  }

  async function toggleGodComment(commentId: string, nextAction: "mark" | "unmark") {
    setMarkingGodCommentId(commentId)
    setActionMessage("")

    try {
      const response = await fetch("/api/posts/god-comment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          commentId,
          action: nextAction,
          sort: currentSort,
          view: currentDisplayMode,
          pageSize,
        }),
      })

      const result = await response.json().catch(() => null) as GodCommentApiPayload | null
      setActionMessage(result?.message ?? (response.ok ? "操作成功" : "操作失败"))

      if (!response.ok) {
        return
      }

      const nextIsGodComment = result?.data?.isGodComment ?? nextAction === "mark"
      patchCommentThreadEntries({
        rootUpdater: (comment) => ({
          ...comment,
          isGodComment: nextIsGodComment ? comment.id === commentId : false,
        }),
      })
      triggerCommentHighlight(commentId)

      const targetPage = Math.max(1, result?.data?.page ?? currentPage)
      router.replace(buildCommentHighlightHref(commentId, { page: targetPage }), { scroll: true })
      if (commentLoadMode === COMMENT_LOAD_MODE_PAGINATION && targetPage === currentPage) {
        router.refresh()
      }
    } catch {
      setActionMessage("操作失败")
    } finally {
      setMarkingGodCommentId(null)
    }
  }

  function changeCommentSort(nextSort: "oldest" | "newest") {
    updateBrowsingPreferences({ commentThreadSort: nextSort })
    router.replace(buildCommentHref({ sort: nextSort, page: 1 }))
  }

  function jumpToParentComment(commentId: string, href?: string) {
    const target = document.getElementById(`comment-${commentId}`)
    if (target) {
      const search = searchParams.toString()
      const nextUrl = `${pathname}${search ? `?${search}` : ""}#comment-${commentId}`
      window.history.replaceState(null, "", nextUrl)
      triggerCommentHighlight(commentId)
      scrollCommentAnchorIntoView(target, "smooth")
      return
    }

    if (href) {
      router.replace(href, { scroll: true })
    }
  }

  const hideFloatingActionButtons = editingCommentId !== null
  const nextDisplayMode = currentDisplayMode === "tree" ? "flat" : "tree"
  const currentDisplayModeLabel = currentDisplayMode === "tree" ? "树形" : "平铺"
  const nextDisplayModeLabel = nextDisplayMode === "tree" ? "树形" : "平铺"
  const DisplayModeIcon = currentDisplayMode === "tree" ? GitBranch : List

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>文明发言，理性讨论</span>
          <button
            type="button"
            onClick={() => setShowOnlyAuthorComments((current) => !current)}
            className={showOnlyAuthorComments ? "rounded-full bg-foreground px-2.5 py-1 text-[11px] text-background" : "rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"}
          >
            {showOnlyAuthorComments ? "查看全部评论" : "只看楼主"}
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={() => changeCommentSort("oldest")} className={currentSort === "oldest" ? "rounded-full bg-foreground px-2.5 py-1 text-[11px] text-background" : "rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground"}>最早</button>
          <button type="button" onClick={() => changeCommentSort("newest")} className={currentSort === "newest" ? "rounded-full bg-foreground px-2.5 py-1 text-[11px] text-background" : "rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground"}>最新</button>
          <button
            type="button"
            aria-label={`当前评论视图：${currentDisplayModeLabel}，点击切换到${nextDisplayModeLabel}`}
            title={`当前${currentDisplayModeLabel}，点击切换到${nextDisplayModeLabel}`}
            onClick={() => changeDisplayMode(nextDisplayMode)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary px-3 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <DisplayModeIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{currentDisplayModeLabel}</span>
          </button>
        </div>
      </div>

      {showOnlyAuthorComments && (currentDisplayMode === "flat" ? filteredFlatComments.length === 0 : filteredComments.length === 0) ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          当前页暂无楼主评论
        </div>
      ) : null}

      {currentDisplayMode === "tree" ? (
        filteredComments.map((comment, index) => (
              <CommentThreadCommentItem
                key={comment.id}
                comment={comment}
                index={index}
                postPath={postPath}
                pointName={pointName}
                tipping={tipping}
                canReply={canReply}
                currentUserId={currentUserId}
            canAcceptAnswer={canAcceptAnswerState}
            isAdmin={isAdmin}
            adminRole={adminRole}
            canPinComment={canPinComment}
            markdownEmojiMap={markdownEmojiMap}
            commentEditWindowMinutes={commentEditWindowMinutes}
            editingCommentId={editingCommentId}
            pinningCommentId={pinningCommentId}
            markingGodCommentId={markingGodCommentId}
            submittingAnswerId={submittingAnswerId}
            hideFloatingActionButtons={hideFloatingActionButtons}
            isHighlighted={highlightedCommentId === comment.id}
            highlightedCommentId={highlightedCommentId}
            isExpanded={expandedReplies[comment.id] ?? false}
            initialVisibleReplies={initialVisibleReplies}
            onToggleReplies={toggleReplies}
            onEnableReplyBox={(target) => enableReplyBox(target)}
            onAcceptAnswer={acceptAnswer}
            onRunAdminAction={runAdminAction}
            onOfflineComment={offlineComment}
            onTogglePinnedComment={togglePinnedComment}
            onToggleGodComment={toggleGodComment}
            onStartEdit={startEdit}
            onStopEdit={stopEdit}
            canEditComment={canEditComment}
            getEditButtonLabel={getEditButtonLabel}
            canOfflineOwnComment={canOfflineOwnComment}
            canOfflineUserComment={canOfflineUserComment}
          />
        ))
      ) : (
        filteredFlatComments.map((entry, index) => {
          if (entry.type === "comment") {
            return (
              <CommentThreadCommentItem
                key={entry.comment.id}
                comment={entry.comment}
                index={index}
                postPath={postPath}
                pointName={pointName}
                tipping={tipping}
                canReply={canReply}
                currentUserId={currentUserId}
                canAcceptAnswer={canAcceptAnswerState}
                isAdmin={isAdmin}
                adminRole={adminRole}
                canPinComment={canPinComment}
                markdownEmojiMap={markdownEmojiMap}
                commentEditWindowMinutes={commentEditWindowMinutes}
                editingCommentId={editingCommentId}
                pinningCommentId={pinningCommentId}
                markingGodCommentId={markingGodCommentId}
                submittingAnswerId={submittingAnswerId}
                hideFloatingActionButtons={hideFloatingActionButtons}
                isHighlighted={highlightedCommentId === entry.comment.id}
                highlightedCommentId={highlightedCommentId}
                isExpanded={false}
                initialVisibleReplies={initialVisibleReplies}
                onToggleReplies={toggleReplies}
                onEnableReplyBox={(target) => enableReplyBox(target)}
                onAcceptAnswer={acceptAnswer}
                onRunAdminAction={runAdminAction}
                onOfflineComment={offlineComment}
                onTogglePinnedComment={togglePinnedComment}
                onToggleGodComment={toggleGodComment}
                onStartEdit={startEdit}
                onStopEdit={stopEdit}
                canEditComment={canEditComment}
                getEditButtonLabel={getEditButtonLabel}
                canOfflineOwnComment={canOfflineOwnComment}
                canOfflineUserComment={canOfflineUserComment}
                renderReplies={false}
              />
            )
          }

          return (
            <CommentThreadReplyItem
              key={entry.reply.id}
              reply={entry.reply}
              postPath={postPath}
              parentCommentId={entry.reply.parentCommentId ?? ""}
              parentCommentFloor={entry.reply.parentCommentFloor}
              referenceCommentId={entry.reply.replyToCommentId ?? entry.reply.parentCommentId}
              parentCommentHref={entry.reply.replyToCommentId ? buildCommentHighlightHref(entry.reply.replyToCommentId, { sort: currentSort, page: entry.reply.replyToCommentPage ?? 1, view: "flat" }) : entry.reply.parentCommentId ? buildCommentHighlightHref(entry.reply.parentCommentId, { sort: currentSort, page: entry.reply.parentCommentPage ?? 1, view: "flat" }) : undefined}
              pointName={pointName}
              tipping={tipping}
              canReply={canReply}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              adminRole={adminRole}
              markdownEmojiMap={markdownEmojiMap}
              commentEditWindowMinutes={commentEditWindowMinutes}
              editingCommentId={editingCommentId}
              hideFloatingActionButtons={hideFloatingActionButtons}
              isHighlighted={highlightedCommentId === entry.reply.id}
              onJumpToParentComment={jumpToParentComment}
              onEnableReplyBox={(target) => enableReplyBox(target)}
              onRunAdminAction={runAdminAction}
              onOfflineComment={offlineComment}
              onStartEdit={startEdit}
              onStopEdit={stopEdit}
              canEditComment={canEditComment}
              getEditButtonLabel={getEditButtonLabel}
              canOfflineOwnComment={canOfflineOwnComment}
              canOfflineUserComment={canOfflineUserComment}
              layout="flat"
            />
          )
        })
      )}

      {actionMessage ? <p className="text-sm text-muted-foreground">{actionMessage}</p> : null}

      {commentLoadMode === COMMENT_LOAD_MODE_INFINITE ? (
        hasNextInfinitePage ? (
          <div className="flex flex-col items-center gap-3 pt-2">
            <div ref={infiniteSentinelRef} className="h-1 w-full" aria-hidden="true" />
            <button
              type="button"
              onClick={() => void loadMoreComments()}
              disabled={isLoadingMoreComments}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingMoreComments ? "加载中..." : "继续加载"}
            </button>
          </div>
        ) : localTotal > pageSize ? (
          <p className="pt-2 text-center text-sm text-muted-foreground">没有更多评论</p>
        ) : null
      ) : totalPages > 1 ? (
        <nav className="grid gap-3 pt-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center" aria-label="评论分页">
          <span className="hidden sm:block" aria-hidden="true" />
          <div className="flex flex-wrap items-center justify-center gap-2 sm:col-start-2">
            <Link
              href={currentPage > 1 ? buildCommentHref({ page: currentPage - 1 }) : "#"}
              aria-disabled={currentPage <= 1}
              className={currentPage <= 1 ? "pointer-events-none rounded-full border border-border px-4 py-2 text-sm text-muted-foreground opacity-50" : "rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent/40"}
            >
              上一页
            </Link>

            {buildPageTokens(currentPage, totalPages).map((token, index) => token === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="px-1 text-sm text-muted-foreground">
                ...
              </span>
            ) : (
              <Link
                key={token}
                href={buildCommentHref({ page: token })}
                aria-current={token === currentPage ? "page" : undefined}
                className={token === currentPage
                  ? "inline-flex min-w-10 items-center justify-center rounded-full border border-foreground bg-foreground px-3 py-2 text-sm text-background"
                  : "inline-flex min-w-10 items-center justify-center rounded-full border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-accent/40"}
              >
                {token}
              </Link>
            ))}

            <Link
              href={currentPage < totalPages ? buildCommentHref({ page: currentPage + 1 }) : "#"}
              aria-disabled={currentPage >= totalPages}
              className={currentPage >= totalPages ? "pointer-events-none rounded-full border border-border px-4 py-2 text-sm text-muted-foreground opacity-50" : "rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent/40"}
            >
              下一页
            </Link>
          </div>
          <span className="text-center text-sm text-muted-foreground sm:col-start-3 sm:justify-self-end">第 {currentPage} / {totalPages} 页</span>
        </nav>
      ) : null}

      {loadMoreError ? <p className="text-center text-sm text-destructive">{loadMoreError}</p> : null}

      {canReply ? (
          <CommentThreadReplyBox
            postId={postId}
            commentsVisibleToAuthorOnly={commentsVisibleToAuthorOnly}
            anonymousIdentityEnabled={anonymousReplyEnabled}
            anonymousIdentityDefaultChecked={anonymousReplyDefaultChecked}
            anonymousIdentitySwitchVisible={anonymousReplySwitchVisible}
            markdownEmojiMap={markdownEmojiMap}
            replyTarget={replyTarget}
          replyHint={replyHint}
          isReplyBoxPinned={isReplyBoxPinned}
          isReplyBoxFollowing={isReplyBoxFollowing}
          replyBoxPinnedLayout={replyBoxPinnedLayout}
          replyBoxContainerRef={replyBoxContainerRef}
          onDisableReplyBox={disableReplyBox}
          onClearReplyTarget={() => setReplyTarget(null)}
          onReplySubmitted={finishTargetedReply}
          commentLoadMode={commentLoadMode}
        />
      ) : null}
    </div>
  )
}
