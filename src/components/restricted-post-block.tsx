"use client"

import { useState } from "react"

import { MarkdownContent } from "@/components/markdown-content"
import { PurchaseUnlockButton } from "@/components/purchase-unlock-button"

interface RestrictedPostBlockProps {
  type: "AUTHOR_ONLY" | "REPLY_UNLOCK" | "PURCHASE_UNLOCK"
  postId: string
  blockId: string
  text?: string
  visible: boolean
  currentUserId?: number
  pointName: string
  replyThreshold?: number
  price?: number
  userReplyCount?: number
  isOwnerOrAdmin?: boolean
}

function UnlockedContentFrame({ title, content }: { title: string; content: string }) {
  return (
    <div className="rounded-[20px] border border-border bg-secondary/35 p-5">
      <div className="mb-3 text-sm font-medium text-foreground">{title}</div>
      <MarkdownContent content={content} />
    </div>
  )
}

export function RestrictedPostBlock({ type, postId, blockId, text, visible, currentUserId, pointName, replyThreshold, price, userReplyCount = 0, isOwnerOrAdmin = false }: RestrictedPostBlockProps) {
  const [scrolling, setScrolling] = useState(false)

  function scrollToReplyBox() {
    setScrolling(true)
    const replyBox = document.getElementById("post-comment-reply-box") ?? document.querySelector('[data-comment-reply-box="true"]') as HTMLElement | null
    replyBox?.scrollIntoView({ behavior: "smooth", block: "start" })
    setTimeout(() => setScrolling(false), 500)
  }


  if (visible && text) {
    return <UnlockedContentFrame title={type === "REPLY_UNLOCK" ? "回复后已解锁内容" : "购买后已解锁内容"} content={text} />
  }

  if (type === "AUTHOR_ONLY") {
    return (
      <div className="rounded-[20px] border border-dashed border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-800">
        这部分内容仅发帖人和管理员可见。
      </div>
    )
  }

  if (type === "REPLY_UNLOCK") {
    return (
      <div className="space-y-4 rounded-[20px] border border-dashed border-sky-300 bg-sky-50 px-5 py-4 text-sm text-sky-900">
        <div className="space-y-1">
          <p className="font-medium">回复后可见内容</p>
          <p>{isOwnerOrAdmin ? "你是楼主或管理员，可直接查看该内容。" : `当前需要在本帖回复满 ${replyThreshold ?? 1} 次后解锁，你已回复 ${userReplyCount} 次。`}</p>
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

  return (
    <div className="space-y-4 rounded-[20px] border border-dashed border-emerald-300 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
      <div className="space-y-1">
        <p className="font-medium">购买后可见内容</p>
        <p>这部分内容需要单独购买后查看。</p>
      </div>
      {currentUserId ? <PurchaseUnlockButton postId={postId} blockId={blockId} price={price ?? 0} pointName={pointName} /> : <p>请先登录后再购买解锁。</p>}
    </div>
  )
}
