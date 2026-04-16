import { redirect } from "next/navigation"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { PendingExternalAuthPanel } from "@/components/auth/pending-external-auth-panel"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { readPendingExternalAuthState } from "@/lib/auth-flow-state"

export default async function ExternalAuthCompletePage() {
  const pendingState = await readPendingExternalAuthState()

  if (!pendingState) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[560px] px-4 py-10 lg:px-6">
        <AddonSlotRenderer slot="auth.complete.page.before" />
        <AddonSurfaceRenderer surface="auth.complete.page" props={{ pendingState }}>
          <>
            <AddonSlotRenderer slot="auth.complete.panel.before" />
            <AddonSurfaceRenderer surface="auth.complete.panel" props={{ pendingState }}>
              <Card>
                <CardHeader>
                  <CardTitle>{pendingState.kind === "email_bind_required" ? "绑定已有账户" : "补充用户名"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <PendingExternalAuthPanel state={pendingState} />
                </CardContent>
              </Card>
            </AddonSurfaceRenderer>
            <AddonSlotRenderer slot="auth.complete.panel.after" />
          </>
        </AddonSurfaceRenderer>
        <AddonSlotRenderer slot="auth.complete.page.after" />
      </main>
    </div>
  )
}
