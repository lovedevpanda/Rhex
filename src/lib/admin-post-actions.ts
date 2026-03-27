import { BoardStatus, PostStatus } from "@/db/types"

import { apiError } from "@/lib/api-route"
import { prisma } from "@/db/client"
import {
  defineAdminAction,
  readAdminActionScope,
  requireAdminActionString,
  writeAdminActionLog,
  type AdminActionDefinition,
} from "@/lib/admin-action-types"

export const adminPostActionHandlers: Record<string, AdminActionDefinition> = {
  "post.feature": defineAdminAction({ targetType: "POST", revalidatePaths: ["/", "/admin"], buildDetail: () => "管理员切换推荐状态" }, async (context) => {
    const post = await prisma.post.findUnique({ where: { id: context.targetId }, select: { isFeatured: true } })
    if (!post) apiError(404, "帖子不存在")
    await prisma.post.update({ where: { id: context.targetId }, data: { isFeatured: !post.isFeatured } })
    await writeAdminActionLog(context, adminPostActionHandlers["post.feature"].metadata)
    return { message: post.isFeatured ? "已取消推荐" : "已设为推荐" }
  }),
  "post.pin": defineAdminAction({ targetType: "POST", revalidatePaths: ["/", "/admin"], buildDetail: (context) => `管理员设置帖子置顶范围为 ${readAdminActionScope(context.body)}` }, async (context) => {
    const normalizedScope = readAdminActionScope(context.body)
    const post = await prisma.post.findUnique({ where: { id: context.targetId }, select: { isPinned: true } })
    if (!post) apiError(404, "帖子不存在")
    const nextPinned = normalizedScope !== "NONE"
    await prisma.post.update({ where: { id: context.targetId }, data: { isPinned: nextPinned, pinScope: normalizedScope } })
    await writeAdminActionLog(context, adminPostActionHandlers["post.pin"].metadata)
    const scopeLabel = normalizedScope === "GLOBAL" ? "全局置顶" : normalizedScope === "ZONE" ? "分区置顶" : normalizedScope === "BOARD" ? "节点置顶" : "取消置顶"
    return { message: scopeLabel }
  }),
  "post.hide": defineAdminAction({ targetType: "POST", revalidatePaths: ["/", "/admin"], buildDetail: () => "管理员下线帖子" }, async (context) => {
    await prisma.post.update({ where: { id: context.targetId }, data: { status: PostStatus.OFFLINE } })
    await writeAdminActionLog(context, adminPostActionHandlers["post.hide"].metadata)
    return { message: "帖子已下线" }
  }),
  "post.show": defineAdminAction({ targetType: "POST", revalidatePaths: ["/", "/admin"], buildDetail: () => "管理员上线帖子" }, async (context) => {
    await prisma.post.update({ where: { id: context.targetId }, data: { status: PostStatus.NORMAL, reviewNote: null } })
    await writeAdminActionLog(context, adminPostActionHandlers["post.show"].metadata)
    return { message: "帖子已上线" }
  }),
  "post.moveBoard": defineAdminAction({ targetType: "POST", buildDetail: () => "管理员移动帖子节点" }, async (context) => {
    const boardSlug = requireAdminActionString(context.body, "boardSlug", "缺少目标节点")
    const [post, targetBoard] = await Promise.all([
      prisma.post.findUnique({ where: { id: context.targetId }, select: { slug: true, boardId: true, board: { select: { slug: true, name: true } } } }),
      prisma.board.findUnique({ where: { slug: boardSlug }, select: { id: true, slug: true, name: true, status: true } }),
    ])
    if (!post) apiError(404, "帖子不存在")
    if (!targetBoard || targetBoard.status !== BoardStatus.ACTIVE) apiError(404, "目标节点不存在或不可用")
    if (post.boardId === targetBoard.id) apiError(400, "帖子已在当前节点，无需移动")
    await prisma.post.update({ where: { id: context.targetId }, data: { boardId: targetBoard.id } })
    await writeAdminActionLog(context, adminPostActionHandlers["post.moveBoard"].metadata)
    return {
      message: `帖子已移动到 ${targetBoard.name}`,
      data: { slug: post.slug, boardSlug: targetBoard.slug },
      revalidatePaths: [`/posts/${post.slug}`, `/boards/${post.board.slug}`, `/boards/${targetBoard.slug}`, "/", "/admin"],
    }
  }),
  "post.approve": defineAdminAction({ targetType: "POST", revalidatePaths: ["/", "/admin"], buildDetail: () => "管理员审核通过帖子" }, async (context) => {
    await prisma.post.update({ where: { id: context.targetId }, data: { status: PostStatus.NORMAL, publishedAt: new Date(), reviewNote: context.message || null } })
    await writeAdminActionLog(context, adminPostActionHandlers["post.approve"].metadata)
    return { message: "帖子已审核通过" }
  }),
  "post.reject": defineAdminAction({ targetType: "POST", revalidatePaths: ["/", "/admin"], buildDetail: () => "管理员驳回帖子审核" }, async (context) => {
    await prisma.post.update({ where: { id: context.targetId }, data: { status: PostStatus.OFFLINE, reviewNote: context.message || "审核未通过" } })
    await writeAdminActionLog(context, adminPostActionHandlers["post.reject"].metadata)
    return { message: "帖子已驳回并下线" }
  }),
}
