import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { parsePostContentDocument } from "@/lib/post-content"
import { purchasePostBlock } from "@/lib/post-unlock"
import { prisma } from "@/db/client"

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ code: 401, message: "请先登录后再购买" }, { status: 401 })
  }

  const body = await request.json()
  const postId = String(body.postId ?? "").trim()
  const blockId = String(body.blockId ?? "").trim()

  if (!postId || !blockId) {
    return NextResponse.json({ code: 400, message: "缺少必要参数" }, { status: 400 })
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      content: true,
      status: true,
    },
  })

  if (!post || post.status !== "NORMAL") {
    return NextResponse.json({ code: 404, message: "帖子不存在或当前不可购买" }, { status: 404 })
  }

  if (post.authorId === currentUser.id) {
    return NextResponse.json({ code: 400, message: "作者无需购买自己的隐藏内容" }, { status: 400 })
  }

  const targetBlock = parsePostContentDocument(post.content).blocks.find((block) => block.id === blockId && block.type === "PURCHASE_UNLOCK")
  if (!targetBlock || !targetBlock.price) {
    return NextResponse.json({ code: 404, message: "未找到可购买的隐藏内容" }, { status: 404 })
  }

  try {
    const result = await purchasePostBlock({
      userId: currentUser.id,
      postId,
      blockId,
      price: targetBlock.price,
      sellerId: post.authorId,
    })

    return NextResponse.json({
      code: 0,
      message: result.alreadyOwned ? "你已购买过该隐藏内容" : "购买成功，隐藏内容已解锁",
      data: {
        blockId,
        alreadyOwned: result.alreadyOwned,
      },
    })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "购买失败" }, { status: 400 })
  }
}
