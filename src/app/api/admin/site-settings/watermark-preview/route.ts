import { createAdminRouteHandler } from "@/lib/api-route"
import { createWatermarkPreviewImageBuffer } from "@/lib/watermark-lib.server"
import type { ImageWatermarkPosition } from "@/lib/site-settings-app-state"

const WATERMARK_POSITIONS: ImageWatermarkPosition[] = ["TOP_LEFT", "TOP_RIGHT", "BOTTOM_LEFT", "BOTTOM_RIGHT", "CENTER"]

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseBoolean(value: string | null, fallback: boolean) {
  if (value === null) {
    return fallback
  }

  return value === "1" || value.toLowerCase() === "true"
}

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parsePosition(value: string | null, fallback: ImageWatermarkPosition) {
  if (value && WATERMARK_POSITIONS.includes(value as ImageWatermarkPosition)) {
    return value as ImageWatermarkPosition
  }

  return fallback
}

export const GET = createAdminRouteHandler(async ({ request }) => {
  const searchParams = new URL(request.url).searchParams
  const pngBuffer = await createWatermarkPreviewImageBuffer({
    enabled: parseBoolean(searchParams.get("enabled"), true),
    text: searchParams.get("text") ?? "",
    position: parsePosition(searchParams.get("position"), "BOTTOM_RIGHT"),
    tiled: parseBoolean(searchParams.get("tiled"), false),
    opacity: parseNumber(searchParams.get("opacity"), 22),
    fontSize: parseNumber(searchParams.get("fontSize"), 24),
    fontFamily: searchParams.get("fontFamily") ?? "",
    margin: parseNumber(searchParams.get("margin"), 24),
    color: searchParams.get("color") ?? "#FFFFFF",
  })

  return new Response(new Uint8Array(pngBuffer), {
    headers: {
      "Cache-Control": "private, no-store, no-cache, max-age=0",
      "Content-Type": "image/png",
    },
  })
}, {
  errorMessage: "生成水印预览失败",
  logPrefix: "[api/admin/site-settings/watermark-preview] unexpected error",
  unauthorizedMessage: "无权操作",
})
