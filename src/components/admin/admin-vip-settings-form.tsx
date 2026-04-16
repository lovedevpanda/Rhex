"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"

import {
  AdminBooleanSelectField,
  SettingsInputField,
  SettingsSection,
} from "@/components/admin/admin-settings-fields"
import { IconPicker } from "@/components/ui/icon-picker"
import { ColorPicker } from "@/components/ui/color-picker"
import { AdminSettingsSubTabs } from "@/components/admin/admin-settings-sub-tabs"
import { AdminRedeemCodeManager } from "@/components/admin/admin-redeem-code-manager"
import { Button } from "@/components/ui/button"
import { getAdminSettingsHref } from "@/lib/admin-settings-navigation"
import type { AdminSettingsSectionKey } from "@/lib/admin-navigation"
import { saveAdminSiteSettings } from "@/lib/admin-site-settings-client"
import { normalizeVipNameColors, VIP_NAME_COLOR_FALLBACKS, VIP_NAME_COLOR_PRESETS } from "@/lib/vip-name-colors"

interface AdminVipSettingsFormProps {
  initialSettings: {
    pointName: string
    redeemCodeHelpEnabled: boolean
    redeemCodeHelpTitle: string
    redeemCodeHelpUrl: string
    checkInEnabled: boolean
    checkInReward: number
    checkInVip1Reward: number
    checkInVip2Reward: number
    checkInVip3Reward: number
    checkInMakeUpEnabled: boolean
    checkInMakeUpCardPrice: number
    checkInVip1MakeUpCardPrice: number
    checkInVip2MakeUpCardPrice: number
    checkInVip3MakeUpCardPrice: number
    checkInMakeUpCountsTowardStreak: boolean
    checkInMakeUpOldestDayLimit: number
    nicknameChangePointCost: number
    nicknameChangeVip1PointCost: number
    nicknameChangeVip2PointCost: number
    nicknameChangeVip3PointCost: number
    introductionChangePointCost: number
    introductionChangeVip1PointCost: number
    introductionChangeVip2PointCost: number
    introductionChangeVip3PointCost: number
    avatarChangePointCost: number
    avatarChangeVip1PointCost: number
    avatarChangeVip2PointCost: number
    avatarChangeVip3PointCost: number
    inviteCodePrice: number
    inviteCodeVip1Price: number
    inviteCodeVip2Price: number
    inviteCodeVip3Price: number
    vipMonthlyPrice: number
    vipQuarterlyPrice: number
    vipYearlyPrice: number
    vipLevelIcons: {
      vip1: string
      vip2: string
      vip3: string
    }
    vipNameColors: {
      normal: string
      vip1: string
      vip2: string
      vip3: string
    }
    postOfflinePrice: number
    postOfflineVip1Price: number
    postOfflineVip2Price: number
    postOfflineVip3Price: number
  }
  initialSubTab?: string
  tabRouteSection?: AdminSettingsSectionKey
  initialRedeemCodes?: Array<{
    id: string
    code: string
    points: number
    codeCategory: string
    categoryUserLimit: number | null
    createdAt: string
    createdByUsername: string | null
    redeemedAt: string | null
    redeemedByUsername: string | null
    expiresAt: string | null
    note: string | null
  }>
}

const VIP_TABS = [
  { key: "points-vip", label: "积分与VIP" },
  { key: "redeem-codes", label: "兑换码管理" },
] as const

function resolveVipTab(initialSubTab?: string) {
  return VIP_TABS.some((item) => item.key === initialSubTab) ? initialSubTab! : "points-vip"
}

