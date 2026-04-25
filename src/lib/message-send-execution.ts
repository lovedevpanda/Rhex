import type { CurrentUserRecord } from "@/db/current-user"

import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
import { logError } from "@/lib/logger"
import { summarizeMessagePreview } from "@/lib/message-media"
import { sendDirectMessage } from "@/lib/messages"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { enqueueUserNotificationDeliveries } from "@/lib/user-notification-delivery"
import { getUserDisplayName } from "@/lib/user-display"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { withRequestWriteGuard, withWriteGuard } from "@/lib/write-guard"
import { createRequestWriteGuardOptions, createWriteGuardOptions } from "@/lib/write-guard-policies"

type MessageExecutionActor = Pick<CurrentUserRecord, "id" | "username" | "nickname" | "avatarPath" | "status">

interface ExecuteDirectMessageSendInput {
  recipientId: number
  body: string
}

interface ExecuteDirectMessageSendOptions {
  request: Request
  sender: MessageExecutionActor
  log?: {
    scope: string
    action: string
    extra?: Record<string, unknown>
  }
}

function assertMessageSenderStatus(sender: MessageExecutionActor) {
  if (sender.status === "ACTIVE" || sender.status === "MUTED") {
    return
  }

  if (sender.status === "BANNED") {
    throw new Error("账号已被拉黑，无法发送私信")
  }

  throw new Error("账号未激活，无法发送私信")
}

async function runMessageWriteGuard<T>(
  input: ExecuteDirectMessageSendInput,
  senderId: number,
  request: Request | undefined,
  task: () => Promise<T>,
) {
  if (request) {
    return withRequestWriteGuard(createRequestWriteGuardOptions("messages-send", {
      request,
      userId: senderId,
      input: {
        recipientId: input.recipientId,
        body: input.body,
      },
    }), task)
  }

  return withWriteGuard({
    ...createWriteGuardOptions("messages-send", {
      userId: senderId,
      input: {
        recipientId: input.recipientId,
        body: input.body,
      },
    }),
    identity: {
      userId: senderId,
    },
  }, task)
}

export async function executeDirectMessageSend(
  input: ExecuteDirectMessageSendInput,
  options: ExecuteDirectMessageSendOptions,
) {
  assertMessageSenderStatus(options.sender)
  const requestUrl = new URL(options.request.url)

  return runMessageWriteGuard(input, options.sender.id, options.request, async () => {
    await executeAddonActionHook("message.send.before", {
      senderId: options.sender.id,
      senderUsername: options.sender.username,
      recipientId: input.recipientId,
      body: input.body,
    }, {
      request: options.request,
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
      throwOnError: true,
    })

    const data = await sendDirectMessage(options.sender.id, input.recipientId, input.body)

    await executeAddonActionHook("message.send.after", {
      senderId: options.sender.id,
      senderUsername: options.sender.username,
      recipientId: input.recipientId,
      messageId: data.id,
      conversationId: data.conversationId,
      body: data.content,
      contentAdjusted: data.contentAdjusted,
      occurredAt: data.occurredAt,
    }, {
      request: options.request,
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
    })

    revalidateUserSurfaceCache(options.sender.id)
    revalidateUserSurfaceCache(input.recipientId)

    void enqueueUserNotificationDeliveries({
      userId: input.recipientId,
      event: {
        type: "privateMessage",
        message: {
          id: data.id,
          conversationId: data.conversationId,
          content: data.content,
          preview: summarizeMessagePreview(data.content),
          createdAt: data.occurredAt,
          inboxPath: `/messages?conversation=${encodeURIComponent(data.conversationId)}`,
        },
        sender: {
          id: options.sender.id,
          username: options.sender.username,
          displayName: getUserDisplayName(options.sender, options.sender.username),
          avatarPath: options.sender.avatarPath ?? null,
        },
      },
    }).catch((error) => {
      logError({
        scope: "user-notification-delivery",
        action: "enqueue-private-message",
        userId: options.sender.id,
        targetId: data.id,
        metadata: {
          recipientId: input.recipientId,
          conversationId: data.conversationId,
        },
      }, error)
    })

    if (options.log) {
      logRouteWriteSuccess({
        scope: options.log.scope,
        action: options.log.action,
      }, {
        userId: options.sender.id,
        targetId: String(input.recipientId),
        extra: {
          conversationId: data.conversationId,
          messageId: data.id,
          contentAdjusted: data.contentAdjusted,
          ...(options.log.extra ?? {}),
        },
      })
    }

    return data
  })
}
