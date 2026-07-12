"use client"

import Link from "next/link"
import type { ChangeEvent, ClipboardEvent, KeyboardEvent as ReactKeyboardEvent } from "react"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { ChevronLeft, ChevronUp, ImageIcon, MessageSquareMore, Paperclip, Send, SmilePlus, Trash2 } from "lucide-react"

import { EmojiPicker } from "@/components/emoji-picker"
import { MessageBubbleContent } from "@/components/message/message-bubble-content"
import { useMarkdownEmojiMap } from "@/components/site-settings-provider"
import { Button } from "@/components/ui/rbutton"
import { Tooltip } from "@/components/ui/tooltip"
import { UserAvatar } from "@/components/user/user-avatar"
import { UserProfilePreviewCardTrigger } from "@/components/user/user-profile-preview-card-trigger"
import { isImageOnlyMessageContent } from "@/lib/message-media"
import { createSiteChatParticipant } from "@/lib/site-chat"
import { cn } from "@/lib/utils"
import type { MessageBubbleItem, MessageConversationDetail, MessageSendResult } from "@/lib/message-types"

export interface LocalMessageSentPayload {
  conversationId: string
  message: MessageBubbleItem
  previousConversationId?: string
}

interface MessageThreadPanelProps {
  conversation: MessageConversationDetail | null
  currentUserId: number
  usingDemoData: boolean
  messageImageUploadEnabled: boolean
  messageFileUploadEnabled: boolean
  loadingConversation?: boolean
  conversationError?: string
  onMessageSent: (payload: LocalMessageSentPayload) => void
  canManageSiteChatMessages?: boolean
  deletingMessageId?: string
  onDeleteMessage?: (messageId: string) => void
  onLoadHistory: () => void
  loadingHistory: boolean
  historyError: string
  onBack?: () => void
}

export function MessageThreadPanel({
  conversation,
  currentUserId,
  usingDemoData,
  messageImageUploadEnabled,
  messageFileUploadEnabled,
  loadingConversation = false,
  conversationError = "",
  onMessageSent,
  canManageSiteChatMessages = false,
  deletingMessageId = "",
  onDeleteMessage,
  onLoadHistory,
  loadingHistory,
  historyError,
  onBack,
}: MessageThreadPanelProps) {
  const recipient = useMemo(() => resolveRecipient(conversation, currentUserId), [conversation, currentUserId])
  const recipientProfileHref = recipient && conversation?.kind !== "SITE_CHAT"
    ? `/users/${recipient.username}`
    : null

  if (!conversation || !recipient) {
    if (loadingConversation) {
      return (
        <div className="flex min-h-[calc(100vh-164px)] items-center justify-center rounded-xl border border-border bg-card px-6 text-center shadow-soft max-sm:min-h-[calc(100dvh-56px)] max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0 max-sm:shadow-none">
          <div>
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="mx-auto mb-6 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground xl:hidden"
                aria-label="返回会话列表"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : null}
            <MessageSquareMore className="mx-auto h-10 w-10 animate-pulse text-muted-foreground" />
            <p className="mt-4 text-sm uppercase tracking-[0.28em] text-muted-foreground">Chat Thread</p>
            <h2 className="mt-3 text-2xl font-semibold">正在加载会话</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">会话内容正在加载，请稍候。</p>
          </div>
        </div>
      )
    }

    if (conversationError) {
      return (
        <div className="flex min-h-[calc(100vh-164px)] items-center justify-center rounded-xl border border-border bg-card px-6 text-center shadow-soft max-sm:min-h-[calc(100dvh-56px)] max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0 max-sm:shadow-none">
          <div>
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="mx-auto mb-6 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground xl:hidden"
                aria-label="返回会话列表"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : null}
            <MessageSquareMore className="mx-auto h-10 w-10 text-rose-500 dark:text-rose-300" />
            <p className="mt-4 text-sm uppercase tracking-[0.28em] text-muted-foreground">Chat Thread</p>
            <h2 className="mt-3 text-2xl font-semibold">会话不可用</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{conversationError}</p>
          </div>
        </div>
      )
    }

    return (
      <div className="flex min-h-[calc(100vh-164px)] items-center justify-center rounded-xl border border-border bg-card px-6 text-center shadow-soft max-sm:min-h-[calc(100dvh-56px)] max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0 max-sm:shadow-none">
        <div>
          <MessageSquareMore className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm uppercase tracking-[0.28em] text-muted-foreground">Chat Thread</p>
          <h2 className="mt-3 text-2xl font-semibold">还没有私信会话</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">去用户主页点击“发私信”，或从现有会话列表中选择一个联系人。</p>
        </div>
      </div>
    )
  }

  return (
    <MessageThreadPanelContent
      key={conversation.id}
      conversation={conversation}
      recipient={recipient}
      recipientProfileHref={recipientProfileHref}
      usingDemoData={usingDemoData}
      currentUserId={currentUserId}
      messageImageUploadEnabled={messageImageUploadEnabled}
      messageFileUploadEnabled={messageFileUploadEnabled}
      onMessageSent={onMessageSent}
      canManageSiteChatMessages={canManageSiteChatMessages}
      deletingMessageId={deletingMessageId}
      onDeleteMessage={onDeleteMessage}
      onLoadHistory={onLoadHistory}
      loadingHistory={loadingHistory}
      historyError={historyError}
      onBack={onBack}
    />
  )
}

