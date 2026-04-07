"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"

import { AdminBooleanSelectField } from "@/components/admin-boolean-select-field"
import { AdminIconPickerField } from "@/components/admin-icon-picker-field"
import { AdminPillTabs } from "@/components/admin-pill-tabs"
import { AdminRedeemCodeManager } from "@/components/admin-redeem-code-manager"
import { Button } from "@/components/ui/button"
import { TextField } from "@/components/ui/text-field"
import { saveAdminSiteSettings } from "@/lib/admin-site-settings-client"

interface AdminVipSettingsFormProps {
  initialSettings: {
    pointName: string
    checkInEnabled: boolean
    checkInReward: number
    checkInVip1Reward: number
    checkInVip2Reward: number
    checkInVip3Reward: number
    checkInMakeUpCardPrice: number
    checkInVip1MakeUpCardPrice: number
    checkInVip2MakeUpCardPrice: number
    checkInVip3MakeUpCardPrice: number
    checkInMakeUpCountsTowardStreak: boolean
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
    postOfflinePrice: number
    postOfflineVip1Price: number
    postOfflineVip2Price: number
    postOfflineVip3Price: number
  }
  initialSubTab?: string
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

export function AdminVipSettingsForm({ initialSettings, initialSubTab, initialRedeemCodes = [] }: AdminVipSettingsFormProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState(() => resolveVipTab(initialSubTab))
  const [pointName, setPointName] = useState(initialSettings.pointName)
  const [checkInEnabled, setCheckInEnabled] = useState(initialSettings.checkInEnabled)
  const [checkInReward, setCheckInReward] = useState(String(initialSettings.checkInReward))
  const [checkInVip1Reward, setCheckInVip1Reward] = useState(String(initialSettings.checkInVip1Reward))
  const [checkInVip2Reward, setCheckInVip2Reward] = useState(String(initialSettings.checkInVip2Reward))
  const [checkInVip3Reward, setCheckInVip3Reward] = useState(String(initialSettings.checkInVip3Reward))
  const [checkInMakeUpCardPrice, setCheckInMakeUpCardPrice] = useState(String(initialSettings.checkInMakeUpCardPrice))
  const [checkInVip1MakeUpCardPrice, setCheckInVip1MakeUpCardPrice] = useState(String(initialSettings.checkInVip1MakeUpCardPrice))
  const [checkInVip2MakeUpCardPrice, setCheckInVip2MakeUpCardPrice] = useState(String(initialSettings.checkInVip2MakeUpCardPrice))
  const [checkInVip3MakeUpCardPrice, setCheckInVip3MakeUpCardPrice] = useState(String(initialSettings.checkInVip3MakeUpCardPrice))
  const [checkInMakeUpCountsTowardStreak, setCheckInMakeUpCountsTowardStreak] = useState(initialSettings.checkInMakeUpCountsTowardStreak)
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
      <div className="rounded-[22px] border border-border bg-card p-3">
        <AdminPillTabs
          items={VIP_TABS.map((item) => ({
            key: item.key,
            label: item.label,
            onSelect: () => setActiveTab(item.key),
          }))}
          activeKey={activeTab}
        />
      </div>

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
                checkInEnabled,
                checkInReward: Number(checkInReward),
                checkInVip1Reward: Number(checkInVip1Reward),
                checkInVip2Reward: Number(checkInVip2Reward),
                checkInVip3Reward: Number(checkInVip3Reward),
                checkInMakeUpCardPrice: Number(checkInMakeUpCardPrice),
                checkInVipMakeUpCardPrice: Number(checkInVip1MakeUpCardPrice),
                checkInVip1MakeUpCardPrice: Number(checkInVip1MakeUpCardPrice),
                checkInVip2MakeUpCardPrice: Number(checkInVip2MakeUpCardPrice),
                checkInVip3MakeUpCardPrice: Number(checkInVip3MakeUpCardPrice),
                checkInMakeUpCountsTowardStreak,
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


          <div className="rounded-[22px] border border-border bg-card p-4 space-y-5">
            <div>
              <h3 className="text-sm font-semibold">积分基础配置</h3>
              <p className="mt-1 text-xs text-muted-foreground">统一配置积分名称、签到奖励、补签价格与修改昵称扣费规则。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TextField label="积分名称" value={pointName} onChange={setPointName} placeholder="如 积分 / 金币 / 钻石" />
              <AdminBooleanSelectField label="签到开关" checked={checkInEnabled} onChange={setCheckInEnabled} />
              <AdminBooleanSelectField label="补签计入连续签到" checked={checkInMakeUpCountsTowardStreak} onChange={setCheckInMakeUpCountsTowardStreak} />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TextField label="普通用户改昵称积分" value={nicknameChangePointCost} onChange={setNicknameChangePointCost} placeholder="0 表示免费" />
              <TextField label="VIP1 改昵称积分" value={nicknameChangeVip1PointCost} onChange={setNicknameChangeVip1PointCost} placeholder="0 表示免费" />
              <TextField label="VIP2 改昵称积分" value={nicknameChangeVip2PointCost} onChange={setNicknameChangeVip2PointCost} placeholder="0 表示免费" />
              <TextField label="VIP3 改昵称积分" value={nicknameChangeVip3PointCost} onChange={setNicknameChangeVip3PointCost} placeholder="0 表示免费" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TextField label="普通用户改介绍积分" value={introductionChangePointCost} onChange={setIntroductionChangePointCost} placeholder="0 表示免费" />
              <TextField label="VIP1 改介绍积分" value={introductionChangeVip1PointCost} onChange={setIntroductionChangeVip1PointCost} placeholder="0 表示免费" />
              <TextField label="VIP2 改介绍积分" value={introductionChangeVip2PointCost} onChange={setIntroductionChangeVip2PointCost} placeholder="0 表示免费" />
              <TextField label="VIP3 改介绍积分" value={introductionChangeVip3PointCost} onChange={setIntroductionChangeVip3PointCost} placeholder="0 表示免费" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TextField label="普通用户改头像积分" value={avatarChangePointCost} onChange={setAvatarChangePointCost} placeholder="0 表示免费" />
              <TextField label="VIP1 改头像积分" value={avatarChangeVip1PointCost} onChange={setAvatarChangeVip1PointCost} placeholder="0 表示免费" />
              <TextField label="VIP2 改头像积分" value={avatarChangeVip2PointCost} onChange={setAvatarChangeVip2PointCost} placeholder="0 表示免费" />
              <TextField label="VIP3 改头像积分" value={avatarChangeVip3PointCost} onChange={setAvatarChangeVip3PointCost} placeholder="0 表示免费" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TextField label="普通用户签到奖励" value={checkInReward} onChange={setCheckInReward} placeholder="如 5" />
              <TextField label="VIP1 签到奖励" value={checkInVip1Reward} onChange={setCheckInVip1Reward} placeholder="如 8" />
              <TextField label="VIP2 签到奖励" value={checkInVip2Reward} onChange={setCheckInVip2Reward} placeholder="如 10" />
              <TextField label="VIP3 签到奖励" value={checkInVip3Reward} onChange={setCheckInVip3Reward} placeholder="如 12" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TextField label="普通用户补签价格" value={checkInMakeUpCardPrice} onChange={setCheckInMakeUpCardPrice} placeholder="如 20" />
              <TextField label="VIP1 补签价格" value={checkInVip1MakeUpCardPrice} onChange={setCheckInVip1MakeUpCardPrice} placeholder="如 10" />
              <TextField label="VIP2 补签价格" value={checkInVip2MakeUpCardPrice} onChange={setCheckInVip2MakeUpCardPrice} placeholder="如 8" />
              <TextField label="VIP3 补签价格" value={checkInVip3MakeUpCardPrice} onChange={setCheckInVip3MakeUpCardPrice} placeholder="如 5" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TextField label="普通用户邀请码价格" value={inviteCodePrice} onChange={setInviteCodePrice} placeholder="如 100" />
              <TextField label="VIP1 邀请码价格" value={inviteCodeVip1Price} onChange={setInviteCodeVip1Price} placeholder="如 80" />
              <TextField label="VIP2 邀请码价格" value={inviteCodeVip2Price} onChange={setInviteCodeVip2Price} placeholder="如 60" />
              <TextField label="VIP3 邀请码价格" value={inviteCodeVip3Price} onChange={setInviteCodeVip3Price} placeholder="如 50" />
            </div>
          </div>

          <div className="rounded-[22px] border border-border bg-card p-4 space-y-5">
            <div>
              <h3 className="text-sm font-semibold">VIP 套餐配置</h3>
              <p className="mt-1 text-xs text-muted-foreground">统一配置前台可售 VIP 套餐对应的积分价格与头像角标图标。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <TextField label="月卡积分价格（VIP1）" value={vipMonthlyPrice} onChange={setVipMonthlyPrice} placeholder="如 3000" />
              <TextField label="季卡积分价格（VIP2）" value={vipQuarterlyPrice} onChange={setVipQuarterlyPrice} placeholder="如 8000" />
              <TextField label="年卡积分价格（VIP3）" value={vipYearlyPrice} onChange={setVipYearlyPrice} placeholder="如 30000" />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <AdminIconPickerField label="VIP1 头像角标" value={vipLevelIconVip1} onChange={setVipLevelIconVip1} previewColor="#7c3aed" popoverTitle="选择 VIP1 头像角标" description="支持 emoji、符号或完整 SVG，前台会显示在用户头像右下角。" />
              <AdminIconPickerField label="VIP2 头像角标" value={vipLevelIconVip2} onChange={setVipLevelIconVip2} previewColor="#e11d48" popoverTitle="选择 VIP2 头像角标" description="支持 emoji、符号或完整 SVG，前台会显示在用户头像右下角。" />
              <AdminIconPickerField label="VIP3 头像角标" value={vipLevelIconVip3} onChange={setVipLevelIconVip3} previewColor="#d97706" popoverTitle="选择 VIP3 头像角标" description="支持 emoji、符号或完整 SVG，前台会显示在用户头像右下角。" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">作者下线帖子价格</h3>
              <p className="mt-1 text-xs text-muted-foreground">0 表示免费；普通用户与 VIP1 / VIP2 / VIP3 按当前身份分别扣除积分。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TextField label="普通用户积分价格" value={postOfflinePrice} onChange={setPostOfflinePrice} placeholder="如 50" />
              <TextField label="VIP1 积分价格" value={postOfflineVip1Price} onChange={setPostOfflineVip1Price} placeholder="如 30" />
              <TextField label="VIP2 积分价格" value={postOfflineVip2Price} onChange={setPostOfflineVip2Price} placeholder="如 20" />
              <TextField label="VIP3 积分价格" value={postOfflineVip3Price} onChange={setPostOfflineVip3Price} placeholder="如 0" />
            </div>
            <div className="flex items-center gap-3">
              <Button disabled={isPending} className="h-10 rounded-full px-4 text-xs">{isPending ? "保存中..." : "保存积分与VIP设置"}</Button>
              {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
            </div>
          </div>
        </form>
      ) : null}
    </div>
  )
}


