import "server-only"

import { type RelatedType } from "@/db/types"
import { findUserNotificationDeliveryRecipient } from "@/db/notification-write-queries"
import { enqueueBackgroundJob, registerBackgroundJobHandler } from "@/lib/background-jobs"
import { sendUserNotificationEmail } from "@/lib/mailer"
import { getServerSiteSettings } from "@/lib/site-settings"
import { getConfiguredSiteOrigin } from "@/lib/site-origin"
import { getUserDisplayName } from "@/lib/user-display"
import { isUserNotificationChannelEnabled } from "@/lib/user-notification-preferences"
import { resolveUserProfileSettings } from "@/lib/user-profile-settings"

export interface SystemNotificationDeliveryEvent {
  type: "systemNotification"
  notification: {
    id: string
    title: string
    content: string
    relatedType: RelatedType
    relatedId: string
    createdAt: string
    inboxPath: string
  }
}

export interface PrivateMessageDeliveryEvent {
  type: "privateMessage"
  message: {
    id: string
    conversationId: string
    content: string
    preview: string
    createdAt: string
    inboxPath: string
  }
  sender: {
    id: number
    username: string
    displayName: string
    avatarPath: string | null
  }
}

export type UserNotificationDeliveryEvent =
  | SystemNotificationDeliveryEvent
  | PrivateMessageDeliveryEvent

export interface UserNotificationDeliveryJobPayload {
  userId: number
  event: UserNotificationDeliveryEvent
}

interface SystemNotificationWebhookPayload {
  event: "system.notification.created"
  notification: {
    id: string
    type: "SYSTEM"
    title: string
    content: string
    relatedType: RelatedType
    relatedId: string
    createdAt: string
    inboxPath: string
    inboxUrl: string
  }
  recipient: {
    userId: number
  }
}

interface PrivateMessageWebhookPayload {
  event: "private.message.created"
  message: {
    id: string
    conversationId: string
    content: string
    preview: string
    createdAt: string
    inboxPath: string
    inboxUrl: string
  }
  sender: {
    id: number
    username: string
    displayName: string
    avatarPath: string | null
  }
  recipient: {
    userId: number
  }
}

type UserNotificationWebhookPayload =
  | SystemNotificationWebhookPayload
  | PrivateMessageWebhookPayload

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatOccurredAt(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString("zh-CN", {
    hour12: false,
  })
}

function toSiteUrl(path: string) {
  const origin = getConfiguredSiteOrigin()
  return origin ? new URL(path, `${origin}/`).toString() : path
}

function hasMailerConfig(settings: Awaited<ReturnType<typeof getServerSiteSettings>>) {
  return Boolean(settings.smtpEnabled && settings.smtpHost && settings.smtpPort && settings.smtpUser && settings.smtpPass && settings.smtpFrom)
}

function buildWebhookPayload(payload: UserNotificationDeliveryJobPayload): UserNotificationWebhookPayload {
  if (payload.event.type === "systemNotification") {
    return {
      event: "system.notification.created",
      notification: {
        id: payload.event.notification.id,
        type: "SYSTEM",
        title: payload.event.notification.title,
        content: payload.event.notification.content,
        relatedType: payload.event.notification.relatedType,
        relatedId: payload.event.notification.relatedId,
        createdAt: payload.event.notification.createdAt,
        inboxPath: payload.event.notification.inboxPath,
        inboxUrl: toSiteUrl(payload.event.notification.inboxPath),
      },
      recipient: {
        userId: payload.userId,
      },
    }
  }

  return {
    event: "private.message.created",
    message: {
      id: payload.event.message.id,
      conversationId: payload.event.message.conversationId,
      content: payload.event.message.content,
      preview: payload.event.message.preview,
      createdAt: payload.event.message.createdAt,
      inboxPath: payload.event.message.inboxPath,
      inboxUrl: toSiteUrl(payload.event.message.inboxPath),
    },
    sender: payload.event.sender,
    recipient: {
      userId: payload.userId,
    },
  }
}

