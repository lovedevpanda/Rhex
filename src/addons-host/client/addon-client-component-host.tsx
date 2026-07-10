"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"

import {
  createAddonClientSdk,
  type AddonClientComponent,
  type AddonClientComponentFactory,
} from "@/addons-host/sdk/client"
import { resolveAddonClientImportUrl } from "@/addons-host/client/module-url"

interface AddonClientComponentModule {
  Component?: AddonClientComponent
  createComponent?: AddonClientComponentFactory
}

interface AddonClientComponentErrorBoundaryState {
  hasError: boolean
}

class AddonClientComponentErrorBoundary extends React.Component<
  { fallback?: React.ReactNode; moduleUrl: string; children: React.ReactNode },
  AddonClientComponentErrorBoundaryState
> {
  state: AddonClientComponentErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
    }
  }

  componentDidCatch(error: unknown) {
    console.error(
      "[addons-host] addon client component crashed",
      this.props.moduleUrl,
      error,
    )
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null
    }

    return this.props.children
  }
}

export function AddonClientComponentHost({
  moduleUrl,
  props,
  fallback = null,
}: {
  moduleUrl: string
  props: Record<string, unknown>
  fallback?: React.ReactNode
}) {
  const sdk = useMemo(() => createAddonClientSdk(), [])

  return (
    <AddonClientComponentHostContent
      key={moduleUrl}
      moduleUrl={moduleUrl}
      props={props}
      fallback={fallback}
      sdk={sdk}
    />
  )
}

function AddonClientComponentHostContent({
  moduleUrl,
  props,
  fallback,
  sdk,
}: {
  moduleUrl: string
  props: Record<string, unknown>
  fallback: React.ReactNode
  sdk: ReturnType<typeof createAddonClientSdk>
}) {
  const [LoadedComponent, setLoadedComponent] = useState<AddonClientComponent | null>(null)

  useEffect(() => {
    let disposed = false

    if (!moduleUrl) {
      return
    }

    void (async () => {
      const importUrl = resolveAddonClientImportUrl(moduleUrl)
      if (!importUrl) {
        return
      }

      try {
        const loaded = await import(
          /* webpackIgnore: true */ importUrl
        ) as AddonClientComponentModule
        const Component = typeof loaded.createComponent === "function"
          ? await loaded.createComponent(sdk)
          : loaded.Component

        if (disposed) {
          return
        }

        if (typeof Component !== "function") {
          throw new Error(
            `Addon client component module "${moduleUrl}" must export Component or createComponent(sdk)`,
          )
        }

        setLoadedComponent(() => Component)
      } catch (error) {
        console.error(
          "[addons-host] failed to load addon client component",
          moduleUrl,
          error,
        )
      }
    })()

    return () => {
      disposed = true
    }
  }, [moduleUrl, sdk])

  if (!LoadedComponent) {
    return <>{fallback}</>
  }

  return (
    <AddonClientComponentErrorBoundary fallback={fallback} moduleUrl={moduleUrl}>
      <LoadedComponent {...props} sdk={sdk} />
    </AddonClientComponentErrorBoundary>
  )
}
