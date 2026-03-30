import { NotificationType, type Prisma } from "@/db/types"

import { extractSummaryFromContent } from "@/lib/content"
import { extractMentionTexts, findMentionUsers, renderUserLinkTokens, resolveMentionsInText, stripUserLinkTokens } from "@/lib/mentions"
import { getAllPostContentText, parsePostContentDocument, serializePostContentDocument, type PostContentDocument } from "@/lib/post-content"

function mapPostContentDocument(document: PostContentDocument, transform: (content: string) => string) {
  return {
    ...document,
    blocks: document.blocks.map((block) => ({
      ...block,
      text: transform(block.text),
    })),
  }
}

export function renderPostContentUserLinks(rawPostContent: string) {
  const document = parsePostContentDocument(rawPostContent)
  return serializePostContentDocument(mapPostContentDocument(document, renderUserLinkTokens))
}

export function stripPostContentUserLinks(rawPostContent: string) {
  const document = parsePostContentDocument(rawPostContent)
  return serializePostContentDocument(mapPostContentDocument(document, stripUserLinkTokens))
}

export async function resolvePostContentMentions(rawPostContent: string) {
  const document = parsePostContentDocument(rawPostContent)
  const mentionTexts = document.blocks.flatMap((block) => extractMentionTexts(block.text))
  const users = await findMentionUsers(mentionTexts)
  const resolvedMentions = [] as ReturnType<typeof resolveMentionsInText>["mentions"]
  const seenUserIds = new Set<number>()

  const nextDocument = mapPostContentDocument(document, (content) => {
    const resolved = resolveMentionsInText(content, users)
    resolved.mentions.forEach((mention) => {
      if (!seenUserIds.has(mention.id)) {
        seenUserIds.add(mention.id)
        resolvedMentions.push(mention)
      }
    })
    return resolved.content
  })

  return {
    content: serializePostContentDocument(nextDocument),
    mentions: resolvedMentions,
  }
}

export async function createPostMentionNotifications(params: {
  tx: Prisma.TransactionClient
  postId: string
  senderId: number
  senderName: string
  rawPostContent: string
  excludeUserIds?: number[]
}) {
  const resolved = await resolvePostContentMentions(params.rawPostContent)
  const excludeUserIds = new Set([params.senderId, ...(params.excludeUserIds ?? [])])
  const notificationTargets = resolved.mentions.filter((user) => !excludeUserIds.has(user.id))

  if (notificationTargets.length === 0) {
    return {
      notifiedCount: 0,
      content: resolved.content,
    }
  }

  const summary = extractSummaryFromContent(getAllPostContentText(stripPostContentUserLinks(resolved.content)), 80)

  await params.tx.notification.createMany({
    data: notificationTargets.map((user) => ({
      userId: user.id,
      type: NotificationType.MENTION,
      senderId: params.senderId,
      relatedType: "POST" as const,
      relatedId: params.postId,
      title: "你在帖子中被提及了",
      content: `${params.senderName} 在帖子中提到了你：${summary || "查看帖子详情"}`,
    })),
  })

  return {
    notifiedCount: notificationTargets.length,
    content: resolved.content,
  }
}
