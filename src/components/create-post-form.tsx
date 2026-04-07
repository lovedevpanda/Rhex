"use client"

import { ChevronDown, Info } from "lucide-react"
import { useRouter } from "next/navigation"
import type { ChangeEvent, FormEvent } from "react"
import { useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from "react"

import {
  clearPostDraftFromStorage,
  loadPostDraftFromStorage,
  savePostDraftToStorage,
  type LocalPostDraft,
} from "@/lib/post-draft"
import { MAX_MANUAL_TAGS, normalizeManualTags } from "@/lib/post-tags"
import { DEFAULT_POST_TYPE, type LocalPostType } from "@/lib/post-types"
import { ensureJiebaReady, extractAutoTags } from "@/lib/post-taxonomy"
import { multiplyPositiveSafeIntegers, parsePositiveSafeInteger } from "@/lib/shared/safe-integer"

import { BoardSelectField } from "@/components/board-select-field"
import {
  BountySettingsSection,
  CoverConfigModal,
  LotterySettingsSection,
  PollSettingsSection,
  PostRewardPoolModal,
  PostEnhancementsSection,
  TagConfigModal,
} from "@/components/create-post-form.sections"
import {
  buildInitialPostDraft,
  buildLotteryConditionItem,
  buildNextLotteryConditionGroupKey,
  buildSubmitRequest,
  getAvailablePostTypes,
  normalizeDraftData,
  resolveAllowedPostTypes,
  type CreatePostFormProps,
  type HiddenModalType,
} from "@/components/create-post-form.shared"
import { HiddenContentModal } from "@/components/hidden-content-modal"
import { PostDraftNotice, type PostDraftNoticeAction } from "@/components/post-draft-notice"
import { PostViewLevelModal } from "@/components/post-view-level-modal"
import { RefinedRichPostEditor } from "@/components/refined-rich-post-editor"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"

function HoverTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground">
        <Info className="h-3.5 w-3.5" />
      </span>
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-20 w-56 -translate-x-1/2 rounded-2xl border border-border bg-background px-3 py-2 text-xs leading-5 text-foreground opacity-0 shadow-2xl transition-opacity group-hover:opacity-100">
        {text}
      </span>
    </span>
  )
}

function resolveAvailableRewardPoolMode(
  currentMode: LocalPostDraft["redPacketMode"],
  options: {
    postRedPacketEnabled: boolean
    postJackpotEnabled: boolean
  },
) {
  if (currentMode === "RED_PACKET" && options.postRedPacketEnabled) {
    return "RED_PACKET" as const
  }

  if (currentMode === "JACKPOT" && options.postJackpotEnabled) {
    return "JACKPOT" as const
  }

  if (options.postJackpotEnabled) {
    return "JACKPOT" as const
  }

  return "RED_PACKET" as const
}

function getEffectiveRewardPoolOptions(
  isAnonymous: boolean,
  options: {
    postRedPacketEnabled: boolean
    postJackpotEnabled: boolean
  },
) {
  return {
    postRedPacketEnabled: !isAnonymous && options.postRedPacketEnabled,
    postJackpotEnabled: options.postJackpotEnabled,
  }
}

