"use client"

import { useMemo, useState } from "react"

import type { LocalPostDraft } from "@/lib/post-draft"
import {
  MAX_MANUAL_TAGS,
  MAX_VISIBLE_AUTO_TAGS,
  normalizeManualTags,
} from "@/lib/post-tags"
import { toast } from "@/components/ui/toast"

interface UseCreatePostTagsOptions {
  draft: LocalPostDraft
  autoExtractedTagPool: string[]
  updateDraftField: <Key extends keyof LocalPostDraft>(
    field: Key,
    value: LocalPostDraft[Key],
  ) => void
}

export function useCreatePostTags({
  draft,
  autoExtractedTagPool,
  updateDraftField,
}: UseCreatePostTagsOptions) {
  const [tagInput, setTagInput] = useState("")
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [tagEditingIndex, setTagEditingIndex] = useState<number | null>(null)
  const [tagEditingValue, setTagEditingValue] = useState("")
  const autoExtractedTags = useMemo(() => {
    const manualTagKeys = new Set(
      draft.manualTags.map((item) => item.trim().toLowerCase()).filter(Boolean),
    )

    return autoExtractedTagPool
      .filter((tag) => !manualTagKeys.has(tag.toLowerCase()))
      .slice(0, MAX_VISIBLE_AUTO_TAGS)
  }, [autoExtractedTagPool, draft.manualTags])

  function addManualTag(value: string) {
    const nextTag = value.trim()
    if (!nextTag) {
      return false
    }

    if (draft.manualTags.length >= MAX_MANUAL_TAGS) {
      toast.info(`最多保留 ${MAX_MANUAL_TAGS} 个最终标签`, "标签数量已满")
      return false
    }

    if (draft.manualTags.some((item) => item.toLowerCase() === nextTag.toLowerCase())) {
      setTagInput("")
      return false
    }

    updateDraftField("manualTags", normalizeManualTags([...draft.manualTags, nextTag]))
    setTagInput("")
    return true
  }

  function startEditingTag(index: number) {
    setTagEditingIndex(index)
    setTagEditingValue(draft.manualTags[index] ?? "")
  }

  function commitEditingTag(index = tagEditingIndex) {
    if (index === null) {
      return
    }

    const nextValue = tagEditingValue.trim()
    updateDraftField(
      "manualTags",
      nextValue
        ? normalizeManualTags(
            draft.manualTags.map((item, currentIndex) =>
              currentIndex === index ? nextValue : item),
          )
        : draft.manualTags.filter((_, currentIndex) => currentIndex !== index),
    )
    setTagEditingIndex(null)
    setTagEditingValue("")
  }

  function cancelEditingTag() {
    setTagEditingIndex(null)
    setTagEditingValue("")
  }

  function removeManualTag(tag: string) {
    const removedIndex = draft.manualTags.findIndex(
      (item) => item.toLowerCase() === tag.toLowerCase(),
    )
    updateDraftField(
      "manualTags",
      draft.manualTags.filter((item) => item.toLowerCase() !== tag.toLowerCase()),
    )
    setTagEditingIndex((current) => {
      if (removedIndex < 0 || current === null) {
        return current
      }
      if (current === removedIndex) {
        return null
      }
      return current > removedIndex ? current - 1 : current
    })
    if (tagEditingIndex === removedIndex) {
      setTagEditingValue("")
    }
  }

  function clearManualTags() {
    updateDraftField("manualTags", [])
    setTagInput("")
    cancelEditingTag()
  }

  function handleTagInputConfirm() {
    if (!tagInput.trim()) {
      return
    }

    let added = 0
    tagInput
      .split(/[，,\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => {
        if (addManualTag(item)) {
          added += 1
        }
      })

    if (added > 0) {
      setTagEditingIndex(null)
    }
  }

  function applyAutoTagsToManual() {
    const nextTags = normalizeManualTags([...draft.manualTags, ...autoExtractedTags])
    const addedCount = nextTags.length - draft.manualTags.length
    updateDraftField("manualTags", nextTags)

    if (addedCount > 0) {
      toast.success(`已加入 ${addedCount} 个可编辑标签`, "标签已更新")
      return
    }

    toast.info("当前自动结果都已在最终标签中", "无需重复添加")
  }

  function handleCloseTagModal() {
    cancelEditingTag()
    setTagModalOpen(false)
  }

  return {
    autoExtractedTags,
    tagInput,
    setTagInput,
    tagModalOpen,
    setTagModalOpen,
    tagEditingIndex,
    tagEditingValue,
    setTagEditingValue,
    addManualTag,
    startEditingTag,
    commitEditingTag,
    cancelEditingTag,
    removeManualTag,
    clearManualTags,
    handleTagInputConfirm,
    applyAutoTagsToManual,
    handleCloseTagModal,
  }
}
