"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { Loader2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TextField } from "@/components/ui/text-field"
import { toast } from "@/components/ui/toast"
import { PickerPopover, PickerTriggerField, normalizeHexColor } from "@/components/admin-picker-popover"
import { AdminTippingGiftListEditor } from "@/components/admin-tipping-gift-list-editor"
import { calculatePostHeatScore, resolvePostHeatStyle } from "@/lib/post-heat"
import { POST_LIST_DISPLAY_MODE_DEFAULT, POST_LIST_DISPLAY_MODE_GALLERY, type PostListDisplayMode } from "@/lib/post-list-display"
import type { SiteSearchSettings, SiteTippingGiftItem } from "@/lib/site-settings"

interface AdminBasicSettingsFormProps {
  initialSettings: {
    siteName: string
    siteSlogan: string
    siteDescription: string
    siteLogoText: string
    siteLogoPath?: string | null
    siteSeoKeywords?: string[]
    postLinkDisplayMode: "SLUG" | "ID"
    homeFeedPostListDisplayMode: PostListDisplayMode
    homeSidebarStatsCardEnabled: boolean
    homeSidebarAnnouncementsEnabled: boolean
    search: SiteSearchSettings
    analyticsCode?: string | null
    inviteRewardInviter: number
    inviteRewardInvitee: number
    registrationEnabled: boolean
    registrationRequireInviteCode: boolean
    registerInviteCodeEnabled: boolean
    inviteCodePurchaseEnabled: boolean
    registerCaptchaMode: "OFF" | "TURNSTILE" | "BUILTIN" | "POW"
    loginCaptchaMode: "OFF" | "TURNSTILE" | "BUILTIN" | "POW"
    turnstileSiteKey?: string | null
    postEditableMinutes: number
    commentEditableMinutes: number
    tippingEnabled: boolean
    tippingDailyLimit: number
    tippingPerPostLimit: number
    tippingAmounts: number[]
    tippingGifts: SiteTippingGiftItem[]
    postRedPacketEnabled: boolean
    postRedPacketMaxPoints: number
    postRedPacketDailyLimit: number
    heatViewWeight: number
    heatCommentWeight: number
    heatLikeWeight: number
    heatTipCountWeight: number
    heatTipPointsWeight: number
    heatStageThresholds: number[]
    heatStageColors: string[]
    registerEmailEnabled: boolean
    registerEmailRequired: boolean
    registerEmailVerification: boolean
    registerPhoneEnabled: boolean
    registerPhoneRequired: boolean
    registerPhoneVerification: boolean
    registerNicknameEnabled: boolean
    registerNicknameRequired: boolean
    registerGenderEnabled: boolean
    registerGenderRequired: boolean
    registerInviterEnabled: boolean
    smtpEnabled: boolean
    smtpHost?: string | null
    smtpPort?: number | null
    smtpUser?: string | null
    smtpPass?: string | null
    smtpFrom?: string | null
    smtpSecure: boolean
  }
  mode?: "profile" | "registration" | "interaction"
}

const HEAT_COLOR_PRESETS = ["#4A4A4A", "#808080", "#9B8F7F", "#B87333", "#C4A777", "#E8C547", "#FFA500", "#D96C3B", "#C41E3A", "#6B7280", "#F59E0B", "#EF4444", "#8B5CF6", "#10B981"]

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

