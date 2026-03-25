import { notFound } from "next/navigation"

import { SiteHeader } from "@/components/site-header"

import { getPluginInstallation } from "@/lib/plugins"
import { loadPluginPage } from "@/lib/plugin-loader"

interface PluginFunPageProps {
  params: {
    plugin: string
  }
}

export default async function PluginFunPage({ params }: PluginFunPageProps) {
  const installed = await getPluginInstallation(params.plugin)
  if (!installed || !installed.enabled) {
    notFound()
  }

  const loaded = await loadPluginPage(installed.pluginId, "web")
  if (!loaded) {
    notFound()
  }

  const PluginComponent = loaded.component as React.ComponentType<{ pluginId: string; config: Record<string, boolean | number | string> }>

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-4 py-8">
        <div className="space-y-6">
      
          <PluginComponent pluginId={installed.pluginId} config={installed.config} />
        </div>
      </div>
    </div>
  )
}
