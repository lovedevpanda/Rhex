import type { Metadata } from "next"
import { Eye, MessageCircle } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { AccessDeniedCard } from "@/components/access-denied-card"
import { CommentThread } from "@/components/comment-thread"
import { LevelIcon } from "@/components/level-icon"
import { MarkdownContent } from "@/components/markdown-content"

import { PostAdminPanel } from "@/components/post-admin-panel"
import { PostEditPanel } from "@/components/post-edit-panel"
import { PostEngagementBar } from "@/components/post-engagement-bar"
import { PostSidebarPanels } from "@/components/post-sidebar-panels"
import { RestrictedPostBlock } from "@/components/restricted-post-block"
import { SidebarNavigation } from "@/components/sidebar-navigation"
import { BountyPanel, LotteryPanel, PollPanel } from "@/components/post-type-panels"

import { SiteHeader } from "@/components/site-header"
import { UserAvatar } from "@/components/user-avatar"
import { UserDisplayedBadges } from "@/components/user-displayed-badges"
import { UserStatusBadge } from "@/components/user-status-badge"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VipBadge } from "@/components/vip-badge"
import { getCurrentUser } from "@/lib/auth"
import { checkBoardPermission, getBoardAccessContextByPostId } from "@/lib/board-access"
import { getBoards } from "@/lib/boards"
import { getCommentsByPostId, getUserReplyCountByPost } from "@/lib/comments"
import { resolveSidebarUser } from "@/lib/home-sidebar"
import { getPostDetailBySlug, getPostSeoBySlug, incrementPostViewCount } from "@/lib/posts"

import { getPostSidebarData } from "@/lib/post-sidebar"
import { getPostRedPacketSummary } from "@/lib/post-red-packets"
import { getPostTipSummary } from "@/lib/post-tips"
import { getPostOfflineActionMeta } from "@/lib/post-offline"

import { getPurchasedPostBlockIds } from "@/lib/post-unlock"

import { buildArticleJsonLd, buildMetadataKeywords } from "@/lib/seo"
import { getSiteSettings } from "@/lib/site-settings"

import { formatRelativeTime } from "@/lib/formatters"
import { cn } from "@/lib/utils"

import { getZones } from "@/lib/zones"
import { getVipNameClass } from "@/lib/vip-status"

