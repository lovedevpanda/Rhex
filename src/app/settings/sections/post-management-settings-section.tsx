import Link from "next/link"

import { FavoriteCollectionManager } from "@/components/collection/favorite-collection-manager"
import { ForumPostStream } from "@/components/forum/forum-post-stream"
import { SettingsTabs } from "@/components/settings/settings-tabs"
import { UserRecentRepliesList } from "@/components/user/user-recent-replies-list"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { postManagementTabs } from "@/app/settings/settings-page-loader"
import type { SettingsPageData } from "@/app/settings/settings-page-loader"

function buildCursorHref(basePath: string, queryKey: string, cursor: string | null) {
  return cursor ? `${basePath}&${queryKey}=${encodeURIComponent(cursor)}` : "#"
}

export function PostManagementSettingsSection({ data }: { data: SettingsPageData }) {
  const { route, settings, userPosts, replies, favoritePosts, favoriteCollections, likedPosts } = data

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-4">
          <div className="space-y-1">
            <CardTitle>帖子管理</CardTitle>
            <p className="text-sm text-muted-foreground">集中查看你发布、回复、收藏和点赞过的帖子内容。</p>
          </div>
          <SettingsTabs tabs={postManagementTabs} queryKey="postTab" basePath="/settings?tab=post-management" />
        </CardHeader>
      </Card>

      {route.currentPostTab === "posts" ? <MyPostsPanel userPosts={userPosts} listDisplayMode={settings.homeFeedPostListDisplayMode} /> : null}
      {route.currentPostTab === "replies" ? <MyRepliesPanel replies={replies} postLinkDisplayMode={settings.postLinkDisplayMode} /> : null}
      {route.currentPostTab === "favorites" ? <FavoritesPanel favoritePosts={favoritePosts} listDisplayMode={settings.homeFeedPostListDisplayMode} /> : null}
      {route.currentPostTab === "collections" ? <CollectionsPanel favoriteCollections={favoriteCollections} /> : null}
      {route.currentPostTab === "likes" ? <MyLikesPanel likedPosts={likedPosts} listDisplayMode={settings.homeFeedPostListDisplayMode} /> : null}
    </div>
  )
}

function MyPostsPanel({
  userPosts,
  listDisplayMode,
}: {
  userPosts: SettingsPageData["userPosts"]
  listDisplayMode: SettingsPageData["settings"]["homeFeedPostListDisplayMode"]
}) {
  if (!userPosts) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载我的帖子，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return <PostListPanel title="我的帖子" emptyText="当前还没有发布过帖子。" posts={userPosts} listDisplayMode={listDisplayMode} paginationBase="/settings?tab=post-management&postTab=posts" />
}

function MyRepliesPanel({
  replies,
  postLinkDisplayMode,
}: {
  replies: SettingsPageData["replies"]
  postLinkDisplayMode: SettingsPageData["settings"]["postLinkDisplayMode"]
}) {
  if (!replies) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载我的回复，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>我的回复</CardTitle>
          <span className="text-sm text-muted-foreground">共 {replies.total} 条记录</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <UserRecentRepliesList replies={replies.items} postLinkDisplayMode={postLinkDisplayMode} emptyText="当前还没有发表过回复。" />

        {replies.total > 0 ? (
          <CursorPaginationBar
            hasPrevPage={replies.hasPrevPage}
            hasNextPage={replies.hasNextPage}
            prevHref={buildCursorHref("/settings?tab=post-management&postTab=replies", "listBefore", replies.prevCursor)}
            nextHref={buildCursorHref("/settings?tab=post-management&postTab=replies", "listAfter", replies.nextCursor)}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function FavoritesPanel({
  favoritePosts,
  listDisplayMode,
}: {
  favoritePosts: SettingsPageData["favoritePosts"]
  listDisplayMode: SettingsPageData["settings"]["homeFeedPostListDisplayMode"]
}) {
  if (!favoritePosts) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载收藏列表，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return <PostListPanel title="我的收藏" emptyText="当前还没有收藏的帖子。" posts={favoritePosts} listDisplayMode={listDisplayMode} paginationBase="/settings?tab=post-management&postTab=favorites" />
}

function CollectionsPanel({ favoriteCollections }: { favoriteCollections: SettingsPageData["favoriteCollections"] }) {
  return <FavoriteCollectionManager initialData={favoriteCollections} />
}

function MyLikesPanel({
  likedPosts,
  listDisplayMode,
}: {
  likedPosts: SettingsPageData["likedPosts"]
  listDisplayMode: SettingsPageData["settings"]["homeFeedPostListDisplayMode"]
}) {
  if (!likedPosts) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载点赞列表，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return <PostListPanel title="我的点赞" emptyText="当前还没有点赞过帖子。" posts={likedPosts} listDisplayMode={listDisplayMode} paginationBase="/settings?tab=post-management&postTab=likes" />
}

function PostListPanel({
  title,
  emptyText,
  posts,
  listDisplayMode,
  paginationBase,
}: {
  title: string
  emptyText: string
  posts: NonNullable<SettingsPageData["userPosts"]>
  listDisplayMode: SettingsPageData["settings"]["homeFeedPostListDisplayMode"]
  paginationBase: string
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <span className="text-sm text-muted-foreground">共 {posts.total} 条记录</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {posts.items.length === 0 ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null}
        {posts.items.length > 0 ? <ForumPostStream compactFirstItem={false} posts={posts.items} showBoard listDisplayMode={listDisplayMode} /> : null}

        {posts.total > 0 ? (
          <CursorPaginationBar
            hasPrevPage={posts.hasPrevPage}
            hasNextPage={posts.hasNextPage}
            prevHref={buildCursorHref(paginationBase, "listBefore", posts.prevCursor)}
            nextHref={buildCursorHref(paginationBase, "listAfter", posts.nextCursor)}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function CursorPaginationBar({ hasPrevPage, hasNextPage, prevHref, nextHref }: { hasPrevPage: boolean; hasNextPage: boolean; prevHref: string; nextHref: string }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-2">
      <Link
        href={hasPrevPage ? prevHref : "#"}
        aria-disabled={!hasPrevPage}
        className={hasPrevPage ? "rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-accent/40" : "pointer-events-none rounded-full border border-border px-4 py-2 text-sm text-muted-foreground opacity-50"}
      >
        上一页
      </Link>
      <Link
        href={hasNextPage ? nextHref : "#"}
        aria-disabled={!hasNextPage}
        className={hasNextPage ? "rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-accent/40" : "pointer-events-none rounded-full border border-border px-4 py-2 text-sm text-muted-foreground opacity-50"}
      >
        下一页
      </Link>
    </div>
  )
}
