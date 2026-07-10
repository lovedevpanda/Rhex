"use client"

import Script from "next/script"
import { usePathname } from "next/navigation"
import { Fragment, useEffect, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"

import { AddonClientIslandLoader } from "@/addons-host/client/addon-client-island-loader"
import type {
  GlobalLayoutAddonSlotBlock,
  GlobalLayoutAddonSlotsPayload,
} from "@/addons-host/global-layout-addon-slots-types"
import type {
  AddonRenderResult,
  AddonScriptDescriptor,
  AddonStyleDescriptor,
} from "@/addons-host/types"

type ApiSuccess<T> = {
  code: 0
  data: T
}

const payloadCache = new Map<string, GlobalLayoutAddonSlotsPayload>()

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

function normalizePathname(value: string | null) {
  if (!value) {
    return "/"
  }

  return value === "/" ? "/" : value.replace(/\/+$/g, "")
}

function seedPayloadCache(payload: GlobalLayoutAddonSlotsPayload | null | undefined) {
  if (!payload) {
    return
  }

  payloadCache.set(normalizePathname(payload.pathname), payload)
}

const subscribeToHydration = () => () => undefined

function HeadPortal({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  )

  if (!mounted) {
    return null
  }

  return createPortal(children, document.head)
}

function AddonRenderBlock({
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
        <link
          key={`${blockKey}:style:${index}`}
          rel="stylesheet"
          href={item.href}
          media={item.media}
          data-addon-id={addonId}
          data-addon-block={blockKey}
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
        <AddonClientIslandLoader moduleUrl={clientModuleUrl} props={result.clientProps} fallback={islandFallback} />
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

function renderBlocks(blocks: GlobalLayoutAddonSlotBlock[], namespace: string) {
  return blocks.map((block) => {
    const blockKey = `${block.addonId}:${block.key}:${namespace}`

    return (
      <Fragment key={blockKey}>
        <AddonRenderBlock addonId={block.addonId} blockKey={blockKey} result={block.result} />
      </Fragment>
    )
  })
}

async function fetchPayload(pathname: string, signal: AbortSignal) {
  const response = await fetch(`/api/addons/global-layout-slots?pathname=${encodeURIComponent(pathname)}`, {
    cache: "no-store",
    credentials: "same-origin",
    signal,
  })
  const result = await response.json() as ApiSuccess<GlobalLayoutAddonSlotsPayload> | { message?: string }

  if (!response.ok || !("code" in result) || result.code !== 0) {
    throw new Error("message" in result && result.message ? result.message : "全局插件插槽加载失败")
  }

  return result.data
}

export function GlobalLayoutAddonSlots({
  initialPayload = null,
}: {
  initialPayload?: GlobalLayoutAddonSlotsPayload | null
}) {
  const pathname = normalizePathname(usePathname())
  const [fetchedPayload, setFetchedPayload] = useState<GlobalLayoutAddonSlotsPayload | null>(null)
  const initialPayloadForPath = initialPayload
    && normalizePathname(initialPayload.pathname) === pathname
    ? initialPayload
    : null
  const payload = initialPayloadForPath
    ?? (fetchedPayload && normalizePathname(fetchedPayload.pathname) === pathname
      ? fetchedPayload
      : payloadCache.get(pathname) ?? null)

  useEffect(() => {
    seedPayloadCache(initialPayload)

    const controller = new AbortController()

    void fetchPayload(pathname, controller.signal)
      .then((nextPayload) => {
        payloadCache.set(pathname, nextPayload)
        setFetchedPayload(nextPayload)
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error("[global-layout-addon-slots] failed to load", error)
        }
      })

    return () => {
      controller.abort()
    }
  }, [initialPayload, pathname])

  if (!payload) {
    return null
  }

  return (
    <>
      <HeadPortal>
        {renderBlocks(payload.slots.headBefore, "head-before")}
        {renderBlocks(payload.slots.headAfter, "head-after")}
      </HeadPortal>
      {renderBlocks(payload.slots.bodyStart, "body-start")}
      {renderBlocks(payload.slots.bodyEnd, "body-end")}
    </>
  )
}
