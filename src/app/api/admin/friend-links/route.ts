import { revalidatePath } from "next/cache"

import { apiSuccess, createAdminRouteHandler, readJsonBody, readOptionalStringField } from "@/lib/api-route"
import { createFriendLinkByAdmin, reviewFriendLink } from "@/lib/friend-links"

export const POST = createAdminRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const action = readOptionalStringField(body, "action")
  const name = readOptionalStringField(body, "name")
  const url = readOptionalStringField(body, "url")
  const logoPath = readOptionalStringField(body, "logoPath") || undefined
  const reviewNote = readOptionalStringField(body, "reviewNote") || undefined
  const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : Number(body.sortOrder ?? 0)

  if (action === "create") {
    await createFriendLinkByAdmin({
      name,
      url,
      logoPath,
      sortOrder,
      reviewNote,
    })

    revalidatePath("/")
    revalidatePath("/link")
    revalidatePath("/admin")
    return apiSuccess(undefined, "友情链接已创建")
  }

  const id = readOptionalStringField(body, "id")
  const reviewAction = action as "approve" | "reject" | "disable" | "update"

  await reviewFriendLink({
    id,
    action: reviewAction,
    reviewNote,
    sortOrder,
    name,
    url,
    logoPath,
  })

  revalidatePath("/")
  revalidatePath("/link")
  revalidatePath("/admin")

  return apiSuccess(undefined, "友情链接状态已更新")
}, {
  errorMessage: "操作失败",
  logPrefix: "[api/admin/friend-links:POST] unexpected error",
  unauthorizedMessage: "无权操作",
})
