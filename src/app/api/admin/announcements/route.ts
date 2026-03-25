import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { requireAdminUser } from "@/lib/admin"
import {
  getAdminAnnouncementList,
  removeAdminAnnouncement,
  saveAdminAnnouncement,
  toggleAdminAnnouncementPin,
  updateAdminAnnouncementStatus,
} from "@/lib/admin-announcements"

export async function GET() {
  const admin = await requireAdminUser()
  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权访问" }, { status: 403 })
  }

  try {
    const items = await getAdminAnnouncementList()
    return NextResponse.json({ code: 0, data: items })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "获取公告失败" }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const admin = await requireAdminUser()
  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权操作" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const action = String(body.action ?? "save")

    if (action === "delete") {
      await removeAdminAnnouncement(String(body.id ?? ""))
      revalidatePath("/")
      revalidatePath("/announcements")
      revalidatePath("/admin")
      return NextResponse.json({ code: 0, message: "公告已删除" })
    }

    if (action === "toggle-pin") {
      await toggleAdminAnnouncementPin(String(body.id ?? ""), Boolean(body.isPinned))
      revalidatePath("/")
      revalidatePath("/announcements")
      revalidatePath("/admin")
      return NextResponse.json({ code: 0, message: "公告置顶状态已更新" })
    }

    if (action === "update-status") {
      await updateAdminAnnouncementStatus(String(body.id ?? ""), String(body.status ?? "DRAFT"))
      revalidatePath("/")
      revalidatePath("/announcements")
      revalidatePath("/admin")
      return NextResponse.json({ code: 0, message: "公告状态已更新" })
    }

    await saveAdminAnnouncement({
      id: body.id,
      title: body.title,
      content: body.content,
      status: body.status,
      isPinned: body.isPinned,
    })

    revalidatePath("/")
    revalidatePath("/announcements")
    revalidatePath("/admin")
    return NextResponse.json({ code: 0, message: body.id ? "公告已更新" : "公告已创建" })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "公告操作失败" }, { status: 400 })
  }
}
