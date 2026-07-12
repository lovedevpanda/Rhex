import type { Metadata } from "next"
import Link from "next/link"
import { MessageCircle } from "lucide-react"
import { cookies } from "next/headers"
import Script from "next/script"
import { notFound } from "next/navigation"


import { AccessDeniedCard } from "@/components/access-denied-card"
import { CommentReplyToggleButton } from "@/components/comment/comment-reply-toggle-button"
import { CommentThread } from "@/components/comment/comment-thread"
import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { MarkdownContent } from "@/components/markdown-content"
import { PostAppendixTimeline } from "@/components/post/post-appendix-timeline"
import { PostAttachmentList } from "@/components/post/post-attachment-list"
import { PostAuctionPanel } from "@/components/post/post-auction-panel"
import { PostBodyCopyMenu } from "@/components/post/post-body-copy-menu"
import { PostDetailHeader } from "@/components/post/post-detail-header"

import { PostAdminPanel } from "@/components/admin/post-admin-panel"
import { PostEditPanel } from "@/components/post/post-edit-panel"
import { PostEngagementBar } from "@/components/post/post-engagement-bar"
import { PostRewardPoolHighlightBar } from "@/components/post/post-reward-pool-highlight-bar"
import { PostReadingHistoryRecorder } from "@/components/post/post-reading-history-recorder"
import { PostSidebarPanels } from "@/components/post/post-sidebar-panels"
import { RestrictedPostBlock } from "@/components/post/restricted-post-block"
import { BountyPanel, LotteryPanel, PollPanel } from "@/components/post/post-type-panels"

import { SiteHeader } from "@/components/site-header"

import { getAiAgentUserIds } from "@/lib/ai-agent"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/rbutton"
import { getCurrentUser } from "@/lib/auth"
import { buildLoginHrefWithRedirect } from "@/lib/auth-redirect"
import { PinScope } from "@/db/types"
import { checkBoardPermission, getBoardAccessContextByPostId } from "@/lib/board-access"
import { getBoards } from "@/lib/boards"
import { getCommentsByPostId, getUserReplyCountByPost } from "@/lib/comments"
import { isUserFollowingTarget } from "@/lib/follows"
import { resolveSidebarUser } from "@/lib/home-sidebar"
import { checkPostAccessPermission, mergeAccessPermissions, resolvePostAccessRequirements } from "@/lib/post-access"
import { renderCachedPostContentHtml } from "@/lib/post-detail-cache"
import { getPostDetailBySlug, getPostSeoBySlug, incrementPostViewCount } from "@/lib/posts"

import { getPostSidebarData } from "@/lib/post-sidebar"
import { getPostRedPacketSummary } from "@/lib/post-red-packets"
import { canUseAnonymousIdentityForPostReply, getAnonymousMaskDisplayIdentity } from "@/lib/post-anonymous"
import { isImageOnlyMarkdown } from "@/lib/markdown/render"
import { normalizeRenderedMarkdownHtmlHeadings } from "@/lib/markdown/toc"
import { getPostTipSummary } from "@/lib/post-tips"
import { getPostOfflineActionMeta } from "@/lib/post-offline"
import { getPostAuctionSummary } from "@/lib/post-auctions"
import { getPurchasedPostAttachmentIds, resolveAttachmentViewerState } from "@/lib/post-attachments"
import { resolvePostEditWindowMinutes } from "@/lib/post-edit-window"
import { isPostOpenForReplies, isPublicReadablePostStatus } from "@/lib/post-types"

import { getPurchasedPostBlockBuyerCounts, getPurchasedPostBlockIds } from "@/lib/post-unlock"

import { buildArticleJsonLd, buildMetadataKeywords } from "@/lib/seo"
import { readSearchParam } from "@/lib/search-params"
import { getSiteSettings } from "@/lib/site-settings"
import { BROWSING_PREFERENCES_COOKIE_NAME, resolveBrowsingPreferencesSnapshot } from "@/lib/browsing-preferences"
import { toAbsoluteSiteUrl } from "@/lib/site-origin"

import { getZones } from "@/lib/zones"
import { getCanonicalPostPath } from "@/lib/post-links"
import { canAdminActorManageBoardWithPermission } from "@/lib/admin-scope-permissions"
import { getAvailablePinScopes, resolveAdminActorFromSessionUser } from "@/lib/moderator-permissions"
import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { formatCompactNumber, formatNumber } from "@/lib/formatters"

interface AdminBoardOptionGroup {
  zone: string
  items: Array<{
    value: string
    label: string
  }>
}

function buildUrlSearchParams(
  input?: Record<string, string | string[] | undefined>,
) {
  const searchParams = new URLSearchParams()

  if (!input) {
    return searchParams
  }

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      searchParams.set(key, value)
      continue
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, item)
      }
    }
  }

  return searchParams
}

