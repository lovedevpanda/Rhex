"use client"

import { useEffect, useState } from "react"

interface AddonClientComponentHostLoaderProps {
  moduleUrl: string
  props: Record<string, unknown>
  fallback?: React.ReactNode
}

type AddonClientComponentHostComponent = typeof import("@/addons-host/client/addon-client-component-host")["AddonClientComponentHost"]

export function AddonClientComponentHostLoader({ moduleUrl, props, fallback = null }: AddonClientComponentHostLoaderProps) {
  const [AddonClientComponentHost, setAddonClientComponentHost] = useState<AddonClientComponentHostComponent | null>(null)

  useEffect(() => {
    let cancelled = false

    void import("@/addons-host/client/addon-client-component-host").then((module) => {
      if (!cancelled) {
        setAddonClientComponentHost(() => module.AddonClientComponentHost)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (!AddonClientComponentHost) {
    return <>{fallback}</>
  }

  return <AddonClientComponentHost moduleUrl={moduleUrl} props={props} fallback={fallback} />
}

