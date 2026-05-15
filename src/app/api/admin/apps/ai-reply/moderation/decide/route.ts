import {
  apiError,
  apiSuccess,
  createAdminRouteHandler,
  readJsonBody,
  requireStringField,
  type JsonObject,
} from "@/lib/api-route"
import { prisma } from "@/db/client"
import type { Prisma } from "@/db/types"
import { revalidateHomeSidebarStatsCache } from "@/lib/home-sidebar-stats"
import { revalidatePostDetailCache } from "@/lib/post-detail-cache"
import { expireTaxonomyCacheImmediately } from "@/lib/taxonomy-cache"

const moderationSuggestionDecisionSelect = {
  id: true,
  status: true,
  postId: true,
  suggestedBoardId: true,
  suggestedTagIds: true,
  suggestedTagsJson: true,
} satisfies Prisma.AiModerationSuggestionSelect

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = (await readJsonBody(request)) as JsonObject
  const id = requireStringField(body, "id", "缺少建议 ID")
  const actionRaw = requireStringField(body, "action", "缺少操作类型")
  const action = actionRaw.toLowerCase()

  if (action !== "approve" && action !== "reject") {
    return apiError(400, "操作类型不合法，仅支持 approve 或 reject")
  }

  const suggestion = await prisma.aiModerationSuggestion.findUnique({
    where: { id },
    select: moderationSuggestionDecisionSelect,
  })

  if (!suggestion) {
    return apiError(404, "审核建议不存在")
  }

  if (suggestion.status !== "PENDING") {
    return apiError(409, "该建议已被处理")
  }

  const now = new Date()

  if (action === "reject") {
    await prisma.aiModerationSuggestion.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewerId: adminUser.id,
        decidedAt: now,
      },
    })
    return apiSuccess({ id, status: "REJECTED" }, "已驳回该建议")
  }

  // approve：事务更新 Post.boardId + PostTag 关联 + suggestion 状态
  const { suggestedBoardId, suggestedTagIds, postId } = suggestion

  // 校验目标 Board 仍存在且 ACTIVE
  if (suggestedBoardId) {
    const board = await prisma.board.findUnique({
      where: { id: suggestedBoardId },
      select: { id: true, status: true },
    })
    if (!board || board.status !== "ACTIVE") {
      return apiError(409, "建议的板块已失效，无法采纳")
    }
  }

  const suggestedTags = Array.isArray(suggestion.suggestedTagsJson) && suggestion.suggestedTagsJson.length > 0
    ? suggestion.suggestedTagsJson
      .map((entry: unknown) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          return null
        }
        const record = entry as Record<string, unknown>
        const slug = typeof record.slug === "string" ? record.slug.trim() : ""
        const name = typeof record.name === "string" ? record.name.trim() : ""
        if (!slug || !name) {
          return null
        }
        return { slug, name }
      })
      .filter((tag: { slug: string; name: string } | null): tag is { slug: string; name: string } => Boolean(tag))
    : (
      suggestedTagIds.length > 0
        ? await prisma.tag.findMany({
          where: { id: { in: suggestedTagIds } },
          select: { slug: true, name: true },
        })
        : []
    )

  await prisma.$transaction(async (tx) => {
    const existingRelations = await tx.postTag.findMany({
      where: { postId },
      select: { tagId: true },
    })

    if (suggestedBoardId) {
      await tx.post.update({
        where: { id: postId },
        data: { boardId: suggestedBoardId },
      })
    }

    if (suggestedTags.length > 0) {
      const syncedTags = await Promise.all(
        suggestedTags.map((tag: { slug: string; name: string }) => tx.tag.upsert({
          where: { slug: tag.slug },
          update: {
            name: tag.name,
          },
          create: {
            slug: tag.slug,
            name: tag.name,
          },
        })),
      )

      await tx.postTag.deleteMany({ where: { postId } })
      await tx.postTag.createMany({
        data: syncedTags.map((tag) => ({ postId, tagId: tag.id })),
        skipDuplicates: true,
      })

      const affectedTagIds = [...new Set([
        ...existingRelations.map((relation) => relation.tagId),
        ...syncedTags.map((tag: { id: string }) => tag.id),
      ])]
      const counts = await Promise.all(
        affectedTagIds.map((tagId: string) => tx.postTag.count({
          where: { tagId },
        })),
      )
      await Promise.all(
        affectedTagIds.map((tagId: string, index: number) => tx.tag.update({
          where: { id: tagId },
          data: {
            postCount: counts[index] ?? 0,
          },
        })),
      )
    }

    await tx.aiModerationSuggestion.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewerId: adminUser.id,
        decidedAt: now,
      },
    })
  })

  revalidateHomeSidebarStatsCache()
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, slug: true },
  })
  revalidatePostDetailCache({ postId, slug: post?.slug })
  expireTaxonomyCacheImmediately()

  return apiSuccess({ id, status: "APPROVED" }, "已采纳该建议并应用到帖子")
}, {
  errorMessage: "处理审核建议失败",
  logPrefix: "[api/admin/apps/ai-reply/moderation/decide:POST] unexpected error",
  unauthorizedMessage: "无权操作",
})
