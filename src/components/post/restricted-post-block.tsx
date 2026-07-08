"use client"

import { useEffect, useMemo, useState } from "react"

import { MarkdownContentClient as MarkdownContent } from "@/components/markdown-content-client"
import { PurchaseUnlockButton } from "@/components/post/purchase-unlock-button"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import { addPostReplyCreatedListener } from "@/lib/post-discussion-events"
import type { PostContentImageMode } from "@/lib/theme"

interface RestrictedPostBlockProps {

  type: "AUTHOR_ONLY" | "LOGIN_UNLOCK" | "REPLY_UNLOCK" | "PURCHASE_UNLOCK"
  postId: string
  blockId: string
  text?: string
  html?: string
  visible: boolean
  currentUserId?: number
  pointName: string
  replyThreshold?: number
  price?: number
  purchaseCount?: number
  userReplyCount?: number
  isOwnerOrAdmin?: boolean
  markdownEmojiMap?: MarkdownEmojiItem[]
  imageDisplayMode?: PostContentImageMode
}

function UnlockedContentFrame({ title, content, html, summary, markdownEmojiMap, imageDisplayMode = "auto" }: { title: string; content: string; html?: string; summary?: string; markdownEmojiMap?: MarkdownEmojiItem[]; imageDisplayMode?: PostContentImageMode }) {

  return (
    <div className="rounded-xl border border-border bg-secondary/35 p-5">
      <div className="mb-3 space-y-1">
        <div className="text-sm font-medium text-foreground">{title}</div>
        {summary ? <div className="text-xs text-muted-foreground">{summary}</div> : null}
      </div>
      <MarkdownContent content={content} html={html} markdownEmojiMap={markdownEmojiMap} imageDisplayMode={imageDisplayMode} collapseLongCodeBlocks />
    </div>
  )
}

export function RestrictedPostBlock({ type, postId, blockId, text, html, visible, currentUserId, pointName, replyThreshold, price, purchaseCount = 0, userReplyCount = 0, isOwnerOrAdmin = false, markdownEmojiMap, imageDisplayMode = "auto" }: RestrictedPostBlockProps) {

  const [scrolling, setScrolling] = useState(false)
  const [localUserReplyCount, setLocalUserReplyCount] = useState(userReplyCount)

  useEffect(() => {
    setLocalUserReplyCount(userReplyCount)
  }, [userReplyCount])

  useEffect(() => {
    if (type !== "REPLY_UNLOCK" || !currentUserId) {
      return
    }

    return addPostReplyCreatedListener((detail) => {
      if (detail.postId !== postId || detail.reviewRequired) {
        return
      }

      setLocalUserReplyCount((current) => current + 1)
    })
  }, [currentUserId, postId, type])

  const replyUnlocked = useMemo(() => (
    isOwnerOrAdmin || localUserReplyCount >= (replyThreshold ?? 1)
  ), [isOwnerOrAdmin, localUserReplyCount, replyThreshold])

  function scrollToReplyBox() {
    setScrolling(true)
    const replyBox = document.getElementById("post-comment-reply-box") ?? document.querySelector('[data-comment-reply-box="true"]') as HTMLElement | null
    replyBox?.scrollIntoView({ behavior: "smooth", block: "start" })
    setTimeout(() => setScrolling(false), 500)
  }


  if ((visible || (type === "REPLY_UNLOCK" && replyUnlocked)) && text) {
    return (
        <UnlockedContentFrame
          title={type === "LOGIN_UNLOCK" ? "登录后可见内容" : type === "REPLY_UNLOCK" ? "回复后已解锁内容" : "购买后已解锁内容"}
          content={text}
          html={html}
          summary={type === "PURCHASE_UNLOCK" ? `已有 ${purchaseCount} 人购买` : undefined}
          markdownEmojiMap={markdownEmojiMap}
          imageDisplayMode={imageDisplayMode}
        />
    )

  }

  if (type === "AUTHOR_ONLY") {
    return (
      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-800">
        这部分内容仅发帖人和管理员可见。
      </div>
    )
  }

  if (type === "REPLY_UNLOCK") {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-dashed border-border bg-card/70 px-5 py-4 text-sm text-muted-foreground shadow-xs shadow-black/5">
        <div className="flex flex-col gap-1">
          <p className="font-medium text-foreground">回复后可见内容</p>
          <p>{isOwnerOrAdmin ? "你是楼主或管理员，可直接查看该内容。" : `当前需要在本帖回复满 ${replyThreshold ?? 1} 次后解锁，你已回复 ${localUserReplyCount} 次。`}</p>
        </div>
        {!currentUserId ? <p>登录后即可参与回复解锁。</p> : null}
        {currentUserId && !isOwnerOrAdmin ? (
          <button type="button" className="text-sm text-primary hover:opacity-80" onClick={scrollToReplyBox}>
            {scrolling ? "正在跳转回复框..." : "立即回复并解锁"}
          </button>
        ) : null}
      </div>
    )
  }

  if (type === "LOGIN_UNLOCK") {
    return (
      <div className="space-y-4 rounded-xl border border-dashed border-violet-300 bg-violet-50 px-5 py-4 text-sm text-violet-900">
        <div className="space-y-1">
          <p className="font-medium">登录后可见内容</p>
          <p>{isOwnerOrAdmin ? "你是楼主或管理员，可直接查看该内容。" : "这部分内容仅登录用户可查看。"}</p>
        </div>
        {!currentUserId ? <p>请先登录后再查看。</p> : null}
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
      <div className="space-y-1">
        <p className="font-medium">购买后可见内容</p>
        <p>这部分内容需要单独购买后查看。</p>
        <p className="text-xs text-emerald-700/80">已有 {purchaseCount} 人购买</p>
      </div>
      {currentUserId ? <PurchaseUnlockButton postId={postId} blockId={blockId} price={price ?? 0} pointName={pointName} /> : <p>请先登录后再购买解锁。</p>}
    </div>
  )
}
