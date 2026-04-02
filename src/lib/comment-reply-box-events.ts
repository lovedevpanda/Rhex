"use client"

export interface CommentReplyTarget {
  parentId: string
  replyToUserName: string
}

export interface CommentReplyToggleDetail {
  threadId: string
  nextTarget?: CommentReplyTarget | null
}

export interface CommentReplyStateDetail {
  threadId: string
  active: boolean
  target: CommentReplyTarget | null
}

export const COMMENT_REPLY_TOGGLE_EVENT = "site:comment-reply-toggle"
export const COMMENT_REPLY_STATE_EVENT = "site:comment-reply-state"

export function emitCommentReplyToggle(detail: CommentReplyToggleDetail) {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(new CustomEvent<CommentReplyToggleDetail>(COMMENT_REPLY_TOGGLE_EVENT, { detail }))
}

export function emitCommentReplyState(detail: CommentReplyStateDetail) {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(new CustomEvent<CommentReplyStateDetail>(COMMENT_REPLY_STATE_EVENT, { detail }))
}
