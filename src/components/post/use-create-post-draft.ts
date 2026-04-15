"use client"

import { useDeferredValue, useEffect, useMemo, useState } from "react"

import type { LocalPostDraft } from "@/lib/post-draft"
import { DEFAULT_POST_TYPE, type LocalPostType } from "@/lib/post-types"
import { AUTO_EXTRACTED_TAG_POOL_SIZE } from "@/lib/post-tags"
import { ensureJiebaReady, extractAutoTags } from "@/lib/post-taxonomy"
import { multiplyPositiveSafeIntegers, parsePositiveSafeInteger } from "@/lib/shared/safe-integer"
import { getVipNameClass } from "@/lib/vip-status"
import {
  buildInitialPostDraft,
  getAvailablePostTypes,
  resolveAllowedPostTypes,
  type CreatePostFormBoardGroup,
  type CreatePostFormInitialValues,
  type HiddenModalType,
} from "@/components/post/create-post-form.shared"
import { useCreatePostAttachments } from "@/components/post/use-create-post-attachments"
import { useCreatePostDraftPersistence } from "@/components/post/use-create-post-draft-persistence"
import {
  getEffectiveRewardPoolOptions,
  resolveAvailableRewardPoolMode,
} from "@/components/post/use-create-post-draft.shared"
import { useCreatePostLottery } from "@/components/post/use-create-post-lottery"
import { useCreatePostTags } from "@/components/post/use-create-post-tags"

interface UseCreatePostDraftOptions {
  boardOptions: CreatePostFormBoardGroup[]
  pointName: string
  anonymousPostEnabled?: boolean
  anonymousPostPrice?: number
  postRedPacketEnabled?: boolean
  postRedPacketMaxPoints?: number
  postJackpotEnabled?: boolean
  postJackpotMinInitialPoints?: number
  postJackpotReplyIncrementPoints?: number
  currentUser: {
    username: string
    nickname: string | null
    role?: string | null
    level: number
    points: number
    vipLevel?: number
    vipExpiresAt?: string | null
  }
  attachmentFeature: {
    uploadEnabled: boolean
    minUploadLevel: number
    minUploadVipLevel: number
    allowedExtensions: string[]
    maxFileSizeMb: number
  }
  mode?: "create" | "edit"
  postId?: string
  initialValues?: CreatePostFormInitialValues
}

