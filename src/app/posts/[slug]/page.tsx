import type { Metadata } from "next"
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
import { PostAuctionPanel, PostAuctionWinnerContent } from "@/components/post/post-auction-panel"
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

import { getAiAgentUserId } from "@/lib/ai-agent"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { PinScope } from "@/db/types"
import { checkBoardPermission, getBoardAccessContextByPostId } from "@/lib/board-access"
import { getBoards } from "@/lib/boards"
import { getCommentsByPostId, getUserReplyCountByPost } from "@/lib/comments"
import { isUserFollowingTarget } from "@/lib/follows"
import { resolveSidebarUser } from "@/lib/home-sidebar"
import { checkPostAccessPermission, mergeAccessPermissions, resolvePostAccessRequirements } from "@/lib/post-access"
import { getPostDetailBySlug, getPostSeoBySlug, incrementPostViewCount } from "@/lib/posts"

import { getPostSidebarData } from "@/lib/post-sidebar"
import { getPostRedPacketSummary } from "@/lib/post-red-packets"
import { canUseAnonymousIdentityForPostReply, getAnonymousMaskDisplayIdentity } from "@/lib/post-anonymous"
import { isImageOnlyMarkdown } from "@/lib/markdown/render"
import { getPostTipSummary } from "@/lib/post-tips"
import { getPostOfflineActionMeta } from "@/lib/post-offline"
import { getPostAuctionSummary } from "@/lib/post-auctions"
import { getPurchasedPostAttachmentIds, resolveAttachmentViewerState } from "@/lib/post-attachments"

import { getPurchasedPostBlockBuyerCounts, getPurchasedPostBlockIds } from "@/lib/post-unlock"

import { buildArticleJsonLd, buildMetadataKeywords } from "@/lib/seo"
import { readSearchParam } from "@/lib/search-params"
import { getSiteSettings } from "@/lib/site-settings"
import { BROWSING_PREFERENCES_COOKIE_NAME, resolveBrowsingPreferencesSnapshot } from "@/lib/browsing-preferences"
import { toAbsoluteSiteUrl } from "@/lib/site-origin"

