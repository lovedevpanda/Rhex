import Image from "next/image"
import type { ChangeEvent, ReactNode } from "react"
import { ImageIcon, Info, Loader2, MessageSquareLock, Sparkles, Upload } from "lucide-react"

import { AdminModal } from "@/components/admin-modal"
import { LotteryConditionValueField } from "@/components/lottery-condition-value-field"
import { PointsBudgetSliderField } from "@/components/points-budget-slider-field"
import { Button } from "@/components/ui/button"
import type { AccessThresholdOption } from "@/lib/access-threshold-options"
import { MAX_MANUAL_TAGS } from "@/lib/post-tags"
import { getPostRewardPoolModeLabel } from "@/lib/post-reward-pool-config"
import { parsePositiveSafeInteger } from "@/lib/shared/safe-integer"

import {
  LOTTERY_CONDITION_CATEGORY_ORDER,
  LOTTERY_CONDITION_OPERATOR_OPTIONS,
  getLotteryConditionCategoryLabel,
  getLotteryConditionMeta,
  getLotteryConditionTypeOptions,
  lotteryConditionAllowsOperator,
  lotteryConditionRequiresValue,
  normalizeLotteryConditionGroupKey,
  type LotteryConditionDraft,
  type LotteryPrizeDraft,
} from "@/components/create-post-form.shared"

function HoverTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground">
        <Info className="h-3.5 w-3.5" />
      </span>
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-20 w-56 -translate-x-1/2 rounded-2xl border border-border bg-background px-3 py-2 text-xs leading-5 text-foreground opacity-0 shadow-2xl transition-opacity group-hover:opacity-100">
        {text}
      </span>
    </span>
  )
}

function HiddenConfigChip({
  icon,
  title,
  active,
  summary,
  onClick,
  onClear,
}: {
  icon: ReactNode
  title: string
  active: boolean
  summary: string
  onClick: () => void
  onClear?: () => void
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
      <button type="button" onClick={onClick} className="inline-flex items-center gap-2 text-sm transition-opacity hover:opacity-80">
        <span className="text-foreground/80">{icon}</span>
        <span>{title}</span>
        <span className={active ? "rounded-full bg-foreground px-2 py-0.5 text-[11px] text-background" : "rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"}>
          {summary}
        </span>
      </button>
      {active && onClear ? <Button type="button" variant="ghost" className="h-7 rounded-full px-2 text-xs" onClick={onClear}>清空</Button> : null}
    </div>
  )
}

export function BountySettingsSection({
  pointName,
  bountyPoints,
  onBountyPointsChange,
  disabled,
}: {
  pointName: string
  bountyPoints: string
  onBountyPointsChange: (value: string) => void
  disabled: boolean
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">悬赏{pointName}</p>
      <input
        value={bountyPoints}
        onChange={(event) => onBountyPointsChange(event.target.value)}
        className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none"
        placeholder={`输入要奖励给最佳答案的${pointName}`}
        disabled={disabled}
      />
      <p className="text-xs leading-6 text-muted-foreground">发帖时会先冻结这部分{pointName}，等你采纳回复后再发放给答案作者。</p>
    </div>
  )
}

