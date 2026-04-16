import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { AddonSlotRenderer } from "@/addons-host"
import { AuthPanelNotice, AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { listAddonExternalAuthEntries } from "@/lib/addon-external-auth-providers"
import { getCurrentUser } from "@/lib/auth"
import { readSearchParam } from "@/lib/search-params"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `登录 - ${settings.siteName}`,
    description: `使用邮箱或用户名登录 ${settings.siteName}，继续浏览帖子、参与讨论并管理你的账户。`,
  }
}

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams
  const [user, settings, addonExternalAuthEntries] = await Promise.all([getCurrentUser(), getSiteSettings(), listAddonExternalAuthEntries()])
  const authError = readSearchParam(searchParams?.authError) ?? ""

  if (user) {
    redirect("/")
  }

  return (
    <AuthShell
      showcaseName={settings.siteName}
      showShowcase={settings.authPageShowcaseEnabled}
      panelTitle="登录论坛"
      panelDescription="输入邮箱或用户名和密码，继续你的社区浏览与互动。"
      beforeForm={authError ? <AuthPanelNotice tone="destructive" title="登录失败">{authError}</AuthPanelNotice> : null}
      footer={(
        <div className="grid w-full grid-cols-2 items-center gap-4 text-sm text-muted-foreground">
          <p>
            忘记密码？<Link href="/forgot-password" className="font-medium text-foreground hover:underline">找回密码</Link>
          </p>
          <p className="justify-self-end">
            还没有账户？<Link href="/register" className="font-medium text-foreground hover:underline">去注册</Link>
          </p>
        </div>
      )}
    >
      <LoginForm
        settings={settings}
        addonCaptcha={<AddonSlotRenderer slot="auth.login.captcha" />}
        addonAfterFields={<AddonSlotRenderer slot="auth.login.form.after" />}
        addonExternalAuthEntries={addonExternalAuthEntries}
      />
    </AuthShell>
  )
}
