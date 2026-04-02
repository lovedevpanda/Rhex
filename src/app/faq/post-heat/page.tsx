import { FaqPageFrame } from "@/components/faq-page-frame"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buildFaqMetadata } from "@/lib/faq"
import { calculatePostHeatScore, resolvePostHeatStyle } from "@/lib/post-heat"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata() {
  return buildFaqMetadata("帖子热度", "查看帖子热度颜色算法、权重、阈值和颜色阶段说明。")
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[20px] border border-border bg-card px-4 py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  )
}

export default async function PostHeatFaqPage() {
  const settings = await getSiteSettings()
  const sampleInput = {
    views: 120,
    comments: 18,
    likes: 12,
    tipCount: 4,
    tipPoints: 160,
  }
  const score = calculatePostHeatScore(sampleInput, settings)
  const preview = resolvePostHeatStyle(sampleInput, settings)

  return (
    <FaqPageFrame
      currentPath="/faq/post-heat"
      eyebrow="Heat Score"
      title="帖子热度"
      description="帖子列表里回复数颜色不是随机的，而是由一套热度分数规则驱动。这个页面集中说明热度如何计算，以及颜色档位如何对应。"
    >
      <Card>
        <CardHeader>
          <CardTitle>算法公式</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-[20px] bg-secondary/40 px-4 py-4 text-sm leading-7">
            热度分数 = 浏览数 × 浏览权重 + 回复数 × 回复权重 + 点赞数 × 点赞权重 + 打赏次数 × 打赏次数权重 + 打赏积分 × 打赏积分权重
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Metric label="浏览权重" value={settings.heatViewWeight} />
            <Metric label="回复权重" value={settings.heatCommentWeight} />
            <Metric label="点赞权重" value={settings.heatLikeWeight} />
            <Metric label="打赏次数权重" value={settings.heatTipCountWeight} />
            <Metric label="打赏积分权重" value={settings.heatTipPointsWeight} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>颜色阶段</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {settings.heatStageColors.map((color, index) => (
              <div key={`${color}-${index}`} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm">
                <span className="inline-block h-3.5 w-3.5 rounded-full" style={{ backgroundColor: color }} />
                <span>第 {index + 1} 档</span>
                <span className="text-muted-foreground">≥ {settings.heatStageThresholds[index] ?? 0}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>示例预览</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[220px_minmax(0,1fr)]">
            <div className="rounded-[20px] border border-border bg-card px-4 py-4">
              <p className="text-xs text-muted-foreground">示例热度分数</p>
              <p className="mt-2 text-3xl font-semibold">{score}</p>
              <p className="mt-2 text-xs text-muted-foreground">落在第 {preview.stageIndex + 1} 档</p>
            </div>
            <div className="rounded-[20px] border border-border bg-card px-4 py-4">
              <p className="text-xs text-muted-foreground">回复数按钮效果</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium" style={{ backgroundColor: `${preview.color}14`, color: preview.color }}>
                  💬 {sampleInput.comments}
                </span>
                <span className="text-sm text-muted-foreground">当前颜色：{preview.color}</span>
              </div>
            </div>
          </div>
          <div className="rounded-[20px] bg-secondary/40 px-4 py-4 text-sm leading-7 text-muted-foreground">
            示例输入：浏览 {sampleInput.views}、回复 {sampleInput.comments}、点赞 {sampleInput.likes}、打赏次数 {sampleInput.tipCount}、打赏积分 {sampleInput.tipPoints}
          </div>
        </CardContent>
      </Card>
    </FaqPageFrame>
  )
}
