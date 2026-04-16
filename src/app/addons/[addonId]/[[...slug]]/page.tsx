import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { AddonRenderBlock, executeAddonPage, isAddonRedirectResult } from "@/addons-host"
import { getSiteSettings } from "@/lib/site-settings"

interface AddonPageProps {
  params: Promise<{
    addonId: string
    slug?: string[]
  }>
}

export async function generateMetadata({ params }: AddonPageProps): Promise<Metadata> {
  const [{ addonId, slug }, settings] = await Promise.all([params, getSiteSettings()])
  const resolved = await executeAddonPage("public", addonId, slug)

  if (!resolved) {
    return {
      title: `插件页面不存在 - ${settings.siteName}`,
    }
  }

  return {
    title: `${resolved.registration.title || resolved.addon.manifest.name} - ${settings.siteName}`,
    description: resolved.registration.description || resolved.addon.manifest.description,
  }
}

export default async function AddonPublicPage({ params }: AddonPageProps) {
  const { addonId, slug } = await params
  const resolved = await executeAddonPage("public", addonId, slug)

  if (!resolved) {
    notFound()
  }

  if (isAddonRedirectResult(resolved.result)) {
    redirect(resolved.result.redirectTo)
  }

  const renderResult = resolved.result
  const renderBlockKey = `${resolved.addon.manifest.id}:${resolved.registration.key}:page`

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{resolved.addon.manifest.id}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{resolved.registration.title || resolved.addon.manifest.name}</h1>
        {resolved.registration.description || resolved.addon.manifest.description ? (
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
            {resolved.registration.description || resolved.addon.manifest.description}
          </p>
        ) : null}
      </section>

      <AddonRenderBlock addonId={resolved.addon.manifest.id} blockKey={renderBlockKey} result={renderResult} />
    </main>
  )
}