async function postWebhook(webhookUrl: string, payload: UserNotificationWebhookPayload) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Webhook responded with ${response.status}`)
    }
  } finally {
    clearTimeout(timeout)
  }
}

function buildEmailEnvelope(input: {
  siteName: string
  recipientName: string
  payload: UserNotificationDeliveryJobPayload
}) {
  if (input.payload.event.type === "systemNotification") {
    const title = input.payload.event.notification.title
    const content = input.payload.event.notification.content
    const occurredAt = formatOccurredAt(input.payload.event.notification.createdAt)
    const inboxUrl = toSiteUrl(input.payload.event.notification.inboxPath)
    const safeSiteName = escapeHtml(input.siteName)
    const safeRecipientName = escapeHtml(input.recipientName)
    const safeTitle = escapeHtml(title)
    const safeContent = escapeHtml(content).replaceAll("\n", "<br />")
    const safeOccurredAt = escapeHtml(occurredAt)
    const safeInboxUrl = escapeHtml(inboxUrl)

    return {
      subject: `${input.siteName} 系统通知 · ${title}`,
      text: [
        `${input.recipientName}，你好。`,
        "",
        `你收到一条新的系统通知：${title}`,
        "",
        content,
        "",
        `通知时间：${occurredAt}`,
        `查看通知：${inboxUrl}`,
      ].join("\n"),
      html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#111"><h2>${safeSiteName} 系统通知</h2><p>${safeRecipientName}，你好。</p><p>你收到一条新的系统通知：<strong>${safeTitle}</strong></p><div style="margin:16px 0;padding:12px 14px;border-radius:12px;background:#f5f5f5">${safeContent}</div><p>通知时间：${safeOccurredAt}</p><p><a href="${safeInboxUrl}">点击查看通知</a></p></div>`,
    }
  }

  const senderName = input.payload.event.sender.displayName || input.payload.event.sender.username
  const content = input.payload.event.message.content
  const occurredAt = formatOccurredAt(input.payload.event.message.createdAt)
  const inboxUrl = toSiteUrl(input.payload.event.message.inboxPath)
  const safeSiteName = escapeHtml(input.siteName)
  const safeRecipientName = escapeHtml(input.recipientName)
  const safeSenderName = escapeHtml(senderName)
  const safeSenderUsername = escapeHtml(input.payload.event.sender.username)
  const safeContent = escapeHtml(content).replaceAll("\n", "<br />")
  const safeOccurredAt = escapeHtml(occurredAt)
  const safeInboxUrl = escapeHtml(inboxUrl)

  return {
    subject: `${input.siteName} 收到来自 ${senderName} 的私信`,
    text: [
      `${input.recipientName}，你好。`,
      "",
      `你收到一条新的私信。`,
      `发送者：${senderName} (@${input.payload.event.sender.username})`,
      `发送时间：${occurredAt}`,
      "",
      content,
      "",
      `进入会话：${inboxUrl}`,
    ].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#111"><h2>${safeSiteName} 私信提醒</h2><p>${safeRecipientName}，你好。</p><p>你收到一条新的私信。</p><table style="border-collapse:collapse;margin:16px 0"><tbody><tr><td style="padding:6px 12px 6px 0;color:#666">发送者</td><td style="padding:6px 0">${safeSenderName} (@${safeSenderUsername})</td></tr><tr><td style="padding:6px 12px 6px 0;color:#666">发送时间</td><td style="padding:6px 0">${safeOccurredAt}</td></tr></tbody></table><div style="margin:16px 0;padding:12px 14px;border-radius:12px;background:#f5f5f5">${safeContent}</div><p><a href="${safeInboxUrl}">点击进入会话</a></p></div>`,
  }
}

async function deliverWebhook(payload: UserNotificationDeliveryJobPayload) {
  const recipient = await findUserNotificationDeliveryRecipient(payload.userId)

  if (!recipient) {
    return
  }

  const notificationPreferences = resolveUserProfileSettings(recipient.signature).notificationPreferences

  if (!isUserNotificationChannelEnabled(notificationPreferences, "webhook", payload.event.type)) {
    return
  }

  await postWebhook(notificationPreferences.webhook.url.trim(), buildWebhookPayload(payload))
}

async function deliverEmail(payload: UserNotificationDeliveryJobPayload) {
  const recipient = await findUserNotificationDeliveryRecipient(payload.userId)

  if (!recipient?.email || !recipient.emailVerifiedAt) {
    return
  }

  const notificationPreferences = resolveUserProfileSettings(recipient.signature).notificationPreferences

  if (!isUserNotificationChannelEnabled(notificationPreferences, "email", payload.event.type)) {
    return
  }

  const siteSettings = await getServerSiteSettings()

  if (!hasMailerConfig(siteSettings)) {
    return
  }

  const recipientName = getUserDisplayName(recipient, recipient.username)
  const emailEnvelope = buildEmailEnvelope({
    siteName: siteSettings.siteName,
    recipientName,
    payload,
  })

  await sendUserNotificationEmail({
    to: recipient.email,
    subject: emailEnvelope.subject,
    text: emailEnvelope.text,
    html: emailEnvelope.html,
  })
}

export async function enqueueUserNotificationDeliveries(payload: UserNotificationDeliveryJobPayload) {
  const recipient = await findUserNotificationDeliveryRecipient(payload.userId)

  if (!recipient) {
    return
  }

  const notificationPreferences = resolveUserProfileSettings(recipient.signature).notificationPreferences
  const tasks: Promise<unknown>[] = []

  if (isUserNotificationChannelEnabled(notificationPreferences, "webhook", payload.event.type)) {
    tasks.push(enqueueBackgroundJob("notification.dispatch-webhook", payload))
  }

  if (recipient.email && recipient.emailVerifiedAt && isUserNotificationChannelEnabled(notificationPreferences, "email", payload.event.type)) {
    tasks.push(enqueueBackgroundJob("notification.dispatch-email", payload))
  }

  await Promise.all(tasks)
}

export async function sendUserNotificationWebhookTest(params: {
  userId: number
  webhookUrl: string
}) {
  await postWebhook(params.webhookUrl, buildWebhookPayload({
    userId: params.userId,
    event: {
      type: "systemNotification",
      notification: {
        id: `test-${Date.now()}`,
        title: "系统通知 Webhook 测试",
        content: "这是一条测试通知，说明你的站外通知 Webhook 已经可以正常接收系统消息。",
        relatedType: "ANNOUNCEMENT",
        relatedId: "webhook-test",
        createdAt: new Date().toISOString(),
        inboxPath: "/notifications",
      },
    },
  }))
}

registerBackgroundJobHandler("notification.dispatch-webhook", async (payload) => {
  await deliverWebhook(payload)
})

registerBackgroundJobHandler("notification.dispatch-email", async (payload) => {
  await deliverEmail(payload)
})
