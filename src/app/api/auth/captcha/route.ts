import { NextResponse } from "next/server"

import { createBuiltinCaptchaToken, hasBuiltinCaptchaSecret } from "@/lib/builtin-captcha"


const CAPTCHA_LENGTH = 4
const CAPTCHA_EXPIRE_SECONDS = 60 * 5
const CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const CAPTCHA_FONTS = [
  "Georgia, serif",
  "Times New Roman, serif",
  "Trebuchet MS, sans-serif",
  "Verdana, sans-serif",
  "Courier New, monospace",
  "Palatino Linotype, serif",
]

function randomText(length: number) {
  return Array.from({ length }, () => CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)]).join("")
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomColor(alpha = 1) {
  const r = randomInt(20, 120)
  const g = randomInt(20, 120)
  const b = randomInt(20, 120)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function buildSvg(text: string) {
  const chars = text.split("")
  const width = 148
  const height = 52
  const dots = Array.from({ length: 32 }, () => {
    const cx = randomInt(6, width - 6)
    const cy = randomInt(6, height - 6)
    const radius = Math.random() > 0.7 ? 1.6 : 1.1
    return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${randomColor(0.24)}" />`
  }).join("")

  const curves = Array.from({ length: 4 }, () => {
    const y1 = randomInt(8, height - 8)
    const y2 = randomInt(8, height - 8)
    const y3 = randomInt(8, height - 8)
    const y4 = randomInt(8, height - 8)
    return `<path d="M 0 ${y1} C ${randomInt(24, 44)} ${y2}, ${randomInt(84, 110)} ${y3}, ${width} ${y4}" stroke="${randomColor(0.35)}" stroke-width="${randomInt(1, 2)}" fill="none" stroke-linecap="round" />`
  }).join("")

  const slashes = Array.from({ length: 5 }, () => {
    const x1 = randomInt(0, width - 20)
    const y1 = randomInt(4, height - 4)
    const x2 = x1 + randomInt(18, 42)
    const y2 = randomInt(4, height - 4)
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${randomColor(0.3)}" stroke-width="1" />`
  }).join("")

  const letters = chars.map((char, index) => {
    const x = 18 + index * 29 + randomInt(-3, 3)
    const y = 33 + randomInt(-4, 5)
    const rotate = randomInt(-24, 24)
    const fontSize = randomInt(24, 30)
    const fontFamily = CAPTCHA_FONTS[randomInt(0, CAPTCHA_FONTS.length - 1)]
    const skewX = randomInt(-14, 14)
    const skewY = randomInt(-8, 8)
    const fill = randomColor(0.92)
    return `<text x="${x}" y="${y}" font-size="${fontSize}" font-family="${fontFamily}" font-style="${index % 2 === 0 ? "italic" : "normal"}" font-weight="${index % 3 === 0 ? "700" : "600"}" fill="${fill}" transform="rotate(${rotate} ${x} ${y}) skewX(${skewX}) skewY(${skewY})">${char}</text>`
  }).join("")

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><filter id="captcha-noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncA type="table" tableValues="0 0.04" /></feComponentTransfer></filter></defs><rect width="${width}" height="${height}" rx="14" fill="#f8fafc" stroke="#dbe4f0" /><rect width="${width}" height="${height}" rx="14" filter="url(#captcha-noise)" opacity="0.7" />${dots}${curves}${slashes}${letters}</svg>`
}

export async function GET() {
  if (!hasBuiltinCaptchaSecret()) {
    return NextResponse.json({ code: 503, message: "当前未配置内建验证码密钥" }, { status: 503 })
  }

  const text = randomText(CAPTCHA_LENGTH)
  const expiresAt = Date.now() + CAPTCHA_EXPIRE_SECONDS * 1000
  const token = createBuiltinCaptchaToken(text, expiresAt)
  const svg = buildSvg(text)

  return NextResponse.json({

    code: 0,
    data: {
      imageDataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
      captchaToken: token,
      expiresAt,
    },
  })
}
