import { revalidatePath } from "next/cache"

import { apiSuccess, createAdminRouteHandler } from "@/lib/api-route"
import {
  getAdminAnnouncementList,
  removeAdminAnnouncement,
  saveAdminAnnouncement,
  toggleAdminAnnouncementPin,
  updateAdminAnnouncementStatus,
} from "@/lib/admin-announcements"

export const GET = createAdminRouteHandler(async () => {
  const items = await getAdminAnnouncementList()
  return apiSuccess(items)
}, {
  errorMessage: "获取公告失败",
  logPrefix: "[api/admin/announcements:GET] unexpected error",
  unauthorizedMessage: "无权访问",
})

export const POST = createAdminRouteHandler(async ({ request }) => {
  const body = await request.json()
  const action = String(body.action ?? "save")

  if (action === "delete") {
    await removeAdminAnnouncement(String(body.id ?? ""))
    revalidatePath("/")
    revalidatePath("/announcements")
    revalidatePath("/admin")
    return apiSuccess(undefined, "公告已删除")
  }

  if (action === "toggle-pin") {
    await toggleAdminAnnouncementPin(String(body.id ?? ""), Boolean(body.isPinned))
    revalidatePath("/")
    revalidatePath("/announcements")
    revalidatePath("/admin")
    return apiSuccess(undefined, "公告置顶状态已更新")
  }

  if (action === "update-status") {
    await updateAdminAnnouncementStatus(String(body.id ?? ""), String(body.status ?? "DRAFT"))
    revalidatePath("/")
    revalidatePath("/announcements")
    revalidatePath("/admin")
    return apiSuccess(undefined, "公告状态已更新")
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
  return apiSuccess(undefined, body.id ? "公告已更新" : "公告已创建")
}, {
  errorMessage: "公告操作失败",
  logPrefix: "[api/admin/announcements:POST] unexpected error",
  unauthorizedMessage: "无权操作",
})