export function useCreatePostDraft({
  boardOptions,
  pointName,
  anonymousPostEnabled = false,
  anonymousPostPrice = 0,
  postRedPacketEnabled = false,
  postRedPacketMaxPoints = 100,
  postJackpotEnabled = false,
  postJackpotMinInitialPoints = 100,
  postJackpotReplyIncrementPoints = 25,
  currentUser,
  attachmentFeature,
  mode = "create",
  postId,
  initialValues,
}: UseCreatePostDraftOptions) {
  const isEditMode = mode === "edit"
  const storageMode = isEditMode ? "edit" : "create"

  const initialDraftData = useMemo(() => {
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
      redPacketMode: resolveAvailableRewardPoolMode(
        draft.redPacketMode,
        effectiveRewardPoolOptions,
      ),
    }
  }, [boardOptions, initialValues, mode, pointName, postJackpotEnabled, postRedPacketEnabled])

  const [draft, setDraft] = useState<LocalPostDraft>(() => initialDraftData)
  const [coverModalOpen, setCoverModalOpen] = useState(false)
  const [rewardPoolModalOpen, setRewardPoolModalOpen] = useState(false)
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false)
  const [showBoardTips, setShowBoardTips] = useState(false)
  const [activeModal, setActiveModal] = useState<HiddenModalType>(null)
  const [jiebaReady, setJiebaReady] = useState(false)
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now())

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
    () =>
      multiplyPositiveSafeIntegers(
        normalizedRedPacketUnitPoints,
        normalizedRedPacketPacketCount,
      ),
    [normalizedRedPacketPacketCount, normalizedRedPacketUnitPoints],
  )
  const effectiveRewardPoolOptions = useMemo(
    () =>
      getEffectiveRewardPoolOptions(draft.isAnonymous, {
        postRedPacketEnabled,
        postJackpotEnabled,
      }),
    [draft.isAnonymous, postJackpotEnabled, postRedPacketEnabled],
  )
  const rewardPoolFeatureEnabled =
    effectiveRewardPoolOptions.postJackpotEnabled
    || effectiveRewardPoolOptions.postRedPacketEnabled
  const showRewardPoolEntry = isEditMode
    ? draft.redPacketEnabled
    : rewardPoolFeatureEnabled
  const allBoards = useMemo(
    () => boardOptions.flatMap((group) => group.items),
    [boardOptions],
  )
  const selectedBoard =
    allBoards.find((item) => item.value === draft.boardSlug) ?? allBoards[0]
  const allowedPostTypes = useMemo(
    () => resolveAllowedPostTypes(selectedBoard),
    [selectedBoard],
  )
  const anonymousAllowedPostTypes = useMemo(
    () => allowedPostTypes.filter((item) => item === "NORMAL" || item === "POLL"),
    [allowedPostTypes],
  )
  const availablePostTypes = useMemo(
    () =>
      getAvailablePostTypes(
        draft.isAnonymous ? anonymousAllowedPostTypes : allowedPostTypes,
        pointName,
      ),
    [allowedPostTypes, anonymousAllowedPostTypes, draft.isAnonymous, pointName],
  )
  const selectedPostTypeOption = useMemo(
    () =>
      availablePostTypes.find((item) => item.value === draft.postType)
      ?? availablePostTypes[0]
      ?? null,
    [availablePostTypes, draft.postType],
  )
  const autoExtractedTagPool = useMemo(
    () => (
      jiebaReady
        ? extractAutoTags(
            deferredTitle,
            deferredContent,
            AUTO_EXTRACTED_TAG_POOL_SIZE,
          )
        : []
    ),
    [deferredContent, deferredTitle, jiebaReady],
  )
  const vipExpiresAtTimestamp = currentUser.vipExpiresAt
    ? new Date(currentUser.vipExpiresAt).getTime()
    : null

  const isVipActive = Boolean(
    vipExpiresAtTimestamp && vipExpiresAtTimestamp > currentTimestamp,
  )
  const currentVipLevel = isVipActive ? (currentUser.vipLevel ?? 0) : 0
  const canBypassAttachmentPermission = currentUser.role === "ADMIN"
  const meetsAttachmentPermission =
    currentUser.level >= attachmentFeature.minUploadLevel
    && currentVipLevel >= attachmentFeature.minUploadVipLevel
  const canAddAttachments = canBypassAttachmentPermission || meetsAttachmentPermission
  const canManageAttachments = isEditMode || canAddAttachments || draft.attachments.length > 0
  const shouldShowAttachmentEntry = canAddAttachments || draft.attachments.length > 0
  const minPostVipLevel = selectedBoard?.minPostVipLevel ?? 0
  const canPostInBoard =
    currentUser.points >= (selectedBoard?.minPostPoints ?? 0)
    && currentUser.level >= (selectedBoard?.minPostLevel ?? 0)
    && currentVipLevel >= minPostVipLevel
  const currentUserSummary = `${currentUser.nickname ?? currentUser.username} · Lv.${currentUser.level} · ${currentUser.points} ${pointName} ${isVipActive ? `· VIP ${currentVipLevel}` : "· 非 VIP"}`
  const currentUserVipClassName = getVipNameClass(isVipActive, currentUser.vipLevel, {
    medium: true,
    interactive: false,
  })

  function patchDraft(patch: Partial<LocalPostDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function updateDraftField<Key extends keyof LocalPostDraft>(
    field: Key,
    value: LocalPostDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTimestamp(Date.now())
    }, 60_000)

    return () => window.clearInterval(timer)
  }, [])

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
    const nextAllowedPostTypes = draft.isAnonymous
      ? anonymousAllowedPostTypes
      : allowedPostTypes
    if (!nextAllowedPostTypes.includes(draft.postType as LocalPostType)) {
      const timer = window.setTimeout(() => {
        updateDraftField("postType", nextAllowedPostTypes[0] ?? DEFAULT_POST_TYPE)
      }, 0)

      return () => window.clearTimeout(timer)
    }
  }, [allowedPostTypes, anonymousAllowedPostTypes, draft.isAnonymous, draft.postType])

  useEffect(() => {
    if (isEditMode || !draft.redPacketEnabled) {
      return
    }

    if (!rewardPoolFeatureEnabled) {
      const timer = window.setTimeout(() => {
        patchDraft({
          redPacketEnabled: false,
          redPacketMode: resolveAvailableRewardPoolMode(
            draft.redPacketMode,
            effectiveRewardPoolOptions,
          ),
          jackpotInitialPoints: String(postJackpotMinInitialPoints),
          redPacketGrantMode: "FIXED",
          redPacketClaimOrderMode: "FIRST_COME_FIRST_SERVED",
          redPacketTriggerType: "REPLY",
          redPacketUnitPoints: "10",
          redPacketTotalPoints: "10",
          redPacketPacketCount: "1",
        })
      }, 0)

      return () => window.clearTimeout(timer)
    }

    const resolvedMode = resolveAvailableRewardPoolMode(
      draft.redPacketMode,
      effectiveRewardPoolOptions,
    )

    if (resolvedMode !== draft.redPacketMode) {
      const timer = window.setTimeout(() => {
        updateDraftField("redPacketMode", resolvedMode)
      }, 0)

      return () => window.clearTimeout(timer)
    }
  }, [
    draft.redPacketEnabled,
    draft.redPacketMode,
    effectiveRewardPoolOptions,
    isEditMode,
    postJackpotMinInitialPoints,
    rewardPoolFeatureEnabled,
  ])

  const persistence = useCreatePostDraftPersistence({
    draft,
    initialDraftData,
    storageMode,
    postId,
    pointName,
    postRedPacketEnabled,
    postJackpotEnabled,
    setDraft,
  })

  const tags = useCreatePostTags({
    draft,
    autoExtractedTagPool,
    updateDraftField,
  })

  const lottery = useCreatePostLottery({
    draft,
    pointName,
    setDraft,
    updateDraftField,
  })

  const attachments = useCreatePostAttachments({
    draft,
    canAddAttachments,
    attachmentFeature,
    setDraft,
    updateDraftField,
  })

  return {
    isEditMode,
    storageMode,
    initialDraftData,
    draft,
    tagInput: tags.tagInput,
    tagModalOpen: tags.tagModalOpen,
    coverModalOpen,
    rewardPoolModalOpen,
    attachmentModalOpen,
    tagEditingIndex: tags.tagEditingIndex,
    tagEditingValue: tags.tagEditingValue,
    pendingDraftToRestore: persistence.pendingDraftToRestore,
    pendingDraftUpdatedAt: persistence.pendingDraftUpdatedAt,
    showBoardTips,
    activeModal,
    draftRestored: persistence.draftRestored,
    lastSavedDraftAt: persistence.lastSavedDraftAt,
    coverUploading: attachments.coverUploading,
    attachmentUploading: attachments.attachmentUploading,
    normalizedPollOptions,
    fixedRedPacketTotalPoints,
    effectiveRewardPoolOptions,
    rewardPoolFeatureEnabled,
    showRewardPoolEntry,
    selectedBoard,
    allowedPostTypes,
    anonymousAllowedPostTypes,
    availablePostTypes,
    selectedPostTypeOption,
    autoExtractedTags: tags.autoExtractedTags,
    isVipActive,
    currentVipLevel,
    canBypassAttachmentPermission,
    meetsAttachmentPermission,
    canAddAttachments,
    canManageAttachments,
    shouldShowAttachmentEntry,
    minPostVipLevel,
    canPostInBoard,
    currentUserSummary,
    currentUserVipClassName,
    anonymousPostEnabled,
    anonymousPostPrice,
    postRedPacketEnabled,
    postRedPacketMaxPoints,
    postJackpotEnabled,
    postJackpotMinInitialPoints,
    postJackpotReplyIncrementPoints,
    currentUser,
    attachmentFeature,
    patchDraft,
    updateDraftField,
    setTagInput: tags.setTagInput,
    setTagModalOpen: tags.setTagModalOpen,
    setCoverModalOpen,
    setRewardPoolModalOpen,
    setAttachmentModalOpen,
    setTagEditingValue: tags.setTagEditingValue,
    setShowBoardTips,
    setActiveModal,
    handleRestorePendingDraft: persistence.handleRestorePendingDraft,
    handleManualDraftSave: persistence.handleManualDraftSave,
    handleClearDraft: persistence.handleClearDraft,
    addManualTag: tags.addManualTag,
    startEditingTag: tags.startEditingTag,
    commitEditingTag: tags.commitEditingTag,
    cancelEditingTag: tags.cancelEditingTag,
    removeManualTag: tags.removeManualTag,
    clearManualTags: tags.clearManualTags,
    handleTagInputConfirm: tags.handleTagInputConfirm,
    applyAutoTagsToManual: tags.applyAutoTagsToManual,
    updatePollOption: lottery.updatePollOption,
    addPollOption: lottery.addPollOption,
    removePollOption: lottery.removePollOption,
    updateLotteryPrize: lottery.updateLotteryPrize,
    addLotteryPrize: lottery.addLotteryPrize,
    removeLotteryPrize: lottery.removeLotteryPrize,
    updateLotteryCondition: lottery.updateLotteryCondition,
    addLotteryCondition: lottery.addLotteryCondition,
    addLotteryConditionGroup: lottery.addLotteryConditionGroup,
    removeLotteryCondition: lottery.removeLotteryCondition,
    removeLotteryConditionGroup: lottery.removeLotteryConditionGroup,
    addExternalAttachment: attachments.addExternalAttachment,
    updateAttachment: attachments.updateAttachment,
    removeAttachment: attachments.removeAttachment,
    handleAttachmentUpload: attachments.handleAttachmentUpload,
    handleCoverUpload: attachments.handleCoverUpload,
    handleCloseTagModal: tags.handleCloseTagModal,
    resolveAvailableRewardPoolMode,
    getEffectiveRewardPoolOptions,
  }
}

export type CreatePostDraftController = ReturnType<typeof useCreatePostDraft>
