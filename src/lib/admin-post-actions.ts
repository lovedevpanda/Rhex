import { BoardStatus, PostStatus } from "@/db/types"

import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
import type { AddonReadablePostStatus } from "@/addons-host/types"
import { apiError } from "@/lib/api-route"
import {
  defineAdminAction,
  readAdminActionScope,
  requireAdminActionString,
  writeAdminActionLog,
  type AdminActionDefinition,
} from "@/lib/admin-action-types"
import {
  findPostMoveBoardContext,
  movePostToBoard,
  updatePostFeatureState,
  updatePostPinState,
  updatePostStatus,
} from "@/db/admin-post-action-queries"
import { revalidateHomeSidebarStatsCache } from "@/lib/home-sidebar-stats"
import { ensureCanManageBoard, ensureCanManagePost, getAvailablePinScopes } from "@/lib/moderator-permissions"
import { createSystemNotification } from "@/lib/notification-writes"
import { activatePostAuctionForPost } from "@/lib/post-auctions"
import { expireTaxonomyCacheImmediately } from "@/lib/taxonomy-cache"

export const adminPostActionHandlers: Record<string, AdminActionDefinition> = {
  "post.feature": defineAdminAction({ targetType: "POST", revalidatePaths: ["/", "/admin"], buildDetail: () => "管理员切换推荐状态" }, async (context) => {
    const post = await ensureCanManagePost(context.actor, context.targetId)
    await updatePostFeatureState(context.targetId, !post.isFeatured)
    await writeAdminActionLog(context, adminPostActionHandlers["post.feature"].metadata)
    return { message: post.isFeatured ? "已取消推荐" : "已设为推荐" }
  }),
  "post.pin": defineAdminAction({ targetType: "POST", revalidatePaths: ["/", "/admin"], buildDetail: (context) => `管理员设置帖子置顶范围为 ${readAdminActionScope(context.body)}` }, async (context) => {
    const normalizedScope = readAdminActionScope(context.body)
    const post = await ensureCanManagePost(context.actor, context.targetId)
    const allowedScopes = getAvailablePinScopes(context.actor, {
      zoneId: post.board.zoneId,
      currentPinScope: post.pinScope,
    })
    if (!allowedScopes.includes(normalizedScope)) {
      apiError(403, normalizedScope === "GLOBAL" ? "版主不能设置或取消全局置顶" : "无权设置该置顶范围")
    }
    const nextPinned = normalizedScope !== "NONE"
    await updatePostPinState(context.targetId, nextPinned, normalizedScope)
    await writeAdminActionLog(context, adminPostActionHandlers["post.pin"].metadata)
    const scopeLabel = normalizedScope === "GLOBAL" ? "全局置顶" : normalizedScope === "ZONE" ? "分区置顶" : normalizedScope === "BOARD" ? "节点置顶" : "取消置顶"
    return { message: scopeLabel }
  }),
  "post.hide": defineAdminAction({ targetType: "POST", revalidatePaths: ["/", "/admin"], buildDetail: () => "管理员下线帖子" }, async (context) => {
    const post = await ensureCanManagePost(context.actor, context.targetId)
    const previousStatus = post.status as AddonReadablePostStatus
    await updatePostStatus(context.targetId, PostStatus.OFFLINE)
    revalidateHomeSidebarStatsCache()
    expireTaxonomyCacheImmediately()
    await executeAddonActionHook("post.status.changed.after", {
      postId: context.targetId,
      editorId: String(context.adminUserId),
      previousStatus,
      nextStatus: "OFFLINE",
    })
    await writeAdminActionLog(context, adminPostActionHandlers["post.hide"].metadata)
    return { message: "帖子已下线" }
  }),
  "post.show": defineAdminAction({ targetType: "POST", revalidatePaths: ["/", "/admin"], buildDetail: () => "管理员上线帖子" }, async (context) => {
    const post = await ensureCanManagePost(context.actor, context.targetId)
    const previousStatus = post.status as AddonReadablePostStatus
    await updatePostStatus(context.targetId, PostStatus.NORMAL, null)
    if (post.type === "AUCTION") {
      await activatePostAuctionForPost(post.id)
    }
    revalidateHomeSidebarStatsCache()
    expireTaxonomyCacheImmediately()
    await executeAddonActionHook("post.status.changed.after", {
      postId: context.targetId,
      editorId: String(context.adminUserId),
      previousStatus,
      nextStatus: "NORMAL",
    })

    await writeAdminActionLog(context, adminPostActionHandlers["post.show"].metadata)
    return { message: "帖子已上线" }
  }),
  "post.moveBoard": defineAdminAction({ targetType: "POST", buildDetail: () => "管理员移动帖子节点" }, async (context) => {
    const boardSlug = requireAdminActionString(context.body, "boardSlug", "缺少目标节点")
    const [post, targetBoard] = await Promise.all([
      ensureCanManagePost(context.actor, context.targetId),
      findPostMoveBoardContext(context.targetId, boardSlug).then(([, board]) => board),
    ])
    if (!targetBoard || targetBoard.status !== BoardStatus.ACTIVE) apiError(404, "目标节点不存在或不可用")
    await ensureCanManageBoard(context.actor, targetBoard.id)
    if (post.boardId === targetBoard.id) apiError(400, "帖子已在当前节点，无需移动")
    await movePostToBoard(context.targetId, targetBoard.id)
    expireTaxonomyCacheImmediately()
    await writeAdminActionLog(context, adminPostActionHandlers["post.moveBoard"].metadata)
    const postId = context.targetId

    return {
      message: `帖子已移动到 ${targetBoard.name}`,
      data: { id: postId, slug: post.slug, boardSlug: targetBoard.slug },
      revalidatePaths: [`/posts/${post.slug}`, `/posts/${postId}`, `/boards/${post.board.slug}`, `/boards/${targetBoard.slug}`, "/", "/admin"],
    }


  }),
  "post.approve": defineAdminAction({ targetType: "POST", revalidatePaths: ["/", "/admin"], buildDetail: () => "管理员审核通过帖子" }, async (context) => {
    const post = await ensureCanManagePost(context.actor, context.targetId)
    const previousStatus = post.status as AddonReadablePostStatus
    await updatePostStatus(context.targetId, PostStatus.NORMAL, context.message || null, new Date())
    if (post.type === "AUCTION") {
      await activatePostAuctionForPost(post.id)
    }
    revalidateHomeSidebarStatsCache()
    expireTaxonomyCacheImmediately()
    await executeAddonActionHook("post.status.changed.after", {
      postId: context.targetId,
      editorId: String(context.adminUserId),
      previousStatus,
      nextStatus: "NORMAL",
    })

    if (post.authorId !== context.adminUserId) {
      void createSystemNotification({
        userId: post.authorId,
        senderId: context.adminUserId,
        relatedType: "POST",
        relatedId: post.id,
        title: "帖子审核已通过",
        content: `你发布的帖子《${post.title}》已通过审核，现已公开展示。${context.message ? ` 审核备注：${context.message}` : ""}`,
      }).catch((error) => {
        console.warn("[admin-post-actions] failed to notify post approval", error)
      })
    }

    await writeAdminActionLog(context, adminPostActionHandlers["post.approve"].metadata)
    return { message: "帖子已审核通过" }
  }),
  "post.reject": defineAdminAction({ targetType: "POST", revalidatePaths: ["/", "/admin"], buildDetail: () => "管理员驳回帖子审核" }, async (context) => {
    const post = await ensureCanManagePost(context.actor, context.targetId)
    const previousStatus = post.status as AddonReadablePostStatus
    await updatePostStatus(context.targetId, PostStatus.OFFLINE, context.message || "审核未通过")
    revalidateHomeSidebarStatsCache()
    expireTaxonomyCacheImmediately()
    await executeAddonActionHook("post.status.changed.after", {
      postId: context.targetId,
      editorId: String(context.adminUserId),
      previousStatus,
      nextStatus: "OFFLINE",
    })

    if (post.authorId !== context.adminUserId) {
      void createSystemNotification({
        userId: post.authorId,
        senderId: context.adminUserId,
        relatedType: "POST",
        relatedId: post.id,
        title: "帖子审核未通过",
        content: `你发布的帖子《${post.title}》未通过审核，当前不会公开展示。${context.message ? ` 驳回原因：${context.message}` : " 请根据内容规范调整后再发布。"}`,
      }).catch((error) => {
        console.warn("[admin-post-actions] failed to notify post rejection", error)
      })
    }

    await writeAdminActionLog(context, adminPostActionHandlers["post.reject"].metadata)
    return { message: "帖子已驳回并下线" }
  }),
}
