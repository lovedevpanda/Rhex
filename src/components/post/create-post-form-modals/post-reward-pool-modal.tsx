"use client"

import { PointsBudgetSliderField } from "@/components/post/points-budget-slider-field"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/rbutton"
import { parsePositiveSafeInteger } from "@/lib/shared/safe-integer"

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
  const fixedUnitSliderMax = Math.max(1, Math.min(Math.max(1, redPacketMaxPoints), Math.max(1, Math.floor(currentUserPoints / normalizedPacketCount) || 1)))
  const randomTotalSliderMin = Math.max(1, normalizedPacketCount)
  const randomTotalSliderMax = Math.max(randomTotalSliderMin, Math.min(Math.max(1, redPacketMaxPoints), Math.max(randomTotalSliderMin, currentUserPoints)))
  const jackpotSliderMax = Math.max(jackpotMinInitialPoints, Math.min(Math.max(jackpotMinInitialPoints, jackpotMaxInitialPoints), Math.max(jackpotMinInitialPoints, currentUserPoints)))

  return (
    <Modal
      open={open}
      onClose={onClose}
      hideHeaderCloseButtonOnMobile
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
                className={value.mode === "RED_PACKET" ? "rounded-[12px] border border-foreground bg-card px-3 py-2.5 text-left shadow-xs" : redPacketEnabled ? "rounded-[12px] border border-border bg-background px-3 py-2.5 text-left" : "rounded-[12px] border border-dashed border-border bg-secondary/40 px-3 py-2.5 text-left text-muted-foreground"}
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
                className={value.mode === "JACKPOT" ? "rounded-[12px] border border-foreground bg-card px-3 py-2.5 text-left shadow-xs" : jackpotEnabled ? "rounded-[12px] border border-border bg-background px-3 py-2.5 text-left" : "rounded-[12px] border border-dashed border-border bg-secondary/40 px-3 py-2.5 text-left text-muted-foreground"}
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
                    <select value={value.grantMode} onChange={(event) => onChange.onGrantModeChange(event.target.value as "FIXED" | "RANDOM")} className="h-9 w-full rounded-[10px] border border-border bg-background px-3 text-xs outline-hidden" disabled={disabled}>
                      <option value="FIXED">固定红包</option>
                      <option value="RANDOM">拼手气红包</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium">领取规则</p>
                    <select value={value.claimOrderMode} onChange={(event) => onChange.onClaimOrderModeChange(event.target.value as "FIRST_COME_FIRST_SERVED" | "RANDOM")} className="h-9 w-full rounded-[10px] border border-border bg-background px-3 text-xs outline-hidden" disabled={disabled}>
                      <option value="FIRST_COME_FIRST_SERVED">先到先得</option>
                      <option value="RANDOM">随机机会</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium">触发行为</p>
                    <select value={value.triggerType} onChange={(event) => onChange.onTriggerTypeChange(event.target.value as "REPLY" | "LIKE" | "FAVORITE")} className="h-9 w-full rounded-[10px] border border-border bg-background px-3 text-xs outline-hidden" disabled={disabled}>
                      <option value="REPLY">回复帖子</option>
                      <option value="LIKE">点赞帖子</option>
                      <option value="FAVORITE">收藏帖子</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium">红包份数</p>
                  <input value={value.packetCount} onChange={(event) => onChange.onPacketCountChange(event.target.value)} className="h-9 w-full rounded-[10px] border border-border bg-background px-3 text-xs outline-hidden" placeholder="如 10" disabled={disabled} />
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
    </Modal>
  )
}
