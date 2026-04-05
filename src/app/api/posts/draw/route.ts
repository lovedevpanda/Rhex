import { prisma } from "@/db/client"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { drawLotteryWinners } from "@/lib/lottery"
import { canManageBoard, resolveAdminActorFromSessionUser } from "@/lib/moderator-permissions"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const postId = requireStringField(body, "postId", "缺少帖子参数")

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      type: true,
      boardId: true,
      board: {
        select: {
          zoneId: true,
        },
      },
    },
  })

  if (!post || post.type !== "LOTTERY") {
    apiError(404, "抽奖帖不存在")
  }

  const adminActor = await resolveAdminActorFromSessionUser(currentUser)
  const canManageAsAdmin = adminActor && (adminActor.role === "ADMIN" || canManageBoard(adminActor, post.boardId, post.board.zoneId))
  if (!canManageAsAdmin && post.authorId !== currentUser.id) {
    apiError(403, "仅楼主或管理员可开奖")
  }

  const result = await drawLotteryWinners(postId, { actorId: currentUser.id })
  return apiSuccess(result, "开奖成功")
}, {
  errorMessage: "开奖失败",
  logPrefix: "[api/posts/draw] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})