export function CreatePostForm({
  boardOptions,
  pointName,
  anonymousPostEnabled = false,
  anonymousPostPrice = 0,
  postRedPacketEnabled = false,
  postRedPacketMaxPoints = 100,
  postJackpotEnabled = false,
  postJackpotMinInitialPoints = 100,
  postJackpotMaxInitialPoints = 1000,
  postJackpotReplyIncrementPoints = 25,
  postJackpotHitProbability = 15,
  markdownEmojiMap,
  currentUser,
  viewLevelOptions,
  viewVipLevelOptions,
  mode = "create",
  postId,
  initialValues,
}: CreatePostFormProps) {
  const router = useRouter()
  const isEditMode = mode === "edit"
  const storageMode = isEditMode ? "edit" : "create"

  const initialDraftData = useMemo(
    () => {
      const draft = buildInitialPostDraft(initialValues, boardOptions, pointName)
      const effectiveRewardPoolOptions = getEffectiveRewardPoolOptions(draft.isAnonymous, {
        postRedPacketEnabled,
        postJackpotEnabled,
      })

      if (mode === "edit") {
        return draft
      }

      return {
        ...draft,
        redPacketMode: resolveAvailableRewardPoolMode(draft.redPacketMode, effectiveRewardPoolOptions),
      }
    },
    [boardOptions, initialValues, mode, pointName, postJackpotEnabled, postRedPacketEnabled],
  )

  const [draft, setDraft] = useState<LocalPostDraft>(() => initialDraftData)
  const [tagInput, setTagInput] = useState("")
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [coverModalOpen, setCoverModalOpen] = useState(false)
  const [rewardPoolModalOpen, setRewardPoolModalOpen] = useState(false)
  const [tagEditingIndex, setTagEditingIndex] = useState<number | null>(null)
  const [tagEditingValue, setTagEditingValue] = useState("")
  const [pendingDraftToRestore, setPendingDraftToRestore] = useState<LocalPostDraft | null>(null)
  const [pendingDraftUpdatedAt, setPendingDraftUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showBoardTips, setShowBoardTips] = useState(false)
  const [activeModal, setActiveModal] = useState<HiddenModalType>(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const [lastSavedDraftAt, setLastSavedDraftAt] = useState<string | null>(null)
  const [coverUploading, setCoverUploading] = useState(false)
  const [jiebaReady, setJiebaReady] = useState(false)
  const hasPromptedDraftRef = useRef(false)

  const deferredTitle = useDeferredValue(draft.title)
  const deferredContent = useDeferredValue(draft.content)

  const normalizedPollOptions = useMemo(
    () => draft.pollOptions.map((item) => item.trim()).filter(Boolean),
    [draft.pollOptions],
  )
  const normalizedRedPacketUnitPoints = useMemo(
    () => parsePositiveSafeInteger(draft.redPacketUnitPoints),
    [draft.redPacketUnitPoints],
  )
  const normalizedRedPacketPacketCount = useMemo(
    () => parsePositiveSafeInteger(draft.redPacketPacketCount),
    [draft.redPacketPacketCount],
  )
  const fixedRedPacketTotalPoints = useMemo(
    () => multiplyPositiveSafeIntegers(normalizedRedPacketUnitPoints, normalizedRedPacketPacketCount),
    [normalizedRedPacketPacketCount, normalizedRedPacketUnitPoints],
  )
  const effectiveRewardPoolOptions = useMemo(
    () => getEffectiveRewardPoolOptions(draft.isAnonymous, { postRedPacketEnabled, postJackpotEnabled }),
    [draft.isAnonymous, postJackpotEnabled, postRedPacketEnabled],
  )
  const rewardPoolFeatureEnabled = effectiveRewardPoolOptions.postJackpotEnabled || effectiveRewardPoolOptions.postRedPacketEnabled
  const allBoards = useMemo(() => boardOptions.flatMap((group) => group.items), [boardOptions])
  const selectedBoard = allBoards.find((item) => item.value === draft.boardSlug) ?? allBoards[0]
  const allowedPostTypes = useMemo(() => resolveAllowedPostTypes(selectedBoard), [selectedBoard])
  const anonymousAllowedPostTypes = useMemo(
    () => allowedPostTypes.filter((item) => item === "NORMAL" || item === "POLL"),
    [allowedPostTypes],
  )
  const availablePostTypes = useMemo(
    () => getAvailablePostTypes(draft.isAnonymous ? anonymousAllowedPostTypes : allowedPostTypes, pointName),
    [allowedPostTypes, anonymousAllowedPostTypes, draft.isAnonymous, pointName],
  )
  const selectedPostTypeOption = useMemo(
    () => availablePostTypes.find((item) => item.value === draft.postType) ?? availablePostTypes[0] ?? null,
    [availablePostTypes, draft.postType],
  )
  const autoExtractedTags = useMemo(
    () => (jiebaReady ? extractAutoTags(deferredTitle, deferredContent) : []),
    [deferredContent, deferredTitle, jiebaReady],
  )

  const isVipActive = Boolean(currentUser.vipExpiresAt && new Date(currentUser.vipExpiresAt).getTime() > Date.now())
  const currentVipLevel = isVipActive ? (currentUser.vipLevel ?? 0) : 0
  const minPostVipLevel = selectedBoard?.minPostVipLevel ?? 0
  const canPostInBoard = currentUser.points >= (selectedBoard?.minPostPoints ?? 0)
    && currentUser.level >= (selectedBoard?.minPostLevel ?? 0)
    && currentVipLevel >= minPostVipLevel

  function patchDraft(patch: Partial<LocalPostDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function updateDraftField<Key extends keyof LocalPostDraft>(field: Key, value: LocalPostDraft[Key]) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  useEffect(() => {
    let cancelled = false

    ensureJiebaReady()
      .then(() => {
        if (!cancelled) {
          setJiebaReady(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setJiebaReady(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const nextAllowedPostTypes = draft.isAnonymous ? anonymousAllowedPostTypes : allowedPostTypes
    if (!nextAllowedPostTypes.includes(draft.postType as LocalPostType)) {
      updateDraftField("postType", nextAllowedPostTypes[0] ?? DEFAULT_POST_TYPE)
    }
  }, [allowedPostTypes, anonymousAllowedPostTypes, draft.isAnonymous, draft.postType])

  useEffect(() => {
    if (!draft.redPacketEnabled) {
      return
    }

    if (!rewardPoolFeatureEnabled) {
      patchDraft({
        redPacketEnabled: false,
        redPacketMode: resolveAvailableRewardPoolMode(draft.redPacketMode, effectiveRewardPoolOptions),
        jackpotInitialPoints: String(postJackpotMinInitialPoints),
        redPacketGrantMode: "FIXED",
        redPacketClaimOrderMode: "FIRST_COME_FIRST_SERVED",
        redPacketTriggerType: "REPLY",
        redPacketUnitPoints: "10",
        redPacketTotalPoints: "10",
        redPacketPacketCount: "1",
      })
      return
    }

    const resolvedMode = resolveAvailableRewardPoolMode(draft.redPacketMode, effectiveRewardPoolOptions)

    if (resolvedMode !== draft.redPacketMode) {
      updateDraftField("redPacketMode", resolvedMode)
    }
  }, [draft.redPacketEnabled, draft.redPacketMode, effectiveRewardPoolOptions, postJackpotMinInitialPoints, rewardPoolFeatureEnabled])

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
    setLastSavedDraftAt(storedDraft.updatedAt)
    setPendingDraftToRestore(storedDraft.data)
    setPendingDraftUpdatedAt(storedDraft.updatedAt)
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

  function restoreDraft(nextDraft: LocalPostDraft) {
    const normalizedDraft = normalizeDraftData(nextDraft, pointName, initialDraftData.boardSlug)
    const restoredRewardPoolOptions = getEffectiveRewardPoolOptions(normalizedDraft.isAnonymous, {
      postRedPacketEnabled,
      postJackpotEnabled,
    })
    setDraft({
      ...normalizedDraft,
      redPacketMode: resolveAvailableRewardPoolMode(normalizedDraft.redPacketMode, restoredRewardPoolOptions),
      redPacketEnabled: normalizedDraft.redPacketEnabled
        && (restoredRewardPoolOptions.postRedPacketEnabled || restoredRewardPoolOptions.postJackpotEnabled),
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

  function handleClearDraft() {
    clearPostDraftFromStorage(storageMode, postId)
    setLastSavedDraftAt(null)
    setDraftRestored(false)
    setPendingDraftToRestore(null)
    setPendingDraftUpdatedAt(null)
    toast.info("当前页面对应的本地草稿已删除", "草稿已清除")
  }

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
        ? normalizeManualTags(draft.manualTags.map((item, currentIndex) => (currentIndex === index ? nextValue : item)))
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
    const removedIndex = draft.manualTags.findIndex((item) => item.toLowerCase() === tag.toLowerCase())
    updateDraftField("manualTags", draft.manualTags.filter((item) => item.toLowerCase() !== tag.toLowerCase()))
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

  function updatePollOption(index: number, value: string) {
    updateDraftField("pollOptions", draft.pollOptions.map((item, currentIndex) => (currentIndex === index ? value : item)))
  }

  function addPollOption() {
    if (draft.pollOptions.length < 8) {
      updateDraftField("pollOptions", [...draft.pollOptions, ""])
    }
  }

  function removePollOption(index: number) {
    if (draft.pollOptions.length > 2) {
      updateDraftField("pollOptions", draft.pollOptions.filter((_, currentIndex) => currentIndex !== index))
    }
  }

  function updateLotteryPrize(index: number, field: keyof LocalPostDraft["lotteryPrizes"][number], value: string) {
    updateDraftField(
      "lotteryPrizes",
      draft.lotteryPrizes.map((item, currentIndex) => (currentIndex === index ? { ...item, [field]: value } : item)),
    )
  }

  function addLotteryPrize() {
    if (draft.lotteryPrizes.length < 20) {
      updateDraftField("lotteryPrizes", [...draft.lotteryPrizes, { title: "", quantity: "1", description: "" }])
    }
  }

  function removeLotteryPrize(index: number) {
    if (draft.lotteryPrizes.length > 1) {
      updateDraftField("lotteryPrizes", draft.lotteryPrizes.filter((_, currentIndex) => currentIndex !== index))
    }
  }

  function updateLotteryCondition(index: number, field: keyof LocalPostDraft["lotteryConditions"][number], value: string) {
    setDraft((current) => ({
      ...current,
      lotteryConditions: current.lotteryConditions.map((item, currentIndex) => {
        if (currentIndex !== index) {
          return item
        }

        if (field === "type") {
          return {
            ...item,
            ...buildLotteryConditionItem(value, pointName, item.groupKey),
          }
        }

        return { ...item, [field]: value }
      }),
    }))
  }

  function addLotteryCondition(type = "REPLY_CONTENT_LENGTH", groupKey = "default") {
    setDraft((current) => {
      if (current.lotteryConditions.length >= 20) {
        return current
      }

      return {
        ...current,
        lotteryConditions: [...current.lotteryConditions, buildLotteryConditionItem(type, pointName, groupKey)],
      }
    })
  }

  function addLotteryConditionGroup() {
    setDraft((current) => {
      if (current.lotteryConditions.length >= 20) {
        return current
      }

      return {
        ...current,
        lotteryConditions: [
          ...current.lotteryConditions,
          buildLotteryConditionItem("REPLY_CONTENT_LENGTH", pointName, buildNextLotteryConditionGroupKey(current.lotteryConditions)),
        ],
      }
    })
  }

  function removeLotteryCondition(index: number) {
    setDraft((current) => {
      if (current.lotteryConditions.length <= 1) {
        return current
      }

      return {
        ...current,
        lotteryConditions: current.lotteryConditions.filter((_, currentIndex) => currentIndex !== index),
      }
    })
  }

  function removeLotteryConditionGroup(groupKey: string) {
    setDraft((current) => {
      const remainingConditions = current.lotteryConditions.filter((item) => item.groupKey !== groupKey)
      if (remainingConditions.length === 0) {
        return current
      }

      return {
        ...current,
        lotteryConditions: remainingConditions,
      }
    })
  }

  async function handleCoverUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件后再上传", "封面上传失败")
      event.target.value = ""
      return
    }

    setCoverUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", "post-covers")

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      const result = await response.json()

      if (!response.ok || result.code !== 0) {
        throw new Error(result.message ?? "封面上传失败")
      }

      updateDraftField("coverPath", String(result.data?.urlPath ?? ""))
      toast.success("封面上传成功", "封面上传成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "封面上传失败", "封面上传失败")
    } finally {
      setCoverUploading(false)
      event.target.value = ""
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)

    const { endpoint, payload } = buildSubmitRequest({ mode, postId, draft })
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
    const result = await response.json()

    if (!response.ok) {
      const errorMessage = result.message ?? (isEditMode ? "保存失败" : "发帖失败")
      toast.error(errorMessage, isEditMode ? "保存失败" : "发帖失败")
      setLoading(false)
      return
    }

    const successMessage = result.message ?? (isEditMode ? "保存成功，正在返回详情页…" : "发布成功，正在跳转详情页…")
    toast.success(successMessage, isEditMode ? "保存成功" : "发布成功")

    router.push(`/posts/${result.data?.id ?? postId}`)
    router.refresh()
    setLoading(false)
  }

  function handleCloseTagModal() {
    cancelEditingTag()
    setTagModalOpen(false)
  }

  const draftMetaTimestamp = pendingDraftUpdatedAt ?? lastSavedDraftAt
  const draftNoticeActions: PostDraftNoticeAction[] = []

  if (pendingDraftToRestore) {
    draftNoticeActions.push({ label: "恢复草稿", onClick: handleRestorePendingDraft, variant: "outline" })
  }

  if (pendingDraftToRestore || lastSavedDraftAt) {
    draftNoticeActions.push({ label: "清除草稿", onClick: handleClearDraft, variant: "ghost" })
  }

  draftNoticeActions.push({ label: "保存草稿", onClick: handleManualDraftSave, variant: "outline" })

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-2">
            <p className="text-sm font-medium">选择节点</p>
            <BoardSelectField value={draft.boardSlug} onChange={(value) => updateDraftField("boardSlug", value)} boardOptions={boardOptions} disabled={isEditMode} />
            <p className="text-xs leading-6 text-muted-foreground">
              {isEditMode ? "编辑模式下暂不允许切换节点，避免跨节点权限和审核状态不一致。" : "现在支持搜索分区、节点名和 slug，节点变多后也能快速找到。"}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">帖子类型</p>
              <p className="text-xs text-muted-foreground">选择后再填写对应内容</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={draft.postType}
                onChange={(event) => updateDraftField("postType", event.target.value as LocalPostType)}
                className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none"
                disabled={isEditMode}
              >
                {availablePostTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              {!isEditMode && anonymousPostEnabled ? (
                <label className="flex h-11 shrink-0 items-center justify-between gap-3 rounded-full border border-border bg-card px-4 text-sm sm:min-w-[168px]">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className="font-medium">匿名发布</span>
                    <HoverTip text={`开启后显示为匿名账号，发布额外扣除 ${anonymousPostPrice} ${pointName}`} />
                  </span>
                  <input
                    type="checkbox"
                    checked={draft.isAnonymous}
                    onChange={(event) => updateDraftField("isAnonymous", event.target.checked)}
                    className="h-4 w-4"
                  />
                </label>
              ) : null}
            </div>
            {selectedPostTypeOption ? <p className="text-xs leading-6 text-muted-foreground">{selectedPostTypeOption.hint}</p> : null}
          </div>
        </div>

        {!canPostInBoard ? (
          <div className="rounded-[20px] border border-border bg-card/70 px-4 py-3">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 text-left"
              onClick={() => setShowBoardTips((current) => !current)}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span>发帖提示与权限要求</span>
              </div>
              <ChevronDown className={showBoardTips ? "h-4 w-4 rotate-180 text-muted-foreground transition-transform" : "h-4 w-4 text-muted-foreground transition-transform"} />
            </button>
            {showBoardTips ? (
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>当前节点要求：最低{pointName} {selectedBoard?.minPostPoints ?? 0}，最低等级 Lv.{selectedBoard?.minPostLevel ?? 0}，最低 VIP 等级 {minPostVipLevel}，{selectedBoard?.requirePostReview ? "发帖后需审核" : "发帖默认直发"}。</p>
                <p>当前账号：{currentUser.nickname ?? currentUser.username} · Lv.{currentUser.level} · {currentUser.points} {pointName} {isVipActive ? `· VIP ${currentVipLevel}` : "· 非 VIP"}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {!canPostInBoard ? (
          <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            当前不满足该节点发帖权限，请提升{pointName}、等级、VIP 等级或开通 VIP 后再试。
          </div>
        ) : null}

        {draft.postType === "BOUNTY" ? (
          <BountySettingsSection
            pointName={pointName}
            bountyPoints={draft.bountyPoints}
            onBountyPointsChange={(value) => updateDraftField("bountyPoints", value)}
            disabled={isEditMode}
          />
        ) : null}

        {draft.postType === "POLL" ? (
          <PollSettingsSection
            pollOptions={draft.pollOptions}
            normalizedPollOptionsCount={normalizedPollOptions.length}
            pollExpiresAt={draft.pollExpiresAt}
            onPollOptionChange={updatePollOption}
            onPollExpiresAtChange={(value) => updateDraftField("pollExpiresAt", value)}
            onAddPollOption={addPollOption}
            onRemovePollOption={removePollOption}
            disabled={isEditMode}
          />
        ) : null}

        {draft.postType === "LOTTERY" ? (
          <LotterySettingsSection
            pointName={pointName}
            lotteryStartsAt={draft.lotteryStartsAt}
            lotteryEndsAt={draft.lotteryEndsAt}
            lotteryParticipantGoal={draft.lotteryParticipantGoal}
            lotteryPrizes={draft.lotteryPrizes}
            lotteryConditions={draft.lotteryConditions}
            userLevelOptions={viewLevelOptions}
            vipLevelOptions={viewVipLevelOptions}
            onLotteryStartsAtChange={(value) => updateDraftField("lotteryStartsAt", value)}
            onLotteryEndsAtChange={(value) => updateDraftField("lotteryEndsAt", value)}
            onLotteryParticipantGoalChange={(value) => updateDraftField("lotteryParticipantGoal", value)}
            onLotteryPrizeChange={updateLotteryPrize}
            onAddLotteryPrize={addLotteryPrize}
            onRemoveLotteryPrize={removeLotteryPrize}
            onLotteryConditionChange={updateLotteryCondition}
            onAddLotteryConditionGroup={addLotteryConditionGroup}
            onAddLotteryCondition={addLotteryCondition}
            onRemoveLotteryCondition={removeLotteryCondition}
            onRemoveLotteryConditionGroup={removeLotteryConditionGroup}
            disabled={isEditMode}
          />
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-medium">标题</p>
          <input value={draft.title} onChange={(event) => updateDraftField("title", event.target.value)} className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none" placeholder="写一个让人愿意点进来的标题" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">公开正文</p>
            <p className="text-xs text-muted-foreground">请遵守社区规则，文明发帖！</p>
          </div>
          <RefinedRichPostEditor value={draft.content} onChange={(value) => updateDraftField("content", value)} placeholder="文明社区，文明发言。支持 Markdown 语法" markdownEmojiMap={markdownEmojiMap} />
        </div>

        <PostEnhancementsSection
          pointName={pointName}
          rewardPoolEnabled={rewardPoolFeatureEnabled}
          settings={{
            finalTags: draft.manualTags,
            autoExtractedTags,
            coverUploading,
            coverPath: draft.coverPath,
            commentsVisibleToAuthorOnly: draft.commentsVisibleToAuthorOnly,
            replyUnlockContent: draft.replyUnlockContent,
            purchaseUnlockContent: draft.purchaseUnlockContent,
            purchasePrice: draft.purchasePrice,
            minViewLevel: draft.minViewLevel,
            minViewVipLevel: draft.minViewVipLevel,
            redPacketEnabled: draft.redPacketEnabled,
            redPacketMode: draft.redPacketMode,
            redPacketGrantMode: draft.redPacketGrantMode,
            redPacketTriggerType: draft.redPacketTriggerType,
            jackpotInitialPoints: draft.jackpotInitialPoints,
            fixedRedPacketTotalPoints,
            postJackpotMinInitialPoints,
            postJackpotReplyIncrementPoints,
            postJackpotHitProbability,
          }}
          actions={{
            onOpenTagModal: () => setTagModalOpen(true),
            onOpenCoverModal: () => setCoverModalOpen(true),
            onRemoveManualTag: removeManualTag,
            onCoverClear: () => updateDraftField("coverPath", ""),
            onCommentsVisibleToAuthorOnlyChange: (checked) => updateDraftField("commentsVisibleToAuthorOnly", checked),
            onOpenReplyModal: () => setActiveModal("reply"),
            onClearReplyUnlock: () => updateDraftField("replyUnlockContent", ""),
            onOpenPurchaseModal: () => setActiveModal("purchase"),
            onClearPurchaseUnlock: () => patchDraft({ purchaseUnlockContent: "", purchasePrice: "20" }),
            onOpenViewLevelModal: () => setActiveModal("view-level"),
            onClearViewLevel: () => patchDraft({ minViewLevel: "0", minViewVipLevel: "0" }),
            onOpenRewardPoolModal: () => setRewardPoolModalOpen(true),
            onClearRewardPool: () => patchDraft({
              redPacketEnabled: false,
              redPacketMode: resolveAvailableRewardPoolMode(draft.redPacketMode, effectiveRewardPoolOptions),
              jackpotInitialPoints: String(postJackpotMinInitialPoints),
              redPacketGrantMode: "FIXED",
              redPacketClaimOrderMode: "FIRST_COME_FIRST_SERVED",
              redPacketTriggerType: "REPLY",
              redPacketUnitPoints: "10",
              redPacketTotalPoints: "10",
              redPacketPacketCount: "1",
            }),
            onRedPacketEnabledChange: (checked) => patchDraft({
              redPacketEnabled: checked,
              ...(checked
                ? {
                    redPacketMode: resolveAvailableRewardPoolMode(draft.redPacketMode, effectiveRewardPoolOptions),
                  }
                : {}),
            }),
            onRedPacketModeChange: (value) => updateDraftField("redPacketMode", value),
            onRedPacketGrantModeChange: (value) => updateDraftField("redPacketGrantMode", value),
            onRedPacketClaimOrderModeChange: (value) => updateDraftField("redPacketClaimOrderMode", value),
            onRedPacketTriggerTypeChange: (value) => updateDraftField("redPacketTriggerType", value),
            onJackpotInitialPointsChange: (value) => updateDraftField("jackpotInitialPoints", value),
            onRedPacketValueChange: (value) => {
              if (draft.redPacketGrantMode === "FIXED") {
                updateDraftField("redPacketUnitPoints", value)
                return
              }
              updateDraftField("redPacketTotalPoints", value)
            },
            onRedPacketPacketCountChange: (value) => updateDraftField("redPacketPacketCount", value),
          }}
        />

        <div className="flex flex-wrap items-start justify-between gap-2 sm:flex-nowrap sm:items-center">
          <div>
            <PostDraftNotice
              title={pendingDraftToRestore ? "检测到本地草稿" : lastSavedDraftAt ? (draftRestored ? "已恢复草稿" : "本地草稿") : "草稿状态"}
              description={pendingDraftToRestore ? `你在${isEditMode ? "编辑帖子" : "发帖"}页有一份未提交内容，可直接恢复继续编辑。支持 Ctrl/Cmd+S 快速保存草稿。` : "当前内容会自动暂存到本地。支持 Ctrl/Cmd+S 快速保存草稿。"}
              meta={draftMetaTimestamp ? `保存于 ${new Date(draftMetaTimestamp).toLocaleString()}` : undefined}
              tone={pendingDraftToRestore ? "warning" : "info"}
              size="dense"
              actions={draftNoticeActions}
              className="w-full"
            />
          </div>
          <Button className="h-8 rounded-full px-4 text-xs sm:h-9 sm:px-4 sm:text-sm" disabled={loading || !canPostInBoard}>
            {loading ? (isEditMode ? "保存中..." : "发布中...") : (isEditMode ? "保存帖子" : "发布帖子")}
          </Button>
        </div>
      </form>

      <CoverConfigModal
        open={coverModalOpen}
        coverPath={draft.coverPath}
        coverUploading={coverUploading}
        onClose={() => setCoverModalOpen(false)}
        onCoverUpload={handleCoverUpload}
        onCoverPathChange={(value) => updateDraftField("coverPath", value)}
        onCoverClear={() => updateDraftField("coverPath", "")}
      />

      <TagConfigModal
        open={tagModalOpen}
        autoExtractedTags={autoExtractedTags}
        manualTags={draft.manualTags}
        tagInput={tagInput}
        tagEditingIndex={tagEditingIndex}
        tagEditingValue={tagEditingValue}
        onClose={handleCloseTagModal}
        onTagInputChange={setTagInput}
        onTagInputConfirm={handleTagInputConfirm}
        onApplyAutoTagsToManual={applyAutoTagsToManual}
        onAddManualTag={addManualTag}
        onClearManualTags={clearManualTags}
        onStartEditingTag={startEditingTag}
        onTagEditingValueChange={setTagEditingValue}
        onCommitEditingTag={commitEditingTag}
        onCancelEditingTag={cancelEditingTag}
        onRemoveManualTag={removeManualTag}
      />

      <PostRewardPoolModal
        open={rewardPoolModalOpen}
        pointName={pointName}
        redPacketEnabled={effectiveRewardPoolOptions.postRedPacketEnabled}
        redPacketMaxPoints={postRedPacketMaxPoints}
        jackpotEnabled={effectiveRewardPoolOptions.postJackpotEnabled}
        jackpotMinInitialPoints={postJackpotMinInitialPoints}
        jackpotMaxInitialPoints={postJackpotMaxInitialPoints}
        jackpotReplyIncrementPoints={postJackpotReplyIncrementPoints}
        currentUserPoints={currentUser.points}
        value={{
          enabled: draft.redPacketEnabled,
          mode: draft.redPacketMode,
          grantMode: draft.redPacketGrantMode,
          claimOrderMode: draft.redPacketClaimOrderMode,
          triggerType: draft.redPacketTriggerType,
          jackpotInitialPoints: draft.jackpotInitialPoints,
          unitPoints: draft.redPacketUnitPoints,
          totalPoints: draft.redPacketTotalPoints,
          packetCount: draft.redPacketPacketCount,
          fixedTotalPoints: fixedRedPacketTotalPoints,
        }}
        disabled={isEditMode}
        onClose={() => setRewardPoolModalOpen(false)}
        onChange={{
          onEnabledChange: (checked) => patchDraft({
            redPacketEnabled: checked,
            ...(checked
              ? {
                  redPacketMode: resolveAvailableRewardPoolMode(draft.redPacketMode, effectiveRewardPoolOptions),
                }
              : {}),
          }),
          onModeChange: (value) => updateDraftField("redPacketMode", value),
          onGrantModeChange: (value) => updateDraftField("redPacketGrantMode", value),
          onClaimOrderModeChange: (value) => updateDraftField("redPacketClaimOrderMode", value),
          onTriggerTypeChange: (value) => updateDraftField("redPacketTriggerType", value),
          onJackpotInitialPointsChange: (value) => updateDraftField("jackpotInitialPoints", value),
          onUnitPointsChange: (value) => updateDraftField("redPacketUnitPoints", value),
          onTotalPointsChange: (value) => updateDraftField("redPacketTotalPoints", value),
          onPacketCountChange: (value) => updateDraftField("redPacketPacketCount", value),
        }}
      />

      <HiddenContentModal
        open={activeModal === "reply"}
        title="配置回复后可看"
        description="用户在本帖回复 1 次后即可解锁。详细说明已收进这里，页面主区域只保留一行入口。"
        value={draft.replyUnlockContent}
        onChange={(value) => updateDraftField("replyUnlockContent", value)}
        onClose={() => setActiveModal(null)}
      />

      <PostViewLevelModal
        open={activeModal === "view-level"}
        value={{ minViewLevel: draft.minViewLevel, minViewVipLevel: draft.minViewVipLevel }}
        levelOptions={viewLevelOptions}
        vipLevelOptions={viewVipLevelOptions}
        onChange={({ minViewLevel, minViewVipLevel }) => patchDraft({ minViewLevel, minViewVipLevel })}
        onClose={() => setActiveModal(null)}
      />

      <HiddenContentModal
        open={activeModal === "purchase"}
        title="配置购买后可看"
        description={`用户支付后才可查看这部分内容。适合资料、附件说明、完整版教程等付费内容，价格单位为 ${pointName}。`}
        value={draft.purchaseUnlockContent}
        onChange={(value) => updateDraftField("purchaseUnlockContent", value)}
        onClose={() => setActiveModal(null)}
        price={draft.purchasePrice}
        onPriceChange={(value) => updateDraftField("purchasePrice", value)}
        priceLabel={`购买价格（${pointName}）`}
      />
    </>
  )
}