export async function generateMetadata(props: PageProps<"/posts/[slug]">): Promise<Metadata> {
  const params = await props.params;
  const [post, settings] = await Promise.all([getPostSeoBySlug(params.slug), getSiteSettings()])

  if (!post) {
    return {
      title: `帖子不存在 - ${settings.siteName}`,
    }
  }

  const canonicalPath = getCanonicalPostPath(post, { mode: settings.postLinkDisplayMode })

  return {
    title: `${post.title} - ${settings.siteName}`,
    description: post.description,
    keywords: buildMetadataKeywords(settings.siteSeoKeywords, [post.title, post.slug, post.description, "帖子", "论坛帖子"]),
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      url: canonicalPath,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  }
}



export default async function PostPage(props: PageProps<"/posts/[slug]">) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const browsingPreferences = resolveBrowsingPreferencesSnapshot((await cookies()).get(BROWSING_PREFERENCES_COOKIE_NAME)?.value)
  const requestedCommentSort = readSearchParam(searchParams?.sort)
  const currentSort = requestedCommentSort === "newest"
    ? "newest"
    : requestedCommentSort === "oldest"
      ? "oldest"
      : browsingPreferences.commentThreadSort
  const requestedCommentView = readSearchParam(searchParams?.view)
  const currentCommentView = requestedCommentView === "flat"
    ? "flat"
    : requestedCommentView === "tree"
      ? "tree"
      : browsingPreferences.commentThreadDisplayMode
  const currentPage = Math.max(1, Number(readSearchParam(searchParams?.page) ?? "1") || 1)


  const [currentUser, settings, aiAgentUserIds] = await Promise.all([
  getCurrentUser(),
  getSiteSettings(),
  getAiAgentUserIds(),
])

  const sidebarUserPromise = resolveSidebarUser(currentUser, settings)
  const basePost = await getPostDetailBySlug(params.slug, currentUser?.id)

  if (!basePost) {
    notFound()
  }

  const canonicalPath = getCanonicalPostPath(basePost, { mode: settings.postLinkDisplayMode })
  const canonicalUrl = await toAbsoluteSiteUrl(canonicalPath)
  const isFollowingPost = currentUser
    ? await isUserFollowingTarget({
        userId: currentUser.id,
        targetType: "post",
        targetId: basePost.id,
      })
    : false

  const adminActorPromise = currentUser && (currentUser.role === "ADMIN" || currentUser.role === "MODERATOR")
    ? resolveAdminActorFromSessionUser(currentUser)
    : Promise.resolve(null)

  const boardAccessContextPromise = getBoardAccessContextByPostId(basePost.id)
  const boardAccessContext = await boardAccessContextPromise
  const adminActor = await adminActorPromise
  const canManageThisPost = Boolean(
    adminActor
    && boardAccessContext
    && await canAdminActorManageBoardWithPermission(
      adminActor,
      "admin.content.manage",
      boardAccessContext.board.id,
      boardAccessContext.board.zoneId,
    ),
  )
  const canManageComments = Boolean(
    adminActor
    && boardAccessContext
    && await canAdminActorManageBoardWithPermission(
      adminActor,
      "admin.comments.manage",
      boardAccessContext.board.id,
      boardAccessContext.board.zoneId,
    ),
  )
  const isPostOwner = currentUser?.id === basePost.authorId
  const isOwnerOrManager = Boolean(isPostOwner || canManageThisPost)
  const canViewPendingPost = basePost.status === "PENDING" && isOwnerOrManager
  const canViewOfflinePost = basePost.status === "OFFLINE" && isOwnerOrManager
  const canViewModeratedPost = canViewPendingPost || canViewOfflinePost

  const viewPermission = boardAccessContext ? checkBoardPermission(currentUser, boardAccessContext.settings, "view", settings.pointName) : { allowed: true, message: "" }
  const replyPermission = boardAccessContext ? checkBoardPermission(currentUser, boardAccessContext.settings, "reply", settings.pointName) : { allowed: true, message: "" }
  const postViewPermission = checkPostAccessPermission(currentUser, resolvePostAccessRequirements(basePost))
  const mergedViewPermission = mergeAccessPermissions(viewPermission, postViewPermission)
  const canViewPublicPost = isPublicReadablePostStatus(basePost.status)
  const canReplyToPost = isPostOpenForReplies(basePost.status)
  const canViewRestrictedPost = canViewPublicPost && (mergedViewPermission.allowed || isOwnerOrManager)
  const canViewPostContent = canViewRestrictedPost || canViewModeratedPost

  if (!canViewPublicPost && !canViewModeratedPost) {
    notFound()
  }

  const postPageSearchParams = buildUrlSearchParams(searchParams)
  const postPageQueryString = postPageSearchParams.toString()
  const postAuthRedirectTarget = `${canonicalPath}${postPageQueryString ? `?${postPageQueryString}` : ""}`

  const userReplyCountPromise = canViewPostContent ? getUserReplyCountByPost(basePost.id, currentUser?.id) : Promise.resolve(0)
  const canViewComments = Boolean(currentUser) || settings.guestCanViewComments
  const canReplyAsAnonymous = Boolean(
    currentUser
    && typeof basePost.authorId === "number"
    && canUseAnonymousIdentityForPostReply({
      post: {
        isAnonymous: basePost.isAnonymous,
        authorId: basePost.authorId,
      },
      currentUserId: currentUser.id,
    }),
  )

  const purchasedBlockIdsPromise = canViewPostContent ? getPurchasedPostBlockIds(basePost.id, currentUser?.id) : Promise.resolve(new Set<string>())
  const purchasedAttachmentIdsPromise = canViewPostContent ? getPurchasedPostAttachmentIds(basePost.id, currentUser?.id) : Promise.resolve(new Set<string>())
  const purchasedBlockBuyerCountsPromise = canViewPostContent ? getPurchasedPostBlockBuyerCounts(basePost.id) : Promise.resolve(new Map<string, number>())
  const tipSummaryPromise = canViewRestrictedPost ? getPostTipSummary(basePost.id, currentUser?.id) : Promise.resolve(undefined)
  const redPacketSummaryPromise = canViewPostContent ? getPostRedPacketSummary(basePost.id, currentUser?.id) : Promise.resolve(undefined)
  const postAuctionSummaryPromise = basePost.type === "AUCTION" && canViewPostContent
    ? getPostAuctionSummary(basePost.id, currentUser?.id, { isAdmin: canManageThisPost })
    : Promise.resolve(undefined)
  const postOfflineMetaPromise = currentUser?.id === basePost.authorId ? getPostOfflineActionMeta(basePost.id) : Promise.resolve(null)
  const anonymousMaskIdentityPromise = basePost.isAnonymous ? getAnonymousMaskDisplayIdentity() : Promise.resolve(null)
  const commentResultPromise = canViewComments
    ? getCommentsByPostId(basePost.id, { sort: currentSort, page: currentPage, pageSize: settings.commentPageSize, viewMode: currentCommentView }, {
      userId: currentUser?.id,
      isAdmin: canManageComments,
      postAuthorId: basePost.authorId,
      postIsAnonymous: basePost.isAnonymous,
      commentsVisibleToAuthorOnly: basePost.commentsVisibleToAuthorOnly,
      anonymousPostAuthor: await anonymousMaskIdentityPromise,
    })
    : Promise.resolve({
      items: [],
      flatItems: [],
      total: 0,
      page: currentPage,
      pageSize: settings.commentPageSize,
      viewMode: currentCommentView,
    })

  const [userReplyCount, purchasedBlockIds, purchasedAttachmentIds, purchasedBlockBuyerCounts, tipSummary, redPacketSummary, postAuctionSummary, postOfflineMeta, commentResult, sidebarData, boards, zones] = await Promise.all([


    userReplyCountPromise,
    purchasedBlockIdsPromise,
    purchasedAttachmentIdsPromise,
    purchasedBlockBuyerCountsPromise,
    tipSummaryPromise,
    redPacketSummaryPromise,
    postAuctionSummaryPromise,
    postOfflineMetaPromise,
    commentResultPromise,
    getPostSidebarData(
      basePost.id,
      basePost.authorUsername ?? basePost.author,
      settings.postSidebarRelatedTopicsCount,
      currentUser?.id,
      {
        pathname: canonicalPath,
        searchParams: postPageSearchParams,
      },
    ),
    getBoards(),
    getZones(),
  ])


  if (canViewRestrictedPost) {
    void incrementPostViewCount(basePost.id)
  }

  const postWithAuction = postAuctionSummary ? { ...basePost, auction: postAuctionSummary } : basePost
  const displayPost = canViewPostContent
    ? { ...postWithAuction, redPacket: redPacketSummary ?? postWithAuction.redPacket, tipping: tipSummary ? {
      enabled: tipSummary.enabled,
      isLoggedIn: tipSummary.isLoggedIn,
      pointName: tipSummary.pointName,
      currentUserPoints: tipSummary.currentUserPoints,
      gifts: tipSummary.gifts,
      giftStats: tipSummary.giftStats,
      recentGiftEvents: tipSummary.recentGiftEvents,
      allowedAmounts: tipSummary.allowedAmounts,
      dailyLimit: tipSummary.dailyLimit,
      perPostLimit: tipSummary.perPostLimit,
      usedDailyCount: tipSummary.usedDailyCount,
      usedPostCount: tipSummary.usedPostCount,
      totalCount: tipSummary.tipCount,
      totalPoints: tipSummary.tipTotalPoints,
      topSupporters: tipSummary.topSupporters,
    } : postWithAuction.tipping,
      contentBlocks: (postWithAuction.contentBlocks ?? []).map((block) => {

        const replyUnlocked = isOwnerOrManager || userReplyCount >= (block.replyThreshold ?? 1)

        const visible = block.type === "PUBLIC"
          || (block.type === "AUTHOR_ONLY" && isOwnerOrManager)
          || (block.type === "LOGIN_UNLOCK" && (Boolean(currentUser?.id) || isOwnerOrManager))
          || (block.type === "REPLY_UNLOCK" && replyUnlocked)
          || (block.type === "PURCHASE_UNLOCK" && (purchasedBlockIds.has(block.id) || isOwnerOrManager))

        return {
          ...block,
          visible,
          purchaseCount: block.type === "PURCHASE_UNLOCK" ? (purchasedBlockBuyerCounts.get(block.id) ?? 0) : block.purchaseCount,
        }
      }) }
    : postWithAuction
  const displayPostWithAiIndicator = {
    ...displayPost,
    authorIsAiAgent: !displayPost.isAnonymous && typeof displayPost.authorId === "number" && aiAgentUserIds.includes(displayPost.authorId),
  }
  const isRestrictedAuthor = displayPostWithAiIndicator.authorStatus === "BANNED" || displayPostWithAiIndicator.authorStatus === "MUTED"
  const currentZone = displayPostWithAiIndicator.boardSlug ? zones.find((zone) => zone.boardSlugs.includes(displayPostWithAiIndicator.boardSlug!)) ?? null : null
  const currentZoneBoards = currentZone
    ? boards
        .filter((board) => currentZone.boardSlugs.includes(board.slug))
        .map((board) => ({
          slug: board.slug,
          name: board.name,
          icon: board.icon,
          count: board.count,
        }))
    : []

  const sidebarUser = await sidebarUserPromise

  const canManageAdminBoard = async (boardSlug: string) => {
    if (!adminActor) {
      return false
    }

    const matchedBoard = boards.find((candidate) => candidate.slug === boardSlug)
    return matchedBoard
      ? canAdminActorManageBoardWithPermission(
          adminActor,
          "admin.content.manage",
          matchedBoard.id,
          matchedBoard.zoneId,
        )
      : false
  }

  const groupedBoardOptions = zones
    .map((zone) => ({
      zone: zone.name,
      items: boards
        .filter((board) => zone.boardSlugs.includes(board.slug))
        .map((board) => ({
          value: board.slug,
          label: board.name,
        })),
    }))
    .filter((group) => group.items.length > 0)

  const groupedBoardSlugs = new Set(groupedBoardOptions.flatMap((group) => group.items.map((item) => item.value)))
  const ungroupedBoards = boards
    .filter((board) => !groupedBoardSlugs.has(board.slug))
    .map((board) => ({
      value: board.slug,
      label: board.name,
    }))

  const filteredAdminBoardOptions: AdminBoardOptionGroup[] = []
  for (const group of groupedBoardOptions) {
    const filteredItems = adminActor
      ? (await Promise.all(group.items.map(async (item) => ({
          item,
          allowed: await canManageAdminBoard(item.value),
        })))).filter((result) => result.allowed).map((result) => result.item)
      : group.items

    if (filteredItems.length > 0) {
      filteredAdminBoardOptions.push({
        zone: group.zone,
        items: filteredItems,
      })
    }
  }

  const filteredUngroupedBoards = adminActor
    ? (await Promise.all(ungroupedBoards.map(async (item) => ({
        item,
        allowed: await canManageAdminBoard(item.value),
      })))).filter((result) => result.allowed).map((result) => result.item)
    : ungroupedBoards
  const adminBoardOptions = filteredUngroupedBoards.length > 0
    ? [...filteredAdminBoardOptions, { zone: "未分区节点", items: filteredUngroupedBoards }]
    : filteredAdminBoardOptions
  const normalizedPinScope = displayPost.pinScope === PinScope.NONE
    || displayPost.pinScope === PinScope.BOARD
    || displayPost.pinScope === PinScope.ZONE
    || displayPost.pinScope === PinScope.GLOBAL
    ? displayPost.pinScope
    : null
  const allowedPinScopes = adminActor && boardAccessContext
    ? getAvailablePinScopes(adminActor, {
        zoneId: boardAccessContext.board.zoneId,
        currentPinScope: normalizedPinScope,
      })
    : []
  const hasAppendices = Boolean(displayPost.appendices && displayPost.appendices.length > 0)
  const postEditWindowMinutes = boardAccessContext
    ? resolvePostEditWindowMinutes(settings.postEditableMinutes, boardAccessContext.settings.postEditRules, currentUser)
    : settings.postEditableMinutes
  const displayAttachments = (displayPost.attachments ?? []).map((attachment) => {
    const replyRequirementSatisfied = attachment.requireReplyUnlock && userReplyCount >= 1
    const viewerState = resolveAttachmentViewerState({
      attachment,
      pointName: settings.pointName,
      siteEnabled: attachment.sourceType === "EXTERNAL_LINK" ? true : settings.attachmentDownloadEnabled,
      viewer: currentUser,
      userReplyCount,
      hasPurchasedAccess: purchasedAttachmentIds.has(attachment.id),
      isOwnerOrAdmin: isOwnerOrManager,
    })

    return {
      ...attachment,
      replyRequirementSatisfied,
      ...viewerState,
    }
  })
  const hasRewardPoolHighlight = Boolean(
    displayPost.redPacket?.enabled
    && displayPost.redPacket.status === "ACTIVE"
    && (
      (displayPost.redPacket.rewardMode === "JACKPOT" && displayPost.redPacket.remainingPoints > 0)
      || (displayPost.redPacket.rewardMode !== "JACKPOT" && displayPost.redPacket.remainingCount > 0 && displayPost.redPacket.remainingPoints > 0)
    ),
  )

  const jsonLd = await buildArticleJsonLd({

    title: displayPost.title,
    description: displayPost.description,
    publishedAt: displayPost.publishedAt,
    author: displayPost.author,
    url: canonicalUrl,
  })
  const [renderedContentBlockHtmlById, renderedAppendices] = await Promise.all([
    Promise.all(
      (displayPost.contentBlocks ?? []).map(async (block) => {
        const shouldRenderHtml = Boolean(block.text && (block.type === "PUBLIC" || block.visible))
        const html = shouldRenderHtml
          ? await renderCachedPostContentHtml({
              postId: displayPost.id,
              blockId: block.id,
              content: block.text,
              markdownEmojiMap: settings.markdownEmojiMap,
              pathname: canonicalPath,
              searchParams: postPageSearchParams,
              allowedOrigins: [new URL(canonicalUrl).origin],
              postLinkDisplayMode: settings.postLinkDisplayMode,
            })
          : ""

        return [block.id, html] as const
      }),
    ).then((entries) => new Map(entries)),
    Promise.all(
      (displayPost.appendices ?? []).map(async (appendix) => ({
        ...appendix,
        html: await renderCachedPostContentHtml({
          postId: displayPost.id,
          blockId: `appendix:${appendix.id}`,
          content: appendix.content,
          markdownEmojiMap: settings.markdownEmojiMap,
          pathname: canonicalPath,
          searchParams: postPageSearchParams,
          allowedOrigins: [new URL(canonicalUrl).origin],
          postLinkDisplayMode: settings.postLinkDisplayMode,
        }),
      })),
    ),
  ])
  const usedHeadingIds = new Map<string, number>()
  const tableOfContents: Array<{ id: string; text: string; level: number }> = []
  const normalizedRenderedContentBlockHtmlById = new Map<string, string>()

  for (const block of displayPost.contentBlocks ?? []) {
    const html = renderedContentBlockHtmlById.get(block.id) ?? ""
    if (!html) {
      continue
    }

    const normalized = normalizeRenderedMarkdownHtmlHeadings(html, usedHeadingIds)
    normalizedRenderedContentBlockHtmlById.set(block.id, normalized.html)
    tableOfContents.push(...normalized.headings)
  }

  const normalizedRenderedAppendices = renderedAppendices.map((appendix) => {
    const normalized = normalizeRenderedMarkdownHtmlHeadings(appendix.html ?? "", usedHeadingIds)
    return {
      ...appendix,
      html: normalized.html,
    }
  })

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <Script id={`post-jsonld-${displayPost.id}`} type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </Script>

      <main className="mx-auto max-w-[1200px] px-1">
        <ForumPageShell
          zones={zones}
          boards={boards}
          activeBoardSlug={displayPost.boardSlug}
          main={(
            <article className="mt-6 mb-4 space-y-6">
            {displayPost.status === "PENDING" ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                当前帖子处于<strong>待审核</strong>状态，仅作者和管理员可查看。{displayPost.reviewNote ? `审核备注：${displayPost.reviewNote}` : "管理员审核通过后才会对其他用户可见。"}
              </div>
            ) : null}

            {displayPost.status === "OFFLINE" ? (
              <div className="rounded-xl border border-slate-300 bg-slate-50 px-5 py-4 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100">
                当前帖子已<strong>下线</strong>，仅作者和管理员可查看。{displayPost.reviewNote ? `下线原因：${displayPost.reviewNote}` : "暂未填写下线原因。"}
              </div>
            ) : null}

            {!canViewRestrictedPost && canViewPublicPost ? (
              <AccessDeniedCard title="当前帖子暂不可查看" description="该帖子所在节点、分区或帖子本身设置了浏览门槛，未满足条件的用户无法查看帖子正文与互动内容。" reason={mergedViewPermission.message || "当前没有访问权限"} isLoggedIn={Boolean(currentUser)} redirectTarget={`/posts/${params.slug}`} />
            ) : (

              <>
              <div className="space-y-0">
                  <PostBodyCopyMenu
                    post={{ id: displayPost.id, slug: displayPost.slug }}
                    postLinkDisplayMode={settings.postLinkDisplayMode}
                    canReport={Boolean(currentUser && currentUser.id !== displayPostWithAiIndicator.authorId)}
                    reportTargetId={displayPostWithAiIndicator.id}
                    reportLabel={displayPostWithAiIndicator.title}
                    initialFollowed={isFollowingPost}
                    viewCount={displayPostWithAiIndicator.stats.views}
                  >
                    <Card className={hasRewardPoolHighlight || hasAppendices ? "rounded-b-none" : undefined}>
                      <CardContent>
                      {canViewRestrictedPost ? (
                        <PostReadingHistoryRecorder
                          postId={displayPostWithAiIndicator.id}
                          postSlug={displayPostWithAiIndicator.slug}
                          postPath={canonicalPath}
                          title={displayPostWithAiIndicator.title}
                          boardName={displayPostWithAiIndicator.board}
                          boardSlug={displayPostWithAiIndicator.boardSlug}
                          postCreatedAt={displayPostWithAiIndicator.createdAt}
                        />
                      ) : null}

                      <PostDetailHeader
                        post={displayPostWithAiIndicator}
                        isFollowingPost={isFollowingPost}
                        isRestrictedAuthor={isRestrictedAuthor}
                        pathname={canonicalPath}
                        zone={currentZone ? { slug: currentZone.slug, name: currentZone.name } : null}
                        zoneBoards={currentZoneBoards}
                      />

                      <div className="mt-6 space-y-4">
                        {displayPost.bounty ? (
                          <BountyPanel
                            key={`${displayPost.id}:${displayPost.bounty.isResolved ? "resolved" : "open"}:${displayPost.bounty.acceptedAnswerAuthor ?? ""}`}
                            postId={displayPost.id}
                            points={displayPost.bounty.points}
                            pointName={settings.pointName}
                            isResolved={displayPost.bounty.isResolved}
                            acceptedAnswerAuthor={displayPost.bounty.acceptedAnswerAuthor}
                          />
                        ) : null}
                      </div>

                        <div className="mt-8 space-y-5 text-[15px] leading-8 text-foreground/90 dark:text-foreground/85">
                          <AddonSlotRenderer slot="post.body.before" />
                          <AddonSurfaceRenderer
                            surface="post.body"
                            props={{
                              postId: displayPost.id,
                              postSlug: displayPost.slug,
                              title: displayPost.title,
                              currentUserId: currentUser?.id ?? null,
                              contentBlockCount: displayPost.contentBlocks?.length ?? 0,
                              attachmentCount: displayAttachments.length,
                              hasPoll: Boolean(displayPost.poll),
                            }}
                          >
                            {(displayPost.contentBlocks ?? []).map((block) => (
                              block.type === "PUBLIC"
                                ? <MarkdownContent key={block.id} content={block.text} html={normalizedRenderedContentBlockHtmlById.get(block.id)} markdownEmojiMap={settings.markdownEmojiMap} expandImagesWhenImageOnly imageDisplayMode={settings.theme.postContentImageMode} imageOnly={isImageOnlyMarkdown(block.text, settings.markdownEmojiMap)} collapseLongCodeBlocks />

                                : (
                                  <RestrictedPostBlock
                                    key={block.id}
                                    type={block.type}
                                    postId={displayPost.id}
                                    blockId={block.id}
                                    text={block.visible ? block.text : undefined}
                                    html={block.visible ? normalizedRenderedContentBlockHtmlById.get(block.id) : undefined}
                                    visible={block.visible}
                                    currentUserId={currentUser?.id}
                                    pointName={settings.pointName}
                                    replyThreshold={block.replyThreshold}
                                    price={block.price}
                                    purchaseCount={block.purchaseCount}
                                    userReplyCount={userReplyCount}
                                    isOwnerOrAdmin={isOwnerOrManager}
                                    markdownEmojiMap={settings.markdownEmojiMap}
                                    imageDisplayMode={settings.theme.postContentImageMode}

                                  />
                                )
                            ))}


                            {displayPost.poll ? <PollPanel postId={displayPost.id} totalVotes={displayPost.poll.totalVotes} hasVoted={displayPost.poll.hasVoted} expiresAt={displayPost.poll.expiresAt} options={displayPost.poll.options} /> : null}
                            {displayAttachments.length > 0 ? <PostAttachmentList postId={displayPost.id} attachments={displayAttachments} pointName={settings.pointName} /> : null}
                          </AddonSurfaceRenderer>
                        <AddonSlotRenderer slot="post.body.after" />
                        {displayPost.lottery || displayPost.auction ? (
                          <div className="space-y-4">
                            {displayPost.lottery ? <LotteryPanel postId={displayPost.id} lottery={displayPost.lottery} isOwnerOrAdmin={isOwnerOrManager} /> : null}
                            {displayPost.auction ? <PostAuctionPanel postId={displayPost.id} postSlug={displayPost.slug} auction={displayPost.auction} pointName={settings.pointName} currentUserId={currentUser?.id} /> : null}
                          </div>
                        ) : null}

                        </div>

                      <PostEngagementBar
                        postId={displayPost.id}
                        postSlug={displayPost.slug}
                        author={sidebarData.author}
                        likeCount={displayPost.stats.likes}
                        favoriteCount={displayPost.stats.favorites}
                        initialLiked={displayPost.viewerState?.liked}
                        initialFavored={displayPost.viewerState?.favored}
                        redPacket={displayPost.redPacket}
                        tipping={displayPost.tipping}
                      />
                      </CardContent>
                      
                    </Card>

                    
                  </PostBodyCopyMenu>




                  <PostRewardPoolHighlightBar summary={displayPost.redPacket} attachedTop attachedBottom={hasAppendices} />

                  {hasAppendices ? (
                    <PostAppendixTimeline appendices={normalizedRenderedAppendices} markdownEmojiMap={settings.markdownEmojiMap} />
                  ) : null}
                </div>

                {currentUser?.id === displayPost.authorId ? (
                  <PostEditPanel
                    postId={displayPost.id}
                    postSlug={displayPost.slug}
                    createdAt={displayPost.createdAt}
                    editWindowMinutes={postEditWindowMinutes}
                    lastAppendedAt={displayPost.lastAppendedAt}
                    appendixCount={displayPost.appendices?.length ?? 0}
                    offlinePrice={postOfflineMeta?.price.amount ?? 0}
                    offlinePriceLabel={postOfflineMeta?.price.label ?? "普通用户"}
                    pointName={postOfflineMeta?.pointName ?? settings.pointName}
                    canOffline={Boolean(postOfflineMeta)}
                  />

                ) : null}

                {canManageThisPost ? (
                  <PostAdminPanel
                    postId={displayPost.id}
                    postSlug={displayPost.slug}
                    currentBoardSlug={displayPost.boardSlug ?? ""}
                    postLinkDisplayMode={settings.postLinkDisplayMode}
                    actorRole={adminActor?.role ?? "MODERATOR"}
                    allowedPinScopes={allowedPinScopes}
                    postAuthorId={displayPost.authorId ?? 0}
                    postAuthorUsername={displayPost.authorUsername ?? displayPost.author}
                    postAuthorStatus={displayPost.authorStatus}
                    postStatus={displayPost.status}
                    isPinned={displayPost.isPinned}
                    pinScope={displayPost.pinScope}
                    isFeatured={displayPost.isFeatured}
                    boardOptions={adminBoardOptions}
                  />

                ) : null}




                <Card id="comments" className="scroll-mt-20 sm:scroll-mt-24">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle>回复讨论</CardTitle>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                          <MessageCircle className="h-4 w-4" />
                          <span className="tabular-nums" title={`${formatNumber(displayPost.stats.comments)} 回复`}>
                            {formatCompactNumber(displayPost.stats.comments)}
                          </span>
                        </span>
                        {currentUser && canReplyToPost ? (
                          <CommentReplyToggleButton threadId={displayPost.id} />
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {displayPost.status === "LOCKED" ? (
                      <p className="text-sm text-muted-foreground">帖子已关闭回复，可以继续查看已有讨论。</p>
                    ) : displayPost.status !== "NORMAL" ? (
                      <p className="text-sm text-muted-foreground">帖子当前不开放公开回复。</p>
                    ) : !currentUser && !canViewComments ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-3">
                        <p className="text-sm text-muted-foreground">当前站点已关闭游客查看评论，登录后可查看评论并参与回复讨论。</p>
                        <div className="flex items-center gap-2">
                          <Link href={buildLoginHrefWithRedirect(postAuthRedirectTarget)}>
                            <Button type="button" size="sm">登录</Button>
                          </Link>
                          <Link href={`/register?redirect=${encodeURIComponent(postAuthRedirectTarget)}`}>
                            <Button type="button" size="sm" variant="outline">注册</Button>
                          </Link>
                        </div>
                      </div>
                    ) : !currentUser ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-3">
                        <p className="text-sm text-muted-foreground">登录后可参与回复讨论。</p>
                        <div className="flex items-center gap-2">
                          <Link href={buildLoginHrefWithRedirect(postAuthRedirectTarget)}>
                            <Button type="button" size="sm">登录</Button>
                          </Link>
                          <Link href={`/register?redirect=${encodeURIComponent(postAuthRedirectTarget)}`}>
                            <Button type="button" size="sm" variant="outline">注册</Button>
                          </Link>
                        </div>
                      </div>
                    ) : null}
                    {canViewComments && commentResult.total === 0 ? (
                      <p className="text-sm text-muted-foreground">当前还没有回复，欢迎成为第一个参与讨论的人。</p>
                    ) : null}
                    {canViewComments ? (
                      <CommentThread
                        key={`${displayPost.id}:${currentSort}:${currentCommentView}:${commentResult.page}:${commentResult.total}`}
                        threadId={displayPost.id}
                        comments={commentResult.items}
                        postId={displayPost.id}
                        postPath={canonicalPath}
                        pointName={settings.pointName}
                        tipping={tipSummary ? {
                          enabled: tipSummary.enabled,
                          isLoggedIn: tipSummary.isLoggedIn,
                          pointName: tipSummary.pointName,
                          currentUserPoints: tipSummary.currentUserPoints,
                          allowedAmounts: tipSummary.allowedAmounts,
                          gifts: tipSummary.gifts,
                          dailyLimit: tipSummary.dailyLimit,
                          perTargetLimit: tipSummary.perPostLimit,
                          usedDailyCount: tipSummary.usedDailyCount,
                        } : undefined}
                        canReply={Boolean(currentUser && canReplyToPost && replyPermission.allowed)}
                        currentPage={commentResult.page}
                        pageSize={commentResult.pageSize}
                        total={commentResult.total}
                        currentSort={currentSort}
                        currentDisplayMode={currentCommentView}
                        commentLoadMode={settings.commentLoadMode}
                        flatComments={commentResult.flatItems}
                        currentUserId={currentUser?.id}
                        canAcceptAnswer={displayPost.type === "BOUNTY" && currentUser?.id === displayPost.authorId && !displayPost.bounty?.isResolved}
                        commentsVisibleToAuthorOnly={displayPost.commentsVisibleToAuthorOnly}
                        canOfflineOwnComment={Boolean(currentUser && boardAccessContext?.settings.allowUserOfflineOwnComment)}
                        canOfflineUserComment={Boolean(currentUser?.id === displayPost.authorId && boardAccessContext?.settings.allowPostAuthorOfflineComment)}
                        anonymousReplyEnabled={canReplyAsAnonymous}
                        anonymousReplyDefaultChecked={settings.anonymousPostDefaultReplyAnonymous}
                        anonymousReplySwitchVisible={canReplyAsAnonymous && settings.anonymousPostAllowReplySwitch}
                        isAdmin={canManageComments}
                        adminRole={adminActor?.role ?? null}
                        canPinComment={Boolean(currentUser?.id === displayPost.authorId || canManageComments)}
                        markdownEmojiMap={settings.markdownEmojiMap}
                        commentEditWindowMinutes={settings.commentEditableMinutes}
                        initialVisibleReplies={settings.commentInitialVisibleReplies}
                      />
                    ) : null}

                  </CardContent>
                </Card>
              </>
            )}
            </article>
          )}
          rightSidebar={(
            <aside className="mt-6 hidden pb-12 lg:block lg:h-full">
              <PostSidebarPanels
                postId={basePost.id}
                currentUser={sidebarUser}
                relatedTopics={sidebarData.relatedTopics}
                tags={sidebarData.tags}
                collections={sidebarData.collections}
                canManageTags={canManageThisPost}
                tableOfContents={tableOfContents}
                postLinkDisplayMode={settings.postLinkDisplayMode}
                siteName={settings.siteName}
                siteDescription={settings.siteDescription}
                siteLogoPath={settings.siteLogoPath}
                siteIconPath={settings.siteIconPath}
              />
            </aside>
          )}
        />
      </main>
    </div>
  )
}
