import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { enforceSensitiveText } from "@/lib/content-safety"
import { hasDatabaseUrl } from "@/lib/db-status"
import { buildPostContentDocument, serializePostContentDocument } from "@/lib/post-content"
import { syncPostTaxonomy } from "@/lib/post-editor"
import { prisma } from "@/db/client"

const APPEND_INTERVAL_MS = 60 * 60 * 1000

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()
  const body = await request.json()
  const postId = String(body.postId ?? "")
  const title = String(body.title ?? "").trim()
  const content = String(body.content ?? "").trim()
  const commentsVisibleToAuthorOnly = Boolean(body.commentsVisibleToAuthorOnly)
  const replyUnlockContent = String(body.replyUnlockContent ?? "").trim()
  const replyThreshold = Number(body.replyThreshold ?? 1)
  const purchaseUnlockContent = String(body.purchaseUnlockContent ?? "").trim()
  const purchasePrice = Number(body.purchasePrice ?? 0)
  const minViewLevel = Math.max(0, Number(body.minViewLevel ?? 0) || 0)
  const appendedContent = String(body.appendedContent ?? "").trim()



  if (!currentUser) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  if (!postId) {
    return NextResponse.json({ code: 400, message: "缺少帖子 ID" }, { status: 400 })
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ code: 503, message: "当前未配置数据库，暂不可修改帖子" }, { status: 503 })
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      slug: true,
      authorId: true,
      editableUntil: true,
      title: true,
      content: true,
      type: true,
      boardId: true,
      bountyPoints: true,
      lastAppendedAt: true,
      appendices: {
        orderBy: {
          sortOrder: "desc",
        },
        take: 1,
        select: {
          sortOrder: true,
        },
      },
      pollOptions: {
        orderBy: {
          sortOrder: "asc",
        },
        select: {
          content: true,
        },
      },
    },
  })

  if (!post) {
    return NextResponse.json({ code: 404, message: "帖子不存在" }, { status: 404 })
  }

  const isAdmin = currentUser.role === "ADMIN" || currentUser.role === "MODERATOR"
  if (!isAdmin && post.authorId !== currentUser.id) {
    return NextResponse.json({ code: 403, message: "无权修改该帖子" }, { status: 403 })
  }

  const canEditOriginal = Boolean(post.editableUntil && new Date(post.editableUntil).getTime() > Date.now()) || isAdmin
  const isAppendRequest = Boolean(appendedContent)

  if (!isAppendRequest && canEditOriginal) {
    if (!title || !content) {
      return NextResponse.json({ code: 400, message: "标题和正文不能为空" }, { status: 400 })
    }

    const titleSafety = await enforceSensitiveText({ scene: "post.title", text: title })
    const contentSafety = await enforceSensitiveText({ scene: "post.content", text: content })
    const replyUnlockSafety = replyUnlockContent ? await enforceSensitiveText({ scene: "post.content", text: replyUnlockContent }) : null
    const purchaseUnlockSafety = purchaseUnlockContent ? await enforceSensitiveText({ scene: "post.content", text: purchaseUnlockContent }) : null

    const serializedContent = serializePostContentDocument(buildPostContentDocument({
      publicContent: contentSafety.sanitizedText,
      replyUnlockContent: replyUnlockSafety?.sanitizedText ?? "",
      replyThreshold: replyUnlockContent ? replyThreshold : undefined,
      purchaseUnlockContent: purchaseUnlockSafety?.sanitizedText ?? "",
      purchasePrice: purchaseUnlockContent ? purchasePrice : undefined,
    }))

    await prisma.post.update({
      where: { id: postId },
      data: {
        title: titleSafety.sanitizedText,
        content: serializedContent,
        commentsVisibleToAuthorOnly,
        minViewLevel,
        reviewNote: titleSafety.shouldReview || contentSafety.shouldReview ? "编辑内容命中敏感词规则，请复核" : undefined,
      },

    })


    await syncPostTaxonomy(postId, titleSafety.sanitizedText, serializedContent)

    return NextResponse.json({
      code: 0,
      message: titleSafety.shouldReview || contentSafety.shouldReview ? "帖子已更新，内容命中敏感词审核规则" : "帖子已更新",
      data: {
        id: post.id,
        slug: post.slug,
      },
    })
  }

  if (!appendedContent) {
    return NextResponse.json({ code: 400, message: "超过编辑时限后只能追加内容" }, { status: 400 })
  }

  if (!isAdmin && post.lastAppendedAt) {
    const waitMs = APPEND_INTERVAL_MS - (Date.now() - new Date(post.lastAppendedAt).getTime())

    if (waitMs > 0) {
      return NextResponse.json({ code: 429, message: `追加过于频繁，请 ${Math.ceil(waitMs / (60 * 1000))} 分钟后再试` }, { status: 429 })
    }
  }

  const appendSafety = await enforceSensitiveText({ scene: "post.content", text: appendedContent })
  const nextSortOrder = (post.appendices[0]?.sortOrder ?? -1) + 1

  await prisma.post.update({
    where: { id: postId },
    data: {
      appendedContent: appendSafety.sanitizedText,
      lastAppendedAt: new Date(),
      reviewNote: appendSafety.shouldReview ? "追加内容命中敏感词审核规则，请复核" : undefined,
      appendices: {
        create: {
          content: appendSafety.sanitizedText,
          sortOrder: nextSortOrder,
        },
      },
    },
  })

  return NextResponse.json({
    code: 0,
    message: appendSafety.shouldReview ? "补充内容已提交，命中敏感词审核规则" : "已追加补充内容",
    data: {
      id: post.id,
      slug: post.slug,
    },
  })
}