interface PostPageProps {
  params: {
    slug: string
  }
  searchParams?: {
    sort?: string
    page?: string
  }
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
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
      canonical: `/posts/${post.slug}`,
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



export default async function PostPage({ params, searchParams }: PostPageProps) {
  const currentSort = searchParams?.sort === "newest" ? "newest" : "oldest"
  const currentPage = Math.max(1, Number(searchParams?.page ?? "1") || 1)


    const [currentUser, settings] = await Promise.all([
    getCurrentUser(),
    getSiteSettings(),
  ])

  const sidebarUserPromise = resolveSidebarUser(currentUser, settings)
  const basePost = await getPostDetailBySlug(params.slug, currentUser?.id)

  if (!basePost) {
    notFound()
  }

  const isAdmin = Boolean(currentUser && (currentUser.role === "ADMIN" || currentUser.role === "MODERATOR"))
  const canViewPendingPost = basePost.status === "PENDING" && (isAdmin || currentUser?.id === basePost.authorId)
  const isOwnerOrAdmin = Boolean(currentUser?.id === basePost.authorId || isAdmin)
  const boardAccessContextPromise = getBoardAccessContextByPostId(basePost.id)
  const boardAccessContext = await boardAccessContextPromise

  const viewPermission = boardAccessContext ? checkBoardPermission(currentUser, boardAccessContext.settings, "view") : { allowed: true, message: "" }
  const postLevelPermission = currentUser && currentUser.level >= (basePost.minViewLevel ?? 0)
    ? { allowed: true, message: "" }
    : (basePost.minViewLevel ?? 0) <= 0
      ? { allowed: true, message: "" }
      : { allowed: false, message: `该帖子要求用户等级至少达到 Lv.${basePost.minViewLevel}` }
  const mergedViewPermission = !viewPermission.allowed ? viewPermission : postLevelPermission
  const canViewRestrictedPost = basePost.status === "NORMAL" && (mergedViewPermission.allowed || isAdmin || currentUser?.id === basePost.authorId)

  if ((basePost.status !== "NORMAL" && !canViewPendingPost) || (basePost.status === "NORMAL" && !canViewRestrictedPost && !isAdmin && currentUser?.id !== basePost.authorId)) {
    if (basePost.status !== "NORMAL") {
      notFound()
    }
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

  const sidebarUser = await sidebarUserPromise




  const jsonLd = buildArticleJsonLd({
    title: displayPost.title,
    description: displayPost.description,
    publishedAt: displayPost.publishedAt,
    author: displayPost.author,
    url: `/posts/${displayPost.slug}`,
  })

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="mx-auto max-w-[1200px] px-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <SidebarNavigation zones={zones} boards={boards} activeBoardSlug={displayPost.boardSlug} />

          <article className="space-y-6 lg:col-span-7 mt-6 mb-4">
            {displayPost.status === "PENDING" ? (
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                当前帖子处于<strong>待审核</strong>状态，仅作者和管理员可查看。{displayPost.reviewNote ? `审核备注：${displayPost.reviewNote}` : "管理员审核通过后才会对其他用户可见。"}
              </div>
            ) : null}

            {!canViewRestrictedPost && basePost.status === "NORMAL" ? (
              <AccessDeniedCard title="当前帖子暂不可查看" description="该帖子所在节点、分区或帖子本身设置了浏览门槛，未满足条件的用户无法查看帖子正文与互动内容。" reason={mergedViewPermission.message || "当前没有访问权限"} />
            ) : (
              <>
                <Card>
                  <CardContent className="p-4 sm:p-6 md:p-8">
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex items-start justify-between gap-3 sm:hidden">
                        <div className={cn("min-w-0 flex-1 space-y-2", isRestrictedAuthor && "grayscale")}>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
                            <LevelIcon icon={displayPost.boardIcon} className="h-3.5 w-3.5 text-sm" svgClassName="[&>svg]:block" />
                            <Link href={`/boards/${displayPost.boardSlug}`} className="truncate hover:underline">
                              {displayPost.board}
                            </Link>
                            <span>·</span>
                            <Link href={`/users/${displayPost.authorUsername ?? displayPost.author}`} className={cn("truncate", getVipNameClass(displayPost.authorIsVip, displayPost.authorVipLevel, { emphasize: true }))}>
                              {displayPost.author}
                            </Link>
                            <UserDisplayedBadges badges={displayPost.authorDisplayedBadges} compact />
                            {displayPost.authorIsVip ? <VipBadge level={displayPost.authorVipLevel} compact /> : null}
                            {isRestrictedAuthor ? <UserStatusBadge status={displayPost.authorStatus} compact /> : null}
                            <span>·</span>
                            <span>{displayPost.publishedAt}</span>
                            {displayPost.type !== "NORMAL" ? <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px]">{displayPost.typeLabel}</span> : null}
                            {displayPost.isPinned ? <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] text-orange-700 dark:bg-orange-500/15 dark:text-orange-200">置顶</span> : null}
                            {displayPost.isFeatured ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">精华</span> : null}
                          </div>
                        </div>

                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-secondary/60 px-2.5 py-1 text-[13px] text-muted-foreground">
                          <Eye className="h-3.5 w-3.5" />
                          {displayPost.stats.views}
                        </span>
                      </div>

                      <h1 className={displayPost.isFeatured ? "text-base font-semibold leading-7 text-emerald-700 sm:hidden dark:text-emerald-300" : displayPost.isPinned ? "text-base font-semibold leading-7 text-orange-700 sm:hidden dark:text-orange-300" : "text-base font-semibold leading-7 sm:hidden"}>{displayPost.title}</h1>

                      <div className="hidden sm:flex sm:flex-col sm:gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
                        <div className="flex min-w-0 items-start gap-4">
                          <Link href={`/users/${displayPost.authorUsername ?? displayPost.author}`} className={cn("shrink-0", isRestrictedAuthor && "grayscale")}>
                            <UserAvatar name={displayPost.author} avatarPath={displayPost.authorAvatarPath} size="lg" />
                          </Link>
                          <div className={cn("min-w-0 flex-1 space-y-3", isRestrictedAuthor && "grayscale")}>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                              <LevelIcon icon={displayPost.boardIcon} className="h-4 w-4 text-sm" svgClassName="[&>svg]:block" />
                              <Link href={`/boards/${displayPost.boardSlug}`} className="truncate hover:underline">
                                {displayPost.board}
                              </Link>
                              <span>·</span>
                              <Link href={`/users/${displayPost.authorUsername ?? displayPost.author}`} className={cn("truncate", getVipNameClass(displayPost.authorIsVip, displayPost.authorVipLevel, { emphasize: true }))}>
                                {displayPost.author}
                              </Link>
                              <UserDisplayedBadges badges={displayPost.authorDisplayedBadges} compact />
                              {displayPost.authorIsVip ? <VipBadge level={displayPost.authorVipLevel} compact /> : null}
                              {isRestrictedAuthor ? <UserStatusBadge status={displayPost.authorStatus} compact /> : null}
                              <span>·</span>
                              <span>{displayPost.publishedAt}</span>
                              {displayPost.type !== "NORMAL" ? <span className="rounded-full bg-secondary px-3 py-1 text-xs">{displayPost.typeLabel}</span> : null}
                              {displayPost.isPinned ? <span className="rounded-full bg-orange-100 px-3 py-1 text-xs text-orange-700 dark:bg-orange-500/15 dark:text-orange-200">置顶</span> : null}
                              {displayPost.isFeatured ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">精华</span> : null}
                            </div>

                            <h1 className={displayPost.isFeatured ? "text-lg font-semibold leading-snug text-emerald-700 sm:text-xl md:text-2xl dark:text-emerald-300" : displayPost.isPinned ? "text-lg font-semibold leading-snug text-orange-700 sm:text-xl md:text-2xl dark:text-orange-300" : "text-lg font-semibold leading-snug sm:text-xl md:text-2xl"}>{displayPost.title}</h1>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center justify-end text-sm text-muted-foreground md:pt-1">
                          <span className="flex items-center gap-1 rounded-full bg-secondary/60 px-3 py-1.5">
                            <Eye className="h-4 w-4" />
                            {displayPost.stats.views}
                          </span>
                        </div>
                      </div>
                    </div>

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

                    {displayPost.appendices && displayPost.appendices.length > 0 ? (
                      <div className="mt-10 border-t border-border/70 pt-6">
                        <div style={{ borderLeft: "3px solid #aead96" }} className="overflow-hidden rounded-2xl bg-secondary/20 dark:bg-secondary/10">
                          {displayPost.appendices.map((appendix, index) => (
                            <section key={appendix.id} className={index === 0 ? "px-2 py-4" : "border-t border-border/50 px-2 py-4"}>
                              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                <h3 className="font-semibold text-foreground/90">第 {appendix.floor} 条附言</h3>
                                <span>·</span>
                                <span>{formatRelativeTime(appendix.createdAt)}</span>
                              </div>
                              <div className="mt-2 pl-0.5">
                                <MarkdownContent content={appendix.content} className="text-[15px] leading-8 text-muted-foreground dark:text-muted-foreground/90" markdownEmojiMap={settings.markdownEmojiMap} />

                              </div>
                            </section>
                          ))}
                        </div>
                      </div>
                    ) : null}

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

                {currentUser?.id === displayPost.authorId ? (
                  <PostEditPanel
                    postId={displayPost.id}
                    postSlug={displayPost.slug}
                    editableUntil={displayPost.editableUntil}
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
                    postAuthorId={displayPost.authorId ?? 0}
                    postAuthorUsername={displayPost.authorUsername ?? displayPost.author}
                    postAuthorStatus={displayPost.authorStatus}
                    isPinned={displayPost.isPinned}
                    isFeatured={displayPost.isFeatured}
                  />
                ) : null}



                <Card id="comments">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle>回复讨论</CardTitle>
                      <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                        <MessageCircle className="h-4 w-4" />
                        {displayPost.stats.comments}
                      </span>
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
                    />

                  </CardContent>
                </Card>
              </>
            )}
          </article>

          <aside className="mt-6 hidden pb-12 lg:col-span-3 lg:block">
            <PostSidebarPanels currentUser={sidebarUser} relatedTopics={sidebarData.relatedTopics} tags={sidebarData.tags} />
          </aside>
        </div>
      </main>
    </div>
  )
}



