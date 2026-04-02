import type { Metadata } from "next"
import { MessageCircle } from "lucide-react"
import { notFound } from "next/navigation"


import { AccessDeniedCard } from "@/components/access-denied-card"
import { CommentReplyToggleButton } from "@/components/comment-reply-toggle-button"
import { CommentThread } from "@/components/comment-thread"
import { ForumPageShell } from "@/components/forum-page-shell"
import { MarkdownContent } from "@/components/markdown-content"
import { PostAppendixTimeline } from "@/components/post-appendix-timeline"
import { PostDetailHeader } from "@/components/post-detail-header"

import { PostAdminPanel } from "@/components/post-admin-panel"
import { PostEditPanel } from "@/components/post-edit-panel"
import { PostEngagementBar } from "@/components/post-engagement-bar"
import { PostReadingHistoryRecorder } from "@/components/post-reading-history-recorder"
import { PostSidebarPanels } from "@/components/post-sidebar-panels"
import { RestrictedPostBlock } from "@/components/restricted-post-block"
import { BountyPanel, LotteryPanel, PollPanel } from "@/components/post-type-panels"

import { SiteHeader } from "@/components/site-header"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { checkBoardPermission, getBoardAccessContextByPostId } from "@/lib/board-access"
import { getBoards } from "@/lib/boards"
import { getCommentsByPostId, getUserReplyCountByPost } from "@/lib/comments"
import { isUserFollowingTarget } from "@/lib/follows"
import { resolveSidebarUser } from "@/lib/home-sidebar"
import { checkPostAccessPermission, mergeAccessPermissions, resolvePostAccessRequirements } from "@/lib/post-access"
import { getPostDetailBySlug, getPostSeoBySlug, incrementPostViewCount } from "@/lib/posts"

import { getPostSidebarData } from "@/lib/post-sidebar"
import { getPostRedPacketSummary } from "@/lib/post-red-packets"
import { getPostTipSummary } from "@/lib/post-tips"
import { getPostOfflineActionMeta } from "@/lib/post-offline"

import { getPurchasedPostBlockIds } from "@/lib/post-unlock"

import { buildArticleJsonLd, buildMetadataKeywords } from "@/lib/seo"
import { readSearchParam } from "@/lib/search-params"
import { getSiteSettings } from "@/lib/site-settings"

import { getZones } from "@/lib/zones"
import { getCanonicalPostPath } from "@/lib/post-links"