function MessageThreadPanelContent({
  conversation,
  recipient,
  recipientProfileHref,
  currentUserId,
  usingDemoData,
  messageImageUploadEnabled,
  messageFileUploadEnabled,
  onMessageSent,
  canManageSiteChatMessages,
  deletingMessageId,
  onDeleteMessage,
  onLoadHistory,
  loadingHistory,
  historyError,
  onBack,
}: {
  conversation: MessageConversationDetail
  recipient: NonNullable<ReturnType<typeof resolveRecipient>>
  recipientProfileHref: string | null
  currentUserId: number
  usingDemoData: boolean
  messageImageUploadEnabled: boolean
  messageFileUploadEnabled: boolean
  onMessageSent: (payload: LocalMessageSentPayload) => void
  canManageSiteChatMessages: boolean
  deletingMessageId: string
  onDeleteMessage?: (messageId: string) => void
  onLoadHistory: () => void
  loadingHistory: boolean
  historyError: string
  onBack?: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const threadRef = useRef<HTMLDivElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null)
  const emojiPanelRef = useRef<HTMLDivElement | null>(null)
  const shouldStickToBottomRef = useRef(true)
  const markdownEmojiMap = useMarkdownEmojiMap()
  const [draft, setDraft] = useState("")
  const [error, setError] = useState("")
  const [showEmojiPanel, setShowEmojiPanel] = useState(false)
  const [assetUploadPending, setAssetUploadPending] = useState(false)
  const [assetUploadLabel, setAssetUploadLabel] = useState("")
  const [isPending, startTransition] = useTransition()
  const emojiPickerItems = useMemo(
    () => markdownEmojiMap.map((emoji) => ({
      key: emoji.shortcode,
      value: `:${emoji.shortcode}:`,
      icon: emoji.icon,
      label: `${emoji.label}（:${emoji.shortcode}:）`,
      group: emoji.group,
    })),
    [markdownEmojiMap],
  )

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    const container = threadRef.current
    if (!container || !shouldStickToBottomRef.current) {
      return
    }

    container.scrollTop = container.scrollHeight
  }, [conversation?.messages])

  useEffect(() => {
    if (!showEmojiPanel) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }

      if (emojiButtonRef.current?.contains(target) || emojiPanelRef.current?.contains(target)) {
        return
      }

      setShowEmojiPanel(false)
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setShowEmojiPanel(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [showEmojiPanel])

  function insertEmoji(emoji: string) {
    const element = textareaRef.current

    if (!element) {
      setDraft((current) => `${current}${emoji}`)
      return
    }

    const selectionStart = element.selectionStart
    const selectionEnd = element.selectionEnd
    const nextDraft = `${draft.slice(0, selectionStart)}${emoji}${draft.slice(selectionEnd)}`

    setDraft(nextDraft)

    requestAnimationFrame(() => {
      element.focus()
      const nextCursor = selectionStart + emoji.length
      element.setSelectionRange(nextCursor, nextCursor)
    })
  }

  async function uploadMessageAsset(file: File) {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch("/api/messages/upload", {
      method: "POST",
      body: formData,
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok || payload?.code !== 0 || !payload?.data?.token) {
      throw new Error(payload?.message ?? "上传失败")
    }

    return payload.data.token as string
  }

  async function sendMessageBody(content: string, options?: {
    clearDraft?: boolean
  }) {
    const response = await fetch("/api/messages/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(conversation.kind === "SITE_CHAT"
        ? { conversationId: conversation.id, body: content }
        : { recipientId: recipient.id, body: content }),
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok || payload?.code !== 0) {
      setError(payload?.message ?? "发送失败")
      return false
    }

    const result = payload?.data as MessageSendResult | undefined

    if (result) {
      const nextConversationId = result.conversationId || conversation.id

      onMessageSent({
        conversationId: nextConversationId,
        previousConversationId: nextConversationId !== conversation.id ? conversation.id : undefined,
        message: {
          id: result.id,
          body: result.content,
          createdAt: result.createdAt,
          occurredAt: result.occurredAt,
          senderId: currentUserId,
          senderUsername: result.senderUsername ?? "",
          senderName: conversation.kind === "SITE_CHAT" ? result.senderDisplayName ?? "我" : "我",
          senderAvatarPath: result.senderAvatarPath ?? null,
          isMine: true,
          bodyImageOnly: isImageOnlyMessageContent(result.content),
        },
      })
    }

    if (options?.clearDraft) {
      setDraft("")
    }
    setShowEmojiPanel(false)
    return true
  }

  function normalizePastedImageFile(file: File, index: number) {
    if (file.name?.trim()) {
      return file
    }

    const extension = file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/gif"
        ? "gif"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/avif"
            ? "avif"
            : file.type === "image/svg+xml"
              ? "svg"
              : "png"

    return new File([file], `pasted-image-${Date.now()}-${index}.${extension}`, {
      type: file.type || "image/png",
      lastModified: Date.now(),
    })
  }

  async function handleAssetUpload(files: File[], label: string, normalizeImageFiles = false) {
    if (files.length === 0) {
      return
    }

    if (usingDemoData) {
      setError("当前会话尚未完成数据库接入")
      return
    }

    setError("")
    setAssetUploadPending(true)
    setAssetUploadLabel(label)

    try {
      const tokens: string[] = []
      for (const [index, file] of files.entries()) {
        const resolvedFile = normalizeImageFiles ? normalizePastedImageFile(file, index) : file
        tokens.push(await uploadMessageAsset(resolvedFile))
      }

      setAssetUploadLabel("正在发送消息...")
      shouldStickToBottomRef.current = true
      await sendMessageBody(tokens.join("\n"))
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "上传失败")
    } finally {
      setAssetUploadPending(false)
      setAssetUploadLabel("")
      textareaRef.current?.focus()
    }
  }

  async function handleImageInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    await handleAssetUpload(files, "正在上传图片...")
  }

  async function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    await handleAssetUpload(files, "正在上传文件...")
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
      .filter((file) => file.type.startsWith("image/"))

    if (imageFiles.length === 0) {
      return
    }

    event.preventDefault()

    if (!messageImageUploadEnabled) {
      setError("当前站点未开启私信图片发送")
      return
    }

    void handleAssetUpload(imageFiles, "正在上传粘贴图片...", true)
  }

  async function handleSend() {
    const content = draft.trim()
    if (!content) {
      setError("请输入消息内容")
      return
    }

    if (usingDemoData) {
      setError("当前会话尚未完成数据库接入")
      return
    }

    setError("")
    shouldStickToBottomRef.current = true

    startTransition(async () => {
      await sendMessageBody(content, {
        clearDraft: true,
      })
    })
  }

  async function handleLoadMore() {
    if (!conversation?.hasMoreHistory || loadingHistory) {
      return
    }

    shouldStickToBottomRef.current = false
    await onLoadHistory()
  }

  function handleDraftKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return
    }

    if (event.shiftKey) {
      return
    }

    event.preventDefault()

    if (!isPending && !assetUploadPending) {
      void handleSend()
    }
  }

  return (
    <div className="flex max-h-[calc(100vh-164px)] min-h-[calc(100vh-164px)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft max-sm:max-h-[calc(100dvh-56px)] max-sm:min-h-[calc(100dvh-56px)] max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0 max-sm:shadow-none">
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground xl:hidden"
              aria-label="返回会话列表"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : null}
          {recipientProfileHref ? (
            <Link
              href={recipientProfileHref}
              className="shrink-0 rounded-2xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={`查看 ${recipient.displayName} 的主页`}
            >
              <UserAvatar name={recipient.displayName} avatarPath={recipient.avatarPath} size="md" />
            </Link>
          ) : (
            <UserAvatar name={recipient.displayName} avatarPath={recipient.avatarPath} size="md" />
          )}
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold">{conversation.title}</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">{conversation.subtitle}</p>
          </div>
        </div>
        <div className="hidden text-right text-xs text-muted-foreground sm:block">
          <p>最近更新</p>
          <p className="mt-1">{conversation.updatedAt}</p>
        </div>
      </div>

      <div ref={threadRef} className="mt-3 flex-1 space-y-4 overflow-y-auto px-5 py-4.5">
        {conversation.hasMoreHistory ? (
          <div className="flex justify-center">
            <Button type="button" variant="outline" className="rounded-full" onClick={handleLoadMore} disabled={loadingHistory}>
              <ChevronUp className="mr-2 h-4 w-4" />
              {loadingHistory ? "加载中..." : "加载历史消息"}
            </Button>
          </div>
        ) : null}

        {historyError ? <p className="rounded-[18px] bg-rose-50 px-4 py-3 text-sm text-rose-700">{historyError}</p> : null}

        {conversation.messages.length === 0 ? (
          <div className="flex h-full min-h-[220px] items-center justify-center rounded-xl border border-dashed border-border bg-card/80 px-6 text-center dark:bg-secondary/30">
            <div>
              <p className="text-sm font-medium">还没有聊天记录</p>
            </div>
          </div>
        ) : null}

        {conversation.messages.map((message) => {
          const shouldShowSenderName = conversation.kind === "SITE_CHAT"
          const canDeleteMessage = canManageSiteChatMessages && conversation.kind === "SITE_CHAT" && Boolean(onDeleteMessage)
          const deletingThisMessage = deletingMessageId === message.id
          const isImageOnlyMessage = message.bodyImageOnly ?? isImageOnlyMessageContent(message.body)
          const senderAvatar = (
            <ChatMessageAvatar
              message={message}
              profilePreviewEnabled={conversation.kind === "SITE_CHAT"}
              side={message.isMine ? "right" : "left"}
            />
          )

          return (
            <div key={message.id} className={cn("flex gap-3", message.isMine ? "justify-end" : "justify-start")}>
              {!message.isMine ? senderAvatar : null}
              <div className={cn("flex min-w-0 max-w-[86%] flex-col sm:max-w-[76%]", message.isMine ? "items-end" : "items-start")}>
                {shouldShowSenderName ? (
                  <p className={cn("mb-1 truncate text-xs font-medium text-muted-foreground", message.isMine ? "text-right" : "text-left")}>
                    {message.senderName}
                  </p>
                ) : null}
                <div
                  className={cn(
                    "inline-block max-w-full min-w-0 text-sm leading-6",
                    isImageOnlyMessage
                      ? "rounded-xl bg-transparent p-0 shadow-none"
                      : [
                          "rounded-xl px-3.5 py-2 shadow-xs",
                          message.isMine
                            ? "rounded-br-md bg-foreground text-background dark:bg-primary dark:text-primary-foreground"
                            : "rounded-bl-md bg-secondary/70 text-foreground dark:bg-secondary/70 dark:text-foreground",
                        ],
                  )}
                >
                  <MessageBubbleContent
                    content={message.body}
                    html={message.bodyHtml}
                    imageOnly={message.bodyImageOnly}
                    markdownEmojiMap={markdownEmojiMap}
                    isMine={message.isMine}
                  />
                </div>
                <div className={cn("mt-2 flex w-full items-center gap-1.5", message.isMine ? "justify-end" : "justify-start")}>
                  <p className="text-xs text-muted-foreground">{message.createdAt}</p>
                  {canDeleteMessage ? (
                    <Tooltip content="删除消息">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="删除消息"
                        onClick={() => onDeleteMessage?.(message.id)}
                        disabled={deletingThisMessage}
                      >
                        <Trash2 data-icon="inline-start" />
                      </Button>
                    </Tooltip>
                  ) : null}
                </div>
              </div>
              {message.isMine ? senderAvatar : null}
            </div>
          )
        })}
      </div>

      <div className="border-t border-border px-4 py-3 sm:px-5 sm:py-3.5 max-sm:pb-[calc(env(safe-area-inset-bottom)+12px)]">
        {usingDemoData ? <p className="mb-3 rounded-[18px] bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">当前会话尚未完成数据库接入。</p> : null}
        {error ? <p className="mb-3 rounded-[18px] bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</p> : null}
        {assetUploadPending ? <p className="mb-3 rounded-[18px] bg-secondary px-4 py-3 text-sm text-muted-foreground">{assetUploadLabel}</p> : null}
        <div className="rounded-xl border border-border bg-background px-4 py-3 max-sm:rounded-xl">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleDraftKeyDown}
            onPaste={handlePaste}
            rows={3}
            placeholder={messageImageUploadEnabled ? "输入消息，回车发送，Shift + Enter 换行，支持粘贴图片" : "输入消息，回车发送，Shift + Enter 换行"}
            className="w-full resize-none border-none bg-transparent text-sm leading-7 outline-hidden placeholder:text-muted-foreground"
          />
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageInputChange} />
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileInputChange} />
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
            <div className="relative flex items-center gap-2 text-xs text-muted-foreground">
              <button
                ref={emojiButtonRef}
                type="button"
                aria-label="表情"
                title="表情"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent max-sm:size-9 max-sm:px-0"
                onClick={() => setShowEmojiPanel((current) => !current)}
              >
                <SmilePlus className="h-4 w-4" />
                <span className="hidden sm:inline">表情</span>
              </button>
              {showEmojiPanel ? (
                <div ref={emojiPanelRef} className="absolute bottom-[calc(100%+12px)] left-0 z-20 max-h-[min(340px,calc(100vh-160px))] w-[min(440px,calc(100vw-32px))] overflow-hidden rounded-[14px] border border-border bg-background p-0 shadow-2xl">
                  <EmojiPicker
                    items={emojiPickerItems}
                    columns={8}
                    onSelect={(value) => insertEmoji(value)}
                  />
                </div>
              ) : null}
              {messageImageUploadEnabled ? (
                <button
                  type="button"
                  aria-label="图片"
                  title="图片"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 max-sm:size-9 max-sm:px-0"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={assetUploadPending || isPending}
                >
                  <ImageIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">图片</span>
                </button>
              ) : null}
              {messageFileUploadEnabled ? (
                <button
                  type="button"
                  aria-label="文件"
                  title="文件"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 max-sm:size-9 max-sm:px-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={assetUploadPending || isPending}
                >
                  <Paperclip className="h-4 w-4" />
                  <span className="hidden sm:inline">文件</span>
                </button>
              ) : null}
            </div>
            <Button type="button" className="h-10 rounded-full px-5" onClick={handleSend} disabled={isPending || assetUploadPending}>
              <Send className="mr-2 h-4 w-4" />
              {isPending ? "发送中..." : assetUploadPending ? "上传中..." : "发送消息"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatMessageAvatar({
  message,
  profilePreviewEnabled,
  side,
}: {
  message: MessageBubbleItem
  profilePreviewEnabled: boolean
  side: "left" | "right"
}) {
  const avatar = <UserAvatar name={message.senderName} avatarPath={message.senderAvatarPath} size="sm" />

  if (!profilePreviewEnabled || !message.senderUsername) {
    return avatar
  }

  return (
    <UserProfilePreviewCardTrigger
      username={message.senderUsername}
      displayName={message.senderName}
      avatarPath={message.senderAvatarPath}
      side="top"
      align={side === "right" ? "end" : "start"}
      triggerClassName="shrink-0"
    >
      {avatar}
    </UserProfilePreviewCardTrigger>
  )
}

function resolveRecipient(conversation: MessageConversationDetail | null, currentUserId: number) {
  if (conversation?.kind === "SITE_CHAT") {
    return createSiteChatParticipant()
  }

  if (conversation?.recipientId) {
    return conversation.participants.find((item) => item.id === conversation.recipientId)
  }

  return conversation?.participants.find((item) => item.id !== currentUserId)
}
