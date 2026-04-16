import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { PasskeyAuthPanel } from "@/components/auth/passkey-auth-panel"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { readSearchParam } from "@/lib/search-params"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `Passkey 认证 - ${settings.siteName}`,
  }
}

interface PasskeyPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function PasskeyPage(props: PasskeyPageProps) {
  const searchParams = await props.searchParams
  const [currentUser, settings] = await Promise.all([getCurrentUser(), getSiteSettings()])
  const mode = readSearchParam(searchParams?.mode) === "register" ? "register" : "login"

  if (!settings.authPasskeyEnabled) {
    redirect("/login?authError=Passkey 登录暂未开放")
  }

  if (currentUser) {
    redirect("/")
  }

  if (mode === "register" && !settings.registrationEnabled) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-[560px] px-4 py-10 lg:px-6">
          <AddonSlotRenderer slot="auth.passkey.page.before" />
          <AddonSurfaceRenderer surface="auth.passkey.page" props={{ mode, settings }}>
            <>
              <AddonSlotRenderer slot="auth.passkey.panel.before" />
              <AddonSurfaceRenderer surface="auth.passkey.panel" props={{ mode, settings }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Passkey 注册暂未开放</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-muted-foreground">
                    <p>当前站点已关闭新用户注册，仍可使用已绑定的 Passkey 进行登录。</p>
                    <p>
                      返回 <Link href="/auth/passkey?mode=login" className="font-medium text-foreground hover:underline">Passkey 登录</Link>
                    </p>
                  </CardContent>
                </Card>
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="auth.passkey.panel.after" />
            </>
          </AddonSurfaceRenderer>
          <AddonSlotRenderer slot="auth.passkey.page.after" />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[560px] px-4 py-10 lg:px-6">
        <AddonSlotRenderer slot="auth.passkey.page.before" />
        <AddonSurfaceRenderer surface="auth.passkey.page" props={{ mode, settings }}>
          <>
            <AddonSlotRenderer slot="auth.passkey.panel.before" />
            <AddonSurfaceRenderer surface="auth.passkey.panel" props={{ mode, settings }}>
              <Card>
                <CardHeader>
                  <CardTitle>{mode === "register" ? "使用 Passkey 注册" : "使用 Passkey 登录"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <PasskeyAuthPanel mode={mode} />
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    {mode === "register"
                      ? <Link href="/login" className="font-medium text-foreground hover:underline">已有账户，返回登录</Link>
                      : <Link href="/register" className="font-medium text-foreground hover:underline">没有账户，返回注册</Link>}
                  </p>
                </CardContent>
              </Card>
            </AddonSurfaceRenderer>
            <AddonSlotRenderer slot="auth.passkey.panel.after" />
          </>
        </AddonSurfaceRenderer>
        <AddonSlotRenderer slot="auth.passkey.page.after" />
      </main>
    </div>
  )
}
