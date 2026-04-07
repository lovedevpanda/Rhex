"use client"

import { useEffect, useMemo, useState } from "react"
import { CircleHelp } from "lucide-react"

import { useAdminMutation } from "@/hooks/use-admin-mutation"
import { AdminBooleanSelectField } from "@/components/admin-boolean-select-field"
import { AdminPillTabs } from "@/components/admin-pill-tabs"
import { AdminModal } from "@/components/admin-modal"
import { Button } from "@/components/ui/button"
import { TextField } from "@/components/ui/text-field"
import { toast } from "@/components/ui/toast"
import {
  buildAdminBasicSettingsPayload,
  createAdminBasicSettingsDraft,
  resolveHomeFeedPostListDisplayMode,
  SiteLogoUploadCard,
  uploadSiteLogoFile,
  type AdminBasicSettingsInitialSettings,
  type AdminBasicSettingsMode,
  type AdminBasicSettingsDraft,
} from "@/components/admin-site-settings.shared"
import { PickerPopover, PickerTriggerField, normalizeHexColor } from "@/components/admin-picker-popover"
import { AdminInviteCodeManager } from "@/components/admin-invite-code-manager"
import { AdminTippingGiftListEditor } from "@/components/admin-tipping-gift-list-editor"
import { adminPost } from "@/lib/admin-client"
import { calculatePostHeatScore, resolvePostHeatStyle } from "@/lib/post-heat"
import { POST_LIST_LOAD_MODE_INFINITE, POST_LIST_LOAD_MODE_PAGINATION } from "@/lib/post-list-load-mode"
import { POST_LIST_DISPLAY_MODE_DEFAULT, POST_LIST_DISPLAY_MODE_GALLERY } from "@/lib/post-list-display"

interface AdminBasicSettingsFormProps {
  initialSettings: AdminBasicSettingsInitialSettings
  mode?: AdminBasicSettingsMode
  initialSubTab?: string
  initialInviteCodes?: Array<{
    id: string
    code: string
    createdAt: string
    createdByUsername: string | null
    usedAt: string | null
    usedByUsername: string | null
    note: string | null
  }>
}

const HEAT_COLOR_PRESETS = ["#4A4A4A", "#808080", "#9B8F7F", "#B87333", "#C4A777", "#E8C547", "#FFA500", "#D96C3B", "#C41E3A", "#6B7280", "#F59E0B", "#EF4444", "#8B5CF6", "#10B981"]
const INTERNAL_SETTING_TABS: Record<AdminBasicSettingsMode, Array<{ key: string; label: string }>> = {
  profile: [
    { key: "branding", label: "品牌基础" },
    { key: "homepage", label: "首页展示" },
    { key: "seo", label: "SEO 与统计" },
  ],
  registration: [
    { key: "invite", label: "注册与邀请码" },
    { key: "invite-codes", label: "邀请码管理" },
    { key: "captcha", label: "验证码" },
    { key: "fields", label: "表单字段" },
    { key: "auth", label: "第三方登录" },
    { key: "smtp", label: "SMTP 邮件" },
  ],
  interaction: [
    { key: "comments", label: "评论展示" },
    { key: "content-limits", label: "内容限制" },
    { key: "anonymous-post", label: "匿名发帖" },
    { key: "tipping", label: "打赏送礼" },
    { key: "gates", label: "发布门槛" },
    { key: "reward-pool", label: "红包与聚宝盆" },
    { key: "heat", label: "热度算法" },
    { key: "preview", label: "热度预览" },
  ],
  "board-applications": [
    { key: "general", label: "基础设置" },
  ],
}

const INTERNAL_SETTING_TAB_DEFAULT: Record<AdminBasicSettingsMode, string> = {
  profile: "branding",
  registration: "invite",
  interaction: "comments",
  "board-applications": "general",
}

function parseNumberList(raw: string) {
  return raw
    .split(/[，,\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item))
}

function normalizeHeatThresholdsInput(raw: string) {
  const values = parseNumberList(raw).filter((item) => item >= 0)
  return Array.from(new Set(values)).sort((left, right) => left - right)
}