export function PollSettingsSection({
  pollOptions,
  normalizedPollOptionsCount,
  pollExpiresAt,
  onPollOptionChange,
  onPollExpiresAtChange,
  onAddPollOption,
  onRemovePollOption,
  disabled,
}: {
  pollOptions: string[]
  normalizedPollOptionsCount: number
  pollExpiresAt: string
  onPollOptionChange: (index: number, value: string) => void
  onPollExpiresAtChange: (value: string) => void
  onAddPollOption: () => void
  onRemovePollOption: (index: number) => void
  disabled: boolean
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">投票选项</p>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">至少填写 2 个选项，最多 8 个。</p>
      </div>
      <div className="space-y-3">
        {pollOptions.map((option, index) => (
          <div key={`${index}-${option}`} className="flex items-center gap-3">
            <input
              value={option}
              onChange={(event) => onPollOptionChange(index, event.target.value)}
              className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none"
              placeholder={`选项 ${index + 1}`}
              disabled={disabled}
            />
            <Button type="button" variant="ghost" onClick={() => onRemovePollOption(index)} disabled={pollOptions.length <= 2 || disabled}>
              删除
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">当前有效选项：{normalizedPollOptionsCount} 项</p>
        <Button type="button" variant="outline" onClick={onAddPollOption} disabled={pollOptions.length >= 8 || disabled}>
          增加选项
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">投票结束时间</p>
        <input
          type="datetime-local"
          value={pollExpiresAt}
          onChange={(event) => onPollExpiresAtChange(event.target.value)}
          className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none"
          disabled={disabled}
        />
        <p className="text-xs leading-6 text-muted-foreground">留空表示长期开放投票；设置后到达截止时间将不再允许新增投票。</p>
      </div>
    </div>
  )
}

function groupLotteryConditions(lotteryConditions: LotteryConditionDraft[]) {
  const groups = new Map<string, Array<{ index: number; condition: LotteryConditionDraft }>>()

  lotteryConditions.forEach((condition, index) => {
    const groupKey = normalizeLotteryConditionGroupKey(condition.groupKey)
    const groupItems = groups.get(groupKey) ?? []
    groupItems.push({ index, condition: { ...condition, groupKey } })
    groups.set(groupKey, groupItems)
  })

  return Array.from(groups.entries()).map(([groupKey, items]) => ({ groupKey, items }))
}

export function LotterySettingsSection({
  pointName,
  lotteryStartsAt,
  lotteryEndsAt,
  lotteryParticipantGoal,
  lotteryPrizes,
  lotteryConditions,
  userLevelOptions,
  vipLevelOptions,
  onLotteryStartsAtChange,
  onLotteryEndsAtChange,
  onLotteryParticipantGoalChange,
  onLotteryPrizeChange,
  onAddLotteryPrize,
  onRemoveLotteryPrize,
  onLotteryConditionChange,
  onAddLotteryConditionGroup,
  onAddLotteryCondition,
  onRemoveLotteryCondition,
  onRemoveLotteryConditionGroup,
  disabled,
}: {
  pointName: string
  lotteryStartsAt: string
  lotteryEndsAt: string
  lotteryParticipantGoal: string
  lotteryPrizes: LotteryPrizeDraft[]
  lotteryConditions: LotteryConditionDraft[]
  userLevelOptions: AccessThresholdOption[]
  vipLevelOptions: AccessThresholdOption[]
  onLotteryStartsAtChange: (value: string) => void
  onLotteryEndsAtChange: (value: string) => void
  onLotteryParticipantGoalChange: (value: string) => void
  onLotteryPrizeChange: (index: number, field: keyof LotteryPrizeDraft, value: string) => void
  onAddLotteryPrize: () => void
  onRemoveLotteryPrize: (index: number) => void
  onLotteryConditionChange: (index: number, field: keyof LotteryConditionDraft, value: string) => void
  onAddLotteryConditionGroup: () => void
  onAddLotteryCondition: (type?: string, groupKey?: string) => void
  onRemoveLotteryCondition: (index: number) => void
  onRemoveLotteryConditionGroup: (groupKey: string) => void
  disabled: boolean
}) {
  const groupedLotteryConditions = groupLotteryConditions(lotteryConditions)
  const lotteryConditionTypeOptions = getLotteryConditionTypeOptions(pointName)
  const canAddLotteryCondition = !disabled && lotteryConditions.length < 20
  const canRemoveLotteryCondition = !disabled && lotteryConditions.length > 1
  const canRemoveLotteryConditionGroup = !disabled && groupedLotteryConditions.length > 1

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">抽奖设置</p>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">支持多个奖项、多个参与方案（方案内全部满足即可，满足任一方案即可参与）、手动开奖与人数达标自动开奖。</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-2">
          <p className="text-sm font-medium">开始时间</p>
          <input type="datetime-local" value={lotteryStartsAt} onChange={(event) => onLotteryStartsAtChange(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" disabled={disabled} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">结束时间</p>
          <input type="datetime-local" value={lotteryEndsAt} onChange={(event) => onLotteryEndsAtChange(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" disabled={disabled} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">目标参与人数</p>
          <input value={lotteryParticipantGoal} onChange={(event) => onLotteryParticipantGoalChange(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" placeholder="留空表示不限制" disabled={disabled} />
        </div>
      </div>

      <div className="space-y-3 rounded-[20px]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">奖项配置</p>
            <p className="mt-1 text-xs text-muted-foreground">至少保留 1 个奖项，可继续新增。</p>
          </div>
          <Button type="button" variant="outline" onClick={onAddLotteryPrize} disabled={disabled || lotteryPrizes.length >= 20}>新增奖项</Button>
        </div>
        <div className="space-y-3">
          {lotteryPrizes.map((prize, index) => (
            <div key={`lottery-prize-${index}`} className="space-y-3 rounded-[18px] border border-border bg-card p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                <input value={prize.title} onChange={(event) => onLotteryPrizeChange(index, "title", event.target.value)} className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none" placeholder="奖项名称，如 一等奖" disabled={disabled} />
                <input value={prize.quantity} onChange={(event) => onLotteryPrizeChange(index, "quantity", event.target.value)} className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none" placeholder="数量" disabled={disabled} />
                <Button type="button" variant="ghost" onClick={() => onRemoveLotteryPrize(index)} disabled={disabled || lotteryPrizes.length <= 1}>删除</Button>
              </div>
              <input value={prize.description} onChange={(event) => onLotteryPrizeChange(index, "description", event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" placeholder="奖品描述，如 周边、积分、兑换码" disabled={disabled} />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-[20px] ">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">参与条件</p>
            <p className="mt-1 text-xs text-muted-foreground">把条件拆成多个参与方案。用户满足任一方案即可参与，方案内条件需全部满足。</p>
          </div>
          <Button type="button" variant="outline" onClick={onAddLotteryConditionGroup} disabled={!canAddLotteryCondition}>新增参与方案</Button>
        </div>
        <div className="space-y-4">
          {groupedLotteryConditions.map((group, groupIndex) => (
            <div key={group.groupKey} className="space-y-3 rounded-[18px] border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">参与方案 {groupIndex + 1}</p>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">需同时满足 {group.items.length} 项条件</span>
                  </div>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">适合把不同参与路径拆开，例如“老用户方案”和“VIP 方案”。</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => onAddLotteryCondition(undefined, group.groupKey)} disabled={!canAddLotteryCondition}>添加条件</Button>
                  <Button type="button" variant="ghost" onClick={() => onRemoveLotteryConditionGroup(group.groupKey)} disabled={!canRemoveLotteryConditionGroup}>删除方案</Button>
                </div>
              </div>

              <div className="space-y-3">
                {group.items.map(({ condition, index }) => {
                  const conditionMeta = getLotteryConditionMeta(condition.type, pointName)
                  const showValueField = lotteryConditionRequiresValue(condition.type)
                  const showOperatorField = lotteryConditionAllowsOperator(condition.type)

                  return (
                    <div key={`lottery-condition-${group.groupKey}-${index}`} className="space-y-3 rounded-[18px] border border-border bg-background p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">{getLotteryConditionCategoryLabel(conditionMeta.category)}</span>
                            <span className="text-xs text-muted-foreground">{conditionMeta.helperText}</span>
                          </div>
                        </div>
                        <Button type="button" variant="ghost" onClick={() => onRemoveLotteryCondition(index)} disabled={!canRemoveLotteryCondition}>删除条件</Button>
                      </div>

                      <div className={showValueField ? "grid gap-3 xl:grid-cols-[220px_160px_minmax(0,1fr)]" : "grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)]"}>
                        <select value={condition.type} onChange={(event) => onLotteryConditionChange(index, "type", event.target.value)} className="h-11 rounded-full border border-border bg-card px-4 text-sm outline-none" disabled={disabled}>
                          {LOTTERY_CONDITION_CATEGORY_ORDER.map((category) => {
                            const categoryOptions = lotteryConditionTypeOptions.filter((option) => option.category === category)
                            if (categoryOptions.length === 0) {
                              return null
                            }

                            return (
                              <optgroup key={category} label={getLotteryConditionCategoryLabel(category)}>
                                {categoryOptions.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </optgroup>
                            )
                          })}
                        </select>

                        {showOperatorField ? (
                          <select value={condition.operator} onChange={(event) => onLotteryConditionChange(index, "operator", event.target.value)} className="h-11 rounded-full border border-border bg-card px-4 text-sm outline-none" disabled={disabled}>
                            {LOTTERY_CONDITION_OPERATOR_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        ) : null}

                        {showValueField ? (
                          <LotteryConditionValueField
                            conditionType={condition.type}
                            value={condition.value}
                            pointName={pointName}
                            userLevelOptions={userLevelOptions}
                            vipLevelOptions={vipLevelOptions}
                            onChange={(value) => onLotteryConditionChange(index, "value", value)}
                            disabled={disabled}
                          />
                        ) : (
                          <div className="flex h-11 items-center rounded-full border border-dashed border-border bg-card px-4 text-sm text-muted-foreground">
                            完成当前互动后即可满足该条件
                          </div>
                        )}
                      </div>

                      <input
                        value={condition.description}
                        onChange={(event) => onLotteryConditionChange(index, "description", event.target.value)}
                        className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none"
                        placeholder="展示文案（可选，不填则按条件自动生成）"
                        disabled={disabled}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface PostEnhancementsSectionProps {
  pointName: string
  rewardPoolEnabled: boolean
  settings: {
    finalTags: string[]
    autoExtractedTags: string[]
    coverUploading: boolean
    coverPath: string
    commentsVisibleToAuthorOnly: boolean
    loginUnlockContent: string
    replyUnlockContent: string
    purchaseUnlockContent: string
    purchasePrice: string
    minViewLevel: string
    minViewVipLevel: string
    redPacketEnabled: boolean
    redPacketMode: "RED_PACKET" | "JACKPOT"
    redPacketGrantMode: "FIXED" | "RANDOM"
    redPacketTriggerType: "REPLY" | "LIKE" | "FAVORITE"
    jackpotInitialPoints: string
    fixedRedPacketTotalPoints: number | null
    postJackpotMinInitialPoints: number
    postJackpotReplyIncrementPoints: number
    postJackpotHitProbability: number
  }
  actions: {
    onOpenTagModal: () => void
    onOpenCoverModal: () => void
    onRemoveManualTag: (tag: string) => void
    onCoverClear: () => void
    onCommentsVisibleToAuthorOnlyChange: (checked: boolean) => void
    onOpenLoginModal: () => void
    onClearLoginUnlock: () => void
    onOpenReplyModal: () => void
    onClearReplyUnlock: () => void
    onOpenPurchaseModal: () => void
    onClearPurchaseUnlock: () => void
    onOpenViewLevelModal: () => void
    onClearViewLevel: () => void
    onOpenRewardPoolModal: () => void
    onClearRewardPool: () => void
    onRedPacketEnabledChange: (checked: boolean) => void
    onRedPacketModeChange: (mode: "RED_PACKET" | "JACKPOT") => void
    onRedPacketGrantModeChange: (mode: "FIXED" | "RANDOM") => void
    onRedPacketClaimOrderModeChange: (mode: "FIRST_COME_FIRST_SERVED" | "RANDOM") => void
    onRedPacketTriggerTypeChange: (type: "REPLY" | "LIKE" | "FAVORITE") => void
    onJackpotInitialPointsChange: (value: string) => void
    onRedPacketValueChange: (value: string) => void
    onRedPacketPacketCountChange: (value: string) => void
  }
}

export function PostEnhancementsSection({ pointName, rewardPoolEnabled, settings, actions }: PostEnhancementsSectionProps) {
  const {
    finalTags,
    autoExtractedTags,
    coverUploading,
    coverPath,
    commentsVisibleToAuthorOnly,
    loginUnlockContent,
    replyUnlockContent,
    purchaseUnlockContent,
    purchasePrice,
    minViewLevel,
    minViewVipLevel,
    redPacketEnabled,
    redPacketMode,
    redPacketGrantMode,
    redPacketTriggerType,
    jackpotInitialPoints,
    fixedRedPacketTotalPoints,
    postJackpotMinInitialPoints,
    postJackpotReplyIncrementPoints,
    postJackpotHitProbability,
  } = settings

  return (
    <div className="rounded-[24px] border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className={finalTags.length > 0 ? "h-9 border-foreground px-4 text-sm" : "h-9 px-4 text-sm"} onClick={actions.onOpenTagModal}>
          <Sparkles className="mr-2 h-4 w-4" />
          标签提取
          <span className={finalTags.length > 0 ? "ml-2 rounded-full bg-foreground px-2 py-0.5 text-[11px] text-background" : "ml-2 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"}>{finalTags.length > 0 ? finalTags.length : autoExtractedTags.length}</span>
        </Button>

        {rewardPoolEnabled ? (
          <HiddenConfigChip
            icon={<Sparkles className="h-4 w-4" />}
            title="帖子激励池"
            active={redPacketEnabled}
            summary={redPacketEnabled
              ? redPacketMode === "JACKPOT"
                ? `${getPostRewardPoolModeLabel(redPacketMode)} / 初始 ${jackpotInitialPoints || postJackpotMinInitialPoints}`
                : `${getPostRewardPoolModeLabel(redPacketMode)} / ${redPacketTriggerType === "REPLY" ? "回复" : redPacketTriggerType === "LIKE" ? "点赞" : "收藏"}`
              : "未配置"}
            onClick={actions.onOpenRewardPoolModal}
            onClear={actions.onClearRewardPool}
          />
        ) : null}



        <HiddenConfigChip
          icon={coverUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          title="封面图"
          active={Boolean(coverPath.trim())}
          summary={coverUploading ? "上传中..." : coverPath.trim() ? "已设置" : "自动提取"}
          onClick={actions.onOpenCoverModal}
          onClear={actions.onCoverClear}
        />

        <label className={commentsVisibleToAuthorOnly ? "inline-flex items-center gap-2 rounded-full border border-foreground bg-accent px-3 py-2 text-sm" : "inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm text-muted-foreground"}>
          <input
            type="checkbox"
            checked={commentsVisibleToAuthorOnly}
            onChange={(event) => actions.onCommentsVisibleToAuthorOnlyChange(event.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <span>评论仅楼主可见</span>
          <HoverTip text="开启后，其他用户发表的评论仅帖子作者和管理员可见。" />
        </label>

        <HiddenConfigChip
          icon={<MessageSquareLock className="h-4 w-4" />}
          title="登录后可看"
          active={Boolean(loginUnlockContent.trim())}
          summary={loginUnlockContent.trim() ? "已配置" : "未配置"}
          onClick={actions.onOpenLoginModal}
          onClear={actions.onClearLoginUnlock}
        />

        <HiddenConfigChip
          icon={<MessageSquareLock className="h-4 w-4" />}
          title="回复后可看"
          active={Boolean(replyUnlockContent.trim())}
          summary={replyUnlockContent.trim() ? "已配置" : "未配置"}
          onClick={actions.onOpenReplyModal}
          onClear={actions.onClearReplyUnlock}
        />

        <HiddenConfigChip
          icon={<Info className="h-4 w-4" />}
          title="购买后可看"
          active={Boolean(purchaseUnlockContent.trim())}
          summary={purchaseUnlockContent.trim() ? `￥${purchasePrice || 0} / ${pointName}` : "未配置"}
          onClick={actions.onOpenPurchaseModal}
          onClear={actions.onClearPurchaseUnlock}
        />

        <HiddenConfigChip
          icon={<Info className="h-4 w-4" />}
          title="整帖门槛"
          active={Number(minViewLevel) > 0 || Number(minViewVipLevel) > 0}
          summary={Number(minViewVipLevel) > 0 ? `VIP${Number(minViewVipLevel)}${Number(minViewLevel) > 0 ? ` / Lv.${Number(minViewLevel)}` : ""}` : Number(minViewLevel) > 0 ? `Lv.${Number(minViewLevel)}` : "公开可见"}
          onClick={actions.onOpenViewLevelModal}
          onClear={actions.onClearViewLevel}
        />


      </div>

      {finalTags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {finalTags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1">
              <span>#{tag}</span>
              <button type="button" onClick={() => actions.onRemoveManualTag(tag)} className="transition-opacity hover:opacity-70">×</button>
            </span>
          ))}
        </div>
      ) : null}

      {redPacketEnabled ? (
        <div className="mt-4 rounded-[20px] border border-border bg-secondary/25 px-4 py-3 text-xs leading-6 text-muted-foreground">
          {redPacketMode === "JACKPOT" ? (
            <>
              <p>当前已配置为聚宝盆：发帖时投入 {jackpotInitialPoints || postJackpotMinInitialPoints} {pointName} 作为初始积分。</p>
              <p>首个有效回复会追加 {postJackpotReplyIncrementPoints} {pointName} 并按 {postJackpotHitProbability}% 概率抽奖，后续回复改为随机小额追加且中奖概率递减。</p>
            </>
          ) : (
            <>
              <p>当前已配置为帖子红包：{redPacketTriggerType === "REPLY" ? "回复" : redPacketTriggerType === "LIKE" ? "点赞" : "收藏"}后触发发放。</p>
              <p>{redPacketGrantMode === "FIXED" ? `固定红包总计需要 ${fixedRedPacketTotalPoints ?? 0} ${pointName}。` : "拼手气红包要求总积分不小于份数。"}</p>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function CoverConfigModal({
  open,
  coverPath,
  coverUploading,
  onClose,
  onCoverUpload,
  onCoverPathChange,
  onCoverClear,
}: {
  open: boolean
  coverPath: string
  coverUploading: boolean
  onClose: () => void
  onCoverUpload: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>
  onCoverPathChange: (value: string) => void
  onCoverClear: () => void
}) {
  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="设置封面图"
      description="画廊模式默认提取正文第一张图片，也可以在这里手动上传或填写封面地址。"
      size="lg"
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">留空时，帖子列表会自动提取正文中的第一张图片作为封面。</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" disabled={!coverPath || coverUploading} onClick={onCoverClear}>清空封面</Button>
            <Button type="button" variant="outline" onClick={onClose}>完成</Button>
          </div>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className={coverUploading ? "inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground" : "inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm transition-colors hover:bg-accent"}>
            {coverUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span>{coverUploading ? "上传中..." : "上传封面"}</span>
            <input type="file" accept="image/*" className="hidden" disabled={coverUploading} onChange={onCoverUpload} />
          </label>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">封面地址</p>
          <input value={coverPath} onChange={(event) => onCoverPathChange(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" placeholder="留空则自动使用正文首图，也可以直接填写封面图片地址" />
        </div>
        {coverPath ? (
          <div className="relative overflow-hidden rounded-[24px] border border-border bg-card">
            <div className="relative aspect-[16/9] w-full">
              <Image src={coverPath} alt="帖子封面预览" fill sizes="(max-width: 1024px) 100vw, 896px" className="object-cover" unoptimized />
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-border bg-card/60 px-4 py-5 text-sm leading-6 text-muted-foreground">
            当前未手动设置封面图，发布后会自动提取正文中的第一张图片作为封面。
          </div>
        )}
      </div>
    </AdminModal>
  )
}

export function PostRewardPoolModal({
  open,
  pointName,
  redPacketEnabled,
  redPacketMaxPoints,
  jackpotEnabled,
  jackpotMinInitialPoints,
  jackpotMaxInitialPoints,
  jackpotReplyIncrementPoints,
  currentUserPoints,
  value,
  disabled,
  onClose,
  onChange,
}: {
  open: boolean
  pointName: string
  redPacketEnabled: boolean
  redPacketMaxPoints: number
  jackpotEnabled: boolean
  jackpotMinInitialPoints: number
  jackpotMaxInitialPoints: number
  jackpotReplyIncrementPoints: number
  currentUserPoints: number
  value: {
    enabled: boolean
    mode: "RED_PACKET" | "JACKPOT"
    grantMode: "FIXED" | "RANDOM"
    claimOrderMode: "FIRST_COME_FIRST_SERVED" | "RANDOM"
    triggerType: "REPLY" | "LIKE" | "FAVORITE"
    jackpotInitialPoints: string
    unitPoints: string
    totalPoints: string
    packetCount: string
    fixedTotalPoints: number | null
  }
  disabled: boolean
  onClose: () => void
  onChange: {
    onEnabledChange: (checked: boolean) => void
    onModeChange: (mode: "RED_PACKET" | "JACKPOT") => void
    onGrantModeChange: (mode: "FIXED" | "RANDOM") => void
    onClaimOrderModeChange: (mode: "FIRST_COME_FIRST_SERVED" | "RANDOM") => void
    onTriggerTypeChange: (type: "REPLY" | "LIKE" | "FAVORITE") => void
    onJackpotInitialPointsChange: (value: string) => void
    onUnitPointsChange: (value: string) => void
    onTotalPointsChange: (value: string) => void
    onPacketCountChange: (value: string) => void
  }
}) {
  const normalizedPacketCount = Math.max(1, parsePositiveSafeInteger(value.packetCount) ?? 1)
  const fixedRedPacketCost = value.fixedTotalPoints ?? 0
  const randomRedPacketCost = parsePositiveSafeInteger(value.totalPoints) ?? 0
  const jackpotCost = parsePositiveSafeInteger(value.jackpotInitialPoints) ?? jackpotMinInitialPoints
  const fixedUnitSliderMax = Math.max(
    1,
    Math.min(
      Math.max(1, redPacketMaxPoints),
      Math.max(1, Math.floor(currentUserPoints / normalizedPacketCount) || 1),
    ),
  )
  const randomTotalSliderMin = Math.max(1, normalizedPacketCount)
  const randomTotalSliderMax = Math.max(
    randomTotalSliderMin,
    Math.min(Math.max(1, redPacketMaxPoints), Math.max(randomTotalSliderMin, currentUserPoints)),
  )
  const jackpotSliderMax = Math.max(
    jackpotMinInitialPoints,
    Math.min(
      Math.max(jackpotMinInitialPoints, jackpotMaxInitialPoints),
      Math.max(jackpotMinInitialPoints, currentUserPoints),
    ),
  )

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="配置帖子激励池"
      description="在这里设置帖子红包或聚宝盆。"
      size="md"
      footer={(
        <div className="flex items-center justify-end">
          <Button type="button" variant="outline" onClick={onClose}>完成</Button>
        </div>
      )}
    >
      <div className="space-y-3">
        <div className="rounded-[14px] bg-card p-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange.onEnabledChange(false)}
              disabled={disabled}
              className={!value.enabled ? "rounded-[10px] border border-foreground bg-foreground px-3 py-2 text-left text-background" : "rounded-[10px] border border-border bg-background px-3 py-2 text-left"}
            >
              <p className="text-xs font-semibold">关闭</p>
              <p className={!value.enabled ? "mt-0.5 text-[10px] text-background/75" : "mt-0.5 text-[10px] text-muted-foreground"}>不启用激励池</p>
            </button>
            <button
              type="button"
              onClick={() => onChange.onEnabledChange(true)}
              disabled={disabled}
              className={value.enabled ? "rounded-[10px] border border-foreground bg-foreground px-3 py-2 text-left text-background" : "rounded-[10px] border border-border bg-background px-3 py-2 text-left"}
            >
              <p className="text-xs font-semibold">开启</p>
              <p className={value.enabled ? "mt-0.5 text-[10px] text-background/75" : "mt-0.5 text-[10px] text-muted-foreground"}>配置红包或聚宝盆</p>
            </button>
          </div>
        </div>

        {value.enabled ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => redPacketEnabled && onChange.onModeChange("RED_PACKET")}
                disabled={disabled || !redPacketEnabled}
                className={value.mode === "RED_PACKET" ? "rounded-[12px] border border-foreground bg-card px-3 py-2.5 text-left shadow-sm" : redPacketEnabled ? "rounded-[12px] border border-border bg-background px-3 py-2.5 text-left" : "rounded-[12px] border border-dashed border-border bg-secondary/40 px-3 py-2.5 text-left text-muted-foreground"}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold">帖子红包</p>
                  {value.mode === "RED_PACKET" ? <span className="rounded-full bg-foreground px-2 py-0.5 text-[9px] font-medium text-background">当前</span> : null}
                </div>
              </button>
              <button
                type="button"
                onClick={() => jackpotEnabled && onChange.onModeChange("JACKPOT")}
                disabled={disabled || !jackpotEnabled}
                className={value.mode === "JACKPOT" ? "rounded-[12px] border border-foreground bg-card px-3 py-2.5 text-left shadow-sm" : jackpotEnabled ? "rounded-[12px] border border-border bg-background px-3 py-2.5 text-left" : "rounded-[12px] border border-dashed border-border bg-secondary/40 px-3 py-2.5 text-left text-muted-foreground"}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold">聚宝盆</p>
                  {value.mode === "JACKPOT" ? <span className="rounded-full bg-foreground px-2 py-0.5 text-[9px] font-medium text-background">当前</span> : null}
                </div>
              </button>
            </div>

            {value.mode === "JACKPOT" ? (
              <div className="space-y-2 rounded-[14px] bg-amber-50/80 p-2.5">
                <PointsBudgetSliderField
                  label={`初始${pointName}`}
                  pointName={pointName}
                  value={value.jackpotInitialPoints}
                  min={jackpotMinInitialPoints}
                  max={jackpotSliderMax}
                  currentBalance={currentUserPoints}
                  estimatedCost={jackpotCost}
                  placeholder="输入数值"
                  disabled={disabled}
                  onChange={onChange.onJackpotInitialPointsChange}
                />
                <div className="rounded-[10px] bg-amber-100 px-3 py-2 text-[11px] leading-5 text-amber-900">
                  <p>{pointName}池递增规则：初始{pointName} + 用户每次回复增加的{pointName}（+{jackpotReplyIncrementPoints}，目前由系统发放）。</p>
                  <p className="mt-1">用户中奖后，会从{pointName}池中扣除相应{pointName}后继续计算，直到{pointName}消耗完或结束。</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 rounded-[14px] p-2.5">
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-2">
                    <p className="text-xs font-medium">发放方式</p>
                    <select value={value.grantMode} onChange={(event) => onChange.onGrantModeChange(event.target.value as "FIXED" | "RANDOM")} className="h-9 w-full rounded-[10px] border border-border bg-background px-3 text-xs outline-none" disabled={disabled}>
                      <option value="FIXED">固定红包</option>
                      <option value="RANDOM">拼手气红包</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium">领取规则</p>
                    <select value={value.claimOrderMode} onChange={(event) => onChange.onClaimOrderModeChange(event.target.value as "FIRST_COME_FIRST_SERVED" | "RANDOM")} className="h-9 w-full rounded-[10px] border border-border bg-background px-3 text-xs outline-none" disabled={disabled}>
                      <option value="FIRST_COME_FIRST_SERVED">先到先得</option>
                      <option value="RANDOM">随机机会</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium">触发行为</p>
                    <select value={value.triggerType} onChange={(event) => onChange.onTriggerTypeChange(event.target.value as "REPLY" | "LIKE" | "FAVORITE")} className="h-9 w-full rounded-[10px] border border-border bg-background px-3 text-xs outline-none" disabled={disabled}>
                      <option value="REPLY">回复帖子</option>
                      <option value="LIKE">点赞帖子</option>
                      <option value="FAVORITE">收藏帖子</option>
                    </select>
                  </div>
                </div>



                <div className="space-y-2">
                  <p className="text-xs font-medium">红包份数</p>
                  <input value={value.packetCount} onChange={(event) => onChange.onPacketCountChange(event.target.value)} className="h-9 w-full rounded-[10px] border border-border bg-background px-3 text-xs outline-none" placeholder="如 10" disabled={disabled} />
                </div>

                <div>
                  <PointsBudgetSliderField
                    label={value.grantMode === "FIXED" ? `单个红包 ${pointName}` : `红包总 ${pointName}`}
                    pointName={pointName}
                    value={value.grantMode === "FIXED" ? value.unitPoints : value.totalPoints}
                    min={value.grantMode === "FIXED" ? 1 : randomTotalSliderMin}
                    max={value.grantMode === "FIXED" ? fixedUnitSliderMax : randomTotalSliderMax}
                    currentBalance={currentUserPoints}
                    estimatedCost={value.grantMode === "FIXED" ? fixedRedPacketCost : randomRedPacketCost}
                    placeholder="输入数值"
                    disabled={disabled}
                    onChange={value.grantMode === "FIXED" ? onChange.onUnitPointsChange : onChange.onTotalPointsChange}
                  />
                </div>

                <div className="grid gap-1.5 sm:grid-cols-3">
                  <div className="rounded-[10px] bg-secondary/60 px-2.5 py-2">
                    <p className="text-[10px] text-muted-foreground">领取规则</p>
                    <p className="mt-0.5 text-[11px] font-semibold">{value.claimOrderMode === "RANDOM" ? "随机机会" : "先到先得"}</p>
                  </div>
                  <div className="rounded-[10px] bg-secondary/60 px-2.5 py-2">
                    <p className="text-[10px] text-muted-foreground">触发行为</p>
                    <p className="mt-0.5 text-[11px] font-semibold">{value.triggerType === "REPLY" ? "回复" : value.triggerType === "LIKE" ? "点赞" : "收藏"}</p>
                  </div>
                  <div className="rounded-[10px] bg-secondary/60 px-2.5 py-2">
                    <p className="text-[10px] text-muted-foreground">总消耗</p>
                    <p className="mt-0.5 text-[11px] font-semibold">{value.grantMode === "FIXED" ? (value.fixedTotalPoints ?? 0) : randomRedPacketCost} {pointName}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </AdminModal>
  )
}

export function TagConfigModal({
  open,
  autoExtractedTags,
  manualTags,
  tagInput,
  tagEditingIndex,
  tagEditingValue,
  onClose,
  onTagInputChange,
  onTagInputConfirm,
  onApplyAutoTagsToManual,
  onAddManualTag,
  onClearManualTags,
  onStartEditingTag,
  onTagEditingValueChange,
  onCommitEditingTag,
  onCancelEditingTag,
  onRemoveManualTag,
}: {
  open: boolean
  autoExtractedTags: string[]
  manualTags: string[]
  tagInput: string
  tagEditingIndex: number | null
  tagEditingValue: string
  onClose: () => void
  onTagInputChange: (value: string) => void
  onTagInputConfirm: () => void
  onApplyAutoTagsToManual: () => void
  onAddManualTag: (value: string) => boolean
  onClearManualTags: () => void
  onStartEditingTag: (index: number) => void
  onTagEditingValueChange: (value: string) => void
  onCommitEditingTag: (index?: number | null) => void
  onCancelEditingTag: () => void
  onRemoveManualTag: (tag: string) => void
}) {
  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="标签提取"
      description="自动提取仅作为候选结果，只有你手动添加后才会进入最终提交标签，并且可以继续编辑。"
      size="lg"
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">左侧是候选标签，右侧和下方是最终提交标签，只有手动采用的标签才会被保存。</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={manualTags.length > 0 ? onClearManualTags : onClose}>{manualTags.length > 0 ? "清空最终标签" : "关闭"}</Button>
            <Button type="button" variant="outline" onClick={onApplyAutoTagsToManual} disabled={autoExtractedTags.length === 0}>加入全部自动标签</Button>
          </div>
        </div>
      )}
    >
      <div className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-[24px] border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">自动提取</p>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">基于当前标题和正文自动计算。</p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">{autoExtractedTags.length} 个</span>
            </div>
            <div className="rounded-[18px] border border-dashed border-border bg-background/60 px-4 py-3 text-xs leading-6 text-muted-foreground">
              自动提取只会显示在这里，点击某个候选标签后，才会加入右侧最终标签，之后还能继续编辑。
            </div>
            <div className="flex min-h-[84px] flex-wrap gap-2">
              {autoExtractedTags.length > 0 ? autoExtractedTags.map((tag) => {
                const adopted = manualTags.some((item) => item.toLowerCase() === tag.toLowerCase())

                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onAddManualTag(tag)}
                    className={adopted ? "rounded-full border border-foreground bg-accent px-3 py-1.5 text-sm" : "rounded-full border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent"}
                  >
                    #{tag}
                    <span className="ml-2 text-xs text-muted-foreground">{adopted ? "已加入" : "加入"}</span>
                  </button>
                )
              }) : <p className="text-sm text-muted-foreground">暂未提取到标签，可以先补充标题或正文。</p>}
            </div>
          </div>

          <div className="space-y-3 rounded-[24px] border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">最终标签</p>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">支持手动新增、删除和编辑，最多 {MAX_MANUAL_TAGS} 个。</p>
              </div>
              <span className={manualTags.length > 0 ? "rounded-full bg-foreground px-3 py-1 text-xs text-background" : "rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground"}>{manualTags.length} / {MAX_MANUAL_TAGS}</span>
            </div>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(event) => onTagInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    onTagInputConfirm()
                  }
                }}
                className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none"
                placeholder="输入标签后回车，可用逗号批量添加"
              />
              <Button type="button" variant="outline" onClick={onTagInputConfirm}>添加</Button>
            </div>
            <div className="rounded-[18px] border border-dashed border-border bg-background/60 px-4 py-3 text-xs leading-6 text-muted-foreground">
              点击标签可直接编辑，编辑时可点“完成”保存或点“取消”放弃。
            </div>
            <div className="flex min-h-[84px] flex-wrap gap-2">
              {manualTags.length > 0 ? manualTags.map((tag, index) => (
                tagEditingIndex === index ? (
                  <div key={`${tag}-${index}`} className="flex items-center gap-2 rounded-full border border-foreground bg-accent px-3 py-1.5">
                    <span className="text-sm text-muted-foreground">#</span>
                    <input
                      value={tagEditingValue}
                      onChange={(event) => onTagEditingValueChange(event.target.value)}
                      onBlur={() => onCommitEditingTag(index)}
                      autoFocus
                      className="h-7 min-w-[96px] bg-transparent text-sm outline-none"
                    />
                    <Button type="button" variant="ghost" className="h-7 rounded-full px-2 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => onCommitEditingTag(index)}>完成</Button>
                    <Button type="button" variant="ghost" className="h-7 rounded-full px-2 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={onCancelEditingTag}>取消</Button>
                  </div>
                ) : (
                  <div key={`${tag}-${index}`} className="inline-flex items-center gap-2 rounded-full border border-foreground bg-accent px-3 py-1.5 text-sm">
                    <button type="button" onClick={() => onStartEditingTag(index)} className="transition-opacity hover:opacity-80">
                      #{tag}
                    </button>
                    <Button type="button" variant="ghost" className="h-7 rounded-full px-2 text-xs" onClick={() => onRemoveManualTag(tag)}>删除</Button>
                  </div>
                )
              )) : <p className="text-sm text-muted-foreground">还没有最终标签，点左侧候选标签加入，或自行输入即可。</p>}
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">最终提交标签</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">候选 {autoExtractedTags.length}</span>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">最终 {manualTags.length}</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {manualTags.length > 0 ? manualTags.map((tag) => (
              <span key={tag} className="rounded-full border border-foreground bg-accent px-3 py-1.5 text-sm">#{tag}</span>
            )) : <p className="text-sm text-muted-foreground">当前还没有可提交的标签。</p>}
          </div>
        </div>
      </div>
    </AdminModal>
  )
}
