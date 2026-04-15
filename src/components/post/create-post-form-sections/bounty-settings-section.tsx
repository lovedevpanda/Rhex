"use client"

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
        className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden"
        placeholder={`输入要奖励给最佳答案的${pointName}`}
        disabled={disabled}
      />
      <p className="text-xs leading-6 text-muted-foreground">
        发帖时会先冻结这部分{pointName}，等你采纳回复后再发放给答案作者。
      </p>
    </div>
  )
}
