export type CaptchaMode = "OFF" | "TURNSTILE" | "BUILTIN"

export interface FooterLinkItem {
  label: string
  href: string
}

export const DEFAULT_FOOTER_LINKS: FooterLinkItem[] = [
  { label: "关于", href: "/about" },
  { label: "小黑屋", href: "/prison" },
  { label: "帮助文档", href: "/help" },
  { label: "FAQ", href: "/faq" },
  { label: "协议", href: "/terms" },
]

export const DEFAULT_HEAT_THRESHOLDS = [0, 80, 180, 320, 520, 780, 1100, 1500, 2000] as const

export const DEFAULT_HEAT_COLORS = ["#4A4A4A", "#808080", "#9B8F7F", "#B87333", "#C4A777", "#E8C547", "#FFA500", "#D96C3B", "#C41E3A"] as const

export function parseNumberList(raw: unknown) {
  return String(raw ?? "")
    .split(/[，,\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item))
}

export function parseTippingAmounts(raw: unknown) {
  const values = parseNumberList(raw).filter((item) => Number.isInteger(item) && item > 0)
  return Array.from(new Set(values)).sort((left, right) => left - right)
}

export function parseHeatThresholds(raw: unknown) {
  const values = parseNumberList(raw).filter((item) => item >= 0)
  const sorted = Array.from(new Set(values)).sort((left, right) => left - right)
  return sorted.length === DEFAULT_HEAT_THRESHOLDS.length ? sorted : [...DEFAULT_HEAT_THRESHOLDS]
}

export function parseHeatColors(raw: unknown) {
  const values = String(raw ?? "")
    .split(/[，,]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  return values.length === DEFAULT_HEAT_COLORS.length ? values : [...DEFAULT_HEAT_COLORS]
}

export function normalizeCaptchaMode(raw: unknown): CaptchaMode {
  const mode = String(raw ?? "OFF").trim().toUpperCase()
  return mode === "TURNSTILE" || mode === "BUILTIN" ? mode : "OFF"
}

export function normalizeFooterLinks(raw: unknown) {
  if (!Array.isArray(raw)) {
    return [...DEFAULT_FOOTER_LINKS]
  }

  const normalized = raw
    .map((item) => ({
      label: String(item?.label ?? "").trim(),
      href: String(item?.href ?? "").trim(),
    }))
    .filter((item) => item.label && item.href)

  return normalized.length > 0 ? normalized : [...DEFAULT_FOOTER_LINKS]
}

export function parseFooterLinks(raw: string | null | undefined) {
  if (!raw) {
    return [...DEFAULT_FOOTER_LINKS]
  }

  try {
    return normalizeFooterLinks(JSON.parse(raw))
  } catch {
    return [...DEFAULT_FOOTER_LINKS]
  }
}
