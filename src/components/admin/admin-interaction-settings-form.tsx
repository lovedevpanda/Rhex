"use client"

import { CircleHelp } from "lucide-react"
import { useMemo, type ReactNode } from "react"

import {
  AdminBooleanSelectField,
  SettingsInputField as TextField,
} from "@/components/admin/admin-settings-fields"
import { HEAT_COLOR_PRESETS } from "@/components/admin/admin-basic-settings.constants"
import type { AdminInteractionSettingsFormProps } from "@/components/admin/admin-basic-settings.types"
import { AdminTippingGiftListEditor } from "@/components/admin/admin-tipping-gift-list-editor"
import { ColorPicker } from "@/components/ui/color-picker"
import { Tooltip } from "@/components/ui/tooltip"
import { calculatePostHeatScore, resolvePostHeatStyle } from "@/lib/post-heat"

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
        <Tooltip content={helpText} align="start" contentClassName="max-w-64 leading-6" enableMobileTap>
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={`${label} 说明`}
          >
            <CircleHelp className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      </div>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden"
      />
    </div>
  )
}

function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-border bg-secondary/30 p-4 space-y-3">
      <p className="text-sm font-semibold">{title}</p>
      {children}
    </div>
  )
}

export function AdminInteractionSettingsForm({
  activeSubTab,
  draft,
  updateDraftField,
}: AdminInteractionSettingsFormProps) {
  const previewSettings = useMemo(
    () => ({
      heatViewWeight: Number(draft.heatViewWeight) || 0,
      heatCommentWeight: Number(draft.heatCommentWeight) || 0,
      heatLikeWeight: Number(draft.heatLikeWeight) || 0,
      heatTipCountWeight: Number(draft.heatTipCountWeight) || 0,
      heatTipPointsWeight: Number(draft.heatTipPointsWeight) || 0,
      heatStageThresholds: normalizeHeatThresholdsInput(draft.heatStageThresholds),
      heatStageColors: draft.heatStageColors,
    }),
    [
      draft.heatCommentWeight,
      draft.heatLikeWeight,
      draft.heatStageColors,
      draft.heatStageThresholds,
      draft.heatTipCountWeight,
      draft.heatTipPointsWeight,
      draft.heatViewWeight,
    ],
  )

  const previewInput = useMemo(
    () => ({
      views: Number(draft.previewViews) || 0,
      comments: Number(draft.previewComments) || 0,
      likes: Number(draft.previewLikes) || 0,
      tipCount: Number(draft.previewTipCount) || 0,
      tipPoints: Number(draft.previewTipPoints) || 0,
    }),
    [
      draft.previewComments,
      draft.previewLikes,
      draft.previewTipCount,
      draft.previewTipPoints,
      draft.previewViews,
    ],
  )

  const previewScore = useMemo(
    () => calculatePostHeatScore(previewInput, previewSettings),
    [previewInput, previewSettings],
  )
  const previewHeat = useMemo(
    () => resolvePostHeatStyle(previewInput, previewSettings),
    [previewInput, previewSettings],
  )

  function updateHeatColor(index: number, nextColor: string) {
    updateDraftField(
      "heatStageColors",
      draft.heatStageColors.map((item, currentIndex) =>
        currentIndex === index ? nextColor : item,
      ),
    )
  }

  return (
    <>
      {activeSubTab === "comments" ? (
        <div className="rounded-[24px] border border-border p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">评论展示</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">控制评论区可见性、楼中楼默认展开数量，以及帖子详情页的评论分页容量。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminBooleanSelectField label="游客可查看评论" checked={draft.guestCanViewComments} onChange={(value) => updateDraftField("guestCanViewComments", value)} />
            <TextField label="楼中楼默认展开条数" value={draft.commentInitialVisibleReplies} onChange={(value) => updateDraftField("commentInitialVisibleReplies", value)} placeholder="如 10" />
            <TextField label="评论区一页显示数" value={draft.commentPageSize} onChange={(value) => updateDraftField("commentPageSize", value)} placeholder="如 15" />
          </div>
          <p className="text-xs leading-6 text-muted-foreground">楼中楼超过默认展开条数后，前台会显示“展开其余 X 条回复”；评论区一页显示数控制主评论分页容量。</p>
        </div>
      ) : null}

      {activeSubTab === "content-limits" ? (
        <div className="rounded-[24px] border border-border p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">发帖、回复与编辑限制</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">分别控制标题、正文、回复的字数范围，以及帖子和评论的可编辑时长，服务端会按这里的值做校验。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <TextField label="发帖标题最小字数" value={draft.postTitleMinLength} onChange={(value) => updateDraftField("postTitleMinLength", value)} placeholder="默认 5，最小 1" />
            <TextField label="发帖标题最大字数" value={draft.postTitleMaxLength} onChange={(value) => updateDraftField("postTitleMaxLength", value)} placeholder="默认 100，最大 500" />
            <TextField label="发帖正文最小字数" value={draft.postContentMinLength} onChange={(value) => updateDraftField("postContentMinLength", value)} placeholder="默认 10，最小 1" />
            <TextField label="发帖正文最大字数" value={draft.postContentMaxLength} onChange={(value) => updateDraftField("postContentMaxLength", value)} placeholder="默认 50000，最大 100000" />
            <TextField label="回复正文最小字数" value={draft.commentContentMinLength} onChange={(value) => updateDraftField("commentContentMinLength", value)} placeholder="默认 2，最小 1" />
            <TextField label="回复正文最大字数" value={draft.commentContentMaxLength} onChange={(value) => updateDraftField("commentContentMaxLength", value)} placeholder="默认 2000，最大 20000" />
            <TextField label="帖子可编辑分钟数" value={draft.postEditableMinutes} onChange={(value) => updateDraftField("postEditableMinutes", value)} placeholder="如 10" />
            <TextField label="评论可编辑分钟数" value={draft.commentEditableMinutes} onChange={(value) => updateDraftField("commentEditableMinutes", value)} placeholder="如 5" />
          </div>
          <p className="text-xs leading-6 text-muted-foreground">保存时若最大值小于最小值，会自动按最小值兜底；发帖、编辑帖子、回复、编辑回复都会使用这组限制。可编辑分钟数填 `0` 表示发出后不可再编辑。</p>
        </div>
      ) : null}

      {activeSubTab === "anonymous-post" ? (
        <div className="rounded-[24px] border border-border p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">匿名发帖</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">控制匿名发帖开关、扣费、每日次数，以及匿名帖下回复时是否允许切换身份。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminBooleanSelectField label="开启匿名发帖" checked={draft.anonymousPostEnabled} onChange={(value) => updateDraftField("anonymousPostEnabled", value)} />
            <AdminBooleanSelectField label="匿名回复可切换身份" checked={draft.anonymousPostAllowReplySwitch} onChange={(value) => updateDraftField("anonymousPostAllowReplySwitch", value)} />
            <AdminBooleanSelectField label="匿名帖默认匿名回复" checked={draft.anonymousPostDefaultReplyAnonymous} onChange={(value) => updateDraftField("anonymousPostDefaultReplyAnonymous", value)} />
            <TextField label="匿名发帖价格" value={draft.anonymousPostPrice} onChange={(value) => updateDraftField("anonymousPostPrice", value)} placeholder="如 20" />
            <TextField label="每日匿名发帖次数" value={draft.anonymousPostDailyLimit} onChange={(value) => updateDraftField("anonymousPostDailyLimit", value)} placeholder="0 表示不限制" />
            <TextField label="匿名马甲用户 ID" value={draft.anonymousPostMaskUserId} onChange={(value) => updateDraftField("anonymousPostMaskUserId", value)} placeholder="如 10001" />
          </div>
          <p className="text-xs leading-6 text-muted-foreground">匿名发帖当前只用于普通帖和投票帖。启用后会按配置积分扣费，前台展示为指定马甲账号，帖子真实作者仍保留原账号。</p>
        </div>
      ) : null}

      {activeSubTab === "tipping" ? (
        <div className="rounded-[24px] border border-border p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">帖子打赏与送礼</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">控制帖子打赏开关、次数限制、裸积分档位、礼物配置，以及打赏送礼税。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminBooleanSelectField label="开启帖子打赏" checked={draft.tippingEnabled} onChange={(value) => updateDraftField("tippingEnabled", value)} />
            <TextField label="每日可打赏次数" value={draft.tippingDailyLimit} onChange={(value) => updateDraftField("tippingDailyLimit", value)} placeholder="如 3" />
            <TextField label="单帖可打赏次数" value={draft.tippingPerPostLimit} onChange={(value) => updateDraftField("tippingPerPostLimit", value)} placeholder="如 1" />
            <AdminBooleanSelectField label="开启打赏送礼税" checked={draft.tipGiftTaxEnabled} onChange={(value) => updateDraftField("tipGiftTaxEnabled", value)} />
            <InfoTextField
              label="打赏送礼税率 BPS"
              value={draft.tipGiftTaxRateBps}
              onChange={(value) => updateDraftField("tipGiftTaxRateBps", value)}
              placeholder="0..10000，如 500"
              helpText="填写 0..10000 的整数。10000 = 100%，500 = 5%，100 = 1%。税额按收款特效后的实际到账 gross 计算，公式是 floor(gross * bps / 10000)。填 0 或关闭税开关都表示不征税。"
            />
          </div>
          <p className="text-xs leading-6 text-muted-foreground">打赏送礼税在收款特效结算后按 BPS 向下取整，只对正整数净收款生效；税额会进入帖子所属节点金库。礼物名称、图标和价格都可在后台维护。</p>
          <TextField label="裸积分打赏档位" value={draft.tippingAmounts} onChange={(value) => updateDraftField("tippingAmounts", value)} placeholder="如 10,30,50,100" />
          <AdminTippingGiftListEditor items={draft.tippingGifts} onChange={(value) => updateDraftField("tippingGifts", value)} />
        </div>
      ) : null}

      {activeSubTab === "gates" ? (
        <div className="rounded-[24px] border border-border p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">发布门槛</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">按发帖和回复分别控制邮箱验证与注册时长门槛。后续新的互动验证规则也会继续挂在这一层扩展，不需要再改主设置表。</p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <FieldGroup title="发帖">
              <AdminBooleanSelectField label="发帖需已验证邮箱" checked={draft.postCreateRequireEmailVerified} onChange={(value) => updateDraftField("postCreateRequireEmailVerified", value)} />
              <TextField label="注册满多少分钟才能发帖" value={draft.postCreateMinRegisteredMinutes} onChange={(value) => updateDraftField("postCreateMinRegisteredMinutes", value)} placeholder="填 0 表示不限制" />
            </FieldGroup>
            <FieldGroup title="回复">
              <AdminBooleanSelectField label="回复需已验证邮箱" checked={draft.commentCreateRequireEmailVerified} onChange={(value) => updateDraftField("commentCreateRequireEmailVerified", value)} />
              <TextField label="注册满多少分钟才能回复" value={draft.commentCreateMinRegisteredMinutes} onChange={(value) => updateDraftField("commentCreateMinRegisteredMinutes", value)} placeholder="填 0 表示不限制" />
            </FieldGroup>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">邮箱门槛只校验账号的 `emailVerifiedAt`；分钟门槛按注册时间到当前时间计算，`0` 表示关闭该限制。</p>
        </div>
      ) : null}

      {activeSubTab === "reward-pool" ? (
        <div className="rounded-[24px] border border-border p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">帖子红包与聚宝盆</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">红包用于一次性预存发放；聚宝盆用于回复后给积分池注入积分，并按概率抽中奖励。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <AdminBooleanSelectField label="开启帖子红包" checked={draft.postRedPacketEnabled} onChange={(value) => updateDraftField("postRedPacketEnabled", value)} />
            <TextField label="单个红包最大积分" value={draft.postRedPacketMaxPoints} onChange={(value) => updateDraftField("postRedPacketMaxPoints", value)} placeholder="如 100" />
            <TextField label="每日发红包积分上限" value={draft.postRedPacketDailyLimit} onChange={(value) => updateDraftField("postRedPacketDailyLimit", value)} placeholder="如 300" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <TextField label="红包随机命中概率（%）" value={draft.postRedPacketRandomClaimProbability} onChange={(value) => updateDraftField("postRedPacketRandomClaimProbability", value)} placeholder="填 0 按候选人数均分，如 25" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminBooleanSelectField label="开启聚宝盆" checked={draft.postJackpotEnabled} onChange={(value) => updateDraftField("postJackpotEnabled", value)} />
            <TextField label="聚宝盆最低初始积分" value={draft.postJackpotMinInitialPoints} onChange={(value) => updateDraftField("postJackpotMinInitialPoints", value)} placeholder="如 100" />
            <TextField label="聚宝盆最高初始积分" value={draft.postJackpotMaxInitialPoints} onChange={(value) => updateDraftField("postJackpotMaxInitialPoints", value)} placeholder="如 1000" />
            <TextField label="每次回复递增积分" value={draft.postJackpotReplyIncrementPoints} onChange={(value) => updateDraftField("postJackpotReplyIncrementPoints", value)} placeholder="如 25" />
            <TextField label="聚宝盆回复中奖概率（%）" value={draft.postJackpotHitProbability} onChange={(value) => updateDraftField("postJackpotHitProbability", value)} placeholder="如 15" />
          </div>
          <p className="text-xs leading-6 text-muted-foreground">红包随机命中概率仅在“随机名额”模式下生效：填 `0` 时沿用当前候选人数均分概率；填大于 `0` 的值时，按“当前触发用户单次命中率”处理，未命中则本次无人领取。聚宝盆仅支持“回复帖子”触发，用户发帖时填写的初始积分必须落在允许范围内；每次有效回复后，系统先向积分池增加设定积分，再按概率抽奖。</p>
        </div>
      ) : null}

      {activeSubTab === "heat" ? (
        <div className="rounded-[24px] border border-border p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">帖子热度颜色算法</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">统一配置热度分数计算权重、首页热门近活跃窗口与颜色阶段。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <TextField label="首页热门近活跃窗口（小时）" value={draft.homeHotRecentWindowHours} onChange={(value) => updateDraftField("homeHotRecentWindowHours", value)} placeholder="如 72" />
          </div>
          <p className="text-xs leading-6 text-muted-foreground">首页“热门”会优先显示近 N 小时内有活动的帖子，再按历史热度补位。建议保持在 `24-168` 小时之间；填写 `72` 即当前默认策略。</p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <TextField label="浏览权重" value={draft.heatViewWeight} onChange={(value) => updateDraftField("heatViewWeight", value)} placeholder="如 1" />
            <TextField label="回复权重" value={draft.heatCommentWeight} onChange={(value) => updateDraftField("heatCommentWeight", value)} placeholder="如 8" />
            <TextField label="点赞权重" value={draft.heatLikeWeight} onChange={(value) => updateDraftField("heatLikeWeight", value)} placeholder="如 6" />
            <TextField label="打赏次数权重" value={draft.heatTipCountWeight} onChange={(value) => updateDraftField("heatTipCountWeight", value)} placeholder="如 10" />
            <TextField label="打赏积分权重" value={draft.heatTipPointsWeight} onChange={(value) => updateDraftField("heatTipPointsWeight", value)} placeholder="如 1" />
          </div>
          <TextField label="9 段热度阈值" value={draft.heatStageThresholds} onChange={(value) => updateDraftField("heatStageThresholds", value)} placeholder="如 0,80,180,320,520,780,1100,1500,2000" />
          <div className="space-y-2">
            <p className="text-sm font-medium">9 段颜色色板</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {draft.heatStageColors.map((color, index) => (
                <div key={`heat-color-${index}`} className="rounded-[20px] border border-border bg-secondary/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-foreground">第 {index + 1} 档颜色</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">阈值 ≥ {previewSettings.heatStageThresholds[index] ?? 0}</p>
                    </div>
                    <ColorPicker
                      value={color}
                      onChange={(value) => updateHeatColor(index, value)}
                      hideLabel
                      presets={HEAT_COLOR_PRESETS}
                      fallbackColor="#4A4A4A"
                      placeholder="#4A4A4A"
                      popoverTitle={`选择第 ${index + 1} 档颜色`}
                      containerClassName="w-[148px]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {activeSubTab === "preview" ? (
        <div className="rounded-[24px] border border-border p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">热度预览面板</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">调整参数后，实时预览热度分数与颜色表现。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <TextField label="浏览数" value={draft.previewViews} onChange={(value) => updateDraftField("previewViews", value)} placeholder="如 120" />
            <TextField label="回复数" value={draft.previewComments} onChange={(value) => updateDraftField("previewComments", value)} placeholder="如 18" />
            <TextField label="点赞数" value={draft.previewLikes} onChange={(value) => updateDraftField("previewLikes", value)} placeholder="如 12" />
            <TextField label="打赏次数" value={draft.previewTipCount} onChange={(value) => updateDraftField("previewTipCount", value)} placeholder="如 4" />
            <TextField label="打赏积分" value={draft.previewTipPoints} onChange={(value) => updateDraftField("previewTipPoints", value)} placeholder="如 160" />
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
      ) : null}
    </>
  )
}
