import { FaqPageFrame } from "@/components/faq-page-frame"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buildFaqMetadata } from "@/lib/faq"

export async function generateMetadata() {
  return buildFaqMetadata("关注与拉黑", "查看关注对象类型、拉黑后的可见性变化与互动限制。")
}

export default function SocialSystemFaqPage() {
  const followTargets = [
    { title: "关注节点", description: "把常看的节点收进关注管理，后续更容易回到固定讨论区。" },
    { title: "关注用户", description: "适合持续跟踪某位作者或活跃用户的动态与主页内容。" },
    { title: "关注标签", description: "你可以围绕某个主题长期追踪相关帖子。" },
    { title: "关注帖子", description: "适合需要长期跟进回复、开奖、采纳或更新的单个帖子。" },
  ]

  const blockEffects = [
    "你拉黑对方后，无法继续关注对方；如果对方拉黑了你，你也无法关注对方。",
    "双方存在拉黑关系时，不能再互相发起或发送私信。",
    "双方存在拉黑关系时，不能继续在对方帖子下回复，也不能在回复链里继续互动。",
    "评论列表会按当前查看者过滤拉黑关系，双方评论会互相隐藏。",
    "如果主页主人拉黑了你，你将无法访问对方主页。",
    "已拉黑用户会集中出现在“个人设置 > 关注管理 > 拉黑”里，可随时解除。",
  ]

  return (
    <FaqPageFrame
      currentPath="/faq/social-system"
      eyebrow="Social Rules"
      title="关注与拉黑"
      description="关注负责内容订阅，拉黑负责关系隔离。两者都不是装饰功能，而是会真实影响信息流、主页访问、评论可见性与私信能力。"
    >
      <Card>
        <CardHeader>
          <CardTitle>关注系统支持什么</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {followTargets.map((item) => (
            <div key={item.title} className="rounded-[20px] bg-secondary/40 p-4">
              <p className="font-semibold">{item.title}</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>拉黑后会发生什么</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {blockEffects.map((effect) => (
            <div key={effect} className="rounded-[20px] border border-border px-4 py-4 text-sm leading-7 text-muted-foreground">
              {effect}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>一个最常见的场景</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm leading-7 text-muted-foreground md:grid-cols-3">
          <div className="rounded-[20px] bg-secondary/40 p-4">用户 A 拉黑用户 B 后，B 不能访问 A 的主页。</div>
          <div className="rounded-[20px] bg-secondary/40 p-4">A 和 B 的评论会在对方视角里被过滤掉，不再继续显示。</div>
          <div className="rounded-[20px] bg-secondary/40 p-4">后续双方也不能再互相关注、发私信，或继续在对方帖子下互动。</div>
        </CardContent>
      </Card>
    </FaqPageFrame>
  )
}
