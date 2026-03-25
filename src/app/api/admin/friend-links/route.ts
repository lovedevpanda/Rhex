import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import { requireAdminUser } from "@/lib/admin"
import { createFriendLinkByAdmin, reviewFriendLink } from "@/lib/friend-links"

export async function POST(request: Request) {
  const admin = await requireAdminUser()
  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权操作" }, { status: 403 })
  }

  try {
    const body = await request.json()

    if (body.action === "create") {
      await createFriendLinkByAdmin({
        name: body.name,
        url: body.url,
        logoPath: body.logoPath,
        sortOrder: body.sortOrder,
        reviewNote: body.reviewNote,
      })


      revalidatePath("/")
      revalidatePath("/link")
      revalidatePath("/admin")
      return NextResponse.json({ code: 0, message: "友情链接已创建" })
    }

    await reviewFriendLink({
      id: String(body.id ?? ""),
      action: body.action,
      reviewNote: body.reviewNote,
      sortOrder: body.sortOrder,
      name: body.name,
      url: body.url,
      logoPath: body.logoPath,

    })

    revalidatePath("/")
    revalidatePath("/link")
    revalidatePath("/admin")

    return NextResponse.json({ code: 0, message: "友情链接状态已更新" })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "操作失败" }, { status: 400 })
  }
}
