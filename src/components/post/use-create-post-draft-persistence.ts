"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"

import {
  clearPostDraftFromStorage,
  loadPostDraftFromStorage,
  savePostDraftToStorage,
  type LocalPostDraft,
} from "@/lib/post-draft"
import { toast } from "@/components/ui/toast"
import { normalizeDraftData } from "@/components/post/create-post-form.shared"
import {
  getEffectiveRewardPoolOptions,
  resolveAvailableRewardPoolMode,
} from "@/components/post/use-create-post-draft.shared"

interface UseCreatePostDraftPersistenceOptions {
  draft: LocalPostDraft
  initialDraftData: LocalPostDraft
  storageMode: "create" | "edit"
  postId?: string
  pointName: string
  postRedPacketEnabled: boolean
  postJackpotEnabled: boolean
  setDraft: React.Dispatch<React.SetStateAction<LocalPostDraft>>
}

export function useCreatePostDraftPersistence({
  draft,
  initialDraftData,
  storageMode,
  postId,
  pointName,
  postRedPacketEnabled,
  postJackpotEnabled,
  setDraft,
}: UseCreatePostDraftPersistenceOptions) {
  const [pendingDraftToRestore, setPendingDraftToRestore] =
    useState<LocalPostDraft | null>(null)
  const [pendingDraftUpdatedAt, setPendingDraftUpdatedAt] = useState<string | null>(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const [lastSavedDraftAt, setLastSavedDraftAt] = useState<string | null>(null)
  const hasPromptedDraftRef = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined" || hasPromptedDraftRef.current) {
      return
    }

    const storedDraft = loadPostDraftFromStorage(storageMode, postId)
    if (!storedDraft) {
      hasPromptedDraftRef.current = true
      return
    }

    hasPromptedDraftRef.current = true
    const timer = window.setTimeout(() => {
      setLastSavedDraftAt(storedDraft.updatedAt)
      setPendingDraftToRestore(storedDraft.data)
      setPendingDraftUpdatedAt(storedDraft.updatedAt)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [postId, storageMode])

  useEffect(() => {
    if (typeof window === "undefined" || !hasPromptedDraftRef.current) {
      return
    }

    const timer = window.setTimeout(() => {
      const payload = savePostDraftToStorage(storageMode, draft, initialDraftData, postId)
      setLastSavedDraftAt(payload?.updatedAt ?? null)
    }, 800)

    return () => window.clearTimeout(timer)
  }, [draft, initialDraftData, postId, storageMode])

  function restoreDraft(nextDraft: LocalPostDraft) {
    const normalizedDraft = normalizeDraftData(
      nextDraft,
      pointName,
      initialDraftData.boardSlug,
    )
    const restoredRewardPoolOptions = getEffectiveRewardPoolOptions(
      normalizedDraft.isAnonymous,
      {
        postRedPacketEnabled,
        postJackpotEnabled,
      },
    )
    setDraft({
      ...normalizedDraft,
      redPacketMode: resolveAvailableRewardPoolMode(
        normalizedDraft.redPacketMode,
        restoredRewardPoolOptions,
      ),
      redPacketEnabled:
        normalizedDraft.redPacketEnabled
        && (restoredRewardPoolOptions.postRedPacketEnabled
          || restoredRewardPoolOptions.postJackpotEnabled),
    })
    setDraftRestored(true)
    setPendingDraftToRestore(null)
    setPendingDraftUpdatedAt(null)
    toast.info("已恢复你上次未提交的本地草稿", "草稿已恢复")
  }

  function handleRestorePendingDraft() {
    if (pendingDraftToRestore) {
      restoreDraft(pendingDraftToRestore)
    }
  }

  function handleManualDraftSave() {
    const payload = savePostDraftToStorage(storageMode, draft, initialDraftData, postId)

    if (!payload) {
      setLastSavedDraftAt(null)
      setDraftRestored(false)
      setPendingDraftUpdatedAt(null)
      toast.info("请先输入标题、正文或其他有效配置后再保存草稿", "未保存草稿")
      return
    }

    setLastSavedDraftAt(payload.updatedAt)
    setDraftRestored(false)
    setPendingDraftUpdatedAt(null)
    toast.success("当前内容已保存到本地，下次进入可恢复", "草稿已保存")
  }

  const handleManualDraftSaveEffect = useEffectEvent(() => {
    handleManualDraftSave()
  })

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
        return
      }

      if (event.key.toLowerCase() !== "s") {
        return
      }

      event.preventDefault()
      handleManualDraftSaveEffect()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  function handleClearDraft() {
    clearPostDraftFromStorage(storageMode, postId)
    setLastSavedDraftAt(null)
    setDraftRestored(false)
    setPendingDraftToRestore(null)
    setPendingDraftUpdatedAt(null)
    toast.info("当前页面对应的本地草稿已删除", "草稿已清除")
  }

  return {
    pendingDraftToRestore,
    pendingDraftUpdatedAt,
    draftRestored,
    lastSavedDraftAt,
    handleRestorePendingDraft,
    handleManualDraftSave,
    handleClearDraft,
  }
}
