import type { Metadata } from "next"
import Link from "next/link"

import { CreatePostForm } from "@/components/post/create-post-form"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/rbutton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buildUserLevelThresholdOptions, buildVipLevelThresholdOptions } from "@/lib/access-threshold-options"
import { getCurrentUser } from "@/lib/auth"
import { getBoards, type SiteBoardItem } from "@/lib/boards"
import { getLevelDefinitions } from "@/lib/level-system"
import { parsePostContentDocument } from "@/lib/post-content"
import { parsePostRewardPoolConfigFromContent } from "@/lib/post-red-packets"
import { getEditablePostBySlug } from "@/lib/posts"
import { DEFAULT_ALLOWED_POST_TYPES } from "@/lib/post-types"
import { readSearchParam } from "@/lib/search-params"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones, type SiteZoneItem } from "@/lib/zones"

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

function isPostStillEditable(createdAt: Date | string, editableMinutes: number) {
  return new Date(createdAt).getTime() + Math.max(0, editableMinutes) * 60 * 1000 > Date.now()
}

export async function generateMetadata(props: PageProps<"/write">): Promise<Metadata> {
  const searchParams = await props.searchParams
  const mode = readSearchParam(searchParams?.mode) === "edit" ? "编辑帖子" : "发布帖子"
  const settings = await getSiteSettings()

  return {
    title: `${mode} - ${settings.siteName}`,
  }
}

