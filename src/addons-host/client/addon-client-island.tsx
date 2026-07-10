"use client"

import * as React from "react"

import {
  createAddonClientSdk,
  type AddonClientComponent,
  type AddonClientComponentFactory,
  type AddonClientSdk,
} from "@/addons-host/sdk/client"
import { resolveAddonClientImportUrl } from "@/addons-host/client/module-url"

interface AddonClientIslandProps {
  moduleUrl: string
  props?: Record<string, unknown>
  fallback?: React.ReactNode
}

interface AddonClientModule {
  default?: AddonClientMount
  mount?: AddonClientMount
  unmount?: AddonClientUnmount
  Component?: AddonClientComponent
  createComponent?: AddonClientComponentFactory
}

type AddonClientMount = (
  container: HTMLElement,
  props: Record<string, unknown>,
  sdk: AddonClientSdk,
) => void | (() => void) | Promise<void | (() => void)>
type AddonClientUnmount = (container: HTMLElement, sdk: AddonClientSdk) => void | Promise<void>

interface AddonClientErrorBoundaryState {
  errorMessage: string | null
}

function scheduleAddonCleanup({
  cleanup,
  container,
  shouldClearContainer,
  moduleUrl,
}: {
  cleanup: (() => void | Promise<void>) | null
  container: HTMLElement | null
  shouldClearContainer: boolean
  moduleUrl: string
}) {
  window.setTimeout(() => {
    const clearContainer = () => {
      if (shouldClearContainer && container) {
        container.innerHTML = ""
      }
    }

    if (!cleanup) {
      clearContainer()
      return
    }

    void Promise.resolve(cleanup())
      .catch((error) => {
        console.error("[addons-host] failed to cleanup addon client module", moduleUrl, error)
      })
      .finally(clearContainer)
  }, 0)
}

function resolveAddonCleanup({
  mounted,
  loaded,
  container,
  sdk,
}: {
  mounted: void | (() => void | Promise<void>)
  loaded: AddonClientModule
  container: HTMLElement
  sdk: AddonClientSdk
}) {
  if (typeof mounted === "function") {
    return mounted
  }

  if (typeof loaded.unmount === "function") {
    return () => loaded.unmount?.(container, sdk)
  }

  return null
}

class AddonClientErrorBoundary extends React.Component<
  { fallback?: React.ReactNode; moduleUrl: string; children: React.ReactNode },
  AddonClientErrorBoundaryState
> {
  state: AddonClientErrorBoundaryState = {
    errorMessage: null,
  }

  static getDerivedStateFromError(error: unknown): AddonClientErrorBoundaryState {
    return {
      errorMessage: error instanceof Error ? error.message : "插件组件渲染失败",
    }
  }

  componentDidCatch(error: unknown) {
    console.error("[addons-host] addon component crashed", this.props.moduleUrl, error)
  }

  render() {
    if (this.state.errorMessage) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          data-addon-client-error={this.props.moduleUrl}
          style={{
            border: "1px solid rgba(239, 68, 68, 0.28)",
            borderRadius: 16,
            background: "rgba(254, 242, 242, 0.95)",
            color: "#b91c1c",
            padding: "0.85rem 1rem",
            fontSize: 13,
          }}
        >
          {this.state.errorMessage}
        </div>
      )
    }

    return this.props.children
  }
}

export function AddonClientIsland({ moduleUrl, props, fallback = null }: AddonClientIslandProps) {
  const serializedProps = React.useMemo(() => JSON.stringify(props ?? {}), [props])
  const mountHostKey = React.useMemo(() => `${moduleUrl}:${serializedProps}`, [moduleUrl, serializedProps])
  const stableProps = React.useMemo(
    () => JSON.parse(serializedProps) as Record<string, unknown>,
    [serializedProps],
  )
  const sdk = React.useMemo(() => createAddonClientSdk(), [])

  return (
    <AddonClientIslandMountHost
      key={mountHostKey}
      moduleUrl={moduleUrl}
      stableProps={stableProps}
      fallback={fallback}
      sdk={sdk}
      mountHostKey={mountHostKey}
    />
  )
}

function AddonClientIslandMountHost({
  moduleUrl,
  stableProps,
  fallback,
  sdk,
  mountHostKey,
}: {
  moduleUrl: string
  stableProps: Record<string, unknown>
  fallback: React.ReactNode
  sdk: AddonClientSdk
  mountHostKey: string
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [ready, setReady] = React.useState(false)
  const [LoadedComponent, setLoadedComponent] = React.useState<AddonClientComponent | null>(null)

  React.useEffect(() => {
    let cleanup: (() => void | Promise<void>) | null = null
    let disposed = false
    let shouldClearContainer = true
    const container = containerRef.current

    if (!moduleUrl) {
      return
    }

    void (async () => {
      const importUrl = resolveAddonClientImportUrl(moduleUrl)
      if (!importUrl) {
        return
      }

      try {
        const loaded = await import(/* webpackIgnore: true */ importUrl) as AddonClientModule
        if (disposed) {
          return
        }

        if (typeof loaded.createComponent === "function" || typeof loaded.Component === "function") {
          const Component = typeof loaded.createComponent === "function"
            ? await loaded.createComponent(sdk)
            : loaded.Component

          if (typeof Component !== "function") {
            throw new Error(`Addon client module "${moduleUrl}" does not export a valid component`)
          }

          if (disposed) {
            return
          }

          shouldClearContainer = false
          setLoadedComponent(() => Component)
          setReady(true)
          return
        }

        if (!container) {
          throw new Error(`Addon client module "${moduleUrl}" requires a mount container`)
        }

        if (disposed) {
          return
        }

        const mount = loaded.mount ?? loaded.default

        if (typeof mount !== "function") {
          throw new Error(`Addon client module "${moduleUrl}" does not export mount(container, props, sdk)`)
        }

        const mounted = await mount(container, stableProps, sdk)
        if (disposed) {
          scheduleAddonCleanup({
            cleanup: resolveAddonCleanup({ mounted, loaded, container, sdk }),
            container,
            shouldClearContainer,
            moduleUrl,
          })
          return
        }

        cleanup = resolveAddonCleanup({ mounted, loaded, container, sdk })
        setReady(true)
      } catch (error) {
        console.error("[addons-host] failed to mount addon client module", moduleUrl, error)
        setReady(false)
      }
    })()

    return () => {
      disposed = true
      scheduleAddonCleanup({
        cleanup,
        container,
        shouldClearContainer,
        moduleUrl,
      })
    }
  }, [moduleUrl, sdk, stableProps])

  return (
    <>
      {!ready ? fallback : null}
      {LoadedComponent ? (
        <AddonClientErrorBoundary key={moduleUrl} fallback={fallback} moduleUrl={moduleUrl}>
          <LoadedComponent {...stableProps} sdk={sdk} />
        </AddonClientErrorBoundary>
      ) : (
        <div
          key={mountHostKey}
          ref={containerRef}
          data-addon-client-module={moduleUrl}
          hidden={!ready && Boolean(fallback)}
        />
      )}
    </>
  )
}