export function AdminBasicSettingsForm({ initialSettings, mode = "profile" }: AdminBasicSettingsFormProps) {
  const router = useRouter()
  const [siteName, setSiteName] = useState(initialSettings.siteName)
  const [siteSlogan, setSiteSlogan] = useState(initialSettings.siteSlogan)
  const [siteDescription, setSiteDescription] = useState(initialSettings.siteDescription)
  const [siteLogoText, setSiteLogoText] = useState(initialSettings.siteLogoText)
  const [siteLogoPath, setSiteLogoPath] = useState(initialSettings.siteLogoPath ?? "")
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [siteSeoKeywords, setSiteSeoKeywords] = useState((initialSettings.siteSeoKeywords ?? []).join(","))
  const [postLinkDisplayMode, setPostLinkDisplayMode] = useState<"SLUG" | "ID">(initialSettings.postLinkDisplayMode)
  const [homeFeedPostListDisplayMode, setHomeFeedPostListDisplayMode] = useState<PostListDisplayMode>(initialSettings.homeFeedPostListDisplayMode)
  const [homeSidebarStatsCardEnabled, setHomeSidebarStatsCardEnabled] = useState(initialSettings.homeSidebarStatsCardEnabled)
  const [homeSidebarAnnouncementsEnabled, setHomeSidebarAnnouncementsEnabled] = useState(initialSettings.homeSidebarAnnouncementsEnabled)
  const [searchEnabled, setSearchEnabled] = useState(initialSettings.search.enabled)
  const [analyticsCode, setAnalyticsCode] = useState(initialSettings.analyticsCode ?? "")
  const [postEditableMinutes, setPostEditableMinutes] = useState(String(initialSettings.postEditableMinutes))
  const [commentEditableMinutes, setCommentEditableMinutes] = useState(String(initialSettings.commentEditableMinutes))
  const [inviteRewardInviter, setInviteRewardInviter] = useState(String(initialSettings.inviteRewardInviter))
  const [inviteRewardInvitee, setInviteRewardInvitee] = useState(String(initialSettings.inviteRewardInvitee))
  const [registrationEnabled, setRegistrationEnabled] = useState(initialSettings.registrationEnabled)
  const [registrationRequireInviteCode, setRegistrationRequireInviteCode] = useState(initialSettings.registrationRequireInviteCode)
  const [registerInviteCodeEnabled, setRegisterInviteCodeEnabled] = useState(initialSettings.registerInviteCodeEnabled)
  const [inviteCodePurchaseEnabled, setInviteCodePurchaseEnabled] = useState(initialSettings.inviteCodePurchaseEnabled)
  const [registerCaptchaMode, setRegisterCaptchaMode] = useState(initialSettings.registerCaptchaMode)
  const [loginCaptchaMode, setLoginCaptchaMode] = useState(initialSettings.loginCaptchaMode)
  const [turnstileSiteKey, setTurnstileSiteKey] = useState(initialSettings.turnstileSiteKey ?? "")
  const [tippingEnabled, setTippingEnabled] = useState(initialSettings.tippingEnabled)
  const [tippingDailyLimit, setTippingDailyLimit] = useState(String(initialSettings.tippingDailyLimit))
  const [tippingPerPostLimit, setTippingPerPostLimit] = useState(String(initialSettings.tippingPerPostLimit))
  const [tippingAmounts, setTippingAmounts] = useState(initialSettings.tippingAmounts.join(","))
  const [tippingGifts, setTippingGifts] = useState(initialSettings.tippingGifts)
  const [postRedPacketEnabled, setPostRedPacketEnabled] = useState(initialSettings.postRedPacketEnabled)
  const [postRedPacketMaxPoints, setPostRedPacketMaxPoints] = useState(String(initialSettings.postRedPacketMaxPoints))
  const [postRedPacketDailyLimit, setPostRedPacketDailyLimit] = useState(String(initialSettings.postRedPacketDailyLimit))
  const [heatViewWeight, setHeatViewWeight] = useState(String(initialSettings.heatViewWeight))
  const [heatCommentWeight, setHeatCommentWeight] = useState(String(initialSettings.heatCommentWeight))
  const [heatLikeWeight, setHeatLikeWeight] = useState(String(initialSettings.heatLikeWeight))
  const [heatTipCountWeight, setHeatTipCountWeight] = useState(String(initialSettings.heatTipCountWeight))
  const [heatTipPointsWeight, setHeatTipPointsWeight] = useState(String(initialSettings.heatTipPointsWeight))
  const [heatStageThresholds, setHeatStageThresholds] = useState(initialSettings.heatStageThresholds.join(","))
  const [heatStageColors, setHeatStageColors] = useState(initialSettings.heatStageColors)
  const [previewViews, setPreviewViews] = useState("120")
  const [previewComments, setPreviewComments] = useState("18")
  const [previewLikes, setPreviewLikes] = useState("12")
  const [previewTipCount, setPreviewTipCount] = useState("4")
  const [previewTipPoints, setPreviewTipPoints] = useState("160")
  const [editingHeatColorIndex, setEditingHeatColorIndex] = useState<number | null>(null)
  const [registerEmailEnabled, setRegisterEmailEnabled] = useState(initialSettings.registerEmailEnabled)
  const [registerEmailRequired, setRegisterEmailRequired] = useState(initialSettings.registerEmailRequired)
  const [registerEmailVerification, setRegisterEmailVerification] = useState(initialSettings.registerEmailVerification)
  const [registerPhoneEnabled, setRegisterPhoneEnabled] = useState(initialSettings.registerPhoneEnabled)
  const [registerPhoneRequired, setRegisterPhoneRequired] = useState(initialSettings.registerPhoneRequired)
  const [registerPhoneVerification, setRegisterPhoneVerification] = useState(initialSettings.registerPhoneVerification)
  const [registerNicknameEnabled, setRegisterNicknameEnabled] = useState(initialSettings.registerNicknameEnabled)
  const [registerNicknameRequired, setRegisterNicknameRequired] = useState(initialSettings.registerNicknameRequired)
  const [registerGenderEnabled, setRegisterGenderEnabled] = useState(initialSettings.registerGenderEnabled)
  const [registerGenderRequired, setRegisterGenderRequired] = useState(initialSettings.registerGenderRequired)
  const [registerInviterEnabled, setRegisterInviterEnabled] = useState(initialSettings.registerInviterEnabled)
  const [smtpEnabled, setSmtpEnabled] = useState(initialSettings.smtpEnabled)
  const [smtpHost, setSmtpHost] = useState(initialSettings.smtpHost ?? "")
  const [smtpPort, setSmtpPort] = useState(initialSettings.smtpPort ? String(initialSettings.smtpPort) : "")
  const [smtpUser, setSmtpUser] = useState(initialSettings.smtpUser ?? "")
  const [smtpPass, setSmtpPass] = useState(initialSettings.smtpPass ?? "")
  const [smtpFrom, setSmtpFrom] = useState(initialSettings.smtpFrom ?? "")
  const [smtpSecure, setSmtpSecure] = useState(initialSettings.smtpSecure)
  const [isPending, startTransition] = useTransition()

  const previewSettings = useMemo(() => ({
    heatViewWeight: Number(heatViewWeight) || 0,
    heatCommentWeight: Number(heatCommentWeight) || 0,
    heatLikeWeight: Number(heatLikeWeight) || 0,
    heatTipCountWeight: Number(heatTipCountWeight) || 0,
    heatTipPointsWeight: Number(heatTipPointsWeight) || 0,
    heatStageThresholds: normalizeHeatThresholdsInput(heatStageThresholds),
    heatStageColors,
  }), [heatCommentWeight, heatLikeWeight, heatStageColors, heatStageThresholds, heatTipCountWeight, heatTipPointsWeight, heatViewWeight])

  const previewInput = useMemo(() => ({
    views: Number(previewViews) || 0,
    comments: Number(previewComments) || 0,
    likes: Number(previewLikes) || 0,
    tipCount: Number(previewTipCount) || 0,
    tipPoints: Number(previewTipPoints) || 0,
  }), [previewComments, previewLikes, previewTipCount, previewTipPoints, previewViews])

  const previewScore = useMemo(() => calculatePostHeatScore(previewInput, previewSettings), [previewInput, previewSettings])
  const previewHeat = useMemo(() => resolvePostHeatStyle(previewInput, previewSettings), [previewInput, previewSettings])

  function updateHeatColor(index: number, nextColor: string) {
    setHeatStageColors((current) => current.map((item, currentIndex) => (currentIndex === index ? nextColor : item)))
  }

  async function uploadSiteLogo(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("请先选择图片格式的站点 Logo", "上传失败")
      return
    }

    setIsUploadingLogo(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", "site-logo")

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      const result = await response.json()

      if (!response.ok || result.code !== 0) {
        toast.error(result.message ?? "站点 Logo 上传失败", "上传失败")
        return
      }

      setSiteLogoPath(String(result.data?.urlPath ?? ""))
      toast.success("站点 Logo 上传成功", "上传成功")
    } catch {
      toast.error("站点 Logo 上传失败，请稍后再试", "上传失败")
    } finally {
      setIsUploadingLogo(false)
    }
  }

  function buildPayload() {
    if (mode === "profile") {
      return {
        siteName,
        siteSlogan,
        siteDescription,
        siteLogoText,
        siteLogoPath,
        siteSeoKeywords,
        postLinkDisplayMode,
        homeFeedPostListDisplayMode,
        homeSidebarStatsCardEnabled,
        homeSidebarAnnouncementsEnabled,
        searchEnabled,
        analyticsCode,
        postEditableMinutes: Number(postEditableMinutes),
        commentEditableMinutes: Number(commentEditableMinutes),
        section: "site-profile",
      }
    }

    if (mode === "registration") {
      return {
        inviteRewardInviter: Number(inviteRewardInviter),
        inviteRewardInvitee: Number(inviteRewardInvitee),
        registrationEnabled,
        registrationRequireInviteCode,
        registerInviteCodeEnabled,
        inviteCodePurchaseEnabled,
        registerCaptchaMode,
        loginCaptchaMode,
        turnstileSiteKey,
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
        smtpEnabled,
        smtpHost,
        smtpPort: Number(smtpPort),
        smtpUser,
        smtpPass,
        smtpFrom,
        smtpSecure,
        section: "site-registration",
      }
    }

    return {
      tippingEnabled,
      tippingDailyLimit: Number(tippingDailyLimit),
      tippingPerPostLimit: Number(tippingPerPostLimit),
      tippingAmounts,
      tippingGifts,
      postRedPacketEnabled,
      postRedPacketMaxPoints: Number(postRedPacketMaxPoints),
      postRedPacketDailyLimit: Number(postRedPacketDailyLimit),
      heatViewWeight: Number(heatViewWeight),
      heatCommentWeight: Number(heatCommentWeight),
      heatLikeWeight: Number(heatLikeWeight),
      heatTipCountWeight: Number(heatTipCountWeight),
      heatTipPointsWeight: Number(heatTipPointsWeight),
      heatStageThresholds,
      heatStageColors: heatStageColors.join(","),
      section: "site-interaction",
    }
  }

  const title = mode === "profile" ? "基础信息" : mode === "registration" ? "注册与邀请" : "互动与热度"
  const submitText = mode === "profile" ? "保存基础信息" : mode === "registration" ? "保存注册与邀请" : "保存互动与热度"

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          const response = await fetch("/api/admin/site-settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildPayload()),
          })
          const result = await response.json()
          if (!response.ok) {
            toast.error(result.message ?? "保存失败", "保存失败")
            return
          }
          toast.success(result.message ?? "保存成功", "保存成功")
          router.refresh()
        })
      }}
    >
      {mode === "profile" ? (
        <div className="rounded-[24px] border border-border p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">站点对外展示的基础品牌信息、帖子链接形式与基础编辑规则配置。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <TextField label="站点名称" value={siteName} onChange={setSiteName} placeholder="如 兴趣论坛" />
            <TextField label="Logo 文案" value={siteLogoText} onChange={setSiteLogoText} placeholder="如 兴趣论坛" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <TextField label="帖子可编辑分钟数" value={postEditableMinutes} onChange={setPostEditableMinutes} placeholder="如 10" />
            <TextField label="评论可编辑分钟数" value={commentEditableMinutes} onChange={setCommentEditableMinutes} placeholder="如 5" />
          </div>
  
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">帖子链接显示模式</p>
              <select value={postLinkDisplayMode} onChange={(event) => setPostLinkDisplayMode(event.target.value as "SLUG" | "ID")} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none">
                <option value="SLUG">slug 模式（/posts/标题-id）</option>
                <option value="ID">id 模式（/posts/id）</option>
              </select>
              <p className="text-xs leading-6 text-muted-foreground">只影响站内生成给用户看到的帖子链接；旧链接仍保持兼容并会规范跳转到标准地址。</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">首页帖子列表形式</p>
              <select value={homeFeedPostListDisplayMode} onChange={(event) => setHomeFeedPostListDisplayMode(event.target.value === POST_LIST_DISPLAY_MODE_GALLERY ? POST_LIST_DISPLAY_MODE_GALLERY : POST_LIST_DISPLAY_MODE_DEFAULT)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none">
                <option value={POST_LIST_DISPLAY_MODE_DEFAULT}>普通列表</option>
                <option value={POST_LIST_DISPLAY_MODE_GALLERY}>画廊模式</option>
              </select>
              <p className="text-xs leading-6 text-muted-foreground">只影响首页 feed 的普通帖子列表；置顶帖始终保持原来的普通列表样式。</p>
            </div>
            <SwitchField label="首页右侧统计卡片" checked={homeSidebarStatsCardEnabled} onChange={setHomeSidebarStatsCardEnabled} />
            <SwitchField label="首页右侧站点公告" checked={homeSidebarAnnouncementsEnabled} onChange={setHomeSidebarAnnouncementsEnabled} />
            <SwitchField label="站内搜索" checked={searchEnabled} onChange={setSearchEnabled} />
          </div>
          <p className="text-xs leading-6 text-muted-foreground">关闭后，前台搜索入口输入关键词将不再跳转站内搜索，而是弹出 `Google 搜索` 和 `Bing 搜索` 两个外部搜索选项。</p>
          <TextField label="站点 Slogan" value={siteSlogan} onChange={setSiteSlogan} placeholder="如 Waste your time on things you love" />
          <div className="space-y-3 rounded-[24px] border border-border p-5">
            <div>
              <h4 className="text-sm font-semibold">站点 Logo</h4>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">支持上传图片或直接填写图片地址；未设置时，前台继续使用默认 SVG 图标。</p>
            </div>
            <div className="space-y-3 rounded-[18px] border border-dashed border-border bg-card/60 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent">
                  {isUploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {isUploadingLogo ? "上传中..." : "上传站点 Logo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={isUploadingLogo}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        void uploadSiteLogo(file)
                      }
                      event.target.value = ""
                    }}
                  />
                </label>
                <Button type="button" variant="ghost" disabled={!siteLogoPath || isUploadingLogo} onClick={() => setSiteLogoPath("")}>清空图片 Logo</Button>
              </div>
              <input value={siteLogoPath} onChange={(event) => setSiteLogoPath(event.target.value)} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none" placeholder="或直接填写站点 Logo 地址" />
              {siteLogoPath ? (
                <div className="relative h-16 w-40 overflow-hidden rounded-xl border border-border bg-white p-2">
                  <Image src={siteLogoPath} alt="站点 Logo 预览" fill sizes="160px" className="object-contain" unoptimized />
                </div>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">站点 SEO 关键字</p>
            <textarea value={siteSeoKeywords} onChange={(event) => setSiteSeoKeywords(event.target.value)} className="min-h-[96px] w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm outline-none" placeholder="多个关键字请用英文逗号、中文逗号或换行分隔" />
            <p className="text-xs leading-6 text-muted-foreground">这些关键字会写入站点页面的 metadata keywords，用于 SEO 基础配置。</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">页脚统计代码</p>
            <textarea value={analyticsCode} onChange={(event) => setAnalyticsCode(event.target.value)} className="min-h-[140px] w-full rounded-[24px] border border-border bg-background px-4 py-3 font-mono text-sm outline-none" placeholder="可粘贴统计脚本、站长统计或自定义 hook 代码" />
            <p className="text-xs leading-6 text-muted-foreground">这段代码会插入到全站页脚底部的统计 Hook 容器中，请仅粘贴你信任的统计脚本。</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">站点描述</p>
            <textarea value={siteDescription} onChange={(event) => setSiteDescription(event.target.value)} className="min-h-[140px] w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm outline-none" />
          </div>
        </div>
      ) : null}

      {mode === "registration" ? (
        <>
          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">注册与邀请码</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">控制注册开关、邀请码策略，以及用户邀请奖励。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <SwitchField label="允许新用户注册" checked={registrationEnabled} onChange={setRegistrationEnabled} />
              <SwitchField label="显示邀请码输入框" checked={registerInviteCodeEnabled} onChange={setRegisterInviteCodeEnabled} />
              <SwitchField label="注册必须邀请码" checked={registrationRequireInviteCode} onChange={setRegistrationRequireInviteCode} />
              <SwitchField label="开启积分购买邀请码" checked={inviteCodePurchaseEnabled} onChange={setInviteCodePurchaseEnabled} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="邀请人奖励数量" value={inviteRewardInviter} onChange={setInviteRewardInviter} placeholder="如 10" />
              <TextField label="被邀请人奖励数量" value={inviteRewardInvitee} onChange={setInviteRewardInvitee} placeholder="如 5" />
            </div>
          </div>

          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">注册防机器人验证码</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">支持关闭、Cloudflare Turnstile、自建图形验证码与 PoW 工作量证明四种模式。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <CaptchaModeField label="注册验证码模式" value={registerCaptchaMode} onChange={setRegisterCaptchaMode} />
              <CaptchaModeField label="登录验证码模式" value={loginCaptchaMode} onChange={setLoginCaptchaMode} />
              <TextField label="Turnstile Site Key" value={turnstileSiteKey} onChange={setTurnstileSiteKey} placeholder="填写 Cloudflare Turnstile 公钥" />
            </div>
            <p className="text-xs leading-6 text-muted-foreground">当模式为 `TURNSTILE` 时，需要同时配置环境变量 `TURNSTILE_SECRET_KEY`；当模式为 `BUILTIN` 时，系统会使用站点自建图形验证码；当模式为 `POW` 时，系统会下发签名挑战并要求浏览器完成一次工作量证明，默认读取 `POW_CAPTCHA_SECRET_KEY`，未设置时回退到 `CAPTCHA_SECRET_KEY` 或 `TURNSTILE_SECRET_KEY`。</p>
          </div>

          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">注册表单字段</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">邮箱、手机、昵称、性别、邀请人等字段的显示与必填策略。</p>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <FieldGroup title="邮箱">
                <SwitchField label="显示邮箱输入框" checked={registerEmailEnabled} onChange={setRegisterEmailEnabled} />
                <SwitchField label="邮箱必填" checked={registerEmailRequired} onChange={setRegisterEmailRequired} />
                <SwitchField label="邮箱需要验证" checked={registerEmailVerification} onChange={setRegisterEmailVerification} />
              </FieldGroup>
              <FieldGroup title="手机">
                <SwitchField label="显示手机输入框" checked={registerPhoneEnabled} onChange={setRegisterPhoneEnabled} />
                <SwitchField label="手机必填" checked={registerPhoneRequired} onChange={setRegisterPhoneRequired} />
                <SwitchField label="手机需要验证" checked={registerPhoneVerification} onChange={setRegisterPhoneVerification} />
              </FieldGroup>
              <FieldGroup title="其它字段">
                <SwitchField label="显示昵称输入框" checked={registerNicknameEnabled} onChange={setRegisterNicknameEnabled} />
                <SwitchField label="昵称必填" checked={registerNicknameRequired} onChange={setRegisterNicknameRequired} />
                <SwitchField label="显示性别选项" checked={registerGenderEnabled} onChange={setRegisterGenderEnabled} />
                <SwitchField label="性别必填" checked={registerGenderRequired} onChange={setRegisterGenderRequired} />
                <SwitchField label="显示邀请人输入框" checked={registerInviterEnabled} onChange={setRegisterInviterEnabled} />
              </FieldGroup>
            </div>
          </div>

          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">SMTP 邮件发送</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">开启后，邮箱验证码会通过真实邮件发送。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SwitchField label="启用 SMTP" checked={smtpEnabled} onChange={setSmtpEnabled} />
              <SwitchField label="启用 SSL/TLS" checked={smtpSecure} onChange={setSmtpSecure} />
              <TextField label="SMTP 主机" value={smtpHost} onChange={setSmtpHost} placeholder="如 smtp.qq.com" />
              <TextField label="SMTP 端口" value={smtpPort} onChange={setSmtpPort} placeholder="如 465 / 587" />
              <TextField label="SMTP 账号" value={smtpUser} onChange={setSmtpUser} placeholder="邮箱账号" />
              <TextField label="SMTP 密码 / 授权码" type="password" value={smtpPass} onChange={setSmtpPass} placeholder="请输入密码或授权码" />
              <TextField label="发件人地址" value={smtpFrom} onChange={setSmtpFrom} placeholder="如 Forum <no-reply@example.com>" />
            </div>
          </div>
        </>
      ) : null}

      {mode === "interaction" ? (
        <>
          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">帖子打赏</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">控制打赏开关、次数限制与送礼配置。礼物名称、图标和价格都可在后台维护。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SwitchField label="开启帖子打赏" checked={tippingEnabled} onChange={setTippingEnabled} />
              <TextField label="每日可打赏次数" value={tippingDailyLimit} onChange={setTippingDailyLimit} placeholder="如 3" />
              <TextField label="单帖可打赏次数" value={tippingPerPostLimit} onChange={setTippingPerPostLimit} placeholder="如 1" />
            </div>
            <TextField label="裸积分打赏档位" value={tippingAmounts} onChange={setTippingAmounts} placeholder="如 10,30,50,100" />
            <AdminTippingGiftListEditor items={tippingGifts} onChange={setTippingGifts} />
          </div>

          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">帖子红包</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">控制帖子红包功能开关、单个红包最大积分，以及用户每日可发红包积分上限。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SwitchField label="开启帖子红包" checked={postRedPacketEnabled} onChange={setPostRedPacketEnabled} />
              <TextField label="单个红包最大积分" value={postRedPacketMaxPoints} onChange={setPostRedPacketMaxPoints} placeholder="如 100" />
              <TextField label="每日发红包积分上限" value={postRedPacketDailyLimit} onChange={setPostRedPacketDailyLimit} placeholder="如 300" />
            </div>
          </div>

          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">帖子热度颜色算法</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">统一配置热度分数计算权重与颜色阶段。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <TextField label="浏览权重" value={heatViewWeight} onChange={setHeatViewWeight} placeholder="如 1" />
              <TextField label="回复权重" value={heatCommentWeight} onChange={setHeatCommentWeight} placeholder="如 8" />
              <TextField label="点赞权重" value={heatLikeWeight} onChange={setHeatLikeWeight} placeholder="如 6" />
              <TextField label="打赏次数权重" value={heatTipCountWeight} onChange={setHeatTipCountWeight} placeholder="如 10" />
              <TextField label="打赏积分权重" value={heatTipPointsWeight} onChange={setHeatTipPointsWeight} placeholder="如 1" />
            </div>
            <TextField label="9 段热度阈值" value={heatStageThresholds} onChange={setHeatStageThresholds} placeholder="如 0,80,180,320,520,780,1100,1500,2000" />
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

          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">热度预览面板</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">调整参数后，实时预览热度分数与颜色表现。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <TextField label="浏览数" value={previewViews} onChange={setPreviewViews} placeholder="如 120" />
              <TextField label="回复数" value={previewComments} onChange={setPreviewComments} placeholder="如 18" />
              <TextField label="点赞数" value={previewLikes} onChange={setPreviewLikes} placeholder="如 12" />
              <TextField label="打赏次数" value={previewTipCount} onChange={setPreviewTipCount} placeholder="如 4" />
              <TextField label="打赏积分" value={previewTipPoints} onChange={setPreviewTipPoints} placeholder="如 160" />
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


function SwitchField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <select value={checked ? "on" : "off"} onChange={(event) => onChange(event.target.value === "on")} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none">
        <option value="on">开启</option>
        <option value="off">关闭</option>
      </select>
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
