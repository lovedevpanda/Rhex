"use client"

import { LotteryConditionValueField } from "@/components/post/lottery-condition-value-field"
import { Button } from "@/components/ui/rbutton"
import type { AccessThresholdOption } from "@/lib/access-threshold-options"
import type {
  LotteryConditionDraft,
  LotteryPrizeDraft,
} from "@/components/post/create-post-form.shared"
import {
  LOTTERY_CONDITION_CATEGORY_ORDER,
  LOTTERY_CONDITION_OPERATOR_OPTIONS,
  getLotteryConditionCategoryLabel,
  getLotteryConditionMeta,
  getLotteryConditionTypeOptions,
  lotteryConditionAllowsOperator,
  lotteryConditionRequiresValue,
  normalizeLotteryConditionGroupKey,
} from "@/components/post/create-post-form.shared"

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
  onLotteryPrizeChange: (
    index: number,
    field: keyof LotteryPrizeDraft,
    value: string,
  ) => void
  onAddLotteryPrize: () => void
  onRemoveLotteryPrize: (index: number) => void
  onLotteryConditionChange: (
    index: number,
    field: keyof LotteryConditionDraft,
    value: string,
  ) => void
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
  const hasManualDrawTime = lotteryEndsAt.trim().length > 0
  const hasAutoParticipantGoal =
    !hasManualDrawTime && lotteryParticipantGoal.trim().length > 0

  function handleLotteryEndsAtChange(value: string) {
    onLotteryEndsAtChange(value)
    if (value.trim()) {
      onLotteryParticipantGoalChange("")
    }
  }

  function handleLotteryParticipantGoalChange(value: string) {
    onLotteryParticipantGoalChange(value)
    if (value.trim()) {
      onLotteryEndsAtChange("")
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">抽奖设置</p>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          支持多个奖项、多个参与方案。结束时间代表手动开奖，目标参与人数代表人数达标自动开奖，两者互斥。
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={hasManualDrawTime ? "rounded-full bg-foreground px-3 py-1 text-xs text-background" : "rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground"}>
            手动开奖
          </span>
          <span className={hasAutoParticipantGoal ? "rounded-full bg-foreground px-3 py-1 text-xs text-background" : "rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground"}>
            自动开奖
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-2">
          <p className="text-sm font-medium">开始时间</p>
          <input type="datetime-local" value={lotteryStartsAt} onChange={(event) => onLotteryStartsAtChange(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden" disabled={disabled} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">结束时间</p>
          <input
            type="datetime-local"
            value={lotteryEndsAt}
            onChange={(event) => handleLotteryEndsAtChange(event.target.value)}
            className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled || hasAutoParticipantGoal}
          />
          <p className="text-xs leading-6 text-muted-foreground">
            {hasAutoParticipantGoal ? "已启用自动开奖，结束时间已禁用。" : "设置后为手动开奖，达到结束时间后由楼主手动执行开奖。"}
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">目标参与人数</p>
          <input
            value={lotteryParticipantGoal}
            onChange={(event) => handleLotteryParticipantGoalChange(event.target.value)}
            className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="留空表示不启用自动开奖"
            disabled={disabled || hasManualDrawTime}
          />
          <p className="text-xs leading-6 text-muted-foreground">
            {hasManualDrawTime ? "已设置结束时间，自动开奖人数已禁用。" : "设置后为人数达标自动开奖，达到目标人数后系统自动开奖。"}
          </p>
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
                <input value={prize.title} onChange={(event) => onLotteryPrizeChange(index, "title", event.target.value)} className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-hidden" placeholder="奖项名称，如 一等奖" disabled={disabled} />
                <input value={prize.quantity} onChange={(event) => onLotteryPrizeChange(index, "quantity", event.target.value)} className="h-11 rounded-full border border-border bg-background px-4 text-sm outline-hidden" placeholder="数量" disabled={disabled} />
                <Button type="button" variant="ghost" onClick={() => onRemoveLotteryPrize(index)} disabled={disabled || lotteryPrizes.length <= 1}>删除</Button>
              </div>
              <input value={prize.description} onChange={(event) => onLotteryPrizeChange(index, "description", event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden" placeholder="奖品描述，如 周边、积分、兑换码" disabled={disabled} />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-[20px]">
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
                        <select value={condition.type} onChange={(event) => onLotteryConditionChange(index, "type", event.target.value)} className="h-11 rounded-full border border-border bg-card px-4 text-sm outline-hidden" disabled={disabled}>
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
                          <select value={condition.operator} onChange={(event) => onLotteryConditionChange(index, "operator", event.target.value)} className="h-11 rounded-full border border-border bg-card px-4 text-sm outline-hidden" disabled={disabled}>
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
                        className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-hidden"
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
