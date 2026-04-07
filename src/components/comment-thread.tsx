"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { Ellipsis } from "lucide-react"

import { CommentThreadCommentItem, CommentThreadReplyItem } from "@/components/comment-thread-items"
import { CommentThreadReplyBox } from "@/components/comment-thread-shared"

import {
  DEFAULT_BROWSING_PREFERENCES,
  readBrowsingPreferencesSnapshot,
  subscribeBrowsingPreferences,
  updateBrowsingPreferences,
} from "@/lib/browsing-preferences"
import type { SiteCommentItem, SiteCommentReplyItem, SiteFlatCommentItem } from "@/lib/comments"
import { COMMENT_REPLY_TOGGLE_EVENT, emitCommentReplyState, type CommentReplyTarget, type CommentReplyToggleDetail } from "@/lib/comment-reply-box-events"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"

interface CommentThreadProps {
  threadId: string
  comments: SiteCommentItem[]
  flatComments?: SiteFlatCommentItem[]
  postId: string
  pointName?: string
  canReply: boolean
  currentPage: number
  pageSize: number
  total: number
  currentSort: "oldest" | "newest"
  currentDisplayMode: "tree" | "flat"
  currentUserId?: number
  canAcceptAnswer?: boolean
  commentsVisibleToAuthorOnly?: boolean
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

export function CommentThread({ threadId, comments, flatComments = [], postId, pointName, canReply, currentPage, pageSize, total, currentSort, currentDisplayMode, currentUserId, canAcceptAnswer = false, commentsVisibleToAuthorOnly = false, anonymousReplyEnabled = false, anonymousReplyDefaultChecked = false, anonymousReplySwitchVisible = false, isAdmin = false, adminRole = null, canPinComment = false, markdownEmojiMap, commentEditWindowMinutes = 5, initialVisibleReplies = 10 }: CommentThreadProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const browsingPreferences = useSyncExternalStore(
    subscribeBrowsingPreferences,
    readBrowsingPreferencesSnapshot,
    () => DEFAULT_BROWSING_PREFERENCES,
  )
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  const [submittingAnswerId, setSubmittingAnswerId] = useState<string | null>(null)
  const [pinningCommentId, setPinningCommentId] = useState<string | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState("")
  const [replyTarget, setReplyTarget] = useState<CommentReplyTarget | null>(null)
  const [showOnlyAuthorComments, setShowOnlyAuthorComments] = useState(false)
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null)
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false)
  const [isReplyBoxPinned, setIsReplyBoxPinned] = useState(false)
  const [isReplyBoxFollowing, setIsReplyBoxFollowing] = useState(false)
  const [replyBoxPinnedLayout, setReplyBoxPinnedLayout] = useState({ left: 0, width: 0 })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const replyBoxContainerRef = useRef<HTMLDivElement | null>(null)
  const replyBoxFollowRafRef = useRef<number | null>(null)
  const viewMenuRef = useRef<HTMLDivElement | null>(null)

  const filteredComments = useMemo(() => {
    if (!showOnlyAuthorComments) {
      return comments
    }

    return comments
      .filter((comment) => comment.isPostAuthor || comment.replies.some((reply) => reply.isPostAuthor))
      .map((comment) => ({
        ...comment,
        replies: comment.replies.filter((reply) => reply.isPostAuthor),
      }))
  }, [comments, showOnlyAuthorComments])
  const filteredFlatComments = useMemo(() => {
    if (!showOnlyAuthorComments) {
      return flatComments
    }

    return flatComments.filter((entry) => entry.type === "comment" ? entry.comment.isPostAuthor : entry.reply.isPostAuthor)
  }, [flatComments, showOnlyAuthorComments])
  const buildCommentHref = useCallback((patch: { sort?: "oldest" | "newest"; page?: number; view?: "tree" | "flat" }) => {
    const nextSearchParams = new URLSearchParams(searchParams.toString())
    nextSearchParams.set("sort", patch.sort ?? currentSort)
    nextSearchParams.set("page", String(patch.page ?? currentPage))
    nextSearchParams.set("view", patch.view ?? currentDisplayMode)
    return `${pathname}?${nextSearchParams.toString()}#comments`
  }, [currentDisplayMode, currentPage, currentSort, pathname, searchParams])

  const replyHint = replyTarget ? `正在回复 @${replyTarget.replyToUserName}` : null

  const triggerCommentHighlight = useCallback((commentId: string) => {
    setHighlightedCommentId(null)
    window.requestAnimationFrame(() => {
      setHighlightedCommentId(commentId)
    })
  }, [])

  useEffect(() => {
    if (searchParams.get("view")) {
      return
    }

    const preferredView = browsingPreferences.commentThreadDisplayMode
    if (preferredView === currentDisplayMode) {
      return
    }

    router.replace(buildCommentHref({ page: 1, view: preferredView }), { scroll: false })
  }, [browsingPreferences.commentThreadDisplayMode, buildCommentHref, currentDisplayMode, router, searchParams])

  useEffect(() => {
    function syncHighlightedCommentFromLocation() {
      const highlightedFromSearch = searchParams.get("highlight")
      if (highlightedFromSearch) {
        triggerCommentHighlight(highlightedFromSearch)
        const nextSearchParams = new URLSearchParams(searchParams.toString())
        nextSearchParams.delete("highlight")
        const nextSearch = nextSearchParams.toString()
        const hash = typeof window === "undefined" ? "" : window.location.hash
        window.history.replaceState(null, "", `${pathname}${nextSearch ? `?${nextSearch}` : ""}${hash}`)
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
  }, [pathname, searchParams, triggerCommentHighlight])

  useEffect(() => {
    if (!highlightedCommentId) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightedCommentId((current) => current === highlightedCommentId ? null : current)
    }, 2600)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [highlightedCommentId])

  useEffect(() => {
    if (!isViewMenuOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (!viewMenuRef.current?.contains(event.target as Node)) {
        setIsViewMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsViewMenuOpen(false)
      }
    }

    window.addEventListener("mousedown", handlePointerDown)
    window.addEventListener("keydown", handleEscape)

    return () => {
      window.removeEventListener("mousedown", handlePointerDown)
      window.removeEventListener("keydown", handleEscape)
    }
  }, [isViewMenuOpen])

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

  async function acceptAnswer(commentId: string) {
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
      window.location.reload()
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

    if (response.ok) {
      window.location.reload()
    }
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
      window.location.reload()
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
    setIsViewMenuOpen(false)
    router.replace(buildCommentHref({ page: 1, view: nextView }))
  }

  function jumpToParentComment(commentId: string, href?: string) {
    const target = document.getElementById(`comment-${commentId}`)
    if (target) {
      const search = searchParams.toString()
      const nextUrl = `${pathname}${search ? `?${search}` : ""}#comment-${commentId}`
      window.history.replaceState(null, "", nextUrl)
      triggerCommentHighlight(commentId)
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
      return
    }

    if (href) {
      router.replace(href, { scroll: true })
    }
  }

  const hideFloatingActionButtons = editingCommentId !== null

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
          <Link href={buildCommentHref({ sort: "oldest", page: 1 })} className={currentSort === "oldest" ? "rounded-full bg-foreground px-2.5 py-1 text-[11px] text-background" : "rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground"}>最早</Link>
          <Link href={buildCommentHref({ sort: "newest", page: 1 })} className={currentSort === "newest" ? "rounded-full bg-foreground px-2.5 py-1 text-[11px] text-background" : "rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground"}>最新</Link>
          <div ref={viewMenuRef} className="relative">
            {isViewMenuOpen ? (
              <div className="absolute right-0 top-10 z-20 min-w-[112px] rounded-2xl border border-border bg-background/95 p-1.5 shadow-sm backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => changeDisplayMode("tree")}
                  className={currentDisplayMode === "tree" ? "flex w-full rounded-xl bg-accent px-3 py-2 text-left text-[12px] font-medium text-foreground" : "flex w-full rounded-xl px-3 py-2 text-left text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"}
                >
                  树形
                </button>
                <button
                  type="button"
                  onClick={() => changeDisplayMode("flat")}
                  className={currentDisplayMode === "flat" ? "flex w-full rounded-xl bg-accent px-3 py-2 text-left text-[12px] font-medium text-foreground" : "flex w-full rounded-xl px-3 py-2 text-left text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"}
                >
                  平铺
                </button>
              </div>
            ) : null}
            <button
              type="button"
              aria-label="评论视图"
              title="评论视图"
              onClick={() => setIsViewMenuOpen((current) => !current)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Ellipsis className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {showOnlyAuthorComments && (currentDisplayMode === "flat" ? filteredFlatComments.length === 0 : filteredComments.length === 0) ? (
        <div className="rounded-[20px] border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          当前页暂无楼主评论
        </div>
      ) : null}

      {currentDisplayMode === "tree" ? (
        filteredComments.map((comment, index) => (
          <CommentThreadCommentItem
            key={comment.id}
            comment={comment}
            index={index}
            pointName={pointName}
            canReply={canReply}
            currentUserId={currentUserId}
            canAcceptAnswer={canAcceptAnswer}
            isAdmin={isAdmin}
            adminRole={adminRole}
            canPinComment={canPinComment}
            markdownEmojiMap={markdownEmojiMap}
            commentEditWindowMinutes={commentEditWindowMinutes}
            editingCommentId={editingCommentId}
            pinningCommentId={pinningCommentId}
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
            onTogglePinnedComment={togglePinnedComment}
            onStartEdit={startEdit}
            onStopEdit={stopEdit}
            canEditComment={canEditComment}
            getEditButtonLabel={getEditButtonLabel}
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
                pointName={pointName}
                canReply={canReply}
                currentUserId={currentUserId}
                canAcceptAnswer={canAcceptAnswer}
                isAdmin={isAdmin}
                adminRole={adminRole}
                canPinComment={canPinComment}
                markdownEmojiMap={markdownEmojiMap}
                commentEditWindowMinutes={commentEditWindowMinutes}
                editingCommentId={editingCommentId}
                pinningCommentId={pinningCommentId}
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
                onTogglePinnedComment={togglePinnedComment}
                onStartEdit={startEdit}
                onStopEdit={stopEdit}
                canEditComment={canEditComment}
                getEditButtonLabel={getEditButtonLabel}
                renderReplies={false}
              />
            )
          }

          return (
            <CommentThreadReplyItem
              key={entry.reply.id}
              reply={entry.reply}
              parentCommentId={entry.reply.parentCommentId ?? ""}
              parentCommentFloor={entry.reply.parentCommentFloor}
              referenceCommentId={entry.reply.replyToCommentId ?? entry.reply.parentCommentId}
              parentCommentHref={entry.reply.replyToCommentId ? `?sort=${currentSort}&page=${entry.reply.replyToCommentPage ?? 1}&view=flat&highlight=${entry.reply.replyToCommentId}#comment-${entry.reply.replyToCommentId}` : entry.reply.parentCommentId ? `?sort=${currentSort}&page=${entry.reply.parentCommentPage ?? 1}&view=flat&highlight=${entry.reply.parentCommentId}#comment-${entry.reply.parentCommentId}` : undefined}
              pointName={pointName}
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
              onStartEdit={startEdit}
              onStopEdit={stopEdit}
              canEditComment={canEditComment}
              getEditButtonLabel={getEditButtonLabel}
              layout="flat"
            />
          )
        })
      )}

      {actionMessage ? <p className="text-sm text-muted-foreground">{actionMessage}</p> : null}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between pt-2">
          <Link href={buildCommentHref({ page: Math.max(1, currentPage - 1) })} className={currentPage <= 1 ? "pointer-events-none rounded-full border border-border bg-card px-4 py-2 text-sm opacity-50" : "rounded-full border border-border bg-card px-4 py-2 text-sm"}>
            上一页
          </Link>
          <span className="text-sm text-muted-foreground">第 {currentPage} / {totalPages} 页</span>
          <Link href={buildCommentHref({ page: Math.min(totalPages, currentPage + 1) })} className={currentPage >= totalPages ? "pointer-events-none rounded-full border border-border bg-card px-4 py-2 text-sm opacity-50" : "rounded-full border border-border bg-card px-4 py-2 text-sm"}>
            下一页
          </Link>
        </div>
      ) : null}

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
        />
      ) : null}
    </div>
  )
}
