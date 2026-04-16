import Script from "next/script"
import { Fragment } from "react"

import { AddonClientIsland } from "@/addons-host/client/addon-client-island"
import {
  executeAddonSlot,
  executeAddonSurface,
  executeAddonSurfaceRender,
} from "@/addons-host/runtime/execute"
import type {
  AddonSurfaceKey,
  AddonSurfaceProps,
  AddonRenderResult,
  AddonScriptDescriptor,
  AddonSlotProps,
  AddonStyleDescriptor,
  AddonSlotKey,
} from "@/addons-host/types"

function normalizeStyleDescriptor(value: string | AddonStyleDescriptor): AddonStyleDescriptor {
  return typeof value === "string" ? { href: value } : value
}

function normalizeScriptDescriptor(value: string | AddonScriptDescriptor): AddonScriptDescriptor {
  return typeof value === "string" ? { src: value, strategy: "afterInteractive" } : value
}

function withAddonClientModuleVersion(moduleUrl: string, blockKey: string) {
  if (process.env.NODE_ENV === "production") {
    return moduleUrl
  }

  const separator = moduleUrl.includes("?") ? "&" : "?"
  return `${moduleUrl}${separator}v=${encodeURIComponent(`${blockKey}:${Date.now()}`)}`
}

export function AddonRenderBlock({
  addonId,
  blockKey,
  result,
  fallback = null,
}: {
  addonId: string
  blockKey: string
  result: AddonRenderResult
  fallback?: React.ReactNode
}) {
  const Tag = result.containerTag ?? "div"
  const textContent = result.text?.trim() ?? ""
  const normalizedStylesheets = (result.stylesheets ?? []).map(normalizeStyleDescriptor)
  const normalizedScripts = (result.scripts ?? []).map(normalizeScriptDescriptor)
  const clientModuleUrl = result.clientModule
    ? withAddonClientModuleVersion(result.clientModule, blockKey)
    : null
  const islandFallback = !result.html && !textContent ? fallback : null

  return (
    <>
      {normalizedStylesheets.map((item, index) => (
        <style
          key={`${blockKey}:style:${index}`}
          dangerouslySetInnerHTML={{
            __html: item.media
              ? `@import url("${item.href}") ${item.media};`
              : `@import url("${item.href}");`,
          }}
        />
      ))}
      {result.html ? (
        <Tag
          data-addon-id={addonId}
          data-addon-block={blockKey}
          className={result.containerClassName}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: result.html }}
        />
      ) : null}
      {clientModuleUrl ? (
        <AddonClientIsland moduleUrl={clientModuleUrl} props={result.clientProps} fallback={islandFallback} />
      ) : null}
      {!result.html && textContent ? (
        <Tag
          data-addon-id={addonId}
          data-addon-block={blockKey}
          className={result.containerClassName}
        >
          {textContent}
        </Tag>
      ) : null}
      {result.inlineScripts?.map((script, index) => (
        <Script
          key={`${blockKey}:inline-script:${index}`}
          id={`${blockKey}:inline-script:${index}`}
          strategy="afterInteractive"
          data-addon-id={addonId}
          data-addon-block={blockKey}
        >
          {script}
        </Script>
      ))}
      {normalizedScripts.map((item, index) => (
        <Script
          key={`${blockKey}:script:${index}`}
          id={`${blockKey}:script:${index}`}
          src={item.src}
          strategy={item.strategy ?? "afterInteractive"}
          type={item.type}
          data-addon-id={addonId}
          data-addon-block={blockKey}
        />
      ))}
    </>
  )
}

export async function AddonSurfaceRenderer<
  TProps extends AddonSurfaceProps = AddonSurfaceProps,
>({
  surface,
  props,
  pathname,
  children,
}: {
  surface: AddonSurfaceKey
  props?: TProps
  pathname?: string
  children: React.ReactNode
}) {
  const resolved = await executeAddonSurface(surface, (props ?? {}) as TProps, {
    pathname,
  })

  if (!resolved) {
    return <>{children}</>
  }

  return (
    <AddonRenderBlock
      addonId={resolved.addon.manifest.id}
      blockKey={`${resolved.addon.manifest.id}:${resolved.registration.key}:surface:${surface}`}
      result={resolved.result}
      fallback={children}
    />
  )
}

export async function AddonSurfaceRenderBoundary<
  TProps extends AddonSurfaceProps = AddonSurfaceProps,
>({
  surface,
  props,
  pathname,
  children,
}: {
  surface: AddonSurfaceKey
  props?: TProps
  pathname?: string
  children: React.ReactNode
}) {
  const resolved = await executeAddonSurfaceRender(surface, (props ?? {}) as TProps, {
    pathname,
  })

  if (!resolved) {
    return <>{children}</>
  }

  return (
    <AddonRenderBlock
      addonId={resolved.addon.manifest.id}
      blockKey={`${resolved.addon.manifest.id}:${resolved.registration.key}:surface:${surface}:render`}
      result={resolved.result}
      fallback={children}
    />
  )
}

export async function AddonSlotRenderer<
  TProps extends AddonSlotProps = AddonSlotProps,
>({
  slot,
  props,
  pathname,
}: {
  slot: AddonSlotKey
  props?: TProps
  pathname?: string
}) {
  const blocks = await executeAddonSlot(slot, (props ?? {}) as TProps, {
    pathname,
  })

  if (blocks.length === 0) {
    return null
  }

  return (
    <>
      {blocks.map((block) => {
        const blockKey = `${block.addon.manifest.id}:${block.key}`

        return (
          <Fragment key={blockKey}>
            <AddonRenderBlock addonId={block.addon.manifest.id} blockKey={blockKey} result={block.result} />
          </Fragment>
        )
      })}
    </>
  )
}
