import fs from "fs"
import path from "path"

import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from "@napi-rs/canvas"

import type { ImageWatermarkPosition } from "@/lib/site-settings-app-state"
import {
  isCenteredWatermark,
  isRightAlignedWatermark,
  resolveWatermarkPlacement,
  resolveWatermarkPresentation,
  WATERMARK_FONT_ALIAS,
  WATERMARK_PREVIEW_HEIGHT,
  WATERMARK_PREVIEW_WIDTH,
  WATERMARK_TEXT_MAX_LINES,
  type WatermarkRenderPresentation,
} from "@/lib/watermark-lib"

type WatermarkRenderableSettings = {
  color: string
  fontSize: number
  fontFamily: string
  margin: number
  opacity: number
  position: ImageWatermarkPosition
  text: string
  tiled: boolean
}

type WatermarkLineLayout = {
  text: string
  width: number
}

type PreparedWatermarkLayout = {
  contentHeight: number
  contentWidth: number
  lines: WatermarkLineLayout[]
  paddingX: number
  paddingY: number
  presentation: WatermarkRenderPresentation
  // Shared character-width cache built during wrap/layout and reused by the
  // draw phase. Previously each of wrapWatermarkText / buildWatermarkLineLayouts
  // / drawSpacedText operated with its own Map (or no cache at all), so every
  // character was measured 2–N+1 times. Keyed by `${ctx.font}::${character}`,
  // so sharing is only valid while the same `ctx.font` is in effect — which
  // is the case across prepare/draw on a single canvas.
  widthCache: Map<string, number>
}

type GlobalWatermarkRuntimeState = {
  __bbsWatermarkFontStatus?: "ready" | "failed"
  __bbsWatermarkFontWarningLogged?: boolean
}

