"use client"

import * as React from "react"
import type { Root } from "react-dom/client"

import {
  createAddonClientSdk,
  type AddonClientComponent,
  type AddonClientComponentFactory,
  type AddonClientSdk,
} from "@/addons-host/sdk/client"

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
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const serializedProps = React.useMemo(() => JSON.stringify(props ?? {}), [props])
  const stableProps = React.useMemo(
    () => JSON.parse(serializedProps) as Record<string, unknown>,
    [serializedProps]
  )
  const sdk = React.useMemo(() => createAddonClientSdk(), [])
  const componentRootRef = React.useRef<Root | null>(null)
  const [ready, setReady] = React.useState(false)

  const unmountComponentRoot = React.useCallback(async () => {
    const root = componentRootRef.current
    if (!root) {
      return
    }

    componentRootRef.current = null

    await new Promise<void>((resolve) => {
      queueMicrotask(() => {
        root.unmount()
        resolve()
      })
    })
  }, [])

  React.useEffect(() => {
    let cleanup: (() => void | Promise<void>) | null = null
    let disposed = false
    let shouldClearContainer = true
    const container = containerRef.current

    setReady(false)

    if (!container || !moduleUrl) {
      return
    }

    void (async () => {
      try {
        const loaded = await import(/* webpackIgnore: true */ moduleUrl) as AddonClientModule
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

          const root = componentRootRef.current ?? sdk.createRoot(container)
          componentRootRef.current = root
          root.render(
            <AddonClientErrorBoundary key={moduleUrl} fallback={fallback} moduleUrl={moduleUrl}>
              <Component {...stableProps} sdk={sdk} />
            </AddonClientErrorBoundary>
          )
          setReady(true)
          return
        }

        await unmountComponentRoot()
        if (disposed) {
          return
        }

        const mount = loaded.mount ?? loaded.default

        if (typeof mount !== "function") {
          throw new Error(`Addon client module "${moduleUrl}" does not export mount(container, props, sdk)`)
        }

        const mounted = await mount(container, stableProps, sdk)
        if (disposed) {
          if (typeof mounted === "function") {
            await mounted()
          }
          return
        }

        if (typeof mounted === "function") {
          cleanup = mounted
        } else if (typeof loaded.unmount === "function") {
          cleanup = () => loaded.unmount?.(container, sdk)
        }
        setReady(true)
      } catch (error) {
        console.error("[addons-host] failed to mount addon client module", moduleUrl, error)
        setReady(false)
      }
    })()

    return () => {
      disposed = true
      setReady(false)
      if (cleanup) {
        void cleanup()
      }
      if (shouldClearContainer && container) {
        container.innerHTML = ""
      }
    }
  }, [fallback, moduleUrl, sdk, stableProps, unmountComponentRoot])

  React.useEffect(() => {
    return () => {
      void unmountComponentRoot()
    }
  }, [unmountComponentRoot])

  return (
    <>
      {!ready ? fallback : null}
      <div
        ref={containerRef}
        data-addon-client-module={moduleUrl}
        hidden={!ready && Boolean(fallback)}
      />
    </>
  )
}
