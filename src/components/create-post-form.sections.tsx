import Image from "next/image"
import type { ChangeEvent, ReactNode } from "react"
import { ImageIcon, Info, Loader2, MessageSquareLock, Sparkles, Upload } from "lucide-react"

import { AdminModal } from "@/components/admin-modal"
import { Button } from "@/components/ui/button"
import { MAX_MANUAL_TAGS } from "@/lib/post-tags"

import {
  LOTTERY_NUMERIC_CONDITION_TYPES,
  LOTTERY_TEXT_CONDITION_TYPES,
  getLotteryConditionPlaceholder,
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
        className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none"
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
    <div className="space-y-3 rounded-[24px] border border-border bg-card p-5">
      <div>
        <p className="text-sm font-medium">投票选项</p>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">至少填写 2 个选项，最多 8 个，审核通过后前台用户可参与投票。</p>
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
          className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none"
          disabled={disabled}
        />
        <p className="text-xs leading-6 text-muted-foreground">留空表示长期开放投票；设置后到达截止时间将不再允许新增投票。</p>
      </div>
    </div>
  )
}

export function LotterySettingsSection({
  pointName,
  lotteryStartsAt,
  lotteryEndsAt,
  lotteryParticipantGoal,
  lotteryPrizes,
  lotteryConditions,
  onLotteryStartsAtChange,
  onLotteryEndsAtChange,
  onLotteryParticipantGoalChange,
  onLotteryPrizeChange,
  onAddLotteryPrize,
  onRemoveLotteryPrize,
  onLotteryConditionChange,
  onAddLotteryCondition,
  onRemoveLotteryCondition,
  disabled,
}: {
  pointName: string
  lotteryStartsAt: string
  lotteryEndsAt: string
  lotteryParticipantGoal: string
  lotteryPrizes: LotteryPrizeDraft[]
  lotteryConditions: LotteryConditionDraft[]
  onLotteryStartsAtChange: (value: string) => void
  onLotteryEndsAtChange: (value: string) => void
  onLotteryParticipantGoalChange: (value: string) => void
  onLotteryPrizeChange: (index: number, field: keyof LotteryPrizeDraft, value: string) => void
  onAddLotteryPrize: () => void
  onRemoveLotteryPrize: (index: number) => void
  onLotteryConditionChange: (index: number, field: keyof LotteryConditionDraft, value: string) => void
  onAddLotteryCondition: (type?: string, groupKey?: string) => void
  onRemoveLotteryCondition: (index: number) => void
  disabled: boolean
}) {
  return (
    <div className="space-y-4 rounded-[24px] border border-border bg-card p-5">
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

      <div className="space-y-3 rounded-[20px] border border-border bg-background p-4">
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

      <div className="space-y-3 rounded-[20px] border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">参与条件</p>
            <p className="mt-1 text-xs text-muted-foreground">支持点赞、收藏、回帖、等级、VIP 等条件组合。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => onAddLotteryCondition("LIKE_POST")} disabled={disabled || lotteryConditions.length >= 20}>加点赞条件</Button>
            <Button type="button" variant="outline" onClick={() => onAddLotteryCondition("REGISTER_DAYS")} disabled={disabled || lotteryConditions.length >= 20}>加门槛条件</Button>
          </div>
        </div>
        <div className="space-y-3">
          {lotteryConditions.map((condition, index) => {
            const valueDisabled = !LOTTERY_NUMERIC_CONDITION_TYPES.has(condition.type) && !LOTTERY_TEXT_CONDITION_TYPES.has(condition.type)

            return (
              <div key={`lottery-condition-${index}`} className="space-y-3 rounded-[18px] border border-border bg-card p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <select value={condition.type} onChange={(event) => onLotteryConditionChange(index, "type", event.target.value)} className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none" disabled={disabled}>
                    <option value="LIKE_POST">点赞帖子</option>
                    <option value="FAVORITE_POST">收藏帖子</option>
                    <option value="REPLY_CONTENT_LENGTH">回帖内容长度</option>
                    <option value="REPLY_KEYWORD">回帖关键词</option>
                    <option value="REGISTER_DAYS">注册天数</option>
                    <option value="USER_LEVEL">用户等级</option>
                    <option value="VIP_LEVEL">VIP 等级</option>
                    <option value="USER_POINTS">用户积分</option>
                  </select>
                  <input value={condition.value} onChange={(event) => onLotteryConditionChange(index, "value", event.target.value)} className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none" placeholder={getLotteryConditionPlaceholder(condition.type, pointName)} disabled={disabled || valueDisabled} />
                </div>
                <div className="grid gap-3 md:grid-cols-[180px_180px_1fr_auto]">
                  <select value={condition.operator} onChange={(event) => onLotteryConditionChange(index, "operator", event.target.value)} className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none" disabled={disabled}>
                    <option value="GTE">大于等于</option>
                    <option value="EQ">等于</option>
                  </select>
                  <input value={condition.groupKey} onChange={(event) => onLotteryConditionChange(index, "groupKey", event.target.value)} className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none" placeholder="参与方案，如 老用户组" disabled={disabled} />
                  <input value={condition.description} onChange={(event) => onLotteryConditionChange(index, "description", event.target.value)} className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-none" placeholder="前端展示文案，可留空自动生成" disabled={disabled} />
                  <Button type="button" variant="ghost" onClick={() => onRemoveLotteryCondition(index)} disabled={disabled || lotteryConditions.length <= 1}>删除</Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface PostEnhancementsSectionProps {
  pointName: string
  postRedPacketEnabled: boolean
  disabled: boolean
  settings: {
    finalTags: string[]
    autoExtractedTags: string[]
    coverUploading: boolean
    coverPath: string
    commentsVisibleToAuthorOnly: boolean
    replyUnlockContent: string
    purchaseUnlockContent: string
    purchasePrice: string
    minViewLevel: string
    minViewVipLevel: string
    redPacketEnabled: boolean
    redPacketGrantMode: "FIXED" | "RANDOM"
    redPacketClaimOrderMode: "FIRST_COME_FIRST_SERVED" | "RANDOM"
    redPacketTriggerType: "REPLY" | "LIKE" | "FAVORITE"
    redPacketUnitPoints: string
    redPacketTotalPoints: string
    redPacketPacketCount: string
    fixedRedPacketTotalPoints: number | null
  }
  actions: {
    onOpenTagModal: () => void
    onOpenCoverModal: () => void
    onRemoveManualTag: (tag: string) => void
    onCoverClear: () => void
    onCommentsVisibleToAuthorOnlyChange: (checked: boolean) => void
    onOpenReplyModal: () => void
    onClearReplyUnlock: () => void
    onOpenPurchaseModal: () => void
    onClearPurchaseUnlock: () => void
    onOpenViewLevelModal: () => void
    onClearViewLevel: () => void
    onRedPacketEnabledChange: (checked: boolean) => void
    onRedPacketGrantModeChange: (mode: "FIXED" | "RANDOM") => void
    onRedPacketClaimOrderModeChange: (mode: "FIRST_COME_FIRST_SERVED" | "RANDOM") => void
    onRedPacketTriggerTypeChange: (type: "REPLY" | "LIKE" | "FAVORITE") => void
    onRedPacketValueChange: (value: string) => void
    onRedPacketPacketCountChange: (value: string) => void
  }
}

export function PostEnhancementsSection({ pointName, postRedPacketEnabled, disabled, settings, actions }: PostEnhancementsSectionProps) {
  const {
    finalTags,
    autoExtractedTags,
    coverUploading,
    coverPath,
    commentsVisibleToAuthorOnly,
    replyUnlockContent,
    purchaseUnlockContent,
    purchasePrice,
    minViewLevel,
    minViewVipLevel,
    redPacketEnabled,
    redPacketGrantMode,
    redPacketClaimOrderMode,
    redPacketTriggerType,
    redPacketUnitPoints,
    redPacketTotalPoints,
    redPacketPacketCount,
    fixedRedPacketTotalPoints,
  } = settings

  return (
    <div className="rounded-[24px] border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className={finalTags.length > 0 ? "h-9 border-foreground px-4 text-sm" : "h-9 px-4 text-sm"} onClick={actions.onOpenTagModal}>
          <Sparkles className="mr-2 h-4 w-4" />
          标签提取
          <span className={finalTags.length > 0 ? "ml-2 rounded-full bg-foreground px-2 py-0.5 text-[11px] text-background" : "ml-2 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"}>{finalTags.length > 0 ? finalTags.length : autoExtractedTags.length}</span>
        </Button>

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
          title="浏览门槛"
          active={Number(minViewLevel) > 0 || Number(minViewVipLevel) > 0}
          summary={Number(minViewVipLevel) > 0 ? `VIP${Number(minViewVipLevel)}${Number(minViewLevel) > 0 ? ` / Lv.${Number(minViewLevel)}` : ""}` : Number(minViewLevel) > 0 ? `Lv.${Number(minViewLevel)}` : "公开可见"}
          onClick={actions.onOpenViewLevelModal}
          onClear={actions.onClearViewLevel}
        />

        {postRedPacketEnabled ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
            <label className={redPacketEnabled ? "inline-flex items-center gap-2 text-sm" : "inline-flex items-center gap-2 text-sm text-muted-foreground"}>
              <input
                type="checkbox"
                checked={redPacketEnabled}
                onChange={(event) => actions.onRedPacketEnabledChange(event.target.checked)}
                className="h-4 w-4 rounded border-border"
                disabled={disabled}
              />
              <span>帖子红包</span>
            </label>
            <span className={redPacketEnabled ? "rounded-full bg-rose-500 px-2 py-0.5 text-[11px] text-white" : "rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"}>
              {redPacketEnabled ? "已开启" : "未开启"}
            </span>
          </div>
        ) : null}
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
        <div className="mt-4 grid gap-3 rounded-[20px] border border-rose-200 bg-rose-50/80 p-4 md:grid-cols-2 xl:grid-cols-5 dark:border-rose-500/20 dark:bg-rose-500/10">
          <div className="space-y-2">
            <p className="text-sm font-medium">发放方式</p>
            <select value={redPacketGrantMode} onChange={(event) => actions.onRedPacketGrantModeChange(event.target.value as "FIXED" | "RANDOM")} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" disabled={disabled}>
              <option value="FIXED">固定红包</option>
              <option value="RANDOM">拼手气红包</option>
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">领取规则</p>
            <select value={redPacketClaimOrderMode} onChange={(event) => actions.onRedPacketClaimOrderModeChange(event.target.value as "FIRST_COME_FIRST_SERVED" | "RANDOM")} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" disabled={disabled}>
              <option value="FIRST_COME_FIRST_SERVED">先到先得</option>
              <option value="RANDOM">随机机会</option>
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">触发行为</p>
            <select value={redPacketTriggerType} onChange={(event) => actions.onRedPacketTriggerTypeChange(event.target.value as "REPLY" | "LIKE" | "FAVORITE")} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" disabled={disabled}>
              <option value="REPLY">回复帖子</option>
              <option value="LIKE">点赞帖子</option>
              <option value="FAVORITE">收藏帖子</option>
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{redPacketGrantMode === "FIXED" ? `单个红包 ${pointName}` : `红包总 ${pointName}`}</p>
            <input
              value={redPacketGrantMode === "FIXED" ? redPacketUnitPoints : redPacketTotalPoints}
              onChange={(event) => actions.onRedPacketValueChange(event.target.value)}
              className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none"
              placeholder={redPacketGrantMode === "FIXED" ? "如 10" : "如 100"}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">红包份数</p>
            <input value={redPacketPacketCount} onChange={(event) => actions.onRedPacketPacketCountChange(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" placeholder="如 10" disabled={disabled} />
          </div>
          <div className="md:col-span-2 xl:col-span-5 rounded-[16px] bg-background/80 px-4 py-3 text-xs leading-6 text-muted-foreground">
            <p>领取行为满足后自动发放；所有红包均按整数分配，每人至少 1 {pointName}。</p>
            <p>{redPacketGrantMode === "FIXED" ? `当前总计需要 ${fixedRedPacketTotalPoints ?? 0} ${pointName}。` : "拼手气红包要求总积分不小于份数。"}</p>
            <p>{redPacketClaimOrderMode === "FIRST_COME_FIRST_SERVED" ? "先到先得会按触发先后直接发放。" : "随机机会会在当前满足条件但尚未领取的用户池中随机命中，让后来触发的用户也有机会获得红包。"}</p>
          </div>
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
