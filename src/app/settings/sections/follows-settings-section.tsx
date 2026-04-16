import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { ForumPostStream } from "@/components/forum/forum-post-stream"
import { ReadingHistoryPanel } from "@/components/post/reading-history-panel"
import { SettingsTabs } from "@/components/settings/settings-tabs"
import { UserAvatar } from "@/components/user/user-avatar"
import { UserBlockToggleButton } from "@/components/user/user-block-toggle-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buildSettingsHref } from "@/app/settings/settings-page-loader"
import { followTabs } from "@/app/settings/settings-page-loader"
import type { SettingsPageData } from "@/app/settings/settings-page-loader"

type SocialUserListItem = {
  id: number
  username: string
  displayName: string
  avatarPath?: string | null
}

type SocialUserListResult = {
  total: number
  items: SocialUserListItem[]
  hasPrevPage: boolean
  hasNextPage: boolean
  prevCursor: string | null
  nextCursor: string | null
}

function buildCursorHref(route: SettingsPageData["route"], basePath: string, queryKey: string, cursor: string | null) {
  if (!cursor) {
    return "#"
  }

  const [, queryPart = ""] = basePath.split("?", 2)
  const baseSearchParams = Object.fromEntries(new URLSearchParams(queryPart).entries())

  return buildSettingsHref(route, {
    ...baseSearchParams,
    [queryKey]: cursor,
  })
}

export function FollowsSettingsSection({ data }: { data: SettingsPageData }) {
  const { route, settings, followedBoards, followedUsers, followers, followedTags, followedPosts, blockedUsers } = data

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-4">
          <div className="space-y-1">
            <CardTitle>我的关注</CardTitle>
            <p className="text-sm text-muted-foreground">统一管理你关注的节点、用户、标签和帖子动态。</p>
          </div>
          <SettingsTabs tabs={followTabs} queryKey="followTab" basePath="/settings?tab=follows" />
        </CardHeader>
      </Card>

      {route.currentFollowTab === "boards" ? <FollowBoardsPanel route={route} followedBoards={followedBoards} /> : null}
      {route.currentFollowTab === "users" ? <FollowUsersPanel route={route} followedUsers={followedUsers} /> : null}
      {route.currentFollowTab === "followers" ? <FollowersPanel route={route} followers={followers} /> : null}
      {route.currentFollowTab === "tags" ? <FollowTagsPanel route={route} followedTags={followedTags} /> : null}
      {route.currentFollowTab === "posts" ? <FollowPostsPanel route={route} followedPosts={followedPosts} listDisplayMode={settings.homeFeedPostListDisplayMode} /> : null}
      {route.currentFollowTab === "history" ? <ReadingHistoryTabPanel /> : null}
      {route.currentFollowTab === "blocks" ? <BlockedUsersPanel route={route} blockedUsers={blockedUsers} /> : null}
    </div>
  )
}

function ReadingHistoryTabPanel() {
  return (
    <ReadingHistoryPanel
      variant="page"
      title="足迹"
      showClearButton
      emptyDescription="浏览过的帖子会自动保存在当前浏览器本地，最多保留 2000 条。"
    />
  )
}

