import Link from "next/link"
import { redirect } from "next/navigation"

import { ForgotPasswordForm } from "@/components/forgot-password-form"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser()

  if (user) {
    redirect("/")
  }

  return (
    <div className="min-h-screen ">
      <SiteHeader />
      <main className="mx-auto max-w-[560px] px-4 py-10 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>找回密码</CardTitle>
          </CardHeader>
          <CardContent>
            <ForgotPasswordForm />
            <p className="mt-4 text-center text-sm text-muted-foreground">
              想起密码了？<Link href="/login" className="font-medium text-foreground hover:underline">返回登录</Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