export default async function WritePage(props: PageProps<"/write">) {
  const searchParams = await props.searchParams;
  const [user, zones, boards, settings, levelDefinitions] = await Promise.all([getCurrentUser(), getZones(), getBoards(), getSiteSettings(), getLevelDefinitions()])
  const mode = readSearchParam(searchParams?.mode) === "edit" ? "edit" : "create"
  const editingSlug = readSearchParam(searchParams?.post)
  const preferredBoardSlug = readSearchParam(searchParams?.board) ?? ""
  const viewLevelOptions = buildUserLevelThresholdOptions(levelDefinitions)
  const viewVipLevelOptions = buildVipLevelThresholdOptions()

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
  const rewardPoolConfig = editingPost ? parsePostRewardPoolConfigFromContent(editingPost.content) : null
  const publicBlock = contentDocument?.blocks.find((block) => block.type === "PUBLIC")
  const loginUnlockBlock = contentDocument?.blocks.find((block) => block.type === "LOGIN_UNLOCK")
  const replyUnlockBlock = contentDocument?.blocks.find((block) => block.type === "REPLY_UNLOCK")
  const purchaseUnlockBlock = contentDocument?.blocks.find((block) => block.type === "PURCHASE_UNLOCK")

  const isAdmin = user.role === "ADMIN"
  const canEditThisPost = Boolean(editingPost && (editingPost.authorId === user.id || isAdmin))
  const isStillEditable = Boolean(editingPost && isPostStillEditable(editingPost.createdAt, settings.postEditableMinutes)) || isAdmin

  return (
    <div className="min-h-screen ">
      <SiteHeader />
      <main className="mx-auto max-w-[900px] px-4 py-6 lg:px-6">
        <Card className="min-[1220px]:overflow-visible">
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
                  anonymousPostEnabled={settings.anonymousPostEnabled}
                  anonymousPostPrice={settings.anonymousPostPrice}
                  markdownEmojiMap={settings.markdownEmojiMap}
                  currentUser={{
                    username: user.username,
                    nickname: user.nickname,
                    role: user.role,
                    level: user.level,
                    points: user.points,
                    vipLevel: user.vipLevel,
                    vipExpiresAt: user.vipExpiresAt?.toISOString?.() ? user.vipExpiresAt.toISOString() : (user.vipExpiresAt as unknown as string | null),
                  }}
                  attachmentFeature={{
                    uploadEnabled: settings.attachmentUploadEnabled,
                    minUploadLevel: settings.attachmentMinUploadLevel,
                    minUploadVipLevel: settings.attachmentMinUploadVipLevel,
                    allowedExtensions: settings.attachmentAllowedExtensions,
                    maxFileSizeMb: settings.attachmentMaxFileSizeMb,
                  }}
                  viewLevelOptions={viewLevelOptions}
                  viewVipLevelOptions={viewVipLevelOptions}
                  mode="edit"
                  postId={editingPost.id}
                  successSlug={editingPost.slug}
                  postLinkDisplayMode={settings.postLinkDisplayMode}
                  initialValues={{
                    title: editingPost.title,
                    content: publicBlock?.text ?? editingPost.content,
                    isAnonymous: editingPost.isAnonymous,
                    coverPath: editingPost.coverPath,
                    commentsVisibleToAuthorOnly: editingPost.commentsVisibleToAuthorOnly,
                    loginUnlockContent: loginUnlockBlock?.text ?? "",
                    replyUnlockContent: replyUnlockBlock?.text ?? "",
                    replyThreshold: replyUnlockBlock?.replyThreshold ?? 1,
                    purchaseUnlockContent: purchaseUnlockBlock?.text ?? "",
                    purchasePrice: purchaseUnlockBlock?.price ?? null,
                    minViewLevel: editingPost.minViewLevel,
                    minViewVipLevel: editingPost.minViewVipLevel,
                    boardSlug: editingPost.board.slug,
                    postType: editingPost.type,
                    bountyPoints: editingPost.bountyPoints,
                    auctionConfig: editingPost.auction
                      ? {
                          mode: editingPost.auction.mode,
                          pricingRule: editingPost.auction.pricingRule,
                          startPrice: editingPost.auction.startPrice,
                          incrementStep: editingPost.auction.incrementStep,
                          startsAt: editingPost.auction.startsAt?.toISOString() ?? null,
                          endsAt: editingPost.auction.endsAt.toISOString(),
                          winnerOnlyContent: editingPost.auction.winnerOnlyContent,
                          winnerOnlyContentPreview: editingPost.auction.winnerOnlyContentPreview,
                        }
                      : undefined,
                    pollOptions: editingPost.pollOptions.map((item) => item.content),
                    tags: editingPost.tags.map((item) => item.tag.name),
                    attachments: editingPost.attachments.map((attachment) => ({
                      id: attachment.id,
                      sourceType: attachment.sourceType,
                      uploadId: attachment.uploadId ?? null,
                      name: attachment.name,
                      externalUrl: attachment.externalUrl ?? null,
                      externalCode: attachment.externalCode ?? null,
                      fileSize: attachment.fileSize ?? attachment.upload?.fileSize ?? null,
                      fileExt: attachment.fileExt ?? attachment.upload?.fileExt ?? null,
                      mimeType: attachment.mimeType ?? attachment.upload?.mimeType ?? null,
                      minDownloadLevel: attachment.minDownloadLevel,
                      minDownloadVipLevel: attachment.minDownloadVipLevel,
                      pointsCost: attachment.pointsCost,
                      requireReplyUnlock: attachment.requireReplyUnlock,
                    })),
                    redPacketConfig: editingPost.redPacket && rewardPoolConfig
                      ? {
                          mode: rewardPoolConfig.mode,
                          enabled: true,
                          grantMode: rewardPoolConfig.mode === "RED_PACKET" ? editingPost.redPacket.grantMode : undefined,
                          claimOrderMode: rewardPoolConfig.mode === "RED_PACKET" ? editingPost.redPacket.claimOrderMode : undefined,
                          triggerType: editingPost.redPacket.triggerType,
                          initialPoints: rewardPoolConfig.mode === "JACKPOT" ? rewardPoolConfig.initialPoints : undefined,
                          totalPoints: rewardPoolConfig.mode === "RED_PACKET" ? editingPost.redPacket.totalPoints : undefined,
                          unitPoints: rewardPoolConfig.mode === "RED_PACKET"
                            ? (editingPost.redPacket.grantMode === "FIXED"
                              ? Math.floor(editingPost.redPacket.totalPoints / Math.max(1, editingPost.redPacket.packetCount))
                              : editingPost.redPacket.totalPoints)
                            : undefined,
                          packetCount: rewardPoolConfig.mode === "RED_PACKET" ? editingPost.redPacket.packetCount : undefined,
                        }
                      : undefined,
                  }}
                  postRedPacketEnabled={settings.postRedPacketEnabled}
                  postRedPacketMaxPoints={settings.postRedPacketMaxPoints}
                  postJackpotEnabled={settings.postJackpotEnabled}
                  postJackpotMinInitialPoints={settings.postJackpotMinInitialPoints}
                  postJackpotMaxInitialPoints={settings.postJackpotMaxInitialPoints}
                  postJackpotReplyIncrementPoints={settings.postJackpotReplyIncrementPoints}
                  postJackpotHitProbability={settings.postJackpotHitProbability}
                />
              )
            ) : (
              <CreatePostForm
                boardOptions={boardOptions}
                pointName={settings.pointName}
                anonymousPostEnabled={settings.anonymousPostEnabled}
                anonymousPostPrice={settings.anonymousPostPrice}
                postRedPacketEnabled={settings.postRedPacketEnabled}
                postRedPacketMaxPoints={settings.postRedPacketMaxPoints}
                postJackpotEnabled={settings.postJackpotEnabled}
                postJackpotMinInitialPoints={settings.postJackpotMinInitialPoints}
                postJackpotMaxInitialPoints={settings.postJackpotMaxInitialPoints}
                postJackpotReplyIncrementPoints={settings.postJackpotReplyIncrementPoints}
                postJackpotHitProbability={settings.postJackpotHitProbability}
                markdownEmojiMap={settings.markdownEmojiMap}
                currentUser={{
                  username: user.username,
                  nickname: user.nickname,
                  role: user.role,
                  level: user.level,
                  points: user.points,
                  vipLevel: user.vipLevel,
                  vipExpiresAt: user.vipExpiresAt?.toISOString?.() ? user.vipExpiresAt.toISOString() : (user.vipExpiresAt as unknown as string | null),
                }}
                attachmentFeature={{
                  uploadEnabled: settings.attachmentUploadEnabled,
                  minUploadLevel: settings.attachmentMinUploadLevel,
                  minUploadVipLevel: settings.attachmentMinUploadVipLevel,
                  allowedExtensions: settings.attachmentAllowedExtensions,
                  maxFileSizeMb: settings.attachmentMaxFileSizeMb,
                }}
                viewLevelOptions={viewLevelOptions}
                viewVipLevelOptions={viewVipLevelOptions}
                postLinkDisplayMode={settings.postLinkDisplayMode}
                initialValues={preferredBoardSlug ? { title: "", content: "", isAnonymous: false, boardSlug: preferredBoardSlug, postType: "NORMAL" } : undefined}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