export function AdminVipSettingsForm({
  initialSettings,
  initialSubTab,
  tabRouteSection,
  initialRedeemCodes = [],
}: AdminVipSettingsFormProps) {
  const initialVipNameColors = normalizeVipNameColors(initialSettings.vipNameColors)
  const router = useRouter()
  const [activeTab, setActiveTab] = useState(() => resolveVipTab(initialSubTab))
  const [pointName, setPointName] = useState(initialSettings.pointName)
  const [redeemCodeHelpEnabled, setRedeemCodeHelpEnabled] = useState(initialSettings.redeemCodeHelpEnabled)
  const [redeemCodeHelpTitle, setRedeemCodeHelpTitle] = useState(initialSettings.redeemCodeHelpTitle)
  const [redeemCodeHelpUrl, setRedeemCodeHelpUrl] = useState(initialSettings.redeemCodeHelpUrl)
  const [checkInEnabled, setCheckInEnabled] = useState(initialSettings.checkInEnabled)
  const [checkInReward, setCheckInReward] = useState(String(initialSettings.checkInReward))
  const [checkInVip1Reward, setCheckInVip1Reward] = useState(String(initialSettings.checkInVip1Reward))
  const [checkInVip2Reward, setCheckInVip2Reward] = useState(String(initialSettings.checkInVip2Reward))
  const [checkInVip3Reward, setCheckInVip3Reward] = useState(String(initialSettings.checkInVip3Reward))
  const [checkInMakeUpEnabled, setCheckInMakeUpEnabled] = useState(initialSettings.checkInMakeUpEnabled ?? true)
  const [checkInMakeUpCardPrice, setCheckInMakeUpCardPrice] = useState(String(initialSettings.checkInMakeUpCardPrice))
  const [checkInVip1MakeUpCardPrice, setCheckInVip1MakeUpCardPrice] = useState(String(initialSettings.checkInVip1MakeUpCardPrice))
  const [checkInVip2MakeUpCardPrice, setCheckInVip2MakeUpCardPrice] = useState(String(initialSettings.checkInVip2MakeUpCardPrice))
  const [checkInVip3MakeUpCardPrice, setCheckInVip3MakeUpCardPrice] = useState(String(initialSettings.checkInVip3MakeUpCardPrice))
  const [checkInMakeUpCountsTowardStreak, setCheckInMakeUpCountsTowardStreak] = useState(initialSettings.checkInMakeUpCountsTowardStreak)
  const [checkInMakeUpOldestDayLimit, setCheckInMakeUpOldestDayLimit] = useState(String(initialSettings.checkInMakeUpOldestDayLimit ?? 0))
  const [nicknameChangePointCost, setNicknameChangePointCost] = useState(String(initialSettings.nicknameChangePointCost))
  const [nicknameChangeVip1PointCost, setNicknameChangeVip1PointCost] = useState(String(initialSettings.nicknameChangeVip1PointCost))
  const [nicknameChangeVip2PointCost, setNicknameChangeVip2PointCost] = useState(String(initialSettings.nicknameChangeVip2PointCost))
  const [nicknameChangeVip3PointCost, setNicknameChangeVip3PointCost] = useState(String(initialSettings.nicknameChangeVip3PointCost))
  const [introductionChangePointCost, setIntroductionChangePointCost] = useState(String(initialSettings.introductionChangePointCost))
  const [introductionChangeVip1PointCost, setIntroductionChangeVip1PointCost] = useState(String(initialSettings.introductionChangeVip1PointCost))
  const [introductionChangeVip2PointCost, setIntroductionChangeVip2PointCost] = useState(String(initialSettings.introductionChangeVip2PointCost))
  const [introductionChangeVip3PointCost, setIntroductionChangeVip3PointCost] = useState(String(initialSettings.introductionChangeVip3PointCost))
  const [avatarChangePointCost, setAvatarChangePointCost] = useState(String(initialSettings.avatarChangePointCost))
  const [avatarChangeVip1PointCost, setAvatarChangeVip1PointCost] = useState(String(initialSettings.avatarChangeVip1PointCost))
  const [avatarChangeVip2PointCost, setAvatarChangeVip2PointCost] = useState(String(initialSettings.avatarChangeVip2PointCost))
  const [avatarChangeVip3PointCost, setAvatarChangeVip3PointCost] = useState(String(initialSettings.avatarChangeVip3PointCost))
  const [inviteCodePrice, setInviteCodePrice] = useState(String(initialSettings.inviteCodePrice))
  const [inviteCodeVip1Price, setInviteCodeVip1Price] = useState(String(initialSettings.inviteCodeVip1Price))
  const [inviteCodeVip2Price, setInviteCodeVip2Price] = useState(String(initialSettings.inviteCodeVip2Price))
  const [inviteCodeVip3Price, setInviteCodeVip3Price] = useState(String(initialSettings.inviteCodeVip3Price))
  const [vipMonthlyPrice, setVipMonthlyPrice] = useState(String(initialSettings.vipMonthlyPrice))
  const [vipQuarterlyPrice, setVipQuarterlyPrice] = useState(String(initialSettings.vipQuarterlyPrice))
  const [vipYearlyPrice, setVipYearlyPrice] = useState(String(initialSettings.vipYearlyPrice))
  const [vipLevelIconVip1, setVipLevelIconVip1] = useState(initialSettings.vipLevelIcons.vip1)
  const [vipLevelIconVip2, setVipLevelIconVip2] = useState(initialSettings.vipLevelIcons.vip2)
  const [vipLevelIconVip3, setVipLevelIconVip3] = useState(initialSettings.vipLevelIcons.vip3)
  const [vipNameColorNormal, setVipNameColorNormal] = useState(initialVipNameColors.normal)
  const [vipNameColorVip1, setVipNameColorVip1] = useState(initialVipNameColors.vip1)
  const [vipNameColorVip2, setVipNameColorVip2] = useState(initialVipNameColors.vip2)
  const [vipNameColorVip3, setVipNameColorVip3] = useState(initialVipNameColors.vip3)
  const [postOfflinePrice, setPostOfflinePrice] = useState(String(initialSettings.postOfflinePrice))
  const [postOfflineVip1Price, setPostOfflineVip1Price] = useState(String(initialSettings.postOfflineVip1Price))
  const [postOfflineVip2Price, setPostOfflineVip2Price] = useState(String(initialSettings.postOfflineVip2Price))
  const [postOfflineVip3Price, setPostOfflineVip3Price] = useState(String(initialSettings.postOfflineVip3Price))
  const [feedback, setFeedback] = useState("")

  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setActiveTab(resolveVipTab(initialSubTab))
  }, [initialSubTab])

  return (
    <div className="space-y-4">
      {!tabRouteSection ? (
        <div className="rounded-[22px] border border-border bg-card p-3">
          <AdminSettingsSubTabs
            items={VIP_TABS.map((item) => ({
              key: item.key,
              label: item.label,
              ...(tabRouteSection
                ? { href: getAdminSettingsHref(tabRouteSection, item.key) }
                : { onSelect: () => setActiveTab(item.key) }),
            }))}
            activeKey={activeTab}
          />
        </div>
      ) : null}

      {activeTab === "redeem-codes" ? <AdminRedeemCodeManager initialRedeemCodes={initialRedeemCodes} /> : null}

      {activeTab === "points-vip" ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            setFeedback("")
            startTransition(async () => {
              const result = await saveAdminSiteSettings({
                pointName,
                redeemCodeHelpEnabled,
                redeemCodeHelpTitle,
                redeemCodeHelpUrl,
                checkInEnabled,
                checkInReward: Number(checkInReward),
                checkInVip1Reward: Number(checkInVip1Reward),
                checkInVip2Reward: Number(checkInVip2Reward),
                checkInVip3Reward: Number(checkInVip3Reward),
                checkInMakeUpEnabled,
                checkInMakeUpCardPrice: Number(checkInMakeUpCardPrice),
                checkInVipMakeUpCardPrice: Number(checkInVip1MakeUpCardPrice),
                checkInVip1MakeUpCardPrice: Number(checkInVip1MakeUpCardPrice),
                checkInVip2MakeUpCardPrice: Number(checkInVip2MakeUpCardPrice),
                checkInVip3MakeUpCardPrice: Number(checkInVip3MakeUpCardPrice),
                checkInMakeUpCountsTowardStreak,
                checkInMakeUpOldestDayLimit: Number(checkInMakeUpOldestDayLimit),
                nicknameChangePointCost: Number(nicknameChangePointCost),
                nicknameChangeVip1PointCost: Number(nicknameChangeVip1PointCost),
                nicknameChangeVip2PointCost: Number(nicknameChangeVip2PointCost),
                nicknameChangeVip3PointCost: Number(nicknameChangeVip3PointCost),
                introductionChangePointCost: Number(introductionChangePointCost),
                introductionChangeVip1PointCost: Number(introductionChangeVip1PointCost),
                introductionChangeVip2PointCost: Number(introductionChangeVip2PointCost),
                introductionChangeVip3PointCost: Number(introductionChangeVip3PointCost),
                avatarChangePointCost: Number(avatarChangePointCost),
                avatarChangeVip1PointCost: Number(avatarChangeVip1PointCost),
                avatarChangeVip2PointCost: Number(avatarChangeVip2PointCost),
                avatarChangeVip3PointCost: Number(avatarChangeVip3PointCost),
                inviteCodePrice: Number(inviteCodePrice),
                inviteCodeVip1Price: Number(inviteCodeVip1Price),
                inviteCodeVip2Price: Number(inviteCodeVip2Price),
                inviteCodeVip3Price: Number(inviteCodeVip3Price),
                vipMonthlyPrice: Number(vipMonthlyPrice),
                vipQuarterlyPrice: Number(vipQuarterlyPrice),
                vipYearlyPrice: Number(vipYearlyPrice),
                vipLevelIconVip1,
                vipLevelIconVip2,
                vipLevelIconVip3,
                vipNameColorNormal,
                vipNameColorVip1,
                vipNameColorVip2,
                vipNameColorVip3,
                postOfflinePrice: Number(postOfflinePrice),
                postOfflineVip1Price: Number(postOfflineVip1Price),
                postOfflineVip2Price: Number(postOfflineVip2Price),
                postOfflineVip3Price: Number(postOfflineVip3Price),
                section: "vip",
              })
              setFeedback(result.message)
              if (result.ok) {
                router.refresh()
              }
            })
          }}
        >
          <SettingsSection
            title="积分基础配置"
            description="统一配置积分名称、签到奖励、补签开关、补签范围与修改昵称扣费规则。0 是免费；补签最旧历史限制填 0 表示不限制。"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SettingsInputField label="积分名称" value={pointName} onChange={setPointName} placeholder="如 积分 / 金币 / 钻石" />
              <AdminBooleanSelectField label="签到开关" checked={checkInEnabled} onChange={setCheckInEnabled} />
              <AdminBooleanSelectField label="补签开关" checked={checkInMakeUpEnabled} onChange={setCheckInMakeUpEnabled} />
              <AdminBooleanSelectField label="补签计入连续签到" checked={checkInMakeUpCountsTowardStreak} onChange={setCheckInMakeUpCountsTowardStreak} />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SettingsInputField label="补签最旧历史限制天数" value={checkInMakeUpOldestDayLimit} onChange={setCheckInMakeUpOldestDayLimit} placeholder="0 表示不限制，如 30" />
              <AdminBooleanSelectField label="兑换码入口链接开关" checked={redeemCodeHelpEnabled} onChange={setRedeemCodeHelpEnabled} />
              <SettingsInputField label="链接文本" value={redeemCodeHelpTitle} onChange={setRedeemCodeHelpTitle} placeholder="如 获取兑换码" />
              <div className="md:col-span-2 xl:col-span-1">
                <SettingsInputField label="链接地址" value={redeemCodeHelpUrl} onChange={setRedeemCodeHelpUrl} placeholder="如 /faq/redeem-code 或 https://example.com/redeem-help" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SettingsInputField label="普通用户改昵称积分" value={nicknameChangePointCost} onChange={setNicknameChangePointCost} placeholder="0 表示免费" />
              <SettingsInputField label="VIP1 改昵称积分" value={nicknameChangeVip1PointCost} onChange={setNicknameChangeVip1PointCost} placeholder="0 表示免费" />
              <SettingsInputField label="VIP2 改昵称积分" value={nicknameChangeVip2PointCost} onChange={setNicknameChangeVip2PointCost} placeholder="0 表示免费" />
              <SettingsInputField label="VIP3 改昵称积分" value={nicknameChangeVip3PointCost} onChange={setNicknameChangeVip3PointCost} placeholder="0 表示免费" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SettingsInputField label="普通用户改介绍积分" value={introductionChangePointCost} onChange={setIntroductionChangePointCost} placeholder="0 表示免费" />
              <SettingsInputField label="VIP1 改介绍积分" value={introductionChangeVip1PointCost} onChange={setIntroductionChangeVip1PointCost} placeholder="0 表示免费" />
              <SettingsInputField label="VIP2 改介绍积分" value={introductionChangeVip2PointCost} onChange={setIntroductionChangeVip2PointCost} placeholder="0 表示免费" />
              <SettingsInputField label="VIP3 改介绍积分" value={introductionChangeVip3PointCost} onChange={setIntroductionChangeVip3PointCost} placeholder="0 表示免费" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SettingsInputField label="普通用户改头像积分" value={avatarChangePointCost} onChange={setAvatarChangePointCost} placeholder="0 表示免费" />
              <SettingsInputField label="VIP1 改头像积分" value={avatarChangeVip1PointCost} onChange={setAvatarChangeVip1PointCost} placeholder="0 表示免费" />
              <SettingsInputField label="VIP2 改头像积分" value={avatarChangeVip2PointCost} onChange={setAvatarChangeVip2PointCost} placeholder="0 表示免费" />
              <SettingsInputField label="VIP3 改头像积分" value={avatarChangeVip3PointCost} onChange={setAvatarChangeVip3PointCost} placeholder="0 表示免费" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SettingsInputField label="普通用户签到奖励" value={checkInReward} onChange={setCheckInReward} placeholder="如 5" />
              <SettingsInputField label="VIP1 签到奖励" value={checkInVip1Reward} onChange={setCheckInVip1Reward} placeholder="如 8" />
              <SettingsInputField label="VIP2 签到奖励" value={checkInVip2Reward} onChange={setCheckInVip2Reward} placeholder="如 10" />
              <SettingsInputField label="VIP3 签到奖励" value={checkInVip3Reward} onChange={setCheckInVip3Reward} placeholder="如 12" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SettingsInputField label="普通用户补签价格" value={checkInMakeUpCardPrice} onChange={setCheckInMakeUpCardPrice} placeholder="如 20" />
              <SettingsInputField label="VIP1 补签价格" value={checkInVip1MakeUpCardPrice} onChange={setCheckInVip1MakeUpCardPrice} placeholder="如 10" />
              <SettingsInputField label="VIP2 补签价格" value={checkInVip2MakeUpCardPrice} onChange={setCheckInVip2MakeUpCardPrice} placeholder="如 8" />
              <SettingsInputField label="VIP3 补签价格" value={checkInVip3MakeUpCardPrice} onChange={setCheckInVip3MakeUpCardPrice} placeholder="如 5" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SettingsInputField label="普通用户邀请码价格" value={inviteCodePrice} onChange={setInviteCodePrice} placeholder="如 100" />
              <SettingsInputField label="VIP1 邀请码价格" value={inviteCodeVip1Price} onChange={setInviteCodeVip1Price} placeholder="如 80" />
              <SettingsInputField label="VIP2 邀请码价格" value={inviteCodeVip2Price} onChange={setInviteCodeVip2Price} placeholder="如 60" />
              <SettingsInputField label="VIP3 邀请码价格" value={inviteCodeVip3Price} onChange={setInviteCodeVip3Price} placeholder="如 50" />
            </div>
          </SettingsSection>

          <SettingsSection
            title="VIP 套餐配置"
            description="统一配置前台可售 VIP 套餐对应的积分价格与头像角标图标。"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SettingsInputField label="月卡积分价格（VIP1）" value={vipMonthlyPrice} onChange={setVipMonthlyPrice} placeholder="如 3000" />
              <SettingsInputField label="季卡积分价格（VIP2）" value={vipQuarterlyPrice} onChange={setVipQuarterlyPrice} placeholder="如 8000" />
              <SettingsInputField label="年卡积分价格（VIP3）" value={vipYearlyPrice} onChange={setVipYearlyPrice} placeholder="如 30000" />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <IconPicker label="VIP1 头像角标" value={vipLevelIconVip1} onChange={setVipLevelIconVip1} previewColor="#7c3aed" popoverTitle="选择 VIP1 头像角标" description="支持 emoji、符号或完整 SVG，前台会显示在用户头像右下角。" />
              <IconPicker label="VIP2 头像角标" value={vipLevelIconVip2} onChange={setVipLevelIconVip2} previewColor="#e11d48" popoverTitle="选择 VIP2 头像角标" description="支持 emoji、符号或完整 SVG，前台会显示在用户头像右下角。" />
              <IconPicker label="VIP3 头像角标" value={vipLevelIconVip3} onChange={setVipLevelIconVip3} previewColor="#d97706" popoverTitle="选择 VIP3 头像角标" description="支持 emoji、符号或完整 SVG，前台会显示在用户头像右下角。" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">昵称颜色</h3>
              <p className="mt-1 text-xs text-muted-foreground">配置普通用户与 VIP1 / VIP2 / VIP3 的昵称颜色。留空时继续使用系统默认色。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ColorPicker label="普通用户昵称颜色" value={vipNameColorNormal} onChange={setVipNameColorNormal} presets={VIP_NAME_COLOR_PRESETS} fallbackColor={VIP_NAME_COLOR_FALLBACKS.normal} placeholder="留空使用默认颜色" allowClear />
              <ColorPicker label="VIP1 昵称颜色" value={vipNameColorVip1} onChange={setVipNameColorVip1} presets={VIP_NAME_COLOR_PRESETS} fallbackColor={VIP_NAME_COLOR_FALLBACKS.vip1} placeholder="留空使用默认颜色" allowClear />
              <ColorPicker label="VIP2 昵称颜色" value={vipNameColorVip2} onChange={setVipNameColorVip2} presets={VIP_NAME_COLOR_PRESETS} fallbackColor={VIP_NAME_COLOR_FALLBACKS.vip2} placeholder="留空使用默认颜色" allowClear />
              <ColorPicker label="VIP3 昵称颜色" value={vipNameColorVip3} onChange={setVipNameColorVip3} presets={VIP_NAME_COLOR_PRESETS} fallbackColor={VIP_NAME_COLOR_FALLBACKS.vip3} placeholder="留空使用默认颜色" allowClear />
            </div>
            <div>
              <h3 className="text-sm font-semibold">作者下线帖子价格</h3>
              <p className="mt-1 text-xs text-muted-foreground">0 表示免费；普通用户与 VIP1 / VIP2 / VIP3 按当前身份分别扣除积分。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SettingsInputField label="普通用户积分价格" value={postOfflinePrice} onChange={setPostOfflinePrice} placeholder="如 50" />
              <SettingsInputField label="VIP1 积分价格" value={postOfflineVip1Price} onChange={setPostOfflineVip1Price} placeholder="如 30" />
              <SettingsInputField label="VIP2 积分价格" value={postOfflineVip2Price} onChange={setPostOfflineVip2Price} placeholder="如 20" />
              <SettingsInputField label="VIP3 积分价格" value={postOfflineVip3Price} onChange={setPostOfflineVip3Price} placeholder="如 0" />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={isPending} size="lg" className="rounded-full px-4 text-xs">{isPending ? "保存中..." : "保存积分与VIP设置"}</Button>
              {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
            </div>
          </SettingsSection>
        </form>
      ) : null}
    </div>
  )
}
