import { toggleFollowTarget } from "@/db/follow-queries"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { enqueueUserFollowedNotification } from "@/lib/follow-notifications"
import { getFollowTargetCopy, normalizeFollowTargetType } from "@/lib/follows"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { ensureUsersCanInteract } from "@/lib/user-blocks"
import { getUserDisplayName } from "@/lib/users"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const rawTargetType = requireStringField(body, "targetType", "缺少关注类型")
  const targetId = requireStringField(body, "targetId", "缺少关注目标")
  const targetType = normalizeFollowTargetType(rawTargetType)
  const desiredFollowed = typeof body.desiredFollowed === "boolean" ? body.desiredFollowed : undefined

  if (!targetType) {
    apiError(400, "不支持的关注类型")
  }

  const targetCopy = getFollowTargetCopy(targetType)

  const targetUserId = Number(targetId)

  if (targetType === "user" && Number.isInteger(targetUserId) && targetUserId > 0) {
    await ensureUsersCanInteract({
      actorId: currentUser.id,
      targetUserId,
      blockedMessage: "你已拉黑该用户，无法继续关注",
      blockedByMessage: "对方已将你拉黑，无法关注",
    })
  }

  const result = await toggleFollowTarget({
    userId: currentUser.id,
    targetType,
    targetId,
    desiredFollowed,
  })

  if (result.status === "invalid") {
    apiError(400, "关注目标不合法")
  }

  if (result.status === "self") {
    apiError(400, targetType === "user" ? "不能关注自己" : `不能关注自己的${targetCopy.noun}`)
  }

  if (result.status === "missing") {
    apiError(404, `${targetCopy.noun}不存在`)
  }

  if (targetType === "user" && result.followed && result.changed) {
    await enqueueUserFollowedNotification({
      userId: Number(targetId),
      followerUserId: currentUser.id,
      followerName: getUserDisplayName(currentUser),
    })
  }

  if (targetType === "user" && result.changed) {
    revalidateUserSurfaceCache(Number(targetId))
  }

  if (targetType === "user") {
    const requestUrl = new URL(request.url)
    await executeAddonActionHook("user.follow.toggle.after", {
      followerId: currentUser.id,
      followeeId: String(targetId),
      following: result.followed,
    }, { request, pathname: requestUrl.pathname, searchParams: requestUrl.searchParams })
  }

  return apiSuccess(
    { followed: result.followed, changed: result.changed },
    result.followed ? `${targetCopy.followAction}成功` : `已${targetCopy.unfollowAction}`,
  )
}, {
  errorMessage: "关注操作失败",
  logPrefix: "[api/follows/toggle] unexpected error",
  unauthorizedMessage: "请先登录后再关注",
  allowStatuses: ["ACTIVE", "MUTED"],
})
