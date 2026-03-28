"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  clearPostDraftFromStorage,
  createEmptyLocalPostDraft,
  loadPostDraftFromStorage,
  savePostDraftToStorage,
  type LocalPostDraft,
} from "@/lib/post-draft"

import { multiplyPositiveSafeIntegers, parsePositiveSafeInteger } from "@/lib/shared/safe-integer"



const LOTTERY_NUMERIC_CONDITION_TYPES = new Set(["REPLY_CONTENT_LENGTH", "REGISTER_DAYS", "USER_LEVEL", "VIP_LEVEL", "USER_POINTS"])
const LOTTERY_TEXT_CONDITION_TYPES = new Set(["REPLY_KEYWORD"])

function getLotteryConditionPlaceholder(type: string, pointName: string) {
  switch (type) {
    case "REPLY_CONTENT_LENGTH":
      return "最少回帖字数，如 10"
    case "REPLY_KEYWORD":
      return "指定回帖内容或关键词"
    case "REGISTER_DAYS":
      return "注册天数，如 30"
    case "USER_LEVEL":
      return "最低用户等级，如 3"
    case "VIP_LEVEL":
      return "最低 VIP 等级，如 1"
    case "USER_POINTS":
      return `最低${pointName}，如 100`
    default:
      return "无需填写"
  }
}

function getLotteryConditionDefaultValue(type: string) {
  switch (type) {
    case "REPLY_CONTENT_LENGTH":
      return "10"
    case "REPLY_KEYWORD":
      return "恭喜发财"
    case "REGISTER_DAYS":
      return "7"
    case "USER_LEVEL":
      return "1"
    case "VIP_LEVEL":
      return "1"
    case "USER_POINTS":
      return "100"
    default:
      return "1"
  }
}

function getLotteryConditionDefaultDescription(type: string, pointName: string) {
  switch (type) {
    case "REPLY_CONTENT_LENGTH":
      return "回帖内容至少 10 字"
    case "REPLY_KEYWORD":
      return "回帖需包含指定内容"
    case "LIKE_POST":
      return "需点赞本帖"
    case "FAVORITE_POST":
      return "需收藏本帖"
    case "REGISTER_DAYS":
      return "注册时间达到指定天数"
    case "USER_LEVEL":
      return "用户等级达到要求"
    case "VIP_LEVEL":
      return "VIP 等级达到要求"
    case "USER_POINTS":
      return `${pointName}达到要求`
    default:
      return ""
  }
}

function buildLotteryConditionItem(type: string, pointName: string, groupKey = "default") {
  return {
    type,
    value: LOTTERY_NUMERIC_CONDITION_TYPES.has(type) || LOTTERY_TEXT_CONDITION_TYPES.has(type) ? getLotteryConditionDefaultValue(type) : "1",
    operator: LOTTERY_NUMERIC_CONDITION_TYPES.has(type) ? "GTE" : "EQ",
    description: getLotteryConditionDefaultDescription(type, pointName),
    groupKey,
  }
}

import { ChevronDown, Info, MessageSquareLock } from "lucide-react"



import { BoardSelectField } from "@/components/board-select-field"
import { HiddenContentModal } from "@/components/hidden-content-modal"
import { PostDraftNotice } from "@/components/post-draft-notice"
import { PostViewLevelModal } from "@/components/post-view-level-modal"
import { RefinedRichPostEditor } from "@/components/refined-rich-post-editor"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"


import { DEFAULT_ALLOWED_POST_TYPES, DEFAULT_POST_TYPE, type LocalPostType } from "@/lib/post-types"




interface CreatePostFormBoardItem {
  value: string
  label: string
  allowedPostTypes?: string[]
  requirePostReview?: boolean
  minPostPoints?: number
  minPostLevel?: number
  minPostVipLevel?: number
}

interface CreatePostFormBoardGroup {
  zone: string
  items: CreatePostFormBoardItem[]
}




interface CreatePostFormProps {
  boardOptions: CreatePostFormBoardGroup[]
  pointName: string
  postRedPacketEnabled?: boolean
  markdownEmojiMap?: MarkdownEmojiItem[]
  currentUser: {


    username: string
    nickname: string | null
    level: number
    points: number
    vipLevel?: number
    vipExpiresAt?: string | null
  }
  mode?: "create" | "edit"
  postId?: string
  successSlug?: string
  initialValues?: {
    title: string
    content: string
    boardSlug: string
    postType: LocalPostType
    bountyPoints?: number | null
    pollOptions?: string[]
    pollExpiresAt?: string | null
    commentsVisibleToAuthorOnly?: boolean
    replyUnlockContent?: string
    replyThreshold?: number | null
    purchaseUnlockContent?: string
    purchasePrice?: number | null
    minViewLevel?: number | null
    lotteryConfig?: {
      startsAt?: string | null
      endsAt?: string | null
      participantGoal?: number | null
      prizes?: Array<{ title: string; quantity: number; description: string }>
      conditions?: Array<{ type: string; value: string; operator?: string; description?: string; groupKey?: string }>
    }
    redPacketConfig?: {
      enabled?: boolean
      grantMode?: "FIXED" | "RANDOM"
      triggerType?: "REPLY" | "LIKE" | "FAVORITE"
      totalPoints?: number | null
      unitPoints?: number | null
      packetCount?: number | null
    }

  }
}




type HiddenModalType = "reply" | "purchase" | "view-level" | null


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

