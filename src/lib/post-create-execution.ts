import type { CurrentUserRecord } from "@/db/current-user"

import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
// Side-effect import：将 AI capability 注入 globalThis symbol，使 ai-reply addon
// （ESM 沙盒）在 post.create.after hook 派发前可通过 bridge 调用 runAutoCategorize。
// 变更此路径前请同步更新 addons/ai-reply/dist/server.mjs 中的 symbol 约定（v1）。
import "@/lib/ai/capabilities/bridge"
import { triggerAiMention } from "@/lib/ai/mention-trigger"
import { apiError } from "@/lib/api-route"
import { revalidateContentListCaches } from "@/lib/content-list-cache"
import { enqueueNewPostFollowNotifications } from "@/lib/follow-notifications"
import { revalidateHomeSidebarStatsCache } from "@/lib/home-sidebar-stats"
import { enqueueEvaluateUserLevelProgress } from "@/lib/level-system"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { recordApprovedPostTaskEvent } from "@/lib/task-center-service"
import { expireTaxonomyCacheImmediately } from "@/lib/taxonomy-cache"
import { createPostFlow, type PostCreateStatusMode } from "@/lib/post-create-service"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { getCurrentUserRecord } from "@/db/current-user"

interface ExecutePostCreationOptions {
  request: Request
  author?: CurrentUserRecord | null
  statusMode?: PostCreateStatusMode
  log?: {
    scope: string
    action: string
    extra?: Record<string, unknown>
  }
}

async function resolvePostAuthor(author?: CurrentUserRecord | null) {
  if (author) {
    return author
  }

  const currentUser = await getCurrentUserRecord()
  if (!currentUser) {
    apiError(401, "请先登录后再发帖")
  }

  return currentUser
}

function assertPostAuthorStatus(author: CurrentUserRecord) {
  if (author.status === "ACTIVE") {
    return
  }

  if (author.status === "MUTED") {
    apiError(403, "当前账号已被禁言，暂不可发帖")
  }

  if (author.status === "BANNED") {
    apiError(403, "当前账号已被拉黑，无法发帖")
  }

  apiError(403, "当前账号状态不可执行该操作")
}

export async function executePostCreation(body: unknown, options: ExecutePostCreationOptions) {
  const author = await resolvePostAuthor(options.author)
  assertPostAuthorStatus(author)

  const requestUrl = new URL(options.request.url)

  await executeAddonActionHook("post.create.before", {
    authorId: author.id,
    authorUsername: author.username,
    body,
  }, {
    request: options.request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
    throwOnError: true,
  })

  const result = await createPostFlow(body, {
    request: options.request,
    author,
    statusMode: options.statusMode,
  })

  if (options.log) {
    logRouteWriteSuccess({
      scope: options.log.scope,
      action: options.log.action,
    }, {
      userId: result.author.id,
      targetId: result.post.id,
      extra: {
        slug: result.post.slug,
        status: result.post.status,
        reviewRequired: result.shouldPending,
        contentAdjusted: result.contentAdjusted,
        ...(options.log.extra ?? {}),
      },
    })
  }

  revalidateUserSurfaceCache(result.author.id)
  if (!result.shouldPending) {
    revalidateContentListCaches()
    revalidateHomeSidebarStatsCache()
    expireTaxonomyCacheImmediately()
    void recordApprovedPostTaskEvent({
      type: "APPROVED_POST",
      userId: result.author.id,
      postId: result.post.id,
      boardId: result.post.boardId,
      postType: result.post.type,
    }).catch((error) => {
      console.warn("[post-create-execution] failed to record task progress", error)
    })
  }

  void enqueueEvaluateUserLevelProgress(result.author.id, { notifyOnUpgrade: true })

  if (!result.shouldPending) {
    void enqueueNewPostFollowNotifications(result.post.id)
    void triggerAiMention({
      kind: "post",
      postId: result.post.id,
      triggerUserId: result.author.id,
      mentionedUserIds: result.mentionUserIds,
    })
  }

  // auto-categorize 已迁移至 addons/ai-reply 的 post.create.after action hook；
  // 主工程保留 capability bridge 以供 addon runtime 调用（见 @/lib/ai/capabilities/bridge）。
  await executeAddonActionHook("post.create.after", {
    postId: result.post.id,
    boardId: result.post.boardId,
    authorId: result.author.id,
    postType: result.post.type,
    status: result.post.status,
  }, {
    request: options.request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
  })

  return result
}
