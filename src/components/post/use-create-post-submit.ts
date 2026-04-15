"use client"

import type { FormEvent } from "react"
import { useEffect, useState } from "react"

import type { LocalPostDraft } from "@/lib/post-draft"
import type { PostLinkDisplayMode } from "@/lib/site-settings"
import { getPostPath } from "@/lib/post-links"
import { toast } from "@/components/ui/toast"
import { buildSubmitRequest } from "@/components/post/create-post-form.shared"

interface UseCreatePostSubmitOptions {
  mode: "create" | "edit"
  postId?: string
  successSlug?: string
  postLinkDisplayMode: PostLinkDisplayMode
  draft: LocalPostDraft
}

export function useCreatePostSubmit({
  mode,
  postId,
  successSlug,
  postLinkDisplayMode,
  draft,
}: UseCreatePostSubmitOptions) {
  const isEditMode = mode === "edit"
  const slowSubmitThresholdMs = 8000
  const [loading, setLoading] = useState(false)
  const [submitStartedAt, setSubmitStartedAt] = useState<number | null>(null)
  const [showSlowSubmitHint, setShowSlowSubmitHint] = useState(false)
  const [slowSubmitWaitSeconds, setSlowSubmitWaitSeconds] = useState(8)

  useEffect(() => {
    if (!loading) {
      setShowSlowSubmitHint(false)
      setSlowSubmitWaitSeconds(8)
      return
    }

    const effectiveSubmitStartedAt = submitStartedAt ?? Date.now()
    const timer = window.setTimeout(() => {
      setSlowSubmitWaitSeconds(
        Math.max(8, Math.floor((Date.now() - effectiveSubmitStartedAt) / 1000)),
      )
      setShowSlowSubmitHint(true)
    }, slowSubmitThresholdMs)

    return () => window.clearTimeout(timer)
  }, [loading, slowSubmitThresholdMs, submitStartedAt])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) {
      return
    }

    setLoading(true)
    const startedAt = Date.now()
    setSubmitStartedAt(startedAt)
    setShowSlowSubmitHint(false)
    setSlowSubmitWaitSeconds(8)

    try {
      const { endpoint, payload } = buildSubmitRequest({ mode, postId, draft })
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
      const result = (await response.json().catch(() => null)) as {
        message?: string
        data?: {
          id?: string
          slug?: string
        }
      } | null

      if (!response.ok) {
        const errorMessage = result?.message ?? (isEditMode ? "保存失败" : "发帖失败")
        toast.error(errorMessage, isEditMode ? "保存失败" : "发帖失败")
        return
      }

      const successMessage = result?.message ?? (isEditMode ? "保存成功，正在返回详情页…" : "发布成功，正在跳转详情页…")
      toast.success(successMessage, isEditMode ? "保存成功" : "发布成功")

      const nextPostId = result?.data?.id ?? postId
      const nextPostSlug = result?.data?.slug ?? successSlug ?? nextPostId
      const targetPath = nextPostId && nextPostSlug
        ? getPostPath({ id: nextPostId, slug: nextPostSlug }, { mode: postLinkDisplayMode })
        : null

      if (typeof window !== "undefined") {
        if (targetPath) {
          window.location.assign(targetPath)
          return
        }

        window.location.reload()
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : isEditMode ? "保存失败" : "发帖失败",
        isEditMode ? "保存失败" : "发帖失败",
      )
    } finally {
      setLoading(false)
      setSubmitStartedAt(null)
    }
  }

  return {
    loading,
    submitStartedAt,
    showSlowSubmitHint,
    slowSubmitWaitSeconds,
    handleSubmit,
  }
}

export type CreatePostSubmitController = ReturnType<typeof useCreatePostSubmit>