function HiddenConfigChip({
  icon,
  title,
  active,
  summary,
  onClick,
  onClear,
}: {
  icon: React.ReactNode
  title: string
  active: boolean
  summary: string
  onClick: () => void
  onClear?: () => void
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
      <button type="button" onClick={onClick} className="inline-flex items-center gap-2 text-sm transition-opacity hover:opacity-80">
        <span className="text-foreground/80">{icon}</span>
        <span>{title}</span>
        <span className={active ? "rounded-full bg-foreground px-2 py-0.5 text-[11px] text-background" : "rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"}>
          {summary}
        </span>
      </button>
      {active && onClear ? <Button type="button" variant="ghost" className="h-7 rounded-full px-2 text-xs" onClick={onClear}>清空</Button> : null}
    </div>
  )
}

export function CreatePostForm({ boardOptions, pointName, postRedPacketEnabled = false, markdownEmojiMap, currentUser, mode = "create", postId, successSlug, initialValues }: CreatePostFormProps) {


  const router = useRouter()
  const [title, setTitle] = useState(initialValues?.title ?? "")
  const [content, setContent] = useState(initialValues?.content ?? "")
  const [commentsVisibleToAuthorOnly, setCommentsVisibleToAuthorOnly] = useState(Boolean(initialValues?.commentsVisibleToAuthorOnly))
  const [replyUnlockContent, setReplyUnlockContent] = useState(initialValues?.replyUnlockContent ?? "")
  const [purchaseUnlockContent, setPurchaseUnlockContent] = useState(initialValues?.purchaseUnlockContent ?? "")
  const [purchasePrice, setPurchasePrice] = useState(String(initialValues?.purchasePrice ?? 20))
  const [minViewLevel, setMinViewLevel] = useState(String(initialValues?.minViewLevel ?? 0))
  const [boardSlug, setBoardSlug] = useState(initialValues?.boardSlug ?? boardOptions[0]?.items[0]?.value ?? "")
  const [redPacketEnabled, setRedPacketEnabled] = useState(Boolean(initialValues?.redPacketConfig?.enabled))
  const [redPacketGrantMode, setRedPacketGrantMode] = useState(initialValues?.redPacketConfig?.grantMode ?? "FIXED")
  const [redPacketTriggerType, setRedPacketTriggerType] = useState(initialValues?.redPacketConfig?.triggerType ?? "REPLY")
  const [redPacketUnitPoints, setRedPacketUnitPoints] = useState(String(initialValues?.redPacketConfig?.unitPoints ?? initialValues?.redPacketConfig?.totalPoints ?? 10))
  const [redPacketTotalPoints, setRedPacketTotalPoints] = useState(String(initialValues?.redPacketConfig?.totalPoints ?? 10))
  const [redPacketPacketCount, setRedPacketPacketCount] = useState(String(initialValues?.redPacketConfig?.packetCount ?? 1))



  const [postType, setPostType] = useState<LocalPostType>(initialValues?.postType ?? DEFAULT_POST_TYPE)

  const [bountyPoints, setBountyPoints] = useState(String(initialValues?.bountyPoints ?? 100))
  const [pollOptions, setPollOptions] = useState(initialValues?.pollOptions && initialValues.pollOptions.length > 0 ? initialValues.pollOptions : ["", ""])
  const [pollExpiresAt, setPollExpiresAt] = useState(initialValues?.pollExpiresAt ?? "")
  const [lotteryStartsAt, setLotteryStartsAt] = useState(initialValues?.lotteryConfig?.startsAt ?? "")
  const [lotteryEndsAt, setLotteryEndsAt] = useState(initialValues?.lotteryConfig?.endsAt ?? "")
  const [lotteryParticipantGoal, setLotteryParticipantGoal] = useState(String(initialValues?.lotteryConfig?.participantGoal ?? ""))
  const [lotteryPrizes, setLotteryPrizes] = useState(initialValues?.lotteryConfig?.prizes && initialValues.lotteryConfig.prizes.length > 0 ? initialValues.lotteryConfig.prizes.map((item) => ({ title: item.title, quantity: String(item.quantity), description: item.description })) : [{ title: "一等奖", quantity: "1", description: "填写奖品描述" }])
  const [lotteryConditions, setLotteryConditions] = useState(initialValues?.lotteryConfig?.conditions && initialValues.lotteryConfig.conditions.length > 0 ? initialValues.lotteryConfig.conditions.map((item) => ({ type: item.type, value: item.value, operator: item.operator ?? "GTE", description: item.description ?? "", groupKey: item.groupKey ?? "default" })) : [buildLotteryConditionItem("REPLY_CONTENT_LENGTH", pointName)])

  const [message, setMessage] = useState("")
  const [pendingDraftToRestore, setPendingDraftToRestore] = useState<LocalPostDraft | null>(null)
  const [pendingDraftUpdatedAt, setPendingDraftUpdatedAt] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [showBoardTips, setShowBoardTips] = useState(false)
  const [activeModal, setActiveModal] = useState<HiddenModalType>(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const [lastSavedDraftAt, setLastSavedDraftAt] = useState<string | null>(null)
  const hasPromptedDraftRef = useRef(false)

  const normalizedPollOptions = useMemo(() => pollOptions.map((item) => item.trim()).filter(Boolean), [pollOptions])

  const normalizedRedPacketUnitPoints = useMemo(() => parsePositiveSafeInteger(redPacketUnitPoints), [redPacketUnitPoints])
  const normalizedRedPacketPacketCount = useMemo(() => parsePositiveSafeInteger(redPacketPacketCount), [redPacketPacketCount])

  const fixedRedPacketTotalPoints = useMemo(
    () => multiplyPositiveSafeIntegers(normalizedRedPacketUnitPoints, normalizedRedPacketPacketCount),
    [normalizedRedPacketPacketCount, normalizedRedPacketUnitPoints],
  )
  const allBoards = useMemo(() => boardOptions.flatMap((group) => group.items), [boardOptions])

  const selectedBoard = allBoards.find((item) => item.value === boardSlug) ?? allBoards[0]
  const allowedPostTypes = useMemo<LocalPostType[]>(() => (selectedBoard?.allowedPostTypes ?? DEFAULT_ALLOWED_POST_TYPES) as LocalPostType[], [selectedBoard])
  const storageMode = mode === "edit" ? "edit" : "create"
  const initialDraftData = useMemo<LocalPostDraft>(() => {
    if (initialValues) {
      return {
        title: initialValues.title,
        content: initialValues.content,
        boardSlug: initialValues.boardSlug,
        postType: initialValues.postType,
        bountyPoints: String(initialValues.bountyPoints ?? 100),
        pollOptions: initialValues.pollOptions && initialValues.pollOptions.length > 0 ? initialValues.pollOptions : ["", ""],
        pollExpiresAt: initialValues.pollExpiresAt ?? "",
        commentsVisibleToAuthorOnly: Boolean(initialValues.commentsVisibleToAuthorOnly),
        replyUnlockContent: initialValues.replyUnlockContent ?? "",
        purchaseUnlockContent: initialValues.purchaseUnlockContent ?? "",
        purchasePrice: String(initialValues.purchasePrice ?? 20),
        minViewLevel: String(initialValues.minViewLevel ?? 0),
        lotteryStartsAt: initialValues.lotteryConfig?.startsAt ?? "",
        lotteryEndsAt: initialValues.lotteryConfig?.endsAt ?? "",
        lotteryParticipantGoal: String(initialValues.lotteryConfig?.participantGoal ?? ""),
        lotteryPrizes: initialValues.lotteryConfig?.prizes && initialValues.lotteryConfig.prizes.length > 0
          ? initialValues.lotteryConfig.prizes.map((item) => ({ title: item.title, quantity: String(item.quantity), description: item.description }))
          : [{ title: "一等奖", quantity: "1", description: "填写奖品描述" }],
        lotteryConditions: initialValues.lotteryConfig?.conditions && initialValues.lotteryConfig.conditions.length > 0
          ? initialValues.lotteryConfig.conditions.map((item) => ({ type: item.type, value: item.value, operator: item.operator ?? "GTE", description: item.description ?? "", groupKey: item.groupKey ?? "default" }))
          : [buildLotteryConditionItem("REPLY_CONTENT_LENGTH", pointName)],
        redPacketEnabled: Boolean(initialValues.redPacketConfig?.enabled),
        redPacketGrantMode: initialValues.redPacketConfig?.grantMode ?? "FIXED",
        redPacketTriggerType: initialValues.redPacketConfig?.triggerType ?? "REPLY",
        redPacketUnitPoints: String(initialValues.redPacketConfig?.unitPoints ?? initialValues.redPacketConfig?.totalPoints ?? 10),
        redPacketTotalPoints: String(initialValues.redPacketConfig?.totalPoints ?? 10),
        redPacketPacketCount: String(initialValues.redPacketConfig?.packetCount ?? 1),
      }
    }

    return createEmptyLocalPostDraft(boardOptions[0]?.items[0]?.value ?? "")
  }, [boardOptions, initialValues, pointName])

  const draftData = useMemo<LocalPostDraft>(() => ({

    title,
    content,
    boardSlug,
    postType,
    bountyPoints,
    pollOptions,
    pollExpiresAt,
    commentsVisibleToAuthorOnly,
    replyUnlockContent,
    purchaseUnlockContent,
    purchasePrice,
    minViewLevel,
    lotteryStartsAt,
    lotteryEndsAt,
    lotteryParticipantGoal,
    lotteryPrizes,
    lotteryConditions,
    redPacketEnabled,
    redPacketGrantMode,
    redPacketTriggerType,
    redPacketUnitPoints,
    redPacketTotalPoints,
    redPacketPacketCount,
  }), [
    boardSlug,
    bountyPoints,
    commentsVisibleToAuthorOnly,
    content,
    lotteryConditions,
    lotteryEndsAt,
    lotteryParticipantGoal,
    lotteryPrizes,
    lotteryStartsAt,
    minViewLevel,
    pollExpiresAt,
    pollOptions,
    postType,
    purchasePrice,
    purchaseUnlockContent,
    redPacketEnabled,
    redPacketGrantMode,
    redPacketPacketCount,
    redPacketTotalPoints,
    redPacketTriggerType,
    redPacketUnitPoints,
    replyUnlockContent,
    title,
  ])


  const isVipActive = Boolean(currentUser.vipExpiresAt && new Date(currentUser.vipExpiresAt).getTime() > Date.now())
  const currentVipLevel = isVipActive ? (currentUser.vipLevel ?? 0) : 0
  const minPostVipLevel = selectedBoard?.minPostVipLevel ?? 0
  const canPostInBoard = currentUser.points >= (selectedBoard?.minPostPoints ?? 0)
    && currentUser.level >= (selectedBoard?.minPostLevel ?? 0)
    && currentVipLevel >= minPostVipLevel


  useEffect(() => {
    if (!allowedPostTypes.includes(postType)) {
      setPostType(allowedPostTypes[0] ?? DEFAULT_POST_TYPE)
    }
  }, [allowedPostTypes, postType])

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
  }, [mode, pointName, postId, storageMode])

  useEffect(() => {
    if (typeof window === "undefined" || !hasPromptedDraftRef.current) {
      return
    }

    const timer = window.setTimeout(() => {
      const payload = savePostDraftToStorage(storageMode, draftData, initialDraftData, postId)
      if (payload) {
        setLastSavedDraftAt(payload.updatedAt)
      } else {
        setLastSavedDraftAt(null)
      }
    }, 800)


    return () => window.clearTimeout(timer)
  }, [draftData, initialDraftData, postId, storageMode])


  function restoreDraft(draft: LocalPostDraft) {
    setTitle(draft.title)
    setContent(draft.content)
    setBoardSlug(draft.boardSlug)
    setPostType(draft.postType as LocalPostType)
    setBountyPoints(draft.bountyPoints)
    setPollOptions(draft.pollOptions.length > 0 ? draft.pollOptions : ["", ""])
    setPollExpiresAt(draft.pollExpiresAt)
    setCommentsVisibleToAuthorOnly(draft.commentsVisibleToAuthorOnly)
    setReplyUnlockContent(draft.replyUnlockContent)
    setPurchaseUnlockContent(draft.purchaseUnlockContent)
    setPurchasePrice(draft.purchasePrice)
    setMinViewLevel(draft.minViewLevel)
    setLotteryStartsAt(draft.lotteryStartsAt)
    setLotteryEndsAt(draft.lotteryEndsAt)
    setLotteryParticipantGoal(draft.lotteryParticipantGoal)
    setLotteryPrizes(draft.lotteryPrizes.length > 0 ? draft.lotteryPrizes : [{ title: "一等奖", quantity: "1", description: "填写奖品描述" }])
    setLotteryConditions(draft.lotteryConditions.length > 0 ? draft.lotteryConditions : [buildLotteryConditionItem("REPLY_CONTENT_LENGTH", pointName)])
    setRedPacketEnabled(draft.redPacketEnabled)
    setRedPacketGrantMode(draft.redPacketGrantMode)
    setRedPacketTriggerType(draft.redPacketTriggerType)
    setRedPacketUnitPoints(draft.redPacketUnitPoints)
    setRedPacketTotalPoints(draft.redPacketTotalPoints)
    setRedPacketPacketCount(draft.redPacketPacketCount)
    setDraftRestored(true)
    setPendingDraftToRestore(null)
    setPendingDraftUpdatedAt(null)
    setMessage("已恢复本地草稿，可继续编辑。")
    toast.info("已恢复你上次未提交的本地草稿", "草稿已恢复")
  }

  function handleRestorePendingDraft() {
    if (!pendingDraftToRestore) {
      return
    }

    restoreDraft(pendingDraftToRestore)
  }

  function handleDismissPendingDraft() {
    setPendingDraftToRestore(null)
    setPendingDraftUpdatedAt(null)
  }

  function handleManualDraftSave() {
    const payload = savePostDraftToStorage(storageMode, draftData, initialDraftData, postId)

    if (!payload) {
      setLastSavedDraftAt(null)
      setDraftRestored(false)
      setPendingDraftUpdatedAt(null)
      setMessage("当前内容为空，未保存本地草稿。")
      toast.info("请先输入标题、正文或其他有效配置后再保存草稿", "未保存草稿")
      return
    }

    setLastSavedDraftAt(payload.updatedAt)
    setDraftRestored(false)
    setPendingDraftUpdatedAt(null)
    setMessage("草稿已保存到本地。")
    toast.success("当前内容已保存到本地，下次进入可恢复", "草稿已保存")
  }

  function handleClearDraft() {
    clearPostDraftFromStorage(storageMode, postId)
    setLastSavedDraftAt(null)
    setDraftRestored(false)
    setPendingDraftToRestore(null)
    setPendingDraftUpdatedAt(null)
    setMessage("本地草稿已清除。")
    toast.info("当前页面对应的本地草稿已删除", "草稿已清除")
  }

  function updatePollOption(index: number, value: string) {

    setPollOptions((current) => current.map((item, currentIndex) => (currentIndex === index ? value : item)))
  }

  function addPollOption() {
    setPollOptions((current) => (current.length >= 8 ? current : [...current, ""]))
  }

  function removePollOption(index: number) {
    setPollOptions((current) => (current.length <= 2 ? current : current.filter((_, currentIndex) => currentIndex !== index)))
  }

  function updateLotteryPrize(index: number, field: "title" | "quantity" | "description", value: string) {
    setLotteryPrizes((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, [field]: value } : item)))
  }

  function addLotteryPrize() {
    setLotteryPrizes((current) => (current.length >= 20 ? current : [...current, { title: "", quantity: "1", description: "" }]))
  }

  function removeLotteryPrize(index: number) {
    setLotteryPrizes((current) => (current.length <= 1 ? current : current.filter((_, currentIndex) => currentIndex !== index)))
  }

  function updateLotteryCondition(index: number, field: "type" | "value" | "operator" | "description" | "groupKey", value: string) {
    setLotteryConditions((current) => current.map((item, currentIndex) => {
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
    }))
  }


  function addLotteryCondition(type = "LIKE_POST", groupKey = "default") {
    setLotteryConditions((current) => (current.length >= 20 ? current : [...current, buildLotteryConditionItem(type, pointName, groupKey)]))
  }



  function removeLotteryCondition(index: number) {
    setLotteryConditions((current) => (current.length <= 1 ? current : current.filter((_, currentIndex) => currentIndex !== index)))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {

    event.preventDefault()
    setLoading(true)
    setMessage("")

    const endpoint = mode === "edit" ? "/api/posts/update" : "/api/posts/create"
    const normalizedLotteryPrizes = lotteryPrizes.map((item) => ({ title: item.title.trim(), quantity: Number(item.quantity), description: item.description.trim() })).filter((item) => item.title || item.description || item.quantity > 0)
    const normalizedLotteryConditions = lotteryConditions.map((item) => ({ type: item.type, value: item.value.trim(), operator: item.operator, description: item.description.trim(), groupKey: item.groupKey.trim() || "default" })).filter((item) => item.type && item.value)
    const lotteryConfig = postType === "LOTTERY"
      ? {
          startsAt: lotteryStartsAt || undefined,
          endsAt: lotteryEndsAt || undefined,
          participantGoal: lotteryParticipantGoal.trim() ? Number(lotteryParticipantGoal) : undefined,
          prizes: normalizedLotteryPrizes,
          conditions: normalizedLotteryConditions,
        }
      : undefined
    const redPacketConfig = redPacketEnabled
      ? {
          enabled: true,
          grantMode: redPacketGrantMode,
          triggerType: redPacketTriggerType,
          totalPoints: redPacketGrantMode === "RANDOM" ? parsePositiveSafeInteger(redPacketTotalPoints) ?? 0 : fixedRedPacketTotalPoints ?? 0,
          unitPoints: normalizedRedPacketUnitPoints ?? 0,
          packetCount: normalizedRedPacketPacketCount ?? 0,
        }
      : undefined


    const payload = mode === "edit"


      ? {
          postId,
          title,
          content,
          commentsVisibleToAuthorOnly,
          replyUnlockContent,
          replyThreshold: replyUnlockContent.trim() ? 1 : undefined,
          purchaseUnlockContent,
          purchasePrice: purchaseUnlockContent.trim() ? Number(purchasePrice) : undefined,
          minViewLevel: Number(minViewLevel),
          boardSlug,
          postType,
          bountyPoints: postType === "BOUNTY" ? Number(bountyPoints) : undefined,
          pollOptions: postType === "POLL" ? normalizedPollOptions : undefined,
          lotteryConfig,
        }

      : {
          title,
          content,
          commentsVisibleToAuthorOnly,
          replyUnlockContent,
          replyThreshold: replyUnlockContent.trim() ? 1 : undefined,
          purchaseUnlockContent,
          purchasePrice: purchaseUnlockContent.trim() ? Number(purchasePrice) : undefined,
          minViewLevel: Number(minViewLevel),
          boardSlug,
          postType,
          bountyPoints: postType === "BOUNTY" ? Number(bountyPoints) : undefined,
          pollOptions: postType === "POLL" ? normalizedPollOptions : undefined,
          pollExpiresAt,
          lotteryConfig,
          redPacketConfig,
        }




    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()

    if (!response.ok) {
      const errorMessage = result.message ?? (mode === "edit" ? "保存失败" : "发帖失败")
      setMessage(errorMessage)
      toast.error(errorMessage, mode === "edit" ? "保存失败" : "发帖失败")
      setLoading(false)
      return
    }

    const successMessage = result.message ?? (mode === "edit" ? "保存成功，正在返回详情页…" : "发布成功，正在跳转详情页…")
    setMessage(successMessage)
    toast.success(successMessage, mode === "edit" ? "保存成功" : "发布成功")

    router.push(`/posts/${result.data?.slug ?? successSlug ?? postId}`)
    router.refresh()
    setLoading(false)
  }

  const postTypes = [
    { value: "NORMAL", label: "普通帖", hint: "直接讨论" },
    { value: "BOUNTY", label: "悬赏帖", hint: `设置${pointName}悬赏` },
    { value: "POLL", label: "投票帖", hint: "发起投票" },
    { value: "LOTTERY", label: "抽奖帖", hint: "配置奖项与参与条件" },
  ] as const satisfies Array<{ value: LocalPostType; label: string; hint: string }>

  const availablePostTypes = postTypes.filter((item) => allowedPostTypes.includes(item.value))


  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-2">
            <p className="text-sm font-medium">选择节点</p>
            <BoardSelectField value={boardSlug} onChange={setBoardSlug} boardOptions={boardOptions} disabled={mode === "edit"} />
            <p className="text-xs leading-6 text-muted-foreground">
              {mode === "edit" ? "编辑模式下暂不允许切换节点，避免跨节点权限和审核状态不一致。" : "你只能选择具体节点发帖，不能直接发到分区；现在支持搜索分区、节点名和 slug，节点变多后也能快速找到。"}
            </p>
          </div>


          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">帖子类型</p>
              <p className="text-xs text-muted-foreground">选择后再填写对应内容</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {availablePostTypes.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setPostType(item.value as LocalPostType)}
                  className={postType === item.value ? "inline-flex items-center gap-2 rounded-full border border-foreground bg-accent px-4 py-2 text-sm font-medium" : "inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground hover:bg-accent/50"}
                  disabled={mode === "edit"}
                >
                  <span>{item.label}</span>
                  <span className="text-xs opacity-80">{item.hint}</span>
                </button>
              ))}
            </div>
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

        {postType === "BOUNTY" ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">悬赏{pointName}</p>
            <input value={bountyPoints} onChange={(event) => setBountyPoints(event.target.value)} className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none" placeholder={`输入要奖励给最佳答案的${pointName}`} disabled={mode === "edit"} />
            <p className="text-xs leading-6 text-muted-foreground">发帖时会先冻结这部分{pointName}，等你采纳回复后再发放给答案作者。</p>
          </div>
        ) : null}

        {postType === "POLL" ? (
          <div className="space-y-3 rounded-[24px] border border-border bg-card p-5">
            <div>
              <p className="text-sm font-medium">投票选项</p>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">至少填写 2 个选项，最多 8 个，审核通过后前台用户可参与投票。</p>
            </div>
            <div className="space-y-3">
              {pollOptions.map((option, index) => (
                <div key={`${index}-${option}`} className="flex items-center gap-3">
                  <input
                    value={option}
                    onChange={(event) => updatePollOption(index, event.target.value)}
                    className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none"
                    placeholder={`选项 ${index + 1}`}
                    disabled={mode === "edit"}
                  />
                  <Button type="button" variant="ghost" onClick={() => removePollOption(index)} disabled={pollOptions.length <= 2 || mode === "edit"}>
                    删除
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">当前有效选项：{normalizedPollOptions.length} 项</p>
              <Button type="button" variant="outline" onClick={addPollOption} disabled={pollOptions.length >= 8 || mode === "edit"}>
                增加选项
              </Button>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">投票结束时间</p>
              <input
                type="datetime-local"
                value={pollExpiresAt}
                onChange={(event) => setPollExpiresAt(event.target.value)}
                className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none"
                disabled={mode === "edit"}
              />
              <p className="text-xs leading-6 text-muted-foreground">留空表示长期开放投票；设置后到达截止时间将不再允许新增投票。</p>
            </div>
          </div>
        ) : null}

        {postType === "LOTTERY" ? (
          <div className="space-y-4 rounded-[24px] border border-border bg-card p-5">
            <div>
              <p className="text-sm font-medium">抽奖设置</p>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">支持多个奖项、多个参与方案（方案内全部满足即可，满足任一方案即可参与）、手动开奖与人数达标自动开奖。</p>

            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">开始时间</p>
                <input type="datetime-local" value={lotteryStartsAt} onChange={(event) => setLotteryStartsAt(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" disabled={mode === "edit"} />
                <p className="text-xs text-muted-foreground">留空则默认审核通过后立即开始。</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">结束时间 / 自动开奖人数</p>
                <input type="datetime-local" value={lotteryEndsAt} onChange={(event) => setLotteryEndsAt(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" disabled={mode === "edit" || Boolean(lotteryParticipantGoal.trim())} />
                <input value={lotteryParticipantGoal} onChange={(event) => setLotteryParticipantGoal(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" placeholder="达到多少参与人数自动开奖" disabled={mode === "edit" || Boolean(lotteryEndsAt)} />
                <p className="text-xs text-muted-foreground">二选一：填结束时间则手动开奖；填人数则人数达标后自动开奖。</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">奖项设置</p>
                <Button type="button" variant="outline" onClick={addLotteryPrize} disabled={mode === "edit" || lotteryPrizes.length >= 20}>增加奖项</Button>
              </div>
              {lotteryPrizes.map((prize, index) => (
                <div key={`prize-${index}`} className="space-y-3 rounded-[20px] border border-border bg-background p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_140px_auto]">
                    <input value={prize.title} onChange={(event) => updateLotteryPrize(index, "title", event.target.value)} className="h-11 rounded-full border border-border bg-card px-4 text-sm outline-none" placeholder="如：一等奖" disabled={mode === "edit"} />
                    <input value={prize.quantity} onChange={(event) => updateLotteryPrize(index, "quantity", event.target.value)} className="h-11 rounded-full border border-border bg-card px-4 text-sm outline-none" placeholder="数量" disabled={mode === "edit"} />
                    <Button type="button" variant="ghost" onClick={() => removeLotteryPrize(index)} disabled={mode === "edit" || lotteryPrizes.length <= 1}>删除</Button>
                  </div>
                  <textarea value={prize.description} onChange={(event) => updateLotteryPrize(index, "description", event.target.value)} className="min-h-[88px] w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none" placeholder="填写奖品描述、领奖说明等" disabled={mode === "edit"} />
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">参与条件</p>
                  <p className="mt-1 text-xs text-muted-foreground">将条件拆成行为条件与门槛条件；同一参与方案内全部满足即可，命中任一参与方案即可参与。</p>

                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => addLotteryCondition("LIKE_POST")} disabled={mode === "edit" || lotteryConditions.length >= 20}>增加行为条件</Button>
                  <Button type="button" variant="outline" onClick={() => addLotteryCondition("REGISTER_DAYS")} disabled={mode === "edit" || lotteryConditions.length >= 20}>增加门槛条件</Button>
                </div>
              </div>

              <div className="space-y-3 rounded-[20px] border border-border bg-background/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">行为条件</p>
                    <p className="mt-1 text-xs text-muted-foreground">要求用户先完成互动行为，比如回复、点赞、收藏。</p>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">回复 / 点赞 / 收藏</span>
                </div>
                <div className="space-y-3">
                  {lotteryConditions.map((condition, index) => {
                    if (!["REPLY_CONTENT_LENGTH", "REPLY_KEYWORD", "LIKE_POST", "FAVORITE_POST"].includes(condition.type)) {
                      return null
                    }

                    const requiresNumericValue = LOTTERY_NUMERIC_CONDITION_TYPES.has(condition.type)
                    const requiresTextValue = LOTTERY_TEXT_CONDITION_TYPES.has(condition.type)
                    const requiresValue = requiresNumericValue || requiresTextValue
                    const requiresOperator = requiresNumericValue

                    return (
                      <div key={`behavior-condition-${index}`} className="space-y-3 rounded-[20px] border border-border bg-card p-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <input value={condition.groupKey} onChange={(event) => updateLotteryCondition(index, "groupKey", event.target.value)} className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none" placeholder="参与方案，如 方案A / VIP直通" disabled={mode === "edit"} />
                          <select value={condition.type} onChange={(event) => updateLotteryCondition(index, "type", event.target.value)} className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none" disabled={mode === "edit"}>
                            <option value="REPLY_CONTENT_LENGTH">回帖字数 ≥ X</option>
                            <option value="REPLY_KEYWORD">回帖包含指定内容</option>
                            <option value="LIKE_POST">点赞本帖</option>
                            <option value="FAVORITE_POST">收藏本帖</option>
                          </select>
                        </div>
                        <div className={`grid gap-3 ${requiresValue ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
                          {requiresValue ? (
                            <input
                              value={condition.value}
                              onChange={(event) => updateLotteryCondition(index, "value", event.target.value)}
                              className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none"
                              placeholder={getLotteryConditionPlaceholder(condition.type, pointName)}
                              disabled={mode === "edit"}
                            />
                          ) : null}
                          {requiresOperator ? (
                            <select value={condition.operator} onChange={(event) => updateLotteryCondition(index, "operator", event.target.value)} className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none" disabled={mode === "edit"}>
                              <option value="GTE">大于等于</option>
                              <option value="EQ">等于</option>
                            </select>
                          ) : null}
                        </div>
                        <div className={`grid gap-3 ${requiresOperator ? "md:grid-cols-[1fr_auto]" : "md:grid-cols-[1fr_auto]"}`}>

                          <input value={condition.description} onChange={(event) => updateLotteryCondition(index, "description", event.target.value)} className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none" placeholder="前端展示文案，可留空自动生成" disabled={mode === "edit"} />

                          <Button type="button" variant="ghost" onClick={() => removeLotteryCondition(index)} disabled={mode === "edit" || lotteryConditions.length <= 1}>删除</Button>
                        </div>
                        {!requiresValue ? <p className="text-xs text-muted-foreground">该条件为动作型条件，用户完成对应行为后会自动判断，无需额外填写阈值。</p> : null}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-3 rounded-[20px] border border-border bg-background/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">门槛条件</p>
                    <p className="mt-1 text-xs text-muted-foreground">限制账号资质，适合防小号、防低质参与。</p>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">注册 / 等级 / VIP / 积分</span>
                </div>
                <div className="space-y-3">
                  {lotteryConditions.map((condition, index) => {
                    if (!["REGISTER_DAYS", "USER_LEVEL", "VIP_LEVEL", "USER_POINTS"].includes(condition.type)) {
                      return null
                    }

                    return (
                      <div key={`threshold-condition-${index}`} className="space-y-3 rounded-[20px] border border-border bg-card p-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <select value={condition.type} onChange={(event) => updateLotteryCondition(index, "type", event.target.value)} className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none" disabled={mode === "edit"}>
                            <option value="REGISTER_DAYS">注册天数 ≥ X</option>
                            <option value="USER_LEVEL">用户等级 ≥ X</option>
                            <option value="VIP_LEVEL">VIP 等级 ≥ X</option>
                            <option value="USER_POINTS">积分数量 ≥ X</option>
                          </select>
                          <input
                            value={condition.value}
                            onChange={(event) => updateLotteryCondition(index, "value", event.target.value)}
                            className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none"
                            placeholder={getLotteryConditionPlaceholder(condition.type, pointName)}
                            disabled={mode === "edit"}
                          />
                        </div>
                        <div className="grid gap-3 md:grid-cols-[180px_180px_1fr_auto]">
                          <select value={condition.operator} onChange={(event) => updateLotteryCondition(index, "operator", event.target.value)} className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none" disabled={mode === "edit"}>
                            <option value="GTE">大于等于</option>
                            <option value="EQ">等于</option>
                          </select>
                          <input value={condition.groupKey} onChange={(event) => updateLotteryCondition(index, "groupKey", event.target.value)} className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none" placeholder="参与方案，如 方案A / 老用户" disabled={mode === "edit"} />

                          <input value={condition.description} onChange={(event) => updateLotteryCondition(index, "description", event.target.value)} className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none" placeholder="前端展示文案，可留空自动生成" disabled={mode === "edit"} />
                          <Button type="button" variant="ghost" onClick={() => removeLotteryCondition(index)} disabled={mode === "edit" || lotteryConditions.length <= 1}>删除</Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">标题</p>
          </div>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none" placeholder="写一个让人愿意点进来的标题" />
        </div>



        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">公开正文</p>
            <p className="text-xs text-muted-foreground">请遵守社区规则，文明发帖！</p>
          </div>
          <RefinedRichPostEditor value={content} onChange={setContent} placeholder="文明社区，文明发言。支持 Markdown 语法。" markdownEmojiMap={markdownEmojiMap} />

        </div>

        <div className="rounded-[24px] border border-border bg-card px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className={commentsVisibleToAuthorOnly ? "inline-flex items-center gap-2 rounded-full border border-foreground bg-accent px-3 py-2 text-sm" : "inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm text-muted-foreground"}>
              <input
                type="checkbox"
                checked={commentsVisibleToAuthorOnly}
                onChange={(event) => setCommentsVisibleToAuthorOnly(event.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <span>评论仅楼主可见</span>
              <HoverTip text="开启后，其他用户发表的评论仅帖子作者和管理员可见。" />
            </label>

            <HiddenConfigChip
              icon={<MessageSquareLock className="h-4 w-4" />}
              title="回复后可看"
              active={Boolean(replyUnlockContent.trim())}
              summary={replyUnlockContent.trim() ? "已配置" : "未配置"}
              onClick={() => setActiveModal("reply")}
              onClear={() => setReplyUnlockContent("")}
            />
            <HiddenConfigChip
              icon={<Info className="h-4 w-4" />}
              title="购买后可看"
              active={Boolean(purchaseUnlockContent.trim())}
              summary={purchaseUnlockContent.trim() ? `￥${purchasePrice || 0} / ${pointName}` : "未配置"}
              onClick={() => setActiveModal("purchase")}
              onClear={() => {
                setPurchaseUnlockContent("")
                setPurchasePrice("20")
              }}
            />
            <HiddenConfigChip
              icon={<Info className="h-4 w-4" />}
              title="浏览等级"
              active={Number(minViewLevel) > 0}
              summary={Number(minViewLevel) > 0 ? `Lv.${Number(minViewLevel)}` : "公开可见"}
              onClick={() => setActiveModal("view-level")}
              onClear={() => setMinViewLevel("0")}
            />
            {postRedPacketEnabled ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={redPacketEnabled}
                    onChange={(event) => setRedPacketEnabled(event.target.checked)}
                    className="h-4 w-4 rounded border-border"
                    disabled={mode === "edit"}
                  />
                  <span>帖子红包</span>
                </label>
                <span className={redPacketEnabled ? "rounded-full bg-rose-500 px-2 py-0.5 text-[11px] text-white" : "rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"}>
                  {redPacketEnabled ? "已开启" : "未开启"}
                </span>
              </div>
            ) : null}

          </div>
          {redPacketEnabled ? (
            <div className="mt-4 grid gap-3 rounded-[20px] border border-rose-200 bg-rose-50/80 p-4 md:grid-cols-2 xl:grid-cols-4 dark:border-rose-500/20 dark:bg-rose-500/10">
              <div className="space-y-2">
                <p className="text-sm font-medium">发放方式</p>
                <select value={redPacketGrantMode} onChange={(event) => setRedPacketGrantMode(event.target.value as "FIXED" | "RANDOM")} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" disabled={mode === "edit"}>

                  <option value="FIXED">固定红包</option>
                  <option value="RANDOM">拼手气红包</option>
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">领取条件</p>
                <select value={redPacketTriggerType} onChange={(event) => setRedPacketTriggerType(event.target.value as "REPLY" | "LIKE" | "FAVORITE")} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" disabled={mode === "edit"}>

                  <option value="REPLY">回复帖子</option>
                  <option value="LIKE">点赞帖子</option>
                  <option value="FAVORITE">收藏帖子</option>
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">{redPacketGrantMode === "FIXED" ? `单个红包 ${pointName}` : `红包总 ${pointName}`}</p>
                <input value={redPacketGrantMode === "FIXED" ? redPacketUnitPoints : redPacketTotalPoints} onChange={(event) => redPacketGrantMode === "FIXED" ? setRedPacketUnitPoints(event.target.value) : setRedPacketTotalPoints(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" placeholder={redPacketGrantMode === "FIXED" ? "如 10" : "如 100"} disabled={mode === "edit"} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">红包份数</p>
                <input value={redPacketPacketCount} onChange={(event) => setRedPacketPacketCount(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" placeholder="如 10" disabled={mode === "edit"} />
              </div>
              <div className="md:col-span-2 xl:col-span-4 rounded-[16px] bg-background/80 px-4 py-3 text-xs leading-6 text-muted-foreground">
                <p>领取行为满足后自动发放；所有红包均按整数分配，每人至少 1 {pointName}。</p>
                <p>{redPacketGrantMode === "FIXED" ? `当前总计需要 ${fixedRedPacketTotalPoints ?? 0} ${pointName}。` : "拼手气红包要求总积分不小于份数。"}</p>

              </div>

            </div>
          ) : null}
        </div>


        {pendingDraftToRestore ? (
          <PostDraftNotice
            title="检测到本地草稿"
            description={`你在${mode === "edit" ? "编辑帖子" : "发帖"}页有一份未提交内容，可选择恢复继续编辑，或先忽略后手动处理。`}
            meta={pendingDraftUpdatedAt ? `保存于 ${new Date(pendingDraftUpdatedAt).toLocaleString()}` : undefined}
            tone="warning"
            primaryAction={{ label: "恢复草稿", onClick: handleRestorePendingDraft, variant: "outline" }}
            secondaryAction={{ label: "暂不恢复", onClick: handleDismissPendingDraft, variant: "ghost" }}
          />
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <PostDraftNotice
              title={lastSavedDraftAt ? (draftRestored ? "已恢复草稿" : "本地草稿") : "草稿状态"}
              description={lastSavedDraftAt ? `最近保存于 ${new Date(lastSavedDraftAt).toLocaleString()}` : "尚未检测到本地草稿，编辑内容会自动暂存到本地。"}
              compact
              primaryAction={{ label: "保存草稿", onClick: handleManualDraftSave, variant: "outline" }}
              secondaryAction={lastSavedDraftAt ? { label: "清除草稿", onClick: handleClearDraft, variant: "ghost" } : undefined}
              className="w-full sm:w-auto"
            />
            <Button disabled={loading || !canPostInBoard}>{loading ? (mode === "edit" ? "保存中..." : "发布中...") : (mode === "edit" ? "保存帖子" : "发布帖子")}</Button>
          </div>
        </div>

      </form>


      <HiddenContentModal
        open={activeModal === "reply"}


        title="配置回复后可看"
        description="用户在本帖回复 1 次后即可解锁。详细说明已收进这里，页面主区域只保留一行入口。"
        value={replyUnlockContent}
        onChange={setReplyUnlockContent}
        onClose={() => setActiveModal(null)}
      />

      <PostViewLevelModal
        open={activeModal === "view-level"}
        value={minViewLevel}
        onChange={setMinViewLevel}
        onClose={() => setActiveModal(null)}
      />

      <HiddenContentModal
        open={activeModal === "purchase"}
        title="配置购买后可看"
        description={`用户支付后才可查看这部分内容。适合资料、附件说明、完整版教程等付费内容，价格单位为 ${pointName}。`}
        value={purchaseUnlockContent}
        onChange={setPurchaseUnlockContent}
        onClose={() => setActiveModal(null)}
        price={purchasePrice}
        onPriceChange={setPurchasePrice}
        priceLabel={`购买价格（${pointName}）`}
      />
    </>
  )
}