export function AdminBasicSettingsForm({ initialSettings, mode = "profile", initialSubTab, initialInviteCodes = [] }: AdminBasicSettingsFormProps) {
  const [draft, setDraft] = useState(() => createAdminBasicSettingsDraft(initialSettings))
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [editingHeatColorIndex, setEditingHeatColorIndex] = useState<number | null>(null)
  const [authDocOpen, setAuthDocOpen] = useState(false)
  const [siteOrigin, setSiteOrigin] = useState("https://your-domain.com")
  const [activeSubTab, setActiveSubTab] = useState(() => resolveInternalSettingTab(mode, initialSubTab))
  const { isPending, runMutation } = useAdminMutation()

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSiteOrigin(window.location.origin)
    }
  }, [])

  useEffect(() => {
    setActiveSubTab(resolveInternalSettingTab(mode, initialSubTab))
  }, [initialSubTab, mode])

  function updateDraftField<Key extends keyof AdminBasicSettingsDraft>(field: Key, value: AdminBasicSettingsDraft[Key]) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  const {
    siteName,
    siteSlogan,
    siteDescription,
    siteLogoText,
    siteLogoPath,
    siteSeoKeywords,
    postLinkDisplayMode,
    homeFeedPostListDisplayMode,
    homeFeedPostListLoadMode,
    homeFeedPostPageSize,
    zonePostPageSize,
    boardPostPageSize,
    commentPageSize,
    postTitleMinLength,
    postTitleMaxLength,
    postContentMinLength,
    postContentMaxLength,
    commentContentMinLength,
    commentContentMaxLength,
    homeSidebarHotTopicsCount,
    postSidebarRelatedTopicsCount,
    homeSidebarStatsCardEnabled,
    homeSidebarAnnouncementsEnabled,
    searchEnabled,
    analyticsCode,
    postEditableMinutes,
    commentEditableMinutes,
    guestCanViewComments,
    commentInitialVisibleReplies,
    anonymousPostEnabled,
    anonymousPostPrice,
    anonymousPostDailyLimit,
    anonymousPostMaskUserId,
    anonymousPostAllowReplySwitch,
    anonymousPostDefaultReplyAnonymous,
    postCreateRequireEmailVerified,
    commentCreateRequireEmailVerified,
    postCreateMinRegisteredMinutes,
    commentCreateMinRegisteredMinutes,
    inviteRewardInviter,
    inviteRewardInvitee,
    registerInitialPoints,
    registrationEnabled,
    registrationRequireInviteCode,
    registerInviteCodeEnabled,
    inviteCodePurchaseEnabled,
    boardApplicationEnabled,
    registerCaptchaMode,
    loginCaptchaMode,
    turnstileSiteKey,
    turnstileSecretKey,
    tippingEnabled,
    tippingDailyLimit,
    tippingPerPostLimit,
    tippingAmounts,
    tippingGifts,
    tipGiftTaxEnabled,
    tipGiftTaxRateBps,
    postRedPacketEnabled,
    postRedPacketMaxPoints,
    postRedPacketDailyLimit,
    postRedPacketRandomClaimProbability,
    postJackpotEnabled,
    postJackpotMinInitialPoints,
    postJackpotMaxInitialPoints,
    postJackpotReplyIncrementPoints,
    postJackpotHitProbability,
    heatViewWeight,
    heatCommentWeight,
    heatLikeWeight,
    heatTipCountWeight,
    heatTipPointsWeight,
    homeHotRecentWindowHours,
    heatStageThresholds,
    heatStageColors,
    previewViews,
    previewComments,
    previewLikes,
    previewTipCount,
    previewTipPoints,
    registerEmailEnabled,
    registerEmailRequired,
    registerEmailVerification,
    registerPhoneEnabled,
    registerPhoneRequired,
    registerPhoneVerification,
    registerNicknameEnabled,
    registerNicknameRequired,
    registerGenderEnabled,
    registerGenderRequired,
    registerInviterEnabled,
    authGithubEnabled,
    authGoogleEnabled,
    authPasskeyEnabled,
    githubClientId,
    githubClientSecret,
    googleClientId,
    googleClientSecret,
    passkeyRpId,
    passkeyRpName,
    passkeyOrigin,
    smtpEnabled,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpFrom,
    smtpSecure,
  } = draft

  const previewSettings = useMemo(() => ({
    heatViewWeight: Number(draft.heatViewWeight) || 0,
    heatCommentWeight: Number(draft.heatCommentWeight) || 0,
    heatLikeWeight: Number(draft.heatLikeWeight) || 0,
    heatTipCountWeight: Number(draft.heatTipCountWeight) || 0,
    heatTipPointsWeight: Number(draft.heatTipPointsWeight) || 0,
    heatStageThresholds: normalizeHeatThresholdsInput(draft.heatStageThresholds),
    heatStageColors: draft.heatStageColors,
  }), [draft.heatCommentWeight, draft.heatLikeWeight, draft.heatStageColors, draft.heatStageThresholds, draft.heatTipCountWeight, draft.heatTipPointsWeight, draft.heatViewWeight])

  const previewInput = useMemo(() => ({
    views: Number(draft.previewViews) || 0,
    comments: Number(draft.previewComments) || 0,
    likes: Number(draft.previewLikes) || 0,
    tipCount: Number(draft.previewTipCount) || 0,
    tipPoints: Number(draft.previewTipPoints) || 0,
  }), [draft.previewComments, draft.previewLikes, draft.previewTipCount, draft.previewTipPoints, draft.previewViews])
  const siteHost = useMemo(() => siteOrigin.replace(/^https?:\/\//, "").replace(/\/.*$/, ""), [siteOrigin])
  const resolvedPasskeyRpId = passkeyRpId || siteHost
  const resolvedPasskeyRpName = passkeyRpName || draft.siteName || "你的站点名称"
  const resolvedPasskeyOrigin = passkeyOrigin || siteOrigin

  const previewScore = useMemo(() => calculatePostHeatScore(previewInput, previewSettings), [previewInput, previewSettings])
  const previewHeat = useMemo(() => resolvePostHeatStyle(previewInput, previewSettings), [previewInput, previewSettings])

  function updateHeatColor(index: number, nextColor: string) {
    updateDraftField("heatStageColors", draft.heatStageColors.map((item, currentIndex) => (currentIndex === index ? nextColor : item)))
  }

  async function uploadSiteLogo(file: File) {
    setIsUploadingLogo(true)

    try {
      updateDraftField("siteLogoPath", await uploadSiteLogoFile(file))
      toast.success("站点 Logo 上传成功", "上传成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "站点 Logo 上传失败，请稍后再试", "上传失败")
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const submitText = mode === "profile"
    ? "保存基础信息"
    : mode === "registration"
      ? "保存注册与邀请"
      : mode === "board-applications"
        ? "保存节点申请设置"
        : "保存互动与热度"

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        runMutation({
          mutation: () => adminPost("/api/admin/site-settings", buildAdminBasicSettingsPayload(draft, mode), {
            defaultSuccessMessage: "保存成功",
            defaultErrorMessage: "保存失败",
          }),
          successTitle: "保存成功",
          errorTitle: "保存失败",
          refreshRouter: true,
        })
      }}
    >
      <div className="rounded-[24px]  space-y-4">

        {INTERNAL_SETTING_TABS[mode].length > 1 ? (
          <AdminPillTabs
            items={INTERNAL_SETTING_TABS[mode].map((tab) => ({
              key: tab.key,
              label: tab.label,
              onSelect: () => setActiveSubTab(tab.key),
            }))}
            activeKey={activeSubTab}
          />
        ) : null}
      </div>

      {mode === "profile" && activeSubTab === "branding" ? (
        <div className="rounded-[24px] border border-border p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">品牌与基础信息</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">站点名称、Logo 文案、Slogan 与编辑时效配置。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <TextField label="站点名称" value={siteName} onChange={(value) => updateDraftField("siteName", value)} placeholder="如 兴趣论坛" />
            <TextField label="Logo 文案" value={siteLogoText} onChange={(value) => updateDraftField("siteLogoText", value)} placeholder="如 兴趣论坛" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <TextField label="帖子可编辑分钟数" value={postEditableMinutes} onChange={(value) => updateDraftField("postEditableMinutes", value)} placeholder="如 10" />
            <TextField label="评论可编辑分钟数" value={commentEditableMinutes} onChange={(value) => updateDraftField("commentEditableMinutes", value)} placeholder="如 5" />
          </div>
          <TextField label="站点 Slogan" value={siteSlogan} onChange={(value) => updateDraftField("siteSlogan", value)} placeholder="如 Waste your time on things you love" />
          <SiteLogoUploadCard
            value={siteLogoPath}
            uploading={isUploadingLogo}
            onValueChange={(value) => updateDraftField("siteLogoPath", value)}
            onUpload={uploadSiteLogo}
            onClear={() => updateDraftField("siteLogoPath", "")}
          />
        </div>
      ) : null}

      {mode === "profile" && activeSubTab === "homepage" ? (
        <div className="rounded-[24px] border border-border p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">首页与展示规则</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">帖子链接形式、首页 feed 样式、右侧栏与搜索开关。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">帖子链接显示模式</p>
              <select value={postLinkDisplayMode} onChange={(event) => updateDraftField("postLinkDisplayMode", event.target.value as "SLUG" | "ID")} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none">
                <option value="SLUG">slug 模式（/posts/标题-id）</option>
                <option value="ID">id 模式（/posts/id）</option>
              </select>
              <p className="text-xs leading-6 text-muted-foreground">只影响站内生成给用户看到的帖子链接；旧链接仍保持兼容并会规范跳转到标准地址。</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">首页帖子列表形式</p>
              <select value={homeFeedPostListDisplayMode} onChange={(event) => updateDraftField("homeFeedPostListDisplayMode", resolveHomeFeedPostListDisplayMode(event.target.value))} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none">
                <option value={POST_LIST_DISPLAY_MODE_DEFAULT}>普通列表</option>
                <option value={POST_LIST_DISPLAY_MODE_GALLERY}>画廊模式</option>
              </select>
              <p className="text-xs leading-6 text-muted-foreground">只影响首页 feed 的普通帖子列表；置顶帖始终保持原来的普通列表样式。</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">首页帖子加载方式</p>
              <select value={homeFeedPostListLoadMode} onChange={(event) => updateDraftField("homeFeedPostListLoadMode", event.target.value as typeof POST_LIST_LOAD_MODE_PAGINATION | typeof POST_LIST_LOAD_MODE_INFINITE)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none">
                <option value={POST_LIST_LOAD_MODE_PAGINATION}>分页加载</option>
                <option value={POST_LIST_LOAD_MODE_INFINITE}>无限下拉</option>
              </select>
              <p className="text-xs leading-6 text-muted-foreground">首页可在传统分页和滚动到底部自动加载之间切换。</p>
            </div>
            <AdminBooleanSelectField label="首页右侧统计卡片" checked={homeSidebarStatsCardEnabled} onChange={(value) => updateDraftField("homeSidebarStatsCardEnabled", value)} />
            <AdminBooleanSelectField label="首页右侧站点公告" checked={homeSidebarAnnouncementsEnabled} onChange={(value) => updateDraftField("homeSidebarAnnouncementsEnabled", value)} />
            <AdminBooleanSelectField label="站内搜索" checked={searchEnabled} onChange={(value) => updateDraftField("searchEnabled", value)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <TextField label="首页帖子显示数量" value={homeFeedPostPageSize} onChange={(value) => updateDraftField("homeFeedPostPageSize", value)} placeholder="如 35" />
            <TextField label="分区帖子显示数量" value={zonePostPageSize} onChange={(value) => updateDraftField("zonePostPageSize", value)} placeholder="如 20" />
            <TextField label="节点帖子显示数量" value={boardPostPageSize} onChange={(value) => updateDraftField("boardPostPageSize", value)} placeholder="如 20" />
            <TextField label="今日热帖显示数量" value={homeSidebarHotTopicsCount} onChange={(value) => updateDraftField("homeSidebarHotTopicsCount", value)} placeholder="如 5" />
            <TextField label="帖子相关主题显示数量" value={postSidebarRelatedTopicsCount} onChange={(value) => updateDraftField("postSidebarRelatedTopicsCount", value)} placeholder="如 5" />
          </div>
          <p className="text-xs leading-6 text-muted-foreground">关闭后，前台搜索入口输入关键词将不再跳转站内搜索，而是弹出 `Google 搜索` 和 `Bing 搜索` 两个外部搜索选项。</p>
        </div>
      ) : null}

      {mode === "profile" && activeSubTab === "seo" ? (
        <div className="rounded-[24px] border border-border p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">SEO 与统计</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">站点描述、关键字与页脚统计代码。</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">站点 SEO 关键字</p>
            <textarea value={siteSeoKeywords} onChange={(event) => updateDraftField("siteSeoKeywords", event.target.value)} className="min-h-[96px] w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm outline-none" placeholder="多个关键字请用英文逗号、中文逗号或换行分隔" />
            <p className="text-xs leading-6 text-muted-foreground">这些关键字会写入站点页面的 metadata keywords，用于 SEO 基础配置。</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">页脚统计代码</p>
            <textarea value={analyticsCode} onChange={(event) => updateDraftField("analyticsCode", event.target.value)} className="min-h-[140px] w-full rounded-[24px] border border-border bg-background px-4 py-3 font-mono text-sm outline-none" placeholder="可粘贴统计脚本、站长统计或自定义 hook 代码" />
            <p className="text-xs leading-6 text-muted-foreground">这段代码会插入到全站页脚底部的统计 Hook 容器中，请仅粘贴你信任的统计脚本。</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">站点描述</p>
            <textarea value={siteDescription} onChange={(event) => updateDraftField("siteDescription", event.target.value)} className="min-h-[140px] w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm outline-none" />
          </div>
        </div>
      ) : null}

      {mode === "registration" && activeSubTab === "invite" ? (
        <>
          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">注册与邀请码</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">控制注册开关、邀请码策略，以及用户邀请奖励。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <AdminBooleanSelectField label="允许新用户注册" checked={registrationEnabled} onChange={(value) => updateDraftField("registrationEnabled", value)} />
              <AdminBooleanSelectField label="显示邀请码输入框" checked={registerInviteCodeEnabled} onChange={(value) => updateDraftField("registerInviteCodeEnabled", value)} />
              <AdminBooleanSelectField label="注册必须邀请码" checked={registrationRequireInviteCode} onChange={(value) => updateDraftField("registrationRequireInviteCode", value)} />
              <AdminBooleanSelectField label="开启积分购买邀请码" checked={inviteCodePurchaseEnabled} onChange={(value) => updateDraftField("inviteCodePurchaseEnabled", value)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <TextField label="初始注册赠送积分" value={registerInitialPoints} onChange={(value) => updateDraftField("registerInitialPoints", value)} placeholder="如 0" />
              <TextField label="邀请人奖励数量" value={inviteRewardInviter} onChange={(value) => updateDraftField("inviteRewardInviter", value)} placeholder="如 10" />
              <TextField label="被邀请人奖励数量" value={inviteRewardInvitee} onChange={(value) => updateDraftField("inviteRewardInvitee", value)} placeholder="如 5" />
            </div>
            <p className="text-xs leading-6 text-muted-foreground">填写 `0` 表示新用户首次注册时不额外赠送积分；若大于 `0`，会在注册成功后单独写入一条积分审计日志。</p>
          </div>
        </>
      ) : null}

      {mode === "registration" && activeSubTab === "captcha" ? (
        <>
          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">注册防机器人验证码</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">支持关闭、Cloudflare Turnstile、自建图形验证码与 PoW 工作量证明四种模式。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CaptchaModeField label="注册验证码模式" value={registerCaptchaMode} onChange={(value) => updateDraftField("registerCaptchaMode", value)} />
              <CaptchaModeField label="登录验证码模式" value={loginCaptchaMode} onChange={(value) => updateDraftField("loginCaptchaMode", value)} />
              <TextField label="Turnstile Site Key" value={turnstileSiteKey} onChange={(value) => updateDraftField("turnstileSiteKey", value)} placeholder="填写 Cloudflare Turnstile 公钥" />
              <TextField label="Turnstile Secret Key" type="password" value={turnstileSecretKey} onChange={(value) => updateDraftField("turnstileSecretKey", value)} placeholder="填写 Cloudflare Turnstile 私钥" />
            </div>
            <p className="text-xs leading-6 text-muted-foreground">当模式为 `TURNSTILE` 时，需要同时填写 Site Key 和 Secret Key；当模式为 `BUILTIN` 时，系统会使用站点自建图形验证码；当模式为 `POW` 时，系统会下发签名挑战并要求浏览器完成一次工作量证明，默认读取 `POW_CAPTCHA_SECRET_KEY`，未设置时回退到 `CAPTCHA_SECRET_KEY`。</p>
          </div>
        </>
      ) : null}

      {mode === "registration" && activeSubTab === "invite-codes" ? <AdminInviteCodeManager initialInviteCodes={initialInviteCodes} /> : null}

      {mode === "registration" && activeSubTab === "fields" ? (
        <>
          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">注册表单字段</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">邮箱、手机、昵称、性别、邀请人等字段的显示与必填策略。</p>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <FieldGroup title="邮箱">
                <AdminBooleanSelectField label="显示邮箱输入框" checked={registerEmailEnabled} onChange={(value) => updateDraftField("registerEmailEnabled", value)} />
                <AdminBooleanSelectField label="邮箱必填" checked={registerEmailRequired} onChange={(value) => updateDraftField("registerEmailRequired", value)} />
                <AdminBooleanSelectField label="邮箱需要验证" checked={registerEmailVerification} onChange={(value) => updateDraftField("registerEmailVerification", value)} />
              </FieldGroup>
              <FieldGroup title="手机">
                <AdminBooleanSelectField label="显示手机输入框" checked={registerPhoneEnabled} onChange={(value) => updateDraftField("registerPhoneEnabled", value)} />
                <AdminBooleanSelectField label="手机必填" checked={registerPhoneRequired} onChange={(value) => updateDraftField("registerPhoneRequired", value)} />
                <AdminBooleanSelectField label="手机需要验证" checked={registerPhoneVerification} onChange={(value) => updateDraftField("registerPhoneVerification", value)} />
              </FieldGroup>
              <FieldGroup title="其它字段">
                <AdminBooleanSelectField label="显示昵称输入框" checked={registerNicknameEnabled} onChange={(value) => updateDraftField("registerNicknameEnabled", value)} />
                <AdminBooleanSelectField label="昵称必填" checked={registerNicknameRequired} onChange={(value) => updateDraftField("registerNicknameRequired", value)} />
                <AdminBooleanSelectField label="显示性别选项" checked={registerGenderEnabled} onChange={(value) => updateDraftField("registerGenderEnabled", value)} />
                <AdminBooleanSelectField label="性别必填" checked={registerGenderRequired} onChange={(value) => updateDraftField("registerGenderRequired", value)} />
                <AdminBooleanSelectField label="显示邀请人输入框" checked={registerInviterEnabled} onChange={(value) => updateDraftField("registerInviterEnabled", value)} />
              </FieldGroup>
            </div>
          </div>
        </>
      ) : null}

      {mode === "registration" && activeSubTab === "auth" ? (
        <>
          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">第三方与 Passkey 登录</h3>
                <button
                  type="button"
                  onClick={() => setAuthDocOpen(true)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  aria-label="查看第三方与 Passkey 对接文档"
                  title="查看对接文档"
                >
                  <CircleHelp className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">这里同时控制登录开关与密钥配置。敏感值会写入站点设置的敏感 JSON，仅服务端读取，不向普通前台接口透出。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <AdminBooleanSelectField label="开启 GitHub 登录" checked={authGithubEnabled} onChange={(value) => updateDraftField("authGithubEnabled", value)} />
              <AdminBooleanSelectField label="开启 Google 登录" checked={authGoogleEnabled} onChange={(value) => updateDraftField("authGoogleEnabled", value)} />
              <AdminBooleanSelectField label="开启 Passkey 登录" checked={authPasskeyEnabled} onChange={(value) => updateDraftField("authPasskeyEnabled", value)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <TextField label="GitHub Client ID" value={githubClientId} onChange={(value) => updateDraftField("githubClientId", value)} placeholder="填写 GitHub OAuth App Client ID" />
              <TextField label="GitHub Client Secret" type="password" value={githubClientSecret} onChange={(value) => updateDraftField("githubClientSecret", value)} placeholder="填写 GitHub OAuth App Client Secret" />
              <div className="hidden xl:block" />
              <TextField label="Google Client ID" value={googleClientId} onChange={(value) => updateDraftField("googleClientId", value)} placeholder="填写 Google OAuth Client ID" />
              <TextField label="Google Client Secret" type="password" value={googleClientSecret} onChange={(value) => updateDraftField("googleClientSecret", value)} placeholder="填写 Google OAuth Client Secret" />
              <div className="hidden xl:block" />
              <TextField label="Passkey RP ID" value={passkeyRpId} onChange={(value) => updateDraftField("passkeyRpId", value)} placeholder="如 forum.example.com" />
              <TextField label="Passkey RP Name" value={passkeyRpName} onChange={(value) => updateDraftField("passkeyRpName", value)} placeholder="如 兴趣论坛" />
              <TextField label="Passkey Origin" value={passkeyOrigin} onChange={(value) => updateDraftField("passkeyOrigin", value)} placeholder="如 https://forum.example.com" />
            </div>
            <p className="text-xs leading-6 text-muted-foreground">开启对应登录方式前，请先在这里填写完整凭据；未填写时，运行时会直接报错，不再回退读取环境变量。</p>
          </div>

          <AdminModal
            open={authDocOpen}
            onClose={() => setAuthDocOpen(false)}
            title="第三方与 Passkey 对接文档"
            description="按当前站点域名生成对接信息。把回调地址填到第三方平台，把密钥与 Passkey 参数填回本页的后台表单即可。"
            size="xl"
          >
            <div className="space-y-5 overflow-y-auto p-6 text-sm text-foreground">
              <section className="space-y-3">
                <h4 className="text-sm font-semibold">GitHub OAuth</h4>
                <div className="rounded-[20px] border border-border bg-secondary/30 p-4 space-y-2">
                  <p><span className="font-medium">Homepage URL：</span><code>{siteOrigin}</code></p>
                  <p><span className="font-medium">Authorization callback URL：</span><code>{siteOrigin}/api/auth/oauth/github/callback</code></p>
                  <p><span className="font-medium">发起登录：</span><code>{siteOrigin}/api/auth/oauth/github/start?mode=login</code></p>
                  <p><span className="font-medium">发起注册：</span><code>{siteOrigin}/api/auth/oauth/github/start?mode=register</code></p>
                  <p><span className="font-medium">Scope：</span><code>read:user user:email</code></p>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold">Google OAuth</h4>
                <div className="rounded-[20px] border border-border bg-secondary/30 p-4 space-y-2">
                  <p><span className="font-medium">Authorized JavaScript origins：</span><code>{siteOrigin}</code></p>
                  <p><span className="font-medium">Authorized redirect URIs：</span><code>{siteOrigin}/api/auth/oauth/google/callback</code></p>
                  <p><span className="font-medium">发起登录：</span><code>{siteOrigin}/api/auth/oauth/google/start?mode=login</code></p>
                  <p><span className="font-medium">发起注册：</span><code>{siteOrigin}/api/auth/oauth/google/start?mode=register</code></p>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold">Passkey</h4>
                <div className="rounded-[20px] border border-border bg-secondary/30 p-4 space-y-2">
                  <p><span className="font-medium">Passkey 登录页：</span><code>{siteOrigin}/auth/passkey?mode=login</code></p>
                  <p><span className="font-medium">Passkey 注册页：</span><code>{siteOrigin}/auth/passkey?mode=register</code></p>
                  <p><span className="font-medium">建议 RP ID：</span><code>{resolvedPasskeyRpId}</code></p>
                  <p><span className="font-medium">建议 RP Name：</span><code>{resolvedPasskeyRpName}</code></p>
                  <p><span className="font-medium">建议 Origin：</span><code>{resolvedPasskeyOrigin}</code></p>
                  <p className="text-xs leading-6 text-muted-foreground">RP ID 一般填当前主域名，不带协议与路径。若你使用子域名部署，请确保 RP ID 与实际站点域名匹配。</p>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold">后台填写项</h4>
                <div className="rounded-[20px] border border-border bg-background p-4">
                  <pre className="overflow-x-auto text-xs leading-6 text-foreground"><code>{`GitHub Client ID = ${githubClientId || "第三方平台生成后填写"}
GitHub Client Secret = ${githubClientSecret ? "已填写" : "第三方平台生成后填写"}

Google Client ID = ${googleClientId || "第三方平台生成后填写"}
Google Client Secret = ${googleClientSecret ? "已填写" : "第三方平台生成后填写"}

Passkey RP ID = ${resolvedPasskeyRpId}
Passkey RP Name = ${resolvedPasskeyRpName}
Passkey Origin = ${resolvedPasskeyOrigin}`}</code></pre>
                </div>
                <p className="text-xs leading-6 text-muted-foreground">以上内容保存在数据库敏感配置中。第三方登录流程本身仍需服务端可用的签名密钥，例如现有的 `AUTH_FLOW_SECRET`。</p>
              </section>
            </div>
          </AdminModal>
        </>
      ) : null}

      {mode === "registration" && activeSubTab === "smtp" ? (
        <>
          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">SMTP 邮件发送</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">开启后，邮箱验证码会通过真实邮件发送。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <AdminBooleanSelectField label="启用 SMTP" checked={smtpEnabled} onChange={(value) => updateDraftField("smtpEnabled", value)} />
              <AdminBooleanSelectField label="启用 SSL/TLS" checked={smtpSecure} onChange={(value) => updateDraftField("smtpSecure", value)} />
              <TextField label="SMTP 主机" value={smtpHost} onChange={(value) => updateDraftField("smtpHost", value)} placeholder="如 smtp.qq.com" />
              <TextField label="SMTP 端口" value={smtpPort} onChange={(value) => updateDraftField("smtpPort", value)} placeholder="如 465 / 587" />
              <TextField label="SMTP 账号" value={smtpUser} onChange={(value) => updateDraftField("smtpUser", value)} placeholder="邮箱账号" />
              <TextField label="SMTP 密码 / 授权码" type="password" value={smtpPass} onChange={(value) => updateDraftField("smtpPass", value)} placeholder="请输入密码或授权码" />
              <TextField label="发件人地址" value={smtpFrom} onChange={(value) => updateDraftField("smtpFrom", value)} placeholder="如 Forum <no-reply@example.com>" />
            </div>
          </div>
        </>
      ) : null}

      {mode === "interaction" && activeSubTab === "comments" ? (
        <>
          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">评论展示</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">控制评论区可见性、楼中楼默认展开数量，以及帖子详情页的评论分页容量。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AdminBooleanSelectField label="游客可查看评论" checked={guestCanViewComments} onChange={(value) => updateDraftField("guestCanViewComments", value)} />
              <TextField label="楼中楼默认展开条数" value={commentInitialVisibleReplies} onChange={(value) => updateDraftField("commentInitialVisibleReplies", value)} placeholder="如 10" />
              <TextField label="评论区一页显示数" value={commentPageSize} onChange={(value) => updateDraftField("commentPageSize", value)} placeholder="如 15" />
            </div>
            <p className="text-xs leading-6 text-muted-foreground">楼中楼超过默认展开条数后，前台会显示“展开其余 X 条回复”；评论区一页显示数控制主评论分页容量。</p>
          </div>
        </>
      ) : null}

      {mode === "interaction" && activeSubTab === "content-limits" ? (
        <>
          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">发帖与回复字数限制</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">分别控制标题、正文、回复的最小字数和最大字数，服务端会按这里的值做校验。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TextField label="发帖标题最小字数" value={postTitleMinLength} onChange={(value) => updateDraftField("postTitleMinLength", value)} placeholder="默认 5，最小 1" />
              <TextField label="发帖标题最大字数" value={postTitleMaxLength} onChange={(value) => updateDraftField("postTitleMaxLength", value)} placeholder="默认 100，最大 500" />
              <TextField label="发帖正文最小字数" value={postContentMinLength} onChange={(value) => updateDraftField("postContentMinLength", value)} placeholder="默认 10，最小 1" />
              <TextField label="发帖正文最大字数" value={postContentMaxLength} onChange={(value) => updateDraftField("postContentMaxLength", value)} placeholder="默认 50000，最大 100000" />
              <TextField label="回复正文最小字数" value={commentContentMinLength} onChange={(value) => updateDraftField("commentContentMinLength", value)} placeholder="默认 2，最小 1" />
              <TextField label="回复正文最大字数" value={commentContentMaxLength} onChange={(value) => updateDraftField("commentContentMaxLength", value)} placeholder="默认 2000，最大 20000" />
            </div>
            <p className="text-xs leading-6 text-muted-foreground">保存时若最大值小于最小值，会自动按最小值兜底；发帖、编辑帖子、回复、编辑回复都会使用这组限制。</p>
          </div>
        </>
      ) : null}

      {mode === "interaction" && activeSubTab === "anonymous-post" ? (
        <>
          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">匿名发帖</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">控制匿名发帖开关、扣费、每日次数，以及匿名帖下回复时是否允许切换身份。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AdminBooleanSelectField label="开启匿名发帖" checked={anonymousPostEnabled} onChange={(value) => updateDraftField("anonymousPostEnabled", value)} />
              <AdminBooleanSelectField label="匿名回复可切换身份" checked={anonymousPostAllowReplySwitch} onChange={(value) => updateDraftField("anonymousPostAllowReplySwitch", value)} />
              <AdminBooleanSelectField label="匿名帖默认匿名回复" checked={anonymousPostDefaultReplyAnonymous} onChange={(value) => updateDraftField("anonymousPostDefaultReplyAnonymous", value)} />
              <TextField label="匿名发帖价格" value={anonymousPostPrice} onChange={(value) => updateDraftField("anonymousPostPrice", value)} placeholder="如 20" />
              <TextField label="每日匿名发帖次数" value={anonymousPostDailyLimit} onChange={(value) => updateDraftField("anonymousPostDailyLimit", value)} placeholder="0 表示不限制" />
              <TextField label="匿名马甲用户 ID" value={anonymousPostMaskUserId} onChange={(value) => updateDraftField("anonymousPostMaskUserId", value)} placeholder="如 10001" />
            </div>
            <p className="text-xs leading-6 text-muted-foreground">匿名发帖当前只用于普通帖和投票帖。启用后会按配置积分扣费，前台展示为指定马甲账号，帖子真实作者仍保留原账号。</p>
          </div>
        </>
      ) : null}

      {mode === "interaction" && activeSubTab === "tipping" ? (
        <>
          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">帖子打赏与送礼</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">控制帖子打赏开关、次数限制、裸积分档位、礼物配置，以及打赏送礼税。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AdminBooleanSelectField label="开启帖子打赏" checked={tippingEnabled} onChange={(value) => updateDraftField("tippingEnabled", value)} />
              <TextField label="每日可打赏次数" value={tippingDailyLimit} onChange={(value) => updateDraftField("tippingDailyLimit", value)} placeholder="如 3" />
              <TextField label="单帖可打赏次数" value={tippingPerPostLimit} onChange={(value) => updateDraftField("tippingPerPostLimit", value)} placeholder="如 1" />
              <AdminBooleanSelectField label="开启打赏送礼税" checked={tipGiftTaxEnabled} onChange={(value) => updateDraftField("tipGiftTaxEnabled", value)} />
              <InfoTextField
                label="打赏送礼税率 BPS"
                value={tipGiftTaxRateBps}
                onChange={(value) => updateDraftField("tipGiftTaxRateBps", value)}
                placeholder="0..10000，如 500"
                helpText="填写 0..10000 的整数。10000 = 100%，500 = 5%，100 = 1%。税额按收款特效后的实际到账 gross 计算，公式是 floor(gross * bps / 10000)。填 0 或关闭税开关都表示不征税。"
              />
            </div>
            <p className="text-xs leading-6 text-muted-foreground">打赏送礼税在收款特效结算后按 BPS 向下取整，只对正整数净收款生效；税额会进入帖子所属节点金库。礼物名称、图标和价格都可在后台维护。</p>
            <TextField label="裸积分打赏档位" value={tippingAmounts} onChange={(value) => updateDraftField("tippingAmounts", value)} placeholder="如 10,30,50,100" />
            <AdminTippingGiftListEditor items={tippingGifts} onChange={(value) => updateDraftField("tippingGifts", value)} />
          </div>
        </>
      ) : null}

      {mode === "board-applications" && activeSubTab === "general" ? (
        <div className="rounded-[24px] border border-border p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">节点申请</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">单独控制前台是否展示节点申请入口，以及是否允许用户提交新申请。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminBooleanSelectField label="开启节点申请" checked={boardApplicationEnabled} onChange={(value) => updateDraftField("boardApplicationEnabled", value)} />
          </div>
          <p className="text-xs leading-6 text-muted-foreground">关闭后，前台设置导航会隐藏“节点申请”，直接访问对应页面也会被拦回个人资料页，同时新建申请接口会拒绝提交。</p>
        </div>
      ) : null}

      {mode === "interaction" && activeSubTab === "gates" ? (
        <>
          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">发布门槛</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">按发帖和回复分别控制邮箱验证与注册时长门槛。后续新的互动验证规则也会继续挂在这一层扩展，不需要再改主设置表。</p>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <FieldGroup title="发帖">
                <AdminBooleanSelectField label="发帖需已验证邮箱" checked={postCreateRequireEmailVerified} onChange={(value) => updateDraftField("postCreateRequireEmailVerified", value)} />
                <TextField label="注册满多少分钟才能发帖" value={postCreateMinRegisteredMinutes} onChange={(value) => updateDraftField("postCreateMinRegisteredMinutes", value)} placeholder="填 0 表示不限制" />
              </FieldGroup>
              <FieldGroup title="回复">
                <AdminBooleanSelectField label="回复需已验证邮箱" checked={commentCreateRequireEmailVerified} onChange={(value) => updateDraftField("commentCreateRequireEmailVerified", value)} />
                <TextField label="注册满多少分钟才能回复" value={commentCreateMinRegisteredMinutes} onChange={(value) => updateDraftField("commentCreateMinRegisteredMinutes", value)} placeholder="填 0 表示不限制" />
              </FieldGroup>
            </div>
            <p className="text-xs leading-6 text-muted-foreground">邮箱门槛只校验账号的 `emailVerifiedAt`；分钟门槛按注册时间到当前时间计算，`0` 表示关闭该限制。</p>
          </div>
        </>
      ) : null}

      {mode === "interaction" && activeSubTab === "reward-pool" ? (
        <>
          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">帖子红包与聚宝盆</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">红包用于一次性预存发放；聚宝盆用于回复后给积分池注入积分，并按概率抽中奖励。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <AdminBooleanSelectField label="开启帖子红包" checked={postRedPacketEnabled} onChange={(value) => updateDraftField("postRedPacketEnabled", value)} />
              <TextField label="单个红包最大积分" value={postRedPacketMaxPoints} onChange={(value) => updateDraftField("postRedPacketMaxPoints", value)} placeholder="如 100" />
              <TextField label="每日发红包积分上限" value={postRedPacketDailyLimit} onChange={(value) => updateDraftField("postRedPacketDailyLimit", value)} placeholder="如 300" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TextField
                label="红包随机命中概率（%）"
                value={postRedPacketRandomClaimProbability}
                onChange={(value) => updateDraftField("postRedPacketRandomClaimProbability", value)}
                placeholder="填 0 按候选人数均分，如 25"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AdminBooleanSelectField label="开启聚宝盆" checked={postJackpotEnabled} onChange={(value) => updateDraftField("postJackpotEnabled", value)} />
              <TextField label="聚宝盆最低初始积分" value={postJackpotMinInitialPoints} onChange={(value) => updateDraftField("postJackpotMinInitialPoints", value)} placeholder="如 100" />
              <TextField label="聚宝盆最高初始积分" value={postJackpotMaxInitialPoints} onChange={(value) => updateDraftField("postJackpotMaxInitialPoints", value)} placeholder="如 1000" />
              <TextField label="每次回复递增积分" value={postJackpotReplyIncrementPoints} onChange={(value) => updateDraftField("postJackpotReplyIncrementPoints", value)} placeholder="如 25" />
              <TextField label="聚宝盆回复中奖概率（%）" value={postJackpotHitProbability} onChange={(value) => updateDraftField("postJackpotHitProbability", value)} placeholder="如 15" />
            </div>
            <p className="text-xs leading-6 text-muted-foreground">红包随机命中概率仅在“随机名额”模式下生效：填 `0` 时沿用当前候选人数均分概率；填大于 `0` 的值时，按“当前触发用户单次命中率”处理，未命中则本次无人领取。聚宝盆仅支持“回复帖子”触发，用户发帖时填写的初始积分必须落在允许范围内；每次有效回复后，系统先向积分池增加设定积分，再按概率抽奖。</p>
          </div>
        </>
      ) : null}

      {mode === "interaction" && activeSubTab === "heat" ? (
        <>
          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">帖子热度颜色算法</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">统一配置热度分数计算权重、首页热门近活跃窗口与颜色阶段。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TextField
                label="首页热门近活跃窗口（小时）"
                value={homeHotRecentWindowHours}
                onChange={(value) => updateDraftField("homeHotRecentWindowHours", value)}
                placeholder="如 72"
              />
            </div>
            <p className="text-xs leading-6 text-muted-foreground">首页“热门”会优先显示近 N 小时内有活动的帖子，再按历史热度补位。建议保持在 `24-168` 小时之间；填写 `72` 即当前默认策略。</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <TextField label="浏览权重" value={heatViewWeight} onChange={(value) => updateDraftField("heatViewWeight", value)} placeholder="如 1" />
              <TextField label="回复权重" value={heatCommentWeight} onChange={(value) => updateDraftField("heatCommentWeight", value)} placeholder="如 8" />
              <TextField label="点赞权重" value={heatLikeWeight} onChange={(value) => updateDraftField("heatLikeWeight", value)} placeholder="如 6" />
              <TextField label="打赏次数权重" value={heatTipCountWeight} onChange={(value) => updateDraftField("heatTipCountWeight", value)} placeholder="如 10" />
              <TextField label="打赏积分权重" value={heatTipPointsWeight} onChange={(value) => updateDraftField("heatTipPointsWeight", value)} placeholder="如 1" />
            </div>
            <TextField label="9 段热度阈值" value={heatStageThresholds} onChange={(value) => updateDraftField("heatStageThresholds", value)} placeholder="如 0,80,180,320,520,780,1100,1500,2000" />
            <div className="space-y-2">
              <p className="text-sm font-medium">9 段颜色色板</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {heatStageColors.map((color, index) => {
                  const open = editingHeatColorIndex === index
                  return (
                    <div key={`heat-color-${index}`} className="rounded-[20px] border border-border bg-secondary/30 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-foreground">第 {index + 1} 档颜色</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">阈值 ≥ {previewSettings.heatStageThresholds[index] ?? 0}</p>
                        </div>
                        <PickerTriggerField value={color} previewColor={color} fallbackColor="#4A4A4A" onClick={() => setEditingHeatColorIndex(open ? null : index)} />
                      </div>
                      {open ? (
                        <PickerPopover title={`选择第 ${index + 1} 档颜色`} onClose={() => setEditingHeatColorIndex(null)}>
                          <div className="flex items-center gap-2">
                            <input type="color" value={normalizeHexColor(color, "#4A4A4A")} onChange={(event) => updateHeatColor(index, event.target.value)} className="h-8 w-10 cursor-pointer rounded-lg border border-border bg-background p-0.5" aria-label={`选择第 ${index + 1} 档颜色`} />
                            <input value={color} onChange={(event) => updateHeatColor(index, event.target.value)} className="h-8 w-28 rounded-full border border-border bg-background px-3 text-xs outline-none" />
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            {HEAT_COLOR_PRESETS.map((preset) => {
                              const active = color.toLowerCase() === preset.toLowerCase()
                              return <button key={`heat-${index}-${preset}`} type="button" className={active ? "h-7 w-7 rounded-full ring-2 ring-foreground/20 ring-offset-1 ring-offset-background" : "h-7 w-7 rounded-full border border-border"} style={{ backgroundColor: preset }} onClick={() => {
                                updateHeatColor(index, preset)
                                setEditingHeatColorIndex(null)
                              }} aria-label={`使用颜色 ${preset}`} />
                            })}
                          </div>
                        </PickerPopover>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {mode === "interaction" && activeSubTab === "preview" ? (
        <>
          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">热度预览面板</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">调整参数后，实时预览热度分数与颜色表现。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <TextField label="浏览数" value={previewViews} onChange={(value) => updateDraftField("previewViews", value)} placeholder="如 120" />
              <TextField label="回复数" value={previewComments} onChange={(value) => updateDraftField("previewComments", value)} placeholder="如 18" />
              <TextField label="点赞数" value={previewLikes} onChange={(value) => updateDraftField("previewLikes", value)} placeholder="如 12" />
              <TextField label="打赏次数" value={previewTipCount} onChange={(value) => updateDraftField("previewTipCount", value)} placeholder="如 4" />
              <TextField label="打赏积分" value={previewTipPoints} onChange={(value) => updateDraftField("previewTipPoints", value)} placeholder="如 160" />
            </div>
            <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
              <div className="rounded-[20px] border border-border bg-card px-4 py-4">
                <p className="text-xs text-muted-foreground">热度分数</p>
                <p className="mt-2 text-3xl font-semibold">{previewScore}</p>
                <p className="mt-2 text-xs text-muted-foreground">当前落在第 {previewHeat.stageIndex + 1} 档颜色</p>
              </div>
              <div className="rounded-[20px] border border-border bg-card px-4 py-4">
                <p className="text-xs text-muted-foreground">回复数按钮预览</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium" style={{ backgroundColor: `${previewHeat.color}14`, color: previewHeat.color }}>
                    💬 {previewInput.comments}
                  </span>
                  <span className="text-sm text-muted-foreground">颜色：{previewHeat.color}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <div className="flex items-center gap-3">
        <Button disabled={isPending}>{isPending ? "保存中..." : submitText}</Button>
      </div>
    </form>
  )
}

function resolveInternalSettingTab(mode: AdminBasicSettingsMode, initialSubTab?: string) {
  if (mode === "interaction" && initialSubTab === "comment-tip") {
    return "comments"
  }
  const availableTabs = INTERNAL_SETTING_TABS[mode]
  return availableTabs.some((tab) => tab.key === initialSubTab) ? initialSubTab! : INTERNAL_SETTING_TAB_DEFAULT[mode]
}


function InfoTextField(props: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  helpText: string
}) {
  const { label, value, onChange, placeholder, helpText } = props

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">{label}</p>
        <div className="group relative inline-flex">
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={`${label} 说明`}
          >
            <CircleHelp className="h-3.5 w-3.5" />
          </button>
          <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-2xl border border-border bg-popover px-3 py-2 text-xs leading-6 text-popover-foreground shadow-lg group-hover:block">
            {helpText}
          </div>
        </div>
      </div>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none"
      />
    </div>
  )
}

function CaptchaModeField({ label, value, onChange }: { label: string; value: "OFF" | "TURNSTILE" | "BUILTIN" | "POW"; onChange: (value: "OFF" | "TURNSTILE" | "BUILTIN" | "POW") => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <select value={value} onChange={(event) => onChange(event.target.value as "OFF" | "TURNSTILE" | "BUILTIN" | "POW")} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none">
        <option value="OFF">关闭</option>
        <option value="TURNSTILE">Cloudflare Turnstile</option>
        <option value="BUILTIN">自建图形验证码</option>
        <option value="POW">PoW 工作量证明</option>
      </select>
    </div>
  )
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border border-border bg-secondary/30 p-4 space-y-3">
      <p className="text-sm font-semibold">{title}</p>
      {children}
    </div>
  )
}
