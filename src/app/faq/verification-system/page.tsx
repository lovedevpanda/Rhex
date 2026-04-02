import { CheckCircle2, Clock3, ShieldCheck, XCircle } from "lucide-react"
import type { ReactNode } from "react"

import { FaqPageFrame } from "@/components/faq-page-frame"
import { LevelIcon } from "@/components/level-icon"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buildFaqMetadata } from "@/lib/faq"
import { getCurrentUserVerificationData } from "@/lib/verifications"

export async function generateMetadata() {
  return buildFaqMetadata("认证系统", "查看认证类型、申请流程、审核状态和前台展示方式。")
}

export default async function VerificationSystemFaqPage() {
  const verificationData = await getCurrentUserVerificationData()
  const types = verificationData.types ?? []

  return (
    <FaqPageFrame
      currentPath="/faq/verification-system"
      eyebrow="Verification System"
      title="认证系统"
      description="认证系统用于给账号附加可核验身份。提交申请并审核通过后，帖子和评论作者名前会显示对应认证图标。当前 FAQ 只说明已经上线的真实申请与审核机制。"
    >
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5 text-sm leading-7 text-muted-foreground">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <p className="mt-3">认证不是称号装饰，而是后台审核通过后才会生效的身份标识。</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-sm leading-7 text-muted-foreground">
            <Clock3 className="h-5 w-5 text-amber-500" />
            <p className="mt-3">提交后会进入审核中状态，在管理员处理前不能重复提交同一类型。</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-sm leading-7 text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-sky-500" />
            <p className="mt-3">通过后会绑定到当前账号，并在前台作者信息区域展示对应图标与名称。</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>当前可申请认证类型</CardTitle>
        </CardHeader>
        <CardContent>
          {types.length === 0 ? (
            <p className="text-sm text-muted-foreground">当前还没有启用中的认证类型。</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {types.map((type) => (
                <div key={type.id} className="rounded-[24px] border border-border bg-card p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ backgroundColor: `${type.color}18`, color: type.color }}>
                      <LevelIcon icon={type.iconText} color={type.color} className="h-6 w-6 text-[22px]" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold">{type.name}</p>
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground">
                          字段 {type.formFields.length || 1}
                        </span>
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground">
                          每人上限 {type.userLimit}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">{type.description || "暂无说明"}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        驳回后{type.allowResubmitAfterReject ? "允许重新提交" : "不允许重新提交"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>申请和审核流程</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm leading-7 text-muted-foreground">
          <div className="rounded-[20px] bg-secondary/40 p-4">1. 进入账号认证中心，选择一个已启用的认证类型。</div>
          <div className="rounded-[20px] bg-secondary/40 p-4">2. 按当前认证类型要求填写文本、链接、数字或说明字段后提交申请。</div>
          <div className="rounded-[20px] bg-secondary/40 p-4">3. 后台审核中时，前台会显示“审核中”状态，不能重复提交同一项。</div>
          <div className="rounded-[20px] bg-secondary/40 p-4">4. 审核通过后立即绑定；被驳回时是否允许重提，取决于该认证类型配置。</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>状态说明</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatusCard icon={<Clock3 className="h-4 w-4 text-amber-600" />} title="审核中" description="申请已提交，等待管理员审核。" />
          <StatusCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} title="已通过" description="认证绑定成功，前台会展示认证标识。" />
          <StatusCard icon={<XCircle className="h-4 w-4 text-rose-600" />} title="已驳回" description="申请未通过，可根据配置决定能否重提。" />
          <StatusCard icon={<ShieldCheck className="h-4 w-4 text-slate-600" />} title="已取消" description="该条申请已失效或被取消，不再继续审核。" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>几个关键边界</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
          <div className="rounded-[20px] border border-border px-4 py-4">同一账号如果已经通过了某个认证，不能再直接申请其它认证，除非先解除当前认证绑定。</div>
          <div className="rounded-[20px] border border-border px-4 py-4">如果某个认证类型配置了表单字段，前台会按字段生成申请表，而不是只填一段自由说明。</div>
          <div className="rounded-[20px] border border-border px-4 py-4">认证通过后，显示逻辑会跟随账号走，不是只在某篇帖子里临时生效。</div>
        </CardContent>
      </Card>
    </FaqPageFrame>
  )
}

function StatusCard({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-[20px] border border-border p-4">
      <div className="flex items-center gap-2">
        {icon}
        <p className="font-semibold">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p>
    </div>
  )
}
