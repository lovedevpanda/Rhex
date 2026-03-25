import Link from "next/link"
import { redirect } from "next/navigation"

import { LoginForm } from "@/components/login-form"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { getSiteSettings } from "@/lib/site-settings"

export default async function LoginPage() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSiteSettings()])

  if (user) {
    redirect("/")
  }

  return (
    <div className="min-h-screen ">
      <SiteHeader />
      <main className="mx-auto max-w-[520px] px-4 py-10 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>登录论坛</CardTitle>
          </CardHeader>
          <CardContent>
            <LoginForm settings={settings} />
            <div className="mt-4 space-y-2 text-center text-sm text-muted-foreground">
              <p>
                忘记密码？<Link href="/forgot-password" className="font-medium text-foreground hover:underline">找回密码</Link>
              </p>
              <p>
                还没有账户？<Link href="/register" className="font-medium text-foreground hover:underline">去注册</Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
