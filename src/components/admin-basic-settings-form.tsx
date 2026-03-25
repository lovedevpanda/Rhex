"use client"

import Image from "next/image"
import { useMemo, useState, useTransition } from "react"
import { Loader2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { PickerPopover, PickerTriggerField, normalizeHexColor } from "@/components/admin-picker-popover"
import { calculatePostHeatScore, resolvePostHeatStyle } from "@/lib/post-heat"

interface AdminBasicSettingsFormProps {
  initialSettings: {
    siteName: string
    siteSlogan: string
    siteDescription: string
    siteLogoText: string
    siteLogoPath?: string | null
    siteSeoKeywords?: string[]
    pointName: string
    analyticsCode?: string | null
    checkInEnabled: boolean
    checkInReward: number
    checkInMakeUpCardPrice: number
    checkInVipMakeUpCardPrice: number
    inviteRewardInviter: number
    inviteRewardInvitee: number
    registrationEnabled: boolean
    registrationRequireInviteCode: boolean
    registerInviteCodeEnabled: boolean
    inviteCodePurchaseEnabled: boolean
    inviteCodePrice: number
    registerCaptchaMode: "OFF" | "TURNSTILE" | "BUILTIN"
    loginCaptchaMode: "OFF" | "TURNSTILE" | "BUILTIN"
    turnstileSiteKey?: string | null
    nicknameChangePointCost: number
    tippingEnabled: boolean
    tippingDailyLimit: number
    tippingPerPostLimit: number
    tippingAmounts: number[]
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
  const [siteName, setSiteName] = useState(initialSettings.siteName)
  const [siteSlogan, setSiteSlogan] = useState(initialSettings.siteSlogan)
  const [siteDescription, setSiteDescription] = useState(initialSettings.siteDescription)
  const [siteLogoText, setSiteLogoText] = useState(initialSettings.siteLogoText)
  const [siteLogoPath, setSiteLogoPath] = useState(initialSettings.siteLogoPath ?? "")
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [siteSeoKeywords, setSiteSeoKeywords] = useState((initialSettings.siteSeoKeywords ?? []).join(","))
  const [pointName, setPointName] = useState(initialSettings.pointName)
  const [analyticsCode, setAnalyticsCode] = useState(initialSettings.analyticsCode ?? "")
  const [checkInEnabled, setCheckInEnabled] = useState(initialSettings.checkInEnabled)
  const [checkInReward, setCheckInReward] = useState(String(initialSettings.checkInReward))
  const [checkInMakeUpCardPrice, setCheckInMakeUpCardPrice] = useState(String(initialSettings.checkInMakeUpCardPrice))
  const [checkInVipMakeUpCardPrice, setCheckInVipMakeUpCardPrice] = useState(String(initialSettings.checkInVipMakeUpCardPrice))
  const [nicknameChangePointCost, setNicknameChangePointCost] = useState(String(initialSettings.nicknameChangePointCost))
  const [inviteRewardInviter, setInviteRewardInviter] = useState(String(initialSettings.inviteRewardInviter))
  const [inviteRewardInvitee, setInviteRewardInvitee] = useState(String(initialSettings.inviteRewardInvitee))
  const [registrationEnabled, setRegistrationEnabled] = useState(initialSettings.registrationEnabled)
  const [registrationRequireInviteCode, setRegistrationRequireInviteCode] = useState(initialSettings.registrationRequireInviteCode)
  const [registerInviteCodeEnabled, setRegisterInviteCodeEnabled] = useState(initialSettings.registerInviteCodeEnabled)
  const [inviteCodePurchaseEnabled, setInviteCodePurchaseEnabled] = useState(initialSettings.inviteCodePurchaseEnabled)
  const [inviteCodePrice, setInviteCodePrice] = useState(String(initialSettings.inviteCodePrice))
  const [registerCaptchaMode, setRegisterCaptchaMode] = useState(initialSettings.registerCaptchaMode)
  const [loginCaptchaMode, setLoginCaptchaMode] = useState(initialSettings.loginCaptchaMode)
  const [turnstileSiteKey, setTurnstileSiteKey] = useState(initialSettings.turnstileSiteKey ?? "")
  const [tippingEnabled, setTippingEnabled] = useState(initialSettings.tippingEnabled)
  const [tippingDailyLimit, setTippingDailyLimit] = useState(String(initialSettings.tippingDailyLimit))
  const [tippingPerPostLimit, setTippingPerPostLimit] = useState(String(initialSettings.tippingPerPostLimit))
  const [tippingAmounts, setTippingAmounts] = useState(initialSettings.tippingAmounts.join(","))
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
        pointName,
        analyticsCode,
        checkInEnabled,
        checkInReward: Number(checkInReward),
        checkInMakeUpCardPrice: Number(checkInMakeUpCardPrice),
        checkInVipMakeUpCardPrice: Number(checkInVipMakeUpCardPrice),
        nicknameChangePointCost: Number(nicknameChangePointCost),
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
        inviteCodePrice: Number(inviteCodePrice),
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
        })
      }}
    >
      {mode === "profile" ? (
        <div className="rounded-[24px] border border-border p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">站点对外展示的基础品牌信息、签到规则与资料相关基础收费配置。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="站点名称" value={siteName} onChange={setSiteName} placeholder="如 兴趣论坛" />
            <Field label="Logo 文案" value={siteLogoText} onChange={setSiteLogoText} placeholder="如 兴趣论坛" />
            <Field label="积分名称" value={pointName} onChange={setPointName} placeholder="如 积分 / 金币 / 钻石" />
            <Field label="修改昵称所需积分" value={nicknameChangePointCost} onChange={setNicknameChangePointCost} placeholder="0 表示免费" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SwitchField label="签到开关" checked={checkInEnabled} onChange={setCheckInEnabled} />
            <Field label="签到奖励数量" value={checkInReward} onChange={setCheckInReward} placeholder="如 5" />
            <Field label="普通用户补签价格" value={checkInMakeUpCardPrice} onChange={setCheckInMakeUpCardPrice} placeholder="如 20" />
            <Field label="VIP 补签价格" value={checkInVipMakeUpCardPrice} onChange={setCheckInVipMakeUpCardPrice} placeholder="如 10" />
          </div>
          <Field label="站点 Slogan" value={siteSlogan} onChange={setSiteSlogan} placeholder="如 Waste your time on things you love" />
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
              <Field label="邀请码购买价格" value={inviteCodePrice} onChange={setInviteCodePrice} placeholder="如 100" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="邀请人奖励数量" value={inviteRewardInviter} onChange={setInviteRewardInviter} placeholder="如 10" />
              <Field label="被邀请人奖励数量" value={inviteRewardInvitee} onChange={setInviteRewardInvitee} placeholder="如 5" />
            </div>
          </div>

          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">注册防机器人验证码</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">支持关闭、Cloudflare Turnstile 与自建图形验证码三种模式。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <CaptchaModeField label="注册验证码模式" value={registerCaptchaMode} onChange={setRegisterCaptchaMode} />
              <CaptchaModeField label="登录验证码模式" value={loginCaptchaMode} onChange={setLoginCaptchaMode} />
              <Field label="Turnstile Site Key" value={turnstileSiteKey} onChange={setTurnstileSiteKey} placeholder="填写 Cloudflare Turnstile 公钥" />
            </div>
            <p className="text-xs leading-6 text-muted-foreground">当模式为 `TURNSTILE` 时，需要同时配置环境变量 `TURNSTILE_SECRET_KEY`；当模式为 `BUILTIN` 时，系统会使用站点自建图形验证码，并通过签名 token 校验。</p>
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
              <Field label="SMTP 主机" value={smtpHost} onChange={setSmtpHost} placeholder="如 smtp.qq.com" />
              <Field label="SMTP 端口" value={smtpPort} onChange={setSmtpPort} placeholder="如 465 / 587" />
              <Field label="SMTP 账号" value={smtpUser} onChange={setSmtpUser} placeholder="邮箱账号" />
              <PasswordField label="SMTP 密码 / 授权码" value={smtpPass} onChange={setSmtpPass} placeholder="请输入密码或授权码" />
              <Field label="发件人地址" value={smtpFrom} onChange={setSmtpFrom} placeholder="如 Forum <no-reply@example.com>" />
            </div>
          </div>
        </>
      ) : null}

      {mode === "interaction" ? (
        <>
          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">帖子打赏</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">控制打赏开关、次数限制与固定打赏金额。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SwitchField label="开启帖子打赏" checked={tippingEnabled} onChange={setTippingEnabled} />
              <Field label="每日可打赏次数" value={tippingDailyLimit} onChange={setTippingDailyLimit} placeholder="如 3" />
              <Field label="单帖可打赏次数" value={tippingPerPostLimit} onChange={setTippingPerPostLimit} placeholder="如 1" />
              <Field label="固定打赏金额" value={tippingAmounts} onChange={setTippingAmounts} placeholder="如 10,30,50,100" />
            </div>
          </div>

          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">帖子热度颜色算法</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">统一配置热度分数计算权重与颜色阶段。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Field label="浏览权重" value={heatViewWeight} onChange={setHeatViewWeight} placeholder="如 1" />
              <Field label="回复权重" value={heatCommentWeight} onChange={setHeatCommentWeight} placeholder="如 8" />
              <Field label="点赞权重" value={heatLikeWeight} onChange={setHeatLikeWeight} placeholder="如 6" />
              <Field label="打赏次数权重" value={heatTipCountWeight} onChange={setHeatTipCountWeight} placeholder="如 10" />
              <Field label="打赏积分权重" value={heatTipPointsWeight} onChange={setHeatTipPointsWeight} placeholder="如 1" />
            </div>
            <Field label="9 段热度阈值" value={heatStageThresholds} onChange={setHeatStageThresholds} placeholder="如 0,80,180,320,520,780,1100,1500,2000" />
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
              <Field label="浏览数" value={previewViews} onChange={setPreviewViews} placeholder="如 120" />
              <Field label="回复数" value={previewComments} onChange={setPreviewComments} placeholder="如 18" />
              <Field label="点赞数" value={previewLikes} onChange={setPreviewLikes} placeholder="如 12" />
              <Field label="打赏次数" value={previewTipCount} onChange={setPreviewTipCount} placeholder="如 4" />
              <Field label="打赏积分" value={previewTipPoints} onChange={setPreviewTipPoints} placeholder="如 160" />
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

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" />
    </div>
  )
}

function PasswordField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <input type="password" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" />
    </div>
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

function CaptchaModeField({ label, value, onChange }: { label: string; value: "OFF" | "TURNSTILE" | "BUILTIN"; onChange: (value: "OFF" | "TURNSTILE" | "BUILTIN") => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <select value={value} onChange={(event) => onChange(event.target.value as "OFF" | "TURNSTILE" | "BUILTIN")} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none">
        <option value="OFF">关闭</option>
        <option value="TURNSTILE">Cloudflare Turnstile</option>
        <option value="BUILTIN">自建图形验证码</option>
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
