"use client"

import { useMemo } from "react"

import { AddonClientComponentHost } from "@/addons-host/client/addon-client-component-host"
import { usePreferredAddonSurfaceOverride } from "@/addons-host/client/addon-runtime-provider"
import type { AddonSurfaceKey } from "@/addons-host/types"

export function AddonSurfaceClientRenderer({
  surface,
  surfaceProps,
  fallback = null,
}: {
  surface: AddonSurfaceKey
  surfaceProps?: Record<string, unknown>
  fallback?: React.ReactNode
}) {
  const override = usePreferredAddonSurfaceOverride(surface)

  const props = useMemo(
    () => ({
      ...(surfaceProps ?? {}),
      surface,
      addonId: override?.addonId ?? "",
    }),
    [override?.addonId, surface, surfaceProps],
  )

  if (!override?.clientModuleUrl) {
    return <>{fallback}</>
  }

  return (
    <AddonClientComponentHost
      moduleUrl={override.clientModuleUrl}
      props={props}
      fallback={fallback}
    />
  )
}
