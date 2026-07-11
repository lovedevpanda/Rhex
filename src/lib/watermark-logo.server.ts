import "server-only"

import { lookup } from "dns/promises"
import { readFile } from "fs/promises"
import { isIP } from "net"

import { buildUploadStoragePath } from "@/lib/upload-path"
import { safeOutboundFetch } from "@/lib/safe-outbound-http"

const WATERMARK_LOGO_FETCH_TIMEOUT_MS = 8_000
const WATERMARK_LOGO_MAX_BYTES = 3 * 1024 * 1024
const WATERMARK_LOGO_MAX_REDIRECTS = 5

function resolveLocalUploadUrlPath(value: string) {
  try {
    const url = new URL(value, "http://local.invalid")
    return url.pathname.replace(/\\/g, "/")
  } catch {
    return value.replace(/\\/g, "/")
  }
}

function isPrivateOrLocalIpAddress(address: string): boolean {
  const normalized = address.toLowerCase()

  if (isIP(normalized) === 4) {
    const parts = normalized.split(".").map((item) => Number.parseInt(item, 10))
    const [first = 0, second = 0] = parts

    return first === 0
      || first === 10
      || first === 127
      || (first === 100 && second >= 64 && second <= 127)
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
  }

  if (isIP(normalized) === 6) {
    if (normalized === "::" || normalized === "::1" || normalized.startsWith("fe80:")) {
      return true
    }

    const firstGroup = Number.parseInt(normalized.split(":")[0] ?? "", 16)
    if (Number.isFinite(firstGroup) && (firstGroup & 0xfe00) === 0xfc00) {
      return true
    }

    const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
    return mappedIpv4 ? isPrivateOrLocalIpAddress(mappedIpv4) : false
  }

  return true
}

async function assertPublicWatermarkLogoUrl(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) {
    return false
  }

  const hostname = url.hostname.trim().toLowerCase()
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    return false
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true }).catch(() => [])

  return addresses.length > 0 && !addresses.some((item) => isPrivateOrLocalIpAddress(item.address))
}

async function readLocalWatermarkLogoBuffer(uploadLocalPath: string | null | undefined, logoPath: string) {
  const match = resolveLocalUploadUrlPath(logoPath).match(/^\/uploads\/([^/]+)\/([^/]+)$/)

  if (!match?.[1] || !match[2]) {
    return null
  }

  const buffer = await readFile(buildUploadStoragePath(uploadLocalPath || "uploads", match[1], match[2]))
  return buffer.byteLength > WATERMARK_LOGO_MAX_BYTES ? null : buffer
}

async function fetchWatermarkLogoBuffer(logoPath: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), WATERMARK_LOGO_FETCH_TIMEOUT_MS)
  let currentUrl = new URL(logoPath)

  try {
    for (let redirectCount = 0; redirectCount <= WATERMARK_LOGO_MAX_REDIRECTS; redirectCount += 1) {
      if (!(await assertPublicWatermarkLogoUrl(currentUrl))) {
        return null
      }

      const response = await safeOutboundFetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8",
          "User-Agent": "Rhex watermark renderer",
        },
      })

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location")
        if (!location) {
          return null
        }

        currentUrl = new URL(location, currentUrl)
        continue
      }

      if (!response.ok) {
        return null
      }

      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? ""
      if (contentType && !contentType.startsWith("image/")) {
        return null
      }

      const contentLength = Number(response.headers.get("content-length") ?? 0)
      if (contentLength > WATERMARK_LOGO_MAX_BYTES) {
        return null
      }

      const arrayBuffer = await response.arrayBuffer()
      return arrayBuffer.byteLength > WATERMARK_LOGO_MAX_BYTES ? null : Buffer.from(arrayBuffer)
    }

    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function resolveWatermarkLogoBuffer(options: {
  logoPath: string
  uploadLocalPath?: string | null
}) {
  const logoPath = options.logoPath.trim()

  if (!logoPath) {
    return null
  }

  try {
    if (resolveLocalUploadUrlPath(logoPath).startsWith("/uploads/")) {
      return await readLocalWatermarkLogoBuffer(options.uploadLocalPath, logoPath)
    }

    if (/^https?:\/\//i.test(logoPath)) {
      return await fetchWatermarkLogoBuffer(logoPath)
    }
  } catch (error) {
    console.warn("[watermark] failed to read image watermark logo, skip logo watermark", error)
  }

  return null
}
