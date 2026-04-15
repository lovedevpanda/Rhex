"use client"

import { Gavel } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import type {
  AuctionModeDraft,
  AuctionPricingRuleDraft,
} from "@/components/post/create-post-form.shared"

export function AuctionSettingsSection({
  pointName,
  auctionMode,
  auctionPricingRule,
  auctionStartPrice,
  auctionIncrementStep,
  auctionStartsAt,
  auctionEndsAt,
  auctionWinnerOnlyContent,
  auctionWinnerOnlyContentPreview,
  onAuctionModeChange,
  onAuctionPricingRuleChange,
  onAuctionStartPriceChange,
  onAuctionIncrementStepChange,
  onAuctionStartsAtChange,
  onAuctionEndsAtChange,
  onAuctionWinnerOnlyContentChange,
  onAuctionWinnerOnlyContentPreviewChange,
  disabled,
}: {
  pointName: string
  auctionMode: AuctionModeDraft
  auctionPricingRule: AuctionPricingRuleDraft
  auctionStartPrice: string
  auctionIncrementStep: string
  auctionStartsAt: string
  auctionEndsAt: string
  auctionWinnerOnlyContent: string
  auctionWinnerOnlyContentPreview: string
  onAuctionModeChange: (value: AuctionModeDraft) => void
  onAuctionPricingRuleChange: (value: AuctionPricingRuleDraft) => void
  onAuctionStartPriceChange: (value: string) => void
  onAuctionIncrementStepChange: (value: string) => void
  onAuctionStartsAtChange: (value: string) => void
  onAuctionEndsAtChange: (value: string) => void
  onAuctionWinnerOnlyContentChange: (value: string) => void
  onAuctionWinnerOnlyContentPreviewChange: (value: string) => void
  disabled: boolean
}) {
  const isSealedBid = auctionMode === "SEALED_BID"

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">拍卖配置</p>
              <Badge variant="secondary" className="rounded-full">
                {isSealedBid ? "密封竞拍" : "公开拍卖"}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              发布后出售一段仅赢家可见的内容。密封竞拍一人一次、金额隐藏；公开拍卖可多次出价并展示记录。
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">交易模式</p>
            <select
              value={auctionMode}
              onChange={(event) =>
                onAuctionModeChange(event.target.value as AuctionModeDraft)}
              className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden"
              disabled={disabled}
            >
              <option value="SEALED_BID">密封竞拍</option>
              <option value="OPEN_ASCENDING">公开拍卖</option>
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">成交规则</p>
            <select
              value={auctionPricingRule}
              onChange={(event) =>
                onAuctionPricingRuleChange(
                  event.target.value as AuctionPricingRuleDraft,
                )}
              className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden"
              disabled={disabled}
            >
              <option value="FIRST_PRICE">最高价成交</option>
              <option value="SECOND_PRICE">第二高价成交</option>
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">起拍价</p>
            <input
              value={auctionStartPrice}
              onChange={(event) => onAuctionStartPriceChange(event.target.value)}
              className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden"
              placeholder={`起拍价（${pointName}）`}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">加价幅度</p>
            <input
              value={auctionIncrementStep}
              onChange={(event) =>
                onAuctionIncrementStepChange(event.target.value)}
              className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden"
              placeholder={`最小加价（${pointName}）`}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">开始时间</p>
            <input
              type="datetime-local"
              value={auctionStartsAt}
              onChange={(event) => onAuctionStartsAtChange(event.target.value)}
              className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden"
              disabled={disabled}
            />
            <p className="text-xs leading-6 text-muted-foreground">
              留空表示帖子公开后立即可参与。
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">结束时间</p>
            <input
              type="datetime-local"
              value={auctionEndsAt}
              onChange={(event) => onAuctionEndsAtChange(event.target.value)}
              className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden"
              disabled={disabled}
            />
            <p className="text-xs leading-6 text-muted-foreground">
              到时自动结算，服务端时间为准。
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">赢家内容预告</p>
            <input
              value={auctionWinnerOnlyContentPreview}
              onChange={(event) =>
                onAuctionWinnerOnlyContentPreviewChange(event.target.value)}
              className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden"
              placeholder="例如：成交后可见兑换码 / 下载链接 / 联系方式"
              disabled={disabled}
            />
          </div>
          <div className="rounded-[18px] border border-dashed border-border bg-card/70 px-4 py-3 text-xs leading-6 text-muted-foreground">
            <div className="flex items-center gap-2 font-medium text-foreground/85">
              <Gavel className="h-4 w-4" />
              <span>{isSealedBid ? "密封竞拍提示" : "公开拍卖提示"}</span>
            </div>
            <p className="mt-1">
              {isSealedBid
                ? "每位用户只能出价一次，出价金额在结束前不会公开。"
                : `所有人都能看到出价记录，新出价必须至少比当前价高 ${auctionIncrementStep || 0} ${pointName}。`}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">赢家专属内容</p>
          <Textarea
            value={auctionWinnerOnlyContent}
            onChange={(event) =>
              onAuctionWinnerOnlyContentChange(event.target.value)}
            className="min-h-[180px] rounded-[20px] bg-background px-4 py-3"
            placeholder="这里填写仅赢家可见的内容，例如兑换码、网盘地址、隐藏说明、联系方式。"
            disabled={disabled}
          />
          <p className="text-xs leading-6 text-muted-foreground">
            只有卖家、站点管理员和最终赢家可查看这里的内容。
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
