import { getSiteSettings } from "@/lib/site-settings"

export interface PostHeatInput {
  views: number
  comments: number
  likes: number
  tipCount: number
  tipPoints: number
}

export interface PostHeatResult {
  score: number
  stageIndex: number
  color: string
}

const DEFAULT_COLORS = ["#4A4A4A", "#808080", "#9B8F7F", "#B87333", "#C4A777", "#E8C547", "#FFA500", "#D96C3B", "#C41E3A"]
const DEFAULT_THRESHOLDS = [0, 80, 180, 320, 520, 780, 1100, 1500, 2000]

function sanitizeThresholds(values: number[]) {
  if (values.length !== 9) {
    return DEFAULT_THRESHOLDS
  }

  return [...values].sort((left, right) => left - right)
}

function sanitizeColors(values: string[]) {
  return values.length === 9 ? values : DEFAULT_COLORS
}

export function calculatePostHeatScore(input: PostHeatInput, settings: Pick<Awaited<ReturnType<typeof getSiteSettings>>, "heatViewWeight" | "heatCommentWeight" | "heatLikeWeight" | "heatTipCountWeight" | "heatTipPointsWeight">) {
  return input.views * settings.heatViewWeight
    + input.comments * settings.heatCommentWeight
    + input.likes * settings.heatLikeWeight
    + input.tipCount * settings.heatTipCountWeight
    + input.tipPoints * settings.heatTipPointsWeight
}

export function resolvePostHeatStyle(input: PostHeatInput, settings: Pick<Awaited<ReturnType<typeof getSiteSettings>>, "heatViewWeight" | "heatCommentWeight" | "heatLikeWeight" | "heatTipCountWeight" | "heatTipPointsWeight" | "heatStageThresholds" | "heatStageColors">): PostHeatResult {
  const score = calculatePostHeatScore(input, settings)
  const thresholds = sanitizeThresholds(settings.heatStageThresholds)
  const colors = sanitizeColors(settings.heatStageColors)

  let stageIndex = 0
  for (let index = thresholds.length - 1; index >= 0; index -= 1) {
    if (score >= thresholds[index]) {
      stageIndex = index
      break
    }
  }

  return {
    score,
    stageIndex,
    color: colors[stageIndex] ?? DEFAULT_COLORS[0],
  }
}
