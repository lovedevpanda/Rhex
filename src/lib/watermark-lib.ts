import type { ImageWatermarkPosition } from "@/lib/site-settings-app-state"

export type WatermarkRgbColor = {
  red: number
  green: number
  blue: number
}

export type WatermarkRenderPresentation = {
  color: string
  colorRgb: WatermarkRgbColor
  fontFamily: string
  fontSize: number
  letterSpacing: number
  lineHeight: number
  margin: number
  maxTextWidth: number
  opacityRatio: number
  shadowBlur: number
  shadowColor: string
  shadowOffsetX: number
  shadowOffsetY: number
  text: string
}

export const WATERMARK_FONT_ALIAS = "BBS Watermark"
export const WATERMARK_DEFAULT_FONT_FAMILY = `"${WATERMARK_FONT_ALIAS}","Microsoft YaHei","Noto Sans SC","PingFang SC","Hiragino Sans GB","Source Han Sans SC",sans-serif`
export const WATERMARK_PREVIEW_WIDTH = 1280
export const WATERMARK_PREVIEW_HEIGHT = 720

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function normalizeHexColorToRgb(hexColor: string): WatermarkRgbColor {
  const normalized = hexColor.trim().replace(/^#/, "")
  const expanded = normalized.length === 3
    ? normalized.split("").map((char) => `${char}${char}`).join("")
    : normalized

  const red = Number.parseInt(expanded.slice(0, 2), 16)
  const green = Number.parseInt(expanded.slice(2, 4), 16)
  const blue = Number.parseInt(expanded.slice(4, 6), 16)

  return {
    red: Number.isFinite(red) ? red : 255,
    green: Number.isFinite(green) ? green : 255,
    blue: Number.isFinite(blue) ? blue : 255,
  }
}

export function normalizeWatermarkHexColor(color: string) {
  const trimmed = color.trim()

  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed.toUpperCase()
  }

  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const expanded = trimmed
      .slice(1)
      .split("")
      .map((char) => `${char}${char}`)
      .join("")

    return `#${expanded.toUpperCase()}`
  }

  return "#FFFFFF"
}

export function normalizeWatermarkText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, index, lines) => line.length > 0 || index < lines.length - 1)
    .join("\n")
    .trim()
}

export function normalizeWatermarkFontFamily(value: unknown) {
  return typeof value === "string"
    ? value
      .replace(/[;\r\n\t]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240)
    : ""
}

export function resolveWatermarkFontFamily(value: unknown) {
  const customFontFamily = normalizeWatermarkFontFamily(value)

  if (!customFontFamily) {
    return WATERMARK_DEFAULT_FONT_FAMILY
  }

  return `${customFontFamily}, ${WATERMARK_DEFAULT_FONT_FAMILY}`
}

export function resolveWatermarkPresentation(options: {
  color: string
  fontSize: number
  fontFamily?: string
  margin: number
  opacity: number
  text: string
  width: number
}) {
  const normalizedColor = normalizeWatermarkHexColor(options.color || "#FFFFFF")
  const colorRgb = normalizeHexColorToRgb(normalizedColor)
  const fontSize = clamp(Math.round(options.fontSize || 24), 10, 256)
  const margin = clamp(Math.round(options.margin || 24), 0, Math.max(0, Math.floor(options.width / 3)))
  const opacityRatio = clamp(Number.isFinite(options.opacity) ? options.opacity / 100 : 0.22, 0, 1)
  const letterSpacing = Math.max(0, Math.round(fontSize * 0.04))
  const lineHeight = Math.max(fontSize + 8, Math.round(fontSize * 1.28))
  const maxTextWidth = Math.max(96, Math.min(options.width - margin * 2, Math.round(options.width * 0.58)))
  const shadowOffsetX = Math.max(1, Math.round(fontSize * 0.08))
  const shadowOffsetY = Math.max(1, Math.round(fontSize * 0.12))
  const shadowBlur = Math.max(8, Math.round(fontSize * 0.78))

  return {
    color: normalizedColor,
    colorRgb,
    fontFamily: resolveWatermarkFontFamily(options.fontFamily),
    fontSize,
    letterSpacing,
    lineHeight,
    margin,
    maxTextWidth,
    opacityRatio,
    shadowBlur,
    shadowColor: `rgba(15, 23, 42, ${Math.min(0.75, opacityRatio * 0.9).toFixed(3)})`,
    shadowOffsetX,
    shadowOffsetY,
    text: normalizeWatermarkText(options.text),
  } satisfies WatermarkRenderPresentation
}

export function resolveWatermarkPlacement(options: {
  width: number
  height: number
  overlayWidth: number
  overlayHeight: number
  position: ImageWatermarkPosition
  margin: number
}) {
  const { width, height, overlayWidth, overlayHeight, position, margin } = options

  switch (position) {
    case "TOP_LEFT":
      return { x: margin, y: margin }
    case "TOP_RIGHT":
      return { x: Math.max(0, width - overlayWidth - margin), y: margin }
    case "BOTTOM_LEFT":
      return { x: margin, y: Math.max(0, height - overlayHeight - margin) }
    case "CENTER":
      return { x: Math.max(0, Math.round((width - overlayWidth) / 2)), y: Math.max(0, Math.round((height - overlayHeight) / 2)) }
    case "BOTTOM_RIGHT":
    default:
      return { x: Math.max(0, width - overlayWidth - margin), y: Math.max(0, height - overlayHeight - margin) }
  }
}

export function isRightAlignedWatermark(position: ImageWatermarkPosition) {
  return position.endsWith("RIGHT")
}

export function isCenteredWatermark(position: ImageWatermarkPosition) {
  return position === "CENTER"
}
