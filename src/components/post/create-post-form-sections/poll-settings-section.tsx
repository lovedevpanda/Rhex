"use client"

import { Button } from "@/components/ui/rbutton"

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
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          至少填写 2 个选项，最多 8 个。
        </p>
      </div>
      <div className="space-y-3">
        {pollOptions.map((option, index) => (
          <div key={`${index}-${option}`} className="flex items-center gap-3">
            <input
              value={option}
              onChange={(event) => onPollOptionChange(index, event.target.value)}
              className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-hidden"
              placeholder={`选项 ${index + 1}`}
              disabled={disabled}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => onRemovePollOption(index)}
              disabled={pollOptions.length <= 2 || disabled}
            >
              删除
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          当前有效选项：{normalizedPollOptionsCount} 项
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={onAddPollOption}
          disabled={pollOptions.length >= 8 || disabled}
        >
          增加选项
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">投票结束时间</p>
        <input
          type="datetime-local"
          value={pollExpiresAt}
          onChange={(event) => onPollExpiresAtChange(event.target.value)}
          className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden"
          disabled={disabled}
        />
        <p className="text-xs leading-6 text-muted-foreground">
          留空表示长期开放投票；设置后到达截止时间将不再允许新增投票。
        </p>
      </div>
    </div>
  )
}