export async function generateMetadata(props: PageProps<"/posts/[slug]">): Promise<Metadata> {
  const params = await props.params;
  const [post, settings] = await Promise.all([getPostSeoBySlug(params.slug), getSiteSettings()])

  if (!post) {
    return {
      title: `帖子不存在 - ${settings.siteName}`,
    }
  }

  return {
    title: `${post.title} - ${settings.siteName}`,
    description: post.description,
    keywords: buildMetadataKeywords(settings.siteSeoKeywords, [post.title, post.slug, post.description, "帖子", "论坛帖子"]),
    alternates: {
      canonical: getCanonicalPostPath({ slug: post.slug }) as string,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
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
  const currentPage = Math.max(1, Number(readSearchParam(searchParams?.page) ?? "1") || 1)


  const [currentUser, settings] = await Promise.all([
  getCurrentUser(),
  getSiteSettings(),
])

  const sidebarUserPromise = resolveSidebarUser(currentUser, settings)
  const basePost = await getPostDetailBySlug(params.slug, currentUser?.id)

  if (!basePost) {
    notFound()
  }

  const canonicalPath = getCanonicalPostPath({ slug: basePost.slug })
  const isFollowingPost = currentUser
    ? await isUserFollowingTarget({
        userId: currentUser.id,
        targetType: "post",
        targetId: basePost.id,
      })
    : false

  const isAdmin = Boolean(currentUser && (currentUser.role === "ADMIN" || currentUser.role === "MODERATOR"))

  const isOwnerOrAdmin = Boolean(currentUser?.id === basePost.authorId || isAdmin)
  const canViewPendingPost = basePost.status === "PENDING" && isOwnerOrAdmin
  const canViewOfflinePost = basePost.status === "OFFLINE" && isAdmin

  const boardAccessContextPromise = getBoardAccessContextByPostId(basePost.id)
  const boardAccessContext = await boardAccessContextPromise

  const viewPermission = boardAccessContext ? checkBoardPermission(currentUser, boardAccessContext.settings, "view") : { allowed: true, message: "" }
  const postViewPermission = checkPostAccessPermission(currentUser, resolvePostAccessRequirements(basePost))
  const mergedViewPermission = mergeAccessPermissions(viewPermission, postViewPermission)
  const canViewRestrictedPost = basePost.status === "NORMAL" && (mergedViewPermission.allowed || isOwnerOrAdmin)
  const shouldRenderOfflineNotice = basePost.status === "OFFLINE" && !canViewOfflinePost

  if (basePost.status === "PENDING" && !canViewPendingPost) {
    notFound()
  }

  if (basePost.status !== "NORMAL" && basePost.status !== "PENDING" && basePost.status !== "OFFLINE" && !isOwnerOrAdmin) {
    notFound()
  }


  const userReplyCountPromise = canViewRestrictedPost ? getUserReplyCountByPost(basePost.id, currentUser?.id) : Promise.resolve(0)

  const purchasedBlockIdsPromise = canViewRestrictedPost ? getPurchasedPostBlockIds(basePost.id, currentUser?.id) : Promise.resolve(new Set<string>())
  const tipSummaryPromise = canViewRestrictedPost ? getPostTipSummary(basePost.id, currentUser?.id) : Promise.resolve(undefined)
  const redPacketSummaryPromise = canViewRestrictedPost ? getPostRedPacketSummary(basePost.id, currentUser?.id) : Promise.resolve(undefined)
  const postOfflineMetaPromise = currentUser?.id === basePost.authorId ? getPostOfflineActionMeta(basePost.id) : Promise.resolve(null)


  const [userReplyCount, purchasedBlockIds, tipSummary, redPacketSummary, postOfflineMeta, commentResult, sidebarData, boards, zones] = await Promise.all([


    userReplyCountPromise,
    purchasedBlockIdsPromise,
    tipSummaryPromise,
    redPacketSummaryPromise,
    postOfflineMetaPromise,
    getCommentsByPostId(basePost.id, { sort: currentSort, page: currentPage, pageSize: 15 }, {


      userId: currentUser?.id,
      isAdmin,
      postAuthorId: basePost.authorId,
      commentsVisibleToAuthorOnly: basePost.commentsVisibleToAuthorOnly,
    }),
    getPostSidebarData(basePost.id, basePost.authorUsername ?? basePost.author),
    getBoards(),
    getZones(),
  ])


  if (basePost.status === "NORMAL" && canViewRestrictedPost) {
    void incrementPostViewCount(basePost.id)
  }

  const displayPost = canViewRestrictedPost
    ? { ...basePost, redPacket: redPacketSummary ?? basePost.redPacket, tipping: tipSummary ? {
      enabled: tipSummary.enabled,
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
    } : basePost.tipping,
      contentBlocks: (basePost.contentBlocks ?? []).map((block) => {

        const replyUnlocked = isOwnerOrAdmin || userReplyCount >= (block.replyThreshold ?? 1)

        const visible = block.type === "PUBLIC"
          || (block.type === "AUTHOR_ONLY" && isOwnerOrAdmin)
          || (block.type === "REPLY_UNLOCK" && replyUnlocked)
          || (block.type === "PURCHASE_UNLOCK" && (purchasedBlockIds.has(block.id) || isOwnerOrAdmin))

        return {
          ...block,
          visible,
        }
      }) }
    : basePost
  const isRestrictedAuthor = displayPost.authorStatus === "BANNED" || displayPost.authorStatus === "MUTED"
  const currentZone = displayPost.boardSlug ? zones.find((zone) => zone.boardSlugs.includes(displayPost.boardSlug!)) ?? null : null
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

  const adminBoardOptions = ungroupedBoards.length > 0
    ? [...groupedBoardOptions, { zone: "未分区节点", items: ungroupedBoards }]
    : groupedBoardOptions

  const jsonLd = buildArticleJsonLd({

    title: displayPost.title,
    description: displayPost.description,
    publishedAt: displayPost.publishedAt,
    author: displayPost.author,
    url: canonicalPath,
  })

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

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
                  <Card className={displayPost.appendices && displayPost.appendices.length > 0 ? "rounded-b-none" : undefined}>
                    <CardContent className="pt-4 px-4 pb-4 sm:px-6 sm:pb-6 md:px-8 md:pb-8">
                      {displayPost.status === "NORMAL" && canViewRestrictedPost ? (
                        <PostReadingHistoryRecorder
                          postId={displayPost.id}
                          postSlug={displayPost.slug}
                          postPath={canonicalPath}
                          title={displayPost.title}
                          boardName={displayPost.board}
                          boardSlug={displayPost.boardSlug}
                          postCreatedAt={displayPost.createdAt}
                        />
                      ) : null}

                      <PostDetailHeader
                        post={displayPost}
                        isFollowingPost={isFollowingPost}
                        isRestrictedAuthor={isRestrictedAuthor}
                        zone={currentZone ? { slug: currentZone.slug, name: currentZone.name } : null}
                        zoneBoards={currentZoneBoards}
                      />

                      <div className="mt-6 space-y-4">
                        {displayPost.bounty ? (
                          <BountyPanel
                            postId={displayPost.id}
                            points={displayPost.bounty.points}
                            pointName={settings.pointName}
                            isResolved={displayPost.bounty.isResolved}
                            acceptedAnswerAuthor={displayPost.bounty.acceptedAnswerAuthor}
                          />
                        ) : null}
                        {displayPost.poll ? <PollPanel postId={displayPost.id} totalVotes={displayPost.poll.totalVotes} hasVoted={displayPost.poll.hasVoted} expiresAt={displayPost.poll.expiresAt} options={displayPost.poll.options} /> : null}
                        {displayPost.lottery ? <LotteryPanel postId={displayPost.id} lottery={displayPost.lottery} isOwnerOrAdmin={isOwnerOrAdmin} /> : null}


                      </div>

                      <div className="mt-8 space-y-5 text-[15px] leading-8 text-foreground/90 dark:text-foreground/85">
                        {(displayPost.contentBlocks ?? []).map((block) => (
                          block.type === "PUBLIC"
                            ? <MarkdownContent key={block.id} content={block.text} markdownEmojiMap={settings.markdownEmojiMap} />

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
                                userReplyCount={userReplyCount}
                                isOwnerOrAdmin={isOwnerOrAdmin}

                              />
                            )
                        ))}
                      </div>

                      <PostEngagementBar
                        postId={displayPost.id}
                        author={sidebarData.author}
                        likeCount={displayPost.stats.likes}
                        favoriteCount={displayPost.stats.favorites}
                        initialLiked={displayPost.viewerState?.liked}
                        initialFavored={displayPost.viewerState?.favored}
                        canReport={Boolean(currentUser && currentUser.id !== displayPost.authorId)}
                        reportLabel={displayPost.title}
                        redPacket={displayPost.redPacket}
                        tipping={displayPost.tipping}
                      />
                    </CardContent>
                  </Card>

                  {displayPost.appendices && displayPost.appendices.length > 0 ? (
                    <PostAppendixTimeline appendices={displayPost.appendices} markdownEmojiMap={settings.markdownEmojiMap} />
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

                {isAdmin ? (
                  <PostAdminPanel
                    postId={displayPost.id}
                    postSlug={displayPost.slug}
                    currentBoardSlug={displayPost.boardSlug ?? ""}
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




                <Card id="comments">
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
                    ) : !currentUser ? (
                      <p className="text-sm text-muted-foreground">登录后可参与回复讨论。</p>
                    ) : null}
                    {commentResult.total === 0 ? (
                      <p className="text-sm text-muted-foreground">当前还没有回复，欢迎成为第一个参与讨论的人。</p>
                    ) : null}
                    <CommentThread
                      threadId={displayPost.id}
                      comments={commentResult.items}
                      postId={displayPost.id}
                      canReply={Boolean(currentUser && displayPost.status === "NORMAL")}
                      currentPage={commentResult.page}
                      pageSize={commentResult.pageSize}
                      total={commentResult.total}
                      currentSort={currentSort}
                      currentUserId={currentUser?.id}
                      canAcceptAnswer={displayPost.type === "BOUNTY" && currentUser?.id === displayPost.authorId && !displayPost.bounty?.isResolved}
                      commentsVisibleToAuthorOnly={displayPost.commentsVisibleToAuthorOnly}
                      isAdmin={isAdmin}
                      canPinComment={Boolean(currentUser?.id === displayPost.authorId || isAdmin)}
                      markdownEmojiMap={settings.markdownEmojiMap}
                      commentEditWindowMinutes={settings.commentEditableMinutes}
                    />

                  </CardContent>
                </Card>
              </>
            )}
            </article>
          )}
          rightSidebar={(
            <aside className="mt-6 hidden pb-12 lg:block">
              <PostSidebarPanels currentUser={sidebarUser} relatedTopics={sidebarData.relatedTopics} tags={sidebarData.tags} postLinkDisplayMode={settings.postLinkDisplayMode} siteName={settings.siteName} siteDescription={settings.siteDescription} />
            </aside>
          )}
        />
      </main>
    </div>
  )
}

