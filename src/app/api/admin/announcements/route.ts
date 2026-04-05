import { revalidatePath } from "next/cache"

import { apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
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
  const body = await readJsonBody(request)
  const action = String(body.action ?? "save")
  const input = {
    id: typeof body.id === "string" ? body.id : undefined,
    type: typeof body.type === "string" ? body.type : undefined,
    title: typeof body.title === "string" ? body.title : "",
    content: typeof body.content === "string" ? body.content : undefined,
    sourceType: typeof body.sourceType === "string" ? body.sourceType : undefined,
    slug: typeof body.slug === "string" ? body.slug : undefined,
    linkUrl: typeof body.linkUrl === "string" ? body.linkUrl : undefined,
    titleColor: typeof body.titleColor === "string" ? body.titleColor : undefined,
    titleBold: typeof body.titleBold === "boolean" ? body.titleBold : undefined,
    status: typeof body.status === "string" ? body.status : "DRAFT",
    isPinned: typeof body.isPinned === "boolean" ? body.isPinned : undefined,
  }

  if (action === "delete") {
    await removeAdminAnnouncement(String(input.id ?? ""))
    revalidatePath("/")
    revalidatePath("/help")
    revalidatePath("/announcements")
    revalidatePath("/admin")
    return apiSuccess(undefined, "站点文档已删除")
  }

  if (action === "toggle-pin") {
    await toggleAdminAnnouncementPin(String(input.id ?? ""), Boolean(input.isPinned))
    revalidatePath("/")
    revalidatePath("/help")
    revalidatePath("/announcements")
    revalidatePath("/admin")
    return apiSuccess(undefined, "置顶状态已更新")
  }

  if (action === "update-status") {
    await updateAdminAnnouncementStatus(String(input.id ?? ""), input.status)
    revalidatePath("/")
    revalidatePath("/help")
    revalidatePath("/announcements")
    revalidatePath("/admin")
    return apiSuccess(undefined, "站点文档状态已更新")
  }

  await saveAdminAnnouncement(input)

  revalidatePath("/")
  revalidatePath("/help")
  revalidatePath("/announcements")
  revalidatePath("/admin")
  return apiSuccess(undefined, input.id ? "站点文档已更新" : "站点文档已创建")
}, {
  errorMessage: "站点文档操作失败",
  logPrefix: "[api/admin/announcements:POST] unexpected error",
  unauthorizedMessage: "无权操作",
})
