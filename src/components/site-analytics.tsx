"use client"

import { useEffect } from "react"

import { parseSiteAnalyticsCode } from "@/lib/site-analytics"

const SITE_ANALYTICS_HOOK_ID = "site-analytics-hook"

const SCRIPT_PROP_ATTRIBUTE_MAP: Record<string, string> = {
  crossOrigin: "crossorigin",
  referrerPolicy: "referrerpolicy",
  noModule: "nomodule",
  fetchPriority: "fetchpriority",
  charSet: "charset",
}

const EMPTY_ANALYTICS_CODE = {
  html: "",
  scripts: [],
}

function isExecutableInlineScript(type: string | undefined) {
  if (!type) {
    return true
  }

  const normalizedType = type.trim().toLowerCase()

  return normalizedType === ""
    || normalizedType === "text/javascript"
    || normalizedType === "application/javascript"
}

export function SiteAnalytics({ code }: { code?: string | null }) {
  const normalizedCode = code?.trim() ?? ""
  const { html } = normalizedCode
    ? parseSiteAnalyticsCode(normalizedCode)
    : EMPTY_ANALYTICS_CODE
  // Analytics code is a trusted administrator capability. It intentionally supports
  // executable snippets and must never receive untrusted/user-provided content.
  const hookProps = html
    ? { dangerouslySetInnerHTML: { __html: html } }
    : {}

  useEffect(() => {
    if (!normalizedCode) {
      return
    }

    const hook = document.getElementById(SITE_ANALYTICS_HOOK_ID)

    if (!hook) {
      return
    }

    const { scripts } = parseSiteAnalyticsCode(normalizedCode)

    if (scripts.length === 0) {
      return
    }

    const injectedScripts: HTMLScriptElement[] = []

    for (const [index, script] of scripts.entries()) {
      const src = typeof script.props.src === "string" ? script.props.src : ""
      const type = typeof script.props.type === "string" ? script.props.type : undefined

      if (!src && isExecutableInlineScript(type) && script.content.trim().length > 0) {
        window.eval(script.content)
        continue
      }

      const element = document.createElement("script")

      for (const [name, value] of Object.entries(script.props)) {
        if (value === undefined || value === null || value === false) {
          continue
        }

        const attributeName = SCRIPT_PROP_ATTRIBUTE_MAP[name] ?? name.toLowerCase()

        if (value === true) {
          element.setAttribute(attributeName, "")
          continue
        }

        element.setAttribute(attributeName, String(value))
      }

      if (!element.id) {
        element.id = `site-analytics-script-${index}`
      }

      if (!element.src && script.content.trim().length > 0) {
        element.text = script.content
      }

      document.head.appendChild(element)
      injectedScripts.push(element)
    }

    return () => {
      for (const script of injectedScripts) {
        script.remove()
      }
    }
  }, [normalizedCode])

  return (
    <>
      <div id={SITE_ANALYTICS_HOOK_ID} data-hook="site-analytics" {...hookProps} />
    </>
  )
}
