import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { RegisterForm } from "@/components/register-form"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { readSearchParam } from "@/lib/search-params"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `注册 - ${settings.siteName}`,
    description: `注册 ${settings.siteName} 账户，加入社区讨论并建立你的个人主页。`,
  }
}

export default async function RegisterPage(props: PageProps<"/register">) {
  const searchParams = await props.searchParams;
  const [user, settings] = await Promise.all([getCurrentUser(), getSiteSettings()])

  if (user) {
    redirect("/")
  }

  if (!settings.registrationEnabled) {
    return (
      <div className="min-h-screen ">
        <SiteHeader />
        <main className="mx-auto max-w-[520px] px-4 py-10 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle>注册暂未开放</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>当前站点已关闭新用户注册，请稍后再试或联系管理员。</p>
              <p>
                已有账户？<Link href="/login" className="font-medium text-foreground hover:underline">去登录</Link>
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const inviterUsername = readSearchParam(searchParams?.invite) ?? readSearchParam(searchParams?.inviter) ?? ""
  const inviteCode = readSearchParam(searchParams?.code) ?? ""

  return (
    <div className="min-h-screen ">
      <SiteHeader />
      <main className="mx-auto max-w-[560px] px-4 py-10 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>注册论坛账户</CardTitle>
          </CardHeader>
          <CardContent>
            {inviterUsername ? <p className="mb-4 rounded-2xl border border-border bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">当前通过用户 <span className="font-medium text-foreground">{inviterUsername}</span> 的邀请进入注册。</p> : null}
            {inviteCode ? <p className="mb-4 rounded-2xl border border-border bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">当前注册链接已带入邀请码 <span className="font-mono font-medium text-foreground">{inviteCode}</span>。</p> : null}
            <RegisterForm settings={settings} />
            <p className="mt-4 text-center text-sm text-muted-foreground">
              已有账户？<Link href="/login" className="font-medium text-foreground hover:underline">去登录</Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