function FollowBoardsPanel({ route, followedBoards }: { route: SettingsPageData["route"]; followedBoards: SettingsPageData["followedBoards"] }) {
  if (!followedBoards) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载关注节点，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>关注节点</CardTitle>
          <span className="text-sm text-muted-foreground">共 {followedBoards.total} 个节点</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {followedBoards.items.length === 0 ? <p className="text-sm text-muted-foreground">你还没有关注任何节点。</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {followedBoards.items.map((board) => (
            <Link key={board.id} href={`/boards/${board.slug}`} className="rounded-[18px] border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">💬</span>
                    <p className="truncate text-sm font-semibold text-foreground">{board.name}</p>
                  </div>
                  {board.zoneName ? <p className="mt-1 text-xs text-muted-foreground">所属分区：{board.zoneName}</p> : null}
                </div>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{board.description?.trim() || "这个节点还没有填写简介。"}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span>内容 {board.postCount}</span>
                <span>关注 {board.followerCount}</span>
              </div>
            </Link>
          ))}
        </div>

        {followedBoards.total > 0 ? (
          <CursorPaginationBar
            hasPrevPage={followedBoards.hasPrevPage}
            hasNextPage={followedBoards.hasNextPage}
            prevHref={buildCursorHref(route, "/settings?tab=follows&followTab=boards", "listBefore", followedBoards.prevCursor)}
            nextHref={buildCursorHref(route, "/settings?tab=follows&followTab=boards", "listAfter", followedBoards.nextCursor)}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function FollowUsersPanel({ route, followedUsers }: { route: SettingsPageData["route"]; followedUsers: SettingsPageData["followedUsers"] }) {
  return (
    <SocialUserListPanel
      route={route}
      users={followedUsers}
      title="关注用户"
      emptyText="你还没有关注任何用户。"
      errorText="暂时无法加载关注用户，请稍后刷新重试。"
      paginationBase="/settings?tab=follows&followTab=users"
    />
  )
}

function FollowersPanel({ route, followers }: { route: SettingsPageData["route"]; followers: SettingsPageData["followers"] }) {
  return (
    <SocialUserListPanel
      route={route}
      users={followers}
      title="我的粉丝"
      emptyText="当前还没有粉丝。"
      errorText="暂时无法加载粉丝列表，请稍后刷新重试。"
      paginationBase="/settings?tab=follows&followTab=followers"
    />
  )
}

function FollowTagsPanel({ route, followedTags }: { route: SettingsPageData["route"]; followedTags: SettingsPageData["followedTags"] }) {
  if (!followedTags) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载关注标签，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>关注标签</CardTitle>
          <span className="text-sm text-muted-foreground">共 {followedTags.total} 个标签</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {followedTags.items.length === 0 ? <p className="text-sm text-muted-foreground">你还没有关注任何标签。</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {followedTags.items.map((tag) => (
            <Link key={tag.id} href={`/tags/${tag.slug}`} className="rounded-[18px] border border-border bg-card px-4 py-4 transition-colors hover:bg-accent/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">#{tag.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">/tags/{tag.slug}</p>
                </div>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span>内容 {tag.postCount}</span>
                <span>关注 {tag.followerCount}</span>
              </div>
            </Link>
          ))}
        </div>

        {followedTags.total > 0 ? (
          <CursorPaginationBar
            hasPrevPage={followedTags.hasPrevPage}
            hasNextPage={followedTags.hasNextPage}
            prevHref={buildCursorHref(route, "/settings?tab=follows&followTab=tags", "listBefore", followedTags.prevCursor)}
            nextHref={buildCursorHref(route, "/settings?tab=follows&followTab=tags", "listAfter", followedTags.nextCursor)}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function FollowPostsPanel({
  route,
  followedPosts,
  listDisplayMode,
}: {
  route: SettingsPageData["route"]
  followedPosts: SettingsPageData["followedPosts"]
  listDisplayMode: SettingsPageData["settings"]["homeFeedPostListDisplayMode"]
}) {
  if (!followedPosts) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载关注帖子，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return <PostListPanel route={route} title="关注帖子" emptyText="当前还没有关注任何帖子。" posts={followedPosts} listDisplayMode={listDisplayMode} paginationBase="/settings?tab=follows&followTab=posts" />
}

function BlockedUsersPanel({ route, blockedUsers }: { route: SettingsPageData["route"]; blockedUsers: SettingsPageData["blockedUsers"] }) {
  return (
    <SocialUserListPanel
      route={route}
      users={blockedUsers}
      title="拉黑用户"
      emptyText="当前还没有拉黑任何用户。"
      errorText="暂时无法加载拉黑列表，请稍后刷新重试。"
      paginationBase="/settings?tab=follows&followTab=blocks"
      renderAction={(user) => (
        <UserBlockToggleButton
          targetUserId={user.id}
          initialBlocked
          activeLabel="取消拉黑"
          inactiveLabel="拉黑用户"
          showLabel
          reloadOnChange
          className="h-7 shrink-0 rounded-full px-2.5 text-xs"
        />
      )}
    />
  )
}

function SocialUserListPanel({
  route,
  users,
  title,
  emptyText,
  errorText,
  paginationBase,
  renderAction,
}: {
  route: SettingsPageData["route"]
  users: SocialUserListResult | null
  title: string
  emptyText: string
  errorText: string
  paginationBase: string
  renderAction?: (user: SocialUserListItem) => ReactNode
}) {
  if (!users) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">{errorText}</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <span className="text-sm text-muted-foreground">共 {users.total} 位用户</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {users.items.length === 0 ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null}

        {users.items.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {users.items.map((user) => (
              <SocialUserRow key={user.id} user={user} action={renderAction?.(user)} />
            ))}
          </div>
        ) : null}

        {users.total > 0 ? (
          <CursorPaginationBar
            hasPrevPage={users.hasPrevPage}
            hasNextPage={users.hasNextPage}
            prevHref={buildCursorHref(route, paginationBase, "listBefore", users.prevCursor)}
            nextHref={buildCursorHref(route, paginationBase, "listAfter", users.nextCursor)}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function SocialUserRow({ user, action }: { user: SocialUserListItem; action?: ReactNode }) {
  const profileLabel = user.displayName === user.username ? user.displayName : `${user.displayName} (@${user.username})`

  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/70 bg-background px-2 py-2 transition-colors hover:bg-accent/30">
      <Link href={`/users/${user.username}`} className="group flex min-w-0 items-center gap-2" title={profileLabel}>
        <UserAvatar name={user.displayName || user.username} avatarPath={user.avatarPath} size="xs" />
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">@{user.username}</p>
          {user.displayName !== user.username ? <p className="truncate text-xs text-muted-foreground">{user.displayName}</p> : null}
        </div>
      </Link>
      {action}
    </div>
  )
}

function PostListPanel({
  route,
  title,
  emptyText,
  posts,
  listDisplayMode,
  paginationBase,
}: {
  route: SettingsPageData["route"]
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
            prevHref={buildCursorHref(route, paginationBase, "listBefore", posts.prevCursor)}
            nextHref={buildCursorHref(route, paginationBase, "listAfter", posts.nextCursor)}
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