import { getZones } from "@/lib/zones"
import { getCanonicalPostPath } from "@/lib/post-links"
import { canManageBoard, getAvailablePinScopes, isSiteAdmin as isSiteAdminActor, resolveAdminActorFromSessionUser } from "@/lib/moderator-permissions"

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
  const currentSort = readSearchParam(searchParams?.sort) === "newest" ? "newest" : "oldest"
  const requestedCommentView = readSearchParam(searchParams?.view)
  const currentCommentView = requestedCommentView === "flat"
    ? "flat"
    : requestedCommentView === "tree"
      ? "tree"
      : resolveBrowsingPreferencesSnapshot((await cookies()).get(BROWSING_PREFERENCES_COOKIE_NAME)?.value).commentThreadDisplayMode
  const currentPage = Math.max(1, Number(readSearchParam(searchParams?.page) ?? "1") || 1)


  const [currentUser, settings, aiAgentUserId] = await Promise.all([
  getCurrentUser(),
  getSiteSettings(),
  getAiAgentUserId(),
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
  const canManageThisPost = Boolean(adminActor && boardAccessContext && canManageBoard(adminActor, boardAccessContext.board.id, boardAccessContext.board.zoneId))
  const isSiteAdmin = isSiteAdminActor(adminActor)
  const isPostOwner = currentUser?.id === basePost.authorId
  const isOwnerOrManager = Boolean(isPostOwner || canManageThisPost)
  const isOwnerOrSiteAdmin = Boolean(isPostOwner || isSiteAdmin)
  const canViewPendingPost = basePost.status === "PENDING" && isOwnerOrManager
  const canViewOfflinePost = basePost.status === "OFFLINE" && isOwnerOrManager

  const viewPermission = boardAccessContext ? checkBoardPermission(currentUser, boardAccessContext.settings, "view") : { allowed: true, message: "" }
  const postViewPermission = checkPostAccessPermission(currentUser, resolvePostAccessRequirements(basePost))
  const mergedViewPermission = mergeAccessPermissions(viewPermission, postViewPermission)
  const canViewRestrictedPost = basePost.status === "NORMAL" && (mergedViewPermission.allowed || isOwnerOrManager)
  const shouldRenderOfflineNotice = basePost.status === "OFFLINE" && !canViewOfflinePost

  if (basePost.status === "PENDING" && !canViewPendingPost) {
    notFound()
  }

  if (basePost.status !== "NORMAL" && basePost.status !== "PENDING" && basePost.status !== "OFFLINE" && !isOwnerOrManager) {
    notFound()
  }


  const userReplyCountPromise = canViewRestrictedPost ? getUserReplyCountByPost(basePost.id, currentUser?.id) : Promise.resolve(0)
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

  const purchasedBlockIdsPromise = canViewRestrictedPost ? getPurchasedPostBlockIds(basePost.id, currentUser?.id) : Promise.resolve(new Set<string>())
  const purchasedAttachmentIdsPromise = canViewRestrictedPost ? getPurchasedPostAttachmentIds(basePost.id, currentUser?.id) : Promise.resolve(new Set<string>())
  const purchasedBlockBuyerCountsPromise = canViewRestrictedPost ? getPurchasedPostBlockBuyerCounts(basePost.id) : Promise.resolve(new Map<string, number>())
  const tipSummaryPromise = canViewRestrictedPost ? getPostTipSummary(basePost.id, currentUser?.id) : Promise.resolve(undefined)
  const redPacketSummaryPromise = canViewRestrictedPost ? getPostRedPacketSummary(basePost.id, currentUser?.id) : Promise.resolve(undefined)
  const postAuctionSummaryPromise = basePost.type === "AUCTION" && (canViewRestrictedPost || isOwnerOrManager)
    ? getPostAuctionSummary(basePost.id, currentUser?.id, { isAdmin: isSiteAdmin })
    : Promise.resolve(undefined)
  const postOfflineMetaPromise = currentUser?.id === basePost.authorId ? getPostOfflineActionMeta(basePost.id) : Promise.resolve(null)
  const anonymousMaskIdentityPromise = basePost.isAnonymous ? getAnonymousMaskDisplayIdentity() : Promise.resolve(null)
  const commentResultPromise = canViewComments
    ? getCommentsByPostId(basePost.id, { sort: currentSort, page: currentPage, pageSize: settings.commentPageSize, viewMode: currentCommentView }, {
      userId: currentUser?.id,
      isAdmin: canManageThisPost,
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
    getPostSidebarData(basePost.id, basePost.authorUsername ?? basePost.author, settings.postSidebarRelatedTopicsCount, currentUser?.id),
    getBoards(),
    getZones(),
  ])


  if (basePost.status === "NORMAL" && canViewRestrictedPost) {
    void incrementPostViewCount(basePost.id)
  }

  const postWithAuction = postAuctionSummary ? { ...basePost, auction: postAuctionSummary } : basePost
  const displayPost = canViewRestrictedPost
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
    authorIsAiAgent: !displayPost.isAnonymous && displayPost.authorId === aiAgentUserId,
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

  const filteredAdminBoardOptions = adminActor
    ? groupedBoardOptions
        .map((group) => ({
          zone: group.zone,
          items: group.items.filter((item) => {
            const matchedBoard = boards.find((candidate) => candidate.slug === item.value)
            return matchedBoard ? canManageBoard(adminActor, matchedBoard.id, matchedBoard.zoneId) : false
          }),
        }))
        .filter((group) => group.items.length > 0)
    : groupedBoardOptions
  const filteredUngroupedBoards = adminActor
    ? ungroupedBoards.filter((item) => {
        const matchedBoard = boards.find((candidate) => candidate.slug === item.value)
        return matchedBoard ? canManageBoard(adminActor, matchedBoard.id, matchedBoard.zoneId) : false
      })
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
  const displayAttachments = (displayPost.attachments ?? []).map((attachment) => {
    const replyRequirementSatisfied = attachment.requireReplyUnlock && userReplyCount >= 1
    const viewerState = resolveAttachmentViewerState({
      attachment,
      pointName: settings.pointName,
      siteEnabled: attachment.sourceType === "EXTERNAL_LINK" ? true : settings.attachmentDownloadEnabled,
      viewer: currentUser,
      userReplyCount,
      hasPurchasedAccess: purchasedAttachmentIds.has(attachment.id),
      isOwnerOrAdmin: isOwnerOrSiteAdmin,
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

  const jsonLd = buildArticleJsonLd({

    title: displayPost.title,
    description: displayPost.description,
    publishedAt: displayPost.publishedAt,
    author: displayPost.author,
    url: canonicalUrl,
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
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                当前帖子处于<strong>待审核</strong>状态，仅作者和管理员可查看。{displayPost.reviewNote ? `审核备注：${displayPost.reviewNote}` : "管理员审核通过后才会对其他用户可见。"}
              </div>
            ) : null}

            {shouldRenderOfflineNotice ? (
              <Card>
                <CardContent className="p-8">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-6 text-center text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
                    当前帖子已被<strong>下线</strong>。
                  </div>
                </CardContent>
              </Card>
            ) : !canViewRestrictedPost && basePost.status === "NORMAL" ? (
              <AccessDeniedCard title="当前帖子暂不可查看" description="该帖子所在节点、分区或帖子本身设置了浏览门槛，未满足条件的用户无法查看帖子正文与互动内容。" reason={mergedViewPermission.message || "当前没有访问权限"} isLoggedIn={Boolean(currentUser)} />
            ) : (

              <>
              <div className="space-y-0">
                  <PostBodyCopyMenu
                    post={{ id: displayPost.id, slug: displayPost.slug }}
                    postLinkDisplayMode={settings.postLinkDisplayMode}
                    canReport={Boolean(currentUser && currentUser.id !== displayPostWithAiIndicator.authorId)}
                    reportTargetId={displayPostWithAiIndicator.id}
                    reportLabel={displayPostWithAiIndicator.title}
                  >
                    <Card className={hasRewardPoolHighlight || hasAppendices ? "rounded-b-none" : undefined}>
                      <CardContent>
                      {displayPostWithAiIndicator.status === "NORMAL" && canViewRestrictedPost ? (
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
                        {displayPost.lottery ? <LotteryPanel postId={displayPost.id} lottery={displayPost.lottery} isOwnerOrAdmin={isOwnerOrManager} /> : null}
                        {displayPost.auction ? <PostAuctionPanel postId={displayPost.id} auction={displayPost.auction} pointName={settings.pointName} currentUserId={currentUser?.id} /> : null}


                      </div>

                        <div className="mt-8 space-y-5 text-[15px] leading-8 text-foreground/90 dark:text-foreground/85">
                          {(displayPost.contentBlocks ?? []).map((block) => (
                            block.type === "PUBLIC"
                              ? <MarkdownContent key={block.id} content={block.text} markdownEmojiMap={settings.markdownEmojiMap} expandImagesWhenImageOnly imageOnly={isImageOnlyMarkdown(block.text, settings.markdownEmojiMap)} />

                              : (
                                <RestrictedPostBlock
                                  key={block.id}
                                  type={block.type}
                                  postId={displayPost.id}
                                  blockId={block.id}
                                  text={block.text}
                                  visible={block.visible}
                                  currentUserId={currentUser?.id}
                                  pointName={settings.pointName}
                                  replyThreshold={block.replyThreshold}
                                  price={block.price}
                                  purchaseCount={block.purchaseCount}
                                  userReplyCount={userReplyCount}
                                  isOwnerOrAdmin={isOwnerOrManager}

                                />
                              )
                          ))}


                       {displayPost.poll ? <PollPanel postId={displayPost.id} totalVotes={displayPost.poll.totalVotes} hasVoted={displayPost.poll.hasVoted} expiresAt={displayPost.poll.expiresAt} options={displayPost.poll.options} /> : null}
                        {displayAttachments.length > 0 ? <PostAttachmentList attachments={displayAttachments} pointName={settings.pointName} /> : null}
                        {displayPost.auction ? <PostAuctionWinnerContent auction={displayPost.auction} pointName={settings.pointName} /> : null}

                        </div>

                      <PostEngagementBar
                        postId={displayPost.id}
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
                    <PostAppendixTimeline appendices={displayPost.appendices ?? []} markdownEmojiMap={settings.markdownEmojiMap} />
                  ) : null}
                </div>

                {currentUser?.id === displayPost.authorId ? (
                  <PostEditPanel
                    postId={displayPost.id}
                    postSlug={displayPost.slug}
                    createdAt={displayPost.createdAt}
                    editWindowMinutes={settings.postEditableMinutes}
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
                          {displayPost.stats.comments}
                        </span>
                        {currentUser && displayPost.status === "NORMAL" ? (
                          <CommentReplyToggleButton threadId={displayPost.id} />
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {displayPost.status !== "NORMAL" ? (
                      <p className="text-sm text-muted-foreground">帖子还在审核阶段，暂不开放公开回复。</p>
                    ) : !currentUser && !canViewComments ? (
                      <p className="text-sm text-muted-foreground">当前站点已关闭游客查看评论，登录后可查看评论并参与回复讨论。</p>
                    ) : !currentUser ? (
                      <p className="text-sm text-muted-foreground">登录后可参与回复讨论。</p>
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
                        canReply={Boolean(currentUser && displayPost.status === "NORMAL")}
                        currentPage={commentResult.page}
                        pageSize={commentResult.pageSize}
                        total={commentResult.total}
                        currentSort={currentSort}
                        currentDisplayMode={currentCommentView}
                        flatComments={commentResult.flatItems}
                        currentUserId={currentUser?.id}
                        canAcceptAnswer={displayPost.type === "BOUNTY" && currentUser?.id === displayPost.authorId && !displayPost.bounty?.isResolved}
                        commentsVisibleToAuthorOnly={displayPost.commentsVisibleToAuthorOnly}
                        anonymousReplyEnabled={canReplyAsAnonymous}
                        anonymousReplyDefaultChecked={settings.anonymousPostDefaultReplyAnonymous}
                        anonymousReplySwitchVisible={canReplyAsAnonymous && settings.anonymousPostAllowReplySwitch}
                        isAdmin={canManageThisPost}
                        adminRole={adminActor?.role ?? null}
                        canPinComment={Boolean(currentUser?.id === displayPost.authorId || isSiteAdmin)}
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
            <aside className="mt-6 hidden pb-12 lg:block">
              <PostSidebarPanels
                currentUser={sidebarUser}
                relatedTopics={sidebarData.relatedTopics}
                tags={sidebarData.tags}
                collections={sidebarData.collections}
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

