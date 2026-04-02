"use client"

import { useEffect } from "react"

import { recordReadingHistory } from "@/lib/local-reading-history"

interface PostReadingHistoryRecorderProps {
  postId: string
  postSlug: string
  postPath: string
  title: string
  boardName?: string | null
  boardSlug?: string | null
  postCreatedAt?: string | null
}

export function PostReadingHistoryRecorder({
  postId,
  postSlug,
  postPath,
  title,
  boardName,
  boardSlug,
  postCreatedAt,
}: PostReadingHistoryRecorderProps) {
  useEffect(() => {
    recordReadingHistory({
      postId,
      postSlug,
      postPath,
      title,
      boardName,
      boardSlug,
      postCreatedAt,
    })
  }, [boardName, boardSlug, postCreatedAt, postId, postPath, postSlug, title])

  return null
}

