import bcrypt from "bcryptjs"

import { prisma } from "@/db/client"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { logRouteWriteSuccess } from "@/lib/route-metadata"


export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const currentPassword = requireStringField(body, "currentPassword", "缺少必要参数")
  const newPassword = requireStringField(body, "newPassword", "缺少必要参数")


  if (!currentPassword || !newPassword) {
    apiError(400, "缺少必要参数")
  }

  if (newPassword.length < 6 || newPassword.length > 64) {
    apiError(400, "新密码长度需为 6-64 位")
  }

  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: {
      id: true,
      passwordHash: true,
    },
  })

  if (!user) {
    apiError(404, "用户不存在")
  }

  const matched = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!matched) {
    apiError(400, "当前密码不正确")
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })

  logRouteWriteSuccess({
    scope: "profile-password",
    action: "update-password",
  }, {
    userId: currentUser.id,
    targetId: String(currentUser.id),
  })

  return apiSuccess(undefined, "密码已更新")

}, {
  errorMessage: "修改密码失败",
  logPrefix: "[api/profile/password] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
