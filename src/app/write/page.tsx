import Link from "next/link"

import { CreatePostForm } from "@/components/create-post-form"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { getBoards, type SiteBoardItem } from "@/lib/boards"
import { parsePostContentDocument } from "@/lib/post-content"
import { getEditablePostBySlug } from "@/lib/posts"
import { DEFAULT_ALLOWED_POST_TYPES } from "@/lib/post-types"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones, type SiteZoneItem } from "@/lib/zones"

interface WritePageProps {
  searchParams?: {
    mode?: string
    post?: string
    board?: string
  }
}

interface BoardOptionItem {
  value: string
  label: string
  allowedPostTypes: string[]
  requirePostReview: boolean
  minPostPoints: number
  minPostLevel: number
  minPostVipLevel: number
}

interface BoardOptionGroup {
  zone: string
  items: BoardOptionItem[]
}

function mapBoardOption(board: SiteBoardItem): BoardOptionItem {
  return {
    value: board.slug,
    label: board.name,
    allowedPostTypes: board.allowedPostTypes ?? DEFAULT_ALLOWED_POST_TYPES,
    requirePostReview: board.requirePostReview ?? false,
    minPostPoints: board.minPostPoints ?? 0,
    minPostLevel: board.minPostLevel ?? 0,
    minPostVipLevel: board.minPostVipLevel ?? 0,
  }
}

export default async function WritePage({ searchParams }: WritePageProps) {
  const [user, zones, boards, settings] = await Promise.all([getCurrentUser(), getZones(), getBoards(), getSiteSettings()])
  const mode = searchParams?.mode === "edit" ? "edit" : "create"
  const editingSlug = searchParams?.post
  const preferredBoardSlug = searchParams?.board ?? ""

  const groupedBoardOptions: BoardOptionGroup[] = zones
    .map((zone: SiteZoneItem) => ({
      zone: zone.name,
      items: boards
        .filter((board: SiteBoardItem) => zone.boardSlugs.includes(board.slug))
        .map((board: SiteBoardItem) => mapBoardOption(board)),
    }))
    .filter((group: BoardOptionGroup) => group.items.length > 0)

  const groupedBoardSlugs = new Set(groupedBoardOptions.flatMap((group: BoardOptionGroup) => group.items.map((item: BoardOptionItem) => item.value)))
  const ungroupedBoards: BoardOptionItem[] = boards
    .filter((board: SiteBoardItem) => !groupedBoardSlugs.has(board.slug))
    .map((board: SiteBoardItem) => mapBoardOption(board))

  const boardOptions: BoardOptionGroup[] = ungroupedBoards.length > 0
    ? [...groupedBoardOptions, { zone: "未分区节点", items: ungroupedBoards }]
    : groupedBoardOptions

  if (!user) {
    return (
      <div className="min-h-screen ">
        <SiteHeader />
        <main className="mx-auto max-w-[720px] px-4 py-10 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle>发布帖子前请先登录</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
              <p>为了确保每篇内容都能追溯到明确作者，当前发帖功能需要先登录后再提交。</p>
              <Link href="/login">
                <Button>前往登录</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const editingPost = mode === "edit" && editingSlug
    ? await getEditablePostBySlug(editingSlug)
    : null

  const contentDocument = editingPost ? parsePostContentDocument(editingPost.content) : null
  const publicBlock = contentDocument?.blocks.find((block) => block.type === "PUBLIC")
  const replyUnlockBlock = contentDocument?.blocks.find((block) => block.type === "REPLY_UNLOCK")
  const purchaseUnlockBlock = contentDocument?.blocks.find((block) => block.type === "PURCHASE_UNLOCK")

  const isAdmin = user.role === "ADMIN" || user.role === "MODERATOR"
  const canEditThisPost = Boolean(editingPost && (editingPost.authorId === user.id || isAdmin))
  const isStillEditable = Boolean(editingPost && (new Date(editingPost.createdAt).getTime() + Math.max(0, settings.postEditableMinutes) * 60 * 1000 > Date.now())) || isAdmin

  return (
    <div className="min-h-screen ">
      <SiteHeader />
      <main className="mx-auto max-w-[900px] px-4 py-6 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>{mode === "edit" ? "编辑帖子" : "发布新帖子"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === "edit" ? (
              !editingPost ? (
                <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">未找到要编辑的帖子。</div>
              ) : !canEditThisPost ? (
                <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">你无权编辑这篇帖子。</div>
              ) : !isStillEditable ? (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">该帖子已超过 {settings.postEditableMinutes} 分钟编辑窗口，请回到详情页使用附言追加功能。</div>
              ) : (
                <CreatePostForm
                  boardOptions={boardOptions}
                  pointName={settings.pointName}
                  markdownEmojiMap={settings.markdownEmojiMap}
                  currentUser={{
                    username: user.username,
                    nickname: user.nickname,
                    level: user.level,
                    points: user.points,
                    vipLevel: user.vipLevel,
                    vipExpiresAt: user.vipExpiresAt?.toISOString?.() ? user.vipExpiresAt.toISOString() : (user.vipExpiresAt as unknown as string | null),
                  }}
                  mode="edit"
                  postId={editingPost.id}
                  successSlug={editingPost.slug}
                  initialValues={{
                    title: editingPost.title,
                    content: publicBlock?.text ?? editingPost.content,
                    commentsVisibleToAuthorOnly: editingPost.commentsVisibleToAuthorOnly,
                    replyUnlockContent: replyUnlockBlock?.text ?? "",
                    replyThreshold: replyUnlockBlock?.replyThreshold ?? 1,
                    purchaseUnlockContent: purchaseUnlockBlock?.text ?? "",
                    purchasePrice: purchaseUnlockBlock?.price ?? null,
                    minViewLevel: editingPost.minViewLevel,
                    boardSlug: editingPost.board.slug,
                    postType: editingPost.type,
                    bountyPoints: editingPost.bountyPoints,
                    pollOptions: editingPost.pollOptions.map((item) => item.content),
                    tags: editingPost.tags.map((item) => item.tag.name),
                    redPacketConfig: editingPost.redPacket
                      ? {
                          enabled: true,
                          grantMode: editingPost.redPacket.grantMode,
                          triggerType: editingPost.redPacket.triggerType,
                          totalPoints: editingPost.redPacket.totalPoints,
                          unitPoints: editingPost.redPacket.grantMode === "FIXED"
                            ? Math.floor(editingPost.redPacket.totalPoints / Math.max(1, editingPost.redPacket.packetCount))
                            : editingPost.redPacket.totalPoints,
                          packetCount: editingPost.redPacket.packetCount,
                        }
                      : undefined,
                  }}
                />
              )
            ) : (
              <CreatePostForm
                boardOptions={boardOptions}
                pointName={settings.pointName}
                postRedPacketEnabled={settings.postRedPacketEnabled}
                markdownEmojiMap={settings.markdownEmojiMap}
                currentUser={{
                  username: user.username,
                  nickname: user.nickname,
                  level: user.level,
                  points: user.points,
                  vipLevel: user.vipLevel,
                  vipExpiresAt: user.vipExpiresAt?.toISOString?.() ? user.vipExpiresAt.toISOString() : (user.vipExpiresAt as unknown as string | null),
                }}
                initialValues={preferredBoardSlug ? { title: "", content: "", boardSlug: preferredBoardSlug, postType: "NORMAL" } : undefined}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
