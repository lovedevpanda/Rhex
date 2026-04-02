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
  errorMessage: "获取站点文档失败",
  logPrefix: "[api/admin/announcements:GET] unexpected error",
  unauthorizedMessage: "无权访问",
})

export const POST = createAdminRouteHandler(async ({ request }) => {
  const body = await request.json()
  const action = String(body.action ?? "save")

  if (action === "delete") {
    await removeAdminAnnouncement(String(body.id ?? ""))
    revalidatePath("/")
    revalidatePath("/help")
    revalidatePath("/announcements")
    revalidatePath("/admin")
    return apiSuccess(undefined, "站点文档已删除")
  }

  if (action === "toggle-pin") {
    await toggleAdminAnnouncementPin(String(body.id ?? ""), Boolean(body.isPinned))
    revalidatePath("/")
    revalidatePath("/help")
    revalidatePath("/announcements")
    revalidatePath("/admin")
    return apiSuccess(undefined, "置顶状态已更新")
  }

  if (action === "update-status") {
    await updateAdminAnnouncementStatus(String(body.id ?? ""), String(body.status ?? "DRAFT"))
    revalidatePath("/")
    revalidatePath("/help")
    revalidatePath("/announcements")
    revalidatePath("/admin")
    return apiSuccess(undefined, "站点文档状态已更新")
  }

  await saveAdminAnnouncement({
    id: body.id,
    type: body.type,
    title: body.title,
    content: body.content,
    sourceType: body.sourceType,
    slug: body.slug,
    linkUrl: body.linkUrl,
    titleColor: body.titleColor,
    titleBold: body.titleBold,
    status: body.status,
    isPinned: body.isPinned,
  })

  revalidatePath("/")
  revalidatePath("/help")
  revalidatePath("/announcements")
  revalidatePath("/admin")
  return apiSuccess(undefined, body.id ? "站点文档已更新" : "站点文档已创建")
}, {
  errorMessage: "站点文档操作失败",
  logPrefix: "[api/admin/announcements:POST] unexpected error",
  unauthorizedMessage: "无权操作",
})