const globalForWatermarkRuntime = globalThis as typeof globalThis & GlobalWatermarkRuntimeState
const WATERMARK_FONT_CANDIDATE_PATHS = [
  path.join(process.cwd(), "public", "fonts", "zhi-mang-xing.ttf")
]
const TOKEN_PATTERN = /[\u3400-\u9fff]|[A-Za-z0-9@#&_.:/+\-]+|\s+|./gu
const JPEG_QUALITY = 92

function resolveWatermarkFontPath() {
  return WATERMARK_FONT_CANDIDATE_PATHS.find((candidatePath) => fs.existsSync(candidatePath)) ?? null
}

function ensureWatermarkFontRegistered() {
  if (globalForWatermarkRuntime.__bbsWatermarkFontStatus === "ready") {
    return true
  }

  if (globalForWatermarkRuntime.__bbsWatermarkFontStatus === "failed") {
    return false
  }

  try {
    if (!GlobalFonts.has(WATERMARK_FONT_ALIAS)) {
      const fontPath = resolveWatermarkFontPath()
      if (!fontPath) {
        throw new Error(`No watermark font file found in ${WATERMARK_FONT_CANDIDATE_PATHS.join(", ")}`)
      }

      const registered = GlobalFonts.registerFromPath(fontPath, WATERMARK_FONT_ALIAS)

      if (!registered) {
        throw new Error(`Failed to register watermark font from ${fontPath}`)
      }
    }

    globalForWatermarkRuntime.__bbsWatermarkFontStatus = "ready"
    return true
  } catch (error) {
    globalForWatermarkRuntime.__bbsWatermarkFontStatus = "failed"

    if (!globalForWatermarkRuntime.__bbsWatermarkFontWarningLogged) {
      console.warn("[watermark] failed to register custom watermark font, fallback to system fonts", error)
      globalForWatermarkRuntime.__bbsWatermarkFontWarningLogged = true
    }

    return false
  }
}

function buildFontSpec(fontSize: number, fontFamily: string) {
  return `${fontSize}px ${fontFamily}`
}

function tokenizeWatermarkParagraph(value: string) {
  return value.match(TOKEN_PATTERN) ?? []
}

function measureCharacterWidth(ctx: SKRSContext2D, character: string, cache: Map<string, number>) {
  const cacheKey = `${ctx.font}::${character}`

  if (!cache.has(cacheKey)) {
    cache.set(cacheKey, ctx.measureText(character).width)
  }

  return cache.get(cacheKey) ?? 0
}

function measureSpacedTextWidth(ctx: SKRSContext2D, value: string, letterSpacing: number, cache: Map<string, number>) {
  const characters = Array.from(value)

  if (characters.length === 0) {
    return 0
  }

  let width = 0
  for (let index = 0; index < characters.length; index += 1) {
    width += measureCharacterWidth(ctx, characters[index] ?? "", cache)

    if (index < characters.length - 1) {
      width += letterSpacing
    }
  }

  return width
}

function splitTokenToFit(ctx: SKRSContext2D, token: string, maxWidth: number, letterSpacing: number, cache: Map<string, number>, maxParts = WATERMARK_TEXT_MAX_LINES) {
  const parts: string[] = []
  let current = ""

  for (const character of Array.from(token)) {
    // Early exit: once we have enough parts to fill the allowed line budget,
    // stop scanning the rest of the token. This bounds splitTokenToFit to
    // O(maxParts · maxCharsPerLine) instead of O(tokenLength) which could be
    // huge under a DoS input.
    if (parts.length >= maxParts) {
      break
    }

    const candidate = `${current}${character}`

    if (current && measureSpacedTextWidth(ctx, candidate, letterSpacing, cache) > maxWidth) {
      const committed = current.trimEnd()
      if (committed) {
        parts.push(committed)
      }

      current = character.trimStart()
      continue
    }

    current = candidate
  }

  const committed = current.trim()
  if (committed) {
    parts.push(committed)
  }

  return parts.length > 0 ? parts : [token.trim()]
}

function wrapWatermarkText(ctx: SKRSContext2D, text: string, maxWidth: number, letterSpacing: number, widthCache: Map<string, number>, maxLines = WATERMARK_TEXT_MAX_LINES) {
  const lines: string[] = []

  for (const paragraph of text.split("\n")) {
    if (lines.length >= maxLines) {
      break
    }

    const tokens = tokenizeWatermarkParagraph(paragraph)

    if (tokens.length === 0) {
      lines.push("")
      continue
    }

    let currentLine = ""

    for (const rawToken of tokens) {
      if (lines.length >= maxLines) {
        break
      }

      const token = currentLine ? rawToken : rawToken.replace(/^\s+/g, "")

      if (!token) {
        continue
      }

      const candidate = `${currentLine}${token}`
      if (measureSpacedTextWidth(ctx, candidate, letterSpacing, widthCache) <= maxWidth) {
        currentLine = candidate
        continue
      }

      if (currentLine.trim()) {
        lines.push(currentLine.trimEnd())
        currentLine = ""
        if (lines.length >= maxLines) {
          break
        }
      }

      const trimmedToken = rawToken.replace(/^\s+/g, "")
      if (!trimmedToken) {
        continue
      }

      if (measureSpacedTextWidth(ctx, trimmedToken, letterSpacing, widthCache) <= maxWidth) {
        currentLine = trimmedToken
        continue
      }

      // Bound the split output to the remaining line budget (+1 so the last
      // part may continue as currentLine for potential merge with next token).
      const remaining = Math.max(1, maxLines - lines.length + 1)
      const tokenParts = splitTokenToFit(ctx, trimmedToken, maxWidth, letterSpacing, widthCache, remaining)
      for (let index = 0; index < tokenParts.length; index += 1) {
        const part = tokenParts[index]
        if (!part) {
          continue
        }

        if (index === tokenParts.length - 1) {
          currentLine = part
          continue
        }

        if (lines.length >= maxLines) {
          break
        }
        lines.push(part)
      }
    }

    if (lines.length < maxLines && currentLine.trim()) {
      lines.push(currentLine.trimEnd())
    }
  }

  return lines.slice(0, maxLines)
}

function buildWatermarkLineLayouts(ctx: SKRSContext2D, text: string, maxWidth: number, letterSpacing: number, widthCache: Map<string, number>) {
  return wrapWatermarkText(ctx, text, maxWidth, letterSpacing, widthCache, WATERMARK_TEXT_MAX_LINES)
    .map((line) => ({
      text: line,
      width: measureSpacedTextWidth(ctx, line, letterSpacing, widthCache),
    }))
    .filter((line) => line.text.length > 0 && line.width > 0)
}

function drawSpacedText(ctx: SKRSContext2D, text: string, x: number, y: number, letterSpacing: number, widthCache: Map<string, number>) {
  let cursor = x
  const characters = Array.from(text)

  for (const [index, character] of characters.entries()) {
    ctx.fillText(character, cursor, y)
    // Reuse the shared per-layout width cache instead of issuing a fresh
    // `ctx.measureText` per character per tile. On a 4000-tile render this
    // turns 100s of thousands of measure calls into ~|unique chars| lookups.
    cursor += measureCharacterWidth(ctx, character, widthCache)

    if (index < characters.length - 1) {
      cursor += letterSpacing
    }
  }
}

function resolveLineOffset(position: ImageWatermarkPosition, contentWidth: number, lineWidth: number) {
  if (isCenteredWatermark(position)) {
    return Math.max(0, Math.round((contentWidth - lineWidth) / 2))
  }

  if (isRightAlignedWatermark(position)) {
    return Math.max(0, contentWidth - lineWidth)
  }

  return 0
}

function resolveTilePhase(position: ImageWatermarkPosition, tileWidth: number, tileHeight: number) {
  switch (position) {
    case "TOP_RIGHT":
      return { x: Math.round(tileWidth / 2), y: 0 }
    case "BOTTOM_LEFT":
      return { x: 0, y: Math.round(tileHeight / 2) }
    case "BOTTOM_RIGHT":
      return { x: Math.round(tileWidth / 2), y: Math.round(tileHeight / 2) }
    case "CENTER":
      return { x: Math.round(tileWidth / 4), y: Math.round(tileHeight / 4) }
    case "TOP_LEFT":
    default:
      return { x: 0, y: 0 }
  }
}

function prepareWatermarkLayout(ctx: SKRSContext2D, width: number, settings: WatermarkRenderableSettings): PreparedWatermarkLayout | null {
  const presentation = resolveWatermarkPresentation({
    color: settings.color,
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    margin: settings.margin,
    opacity: settings.opacity,
    text: settings.text,
    width,
  })

  if (!presentation.text) {
    return null
  }

  ctx.font = buildFontSpec(presentation.fontSize, presentation.fontFamily)
  const widthCache = new Map<string, number>()
  const lines = buildWatermarkLineLayouts(ctx, presentation.text, presentation.maxTextWidth, presentation.letterSpacing, widthCache)

  if (lines.length === 0) {
    return null
  }

  const contentWidth = Math.max(...lines.map((line) => line.width))
  const contentHeight = lines.length * presentation.lineHeight
  const paddingX = Math.ceil(presentation.shadowBlur + Math.abs(presentation.shadowOffsetX))
  const paddingY = Math.ceil(presentation.shadowBlur + Math.abs(presentation.shadowOffsetY))

  return {
    contentHeight,
    contentWidth,
    lines,
    paddingX,
    paddingY,
    presentation,
    widthCache,
  }
}

function applyWatermarkPaint(ctx: SKRSContext2D, presentation: WatermarkRenderPresentation) {
  ctx.fillStyle = `rgba(${presentation.colorRgb.red}, ${presentation.colorRgb.green}, ${presentation.colorRgb.blue}, ${presentation.opacityRatio.toFixed(3)})`
  ctx.shadowColor = presentation.shadowColor
  ctx.shadowBlur = presentation.shadowBlur
  ctx.shadowOffsetX = presentation.shadowOffsetX
  ctx.shadowOffsetY = presentation.shadowOffsetY
}

function drawWatermarkBlock(
  ctx: SKRSContext2D,
  layout: PreparedWatermarkLayout,
  originX: number,
  originY: number,
  position: ImageWatermarkPosition,
) {
  applyWatermarkPaint(ctx, layout.presentation)

  for (let index = 0; index < layout.lines.length; index += 1) {
    const line = layout.lines[index]
    const offsetX = resolveLineOffset(position, layout.contentWidth, line.width)
    const x = originX + offsetX
    const y = originY + index * layout.presentation.lineHeight
    drawSpacedText(ctx, line.text, x, y, layout.presentation.letterSpacing, layout.widthCache)
  }
}

function drawPreviewBackground(ctx: SKRSContext2D, width: number, height: number) {
  const baseGradient = ctx.createLinearGradient(0, 0, width, height)
  baseGradient.addColorStop(0, "#0F172A")
  baseGradient.addColorStop(0.52, "#1E293B")
  baseGradient.addColorStop(1, "#334155")
  ctx.fillStyle = baseGradient
  ctx.fillRect(0, 0, width, height)

  const glowLeft = ctx.createRadialGradient(width * 0.16, height * 0.18, 0, width * 0.16, height * 0.18, width * 0.36)
  glowLeft.addColorStop(0, "rgba(254, 243, 199, 0.92)")
  glowLeft.addColorStop(1, "rgba(254, 243, 199, 0)")
  ctx.fillStyle = glowLeft
  ctx.fillRect(0, 0, width, height)

  const glowRight = ctx.createRadialGradient(width * 0.82, height * 0.84, 0, width * 0.82, height * 0.84, width * 0.34)
  glowRight.addColorStop(0, "rgba(191, 219, 254, 0.88)")
  glowRight.addColorStop(1, "rgba(191, 219, 254, 0)")
  ctx.fillStyle = glowRight
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = "rgba(255,255,255,0.09)"
  ctx.lineWidth = 1
  for (let lineIndex = 1; lineIndex < 6; lineIndex += 1) {
    const y = Math.round((height / 6) * lineIndex)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  ctx.fillStyle = "rgba(255,255,255,0.07)"
  ctx.fillRect(width * 0.08, height * 0.16, width * 0.2, height * 0.18)
  ctx.fillStyle = "rgba(255,255,255,0.045)"
  ctx.fillRect(width * 0.62, height * 0.22, width * 0.24, height * 0.24)
  ctx.fillStyle = "rgba(255,255,255,0.05)"
  ctx.fillRect(width * 0.2, height * 0.62, width * 0.16, height * 0.12)
}

function renderSingleWatermark(
  ctx: SKRSContext2D,
  width: number,
  height: number,
  settings: WatermarkRenderableSettings,
  layout: PreparedWatermarkLayout,
) {
  const placement = resolveWatermarkPlacement({
    width,
    height,
    overlayWidth: layout.contentWidth + layout.paddingX * 2,
    overlayHeight: layout.contentHeight + layout.paddingY * 2,
    position: settings.position,
    margin: layout.presentation.margin,
  })
  drawWatermarkBlock(
    ctx,
    layout,
    placement.x + layout.paddingX,
    placement.y + layout.paddingY,
    settings.position,
  )
}

function renderTiledWatermark(
  ctx: SKRSContext2D,
  width: number,
  height: number,
  settings: WatermarkRenderableSettings,
  layout: PreparedWatermarkLayout,
) {
  const tileWidth = layout.contentWidth + layout.paddingX * 2
  const tileHeight = layout.contentHeight + layout.paddingY * 2
  let tileStepX = tileWidth + Math.max(layout.presentation.margin * 2, Math.round(layout.presentation.fontSize * 3.25))
  let tileStepY = tileHeight + Math.max(layout.presentation.margin * 1.5, Math.round(layout.presentation.lineHeight * 1.8))
  const diagonal = Math.ceil(Math.hypot(width, height))
  let tileCanvasSize = diagonal + tileStepX * 2

  // Safety cap: bound total tile fillText calls on extremely large images.
  // Without this, a 30k×30k image with a small fontSize could produce
  // hundreds of thousands of tiles and pin the CPU indefinitely.
  const MAX_TILES = 4000
  const estimateTileCount = () => {
    const cols = Math.ceil((tileCanvasSize + tileStepX * 2) / Math.max(1, tileStepX)) + 1
    const rows = Math.ceil((tileCanvasSize + tileStepY * 2) / Math.max(1, tileStepY)) + 1
    return cols * rows
  }
  let projected = estimateTileCount()
  if (projected > MAX_TILES) {
    const scale = Math.sqrt(projected / MAX_TILES)
    tileStepX = Math.max(1, Math.round(tileStepX * scale))
    tileStepY = Math.max(1, Math.round(tileStepY * scale))
    tileCanvasSize = diagonal + tileStepX * 2
    projected = estimateTileCount()
  }

  const phase = resolveTilePhase(settings.position, tileStepX, tileStepY)
  const rotation = -(Math.PI / 9)

  ctx.save()
  ctx.translate(width / 2, height / 2)
  ctx.rotate(rotation)
  ctx.translate(-(tileCanvasSize / 2), -(tileCanvasSize / 2))

  let drawn = 0
  for (let rowIndex = 0, tileY = -tileStepY - phase.y; tileY <= tileCanvasSize + tileStepY; tileY += tileStepY, rowIndex += 1) {
    const rowOffset = rowIndex % 2 === 0 ? 0 : Math.round(tileStepX / 2)

    for (let tileX = -tileStepX - phase.x + rowOffset; tileX <= tileCanvasSize + tileStepX; tileX += tileStepX) {
      if (drawn >= MAX_TILES) {
        ctx.restore()
        return
      }
      drawWatermarkBlock(
        ctx,
        layout,
        tileX + layout.paddingX,
        tileY + layout.paddingY,
        settings.position,
      )
      drawn += 1
    }
  }

  ctx.restore()
}

function renderWatermarkOnContext(ctx: SKRSContext2D, width: number, height: number, settings: WatermarkRenderableSettings) {
  ensureWatermarkFontRegistered()

  ctx.save()
  ctx.textBaseline = "top"
  ctx.textAlign = "left"
  ctx.direction = "ltr"
  const layout = prepareWatermarkLayout(ctx, width, settings)

  if (!layout) {
    ctx.restore()
    return false
  }

  if (settings.tiled) {
    renderTiledWatermark(ctx, width, height, settings, layout)
  } else {
    renderSingleWatermark(ctx, width, height, settings, layout)
  }

  ctx.restore()
  return true
}

function resolveCanvasOutputFormat(mimeType: "image/jpeg" | "image/png") {
  return mimeType === "image/jpeg"
    ? { canvasFormat: "jpeg" as const, quality: JPEG_QUALITY }
    : { canvasFormat: "png" as const }
}

export async function applyTextWatermarkToBuffer(params: {
  buffer: Buffer
  mimeType: "image/jpeg" | "image/png"
  settings: WatermarkRenderableSettings
}) {
  const image = await loadImage(params.buffer)
  const canvas = createCanvas(image.width, image.height)
  const ctx = canvas.getContext("2d")

  ctx.drawImage(image, 0, 0, image.width, image.height)
  const rendered = renderWatermarkOnContext(ctx, image.width, image.height, params.settings)

  if (!rendered) {
    return params.buffer
  }

  const output = resolveCanvasOutputFormat(params.mimeType)

  if ("quality" in output) {
    return canvas.encode("jpeg", output.quality)
  }

  return canvas.encode("png")
}

export async function createWatermarkPreviewImageBuffer(settings: WatermarkRenderableSettings & {
  enabled: boolean
}) {
  const canvas = createCanvas(WATERMARK_PREVIEW_WIDTH, WATERMARK_PREVIEW_HEIGHT)
  const ctx = canvas.getContext("2d")

  drawPreviewBackground(ctx, WATERMARK_PREVIEW_WIDTH, WATERMARK_PREVIEW_HEIGHT)

  if (settings.enabled) {
    renderWatermarkOnContext(ctx, WATERMARK_PREVIEW_WIDTH, WATERMARK_PREVIEW_HEIGHT, settings)
  }

  return canvas.encode("png")
}
