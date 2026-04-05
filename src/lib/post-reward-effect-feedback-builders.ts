import { randomInt } from "node:crypto"

import type { AppliedPointEffectTrace, PreparedPointDelta, PreparedProbabilityValue } from "@/lib/point-center"
import type { PostRewardPoolEffectFeedback, PostRewardPoolEffectFeedbackBadge, PostRewardPoolEffectFeedbackEvent } from "@/lib/post-reward-effect-feedback"

const JACKPOT_PROBABILITY_POSITIVE_HIT_TITLES = ["欧皇附体", "锦鲤贴脸", "今天偏爱你"]
const JACKPOT_PROBABILITY_POSITIVE_MISS_TITLES = ["倒霉瓜", "就差一点", "祝福差点成真"]
const JACKPOT_PROBABILITY_NEGATIVE_HIT_TITLES = ["逆风翻盘", "硬闯天命", "霉运没压住你"]
const JACKPOT_PROBABILITY_NEGATIVE_MISS_TITLES = ["霉运压顶", "衰气缠身", "手气被按住了"]
const JACKPOT_POINT_POSITIVE_TITLES = ["福气加码", "金运加持", "这波血赚"]
const JACKPOT_POINT_NEGATIVE_TITLES = ["衰神到来", "手滑漏财", "到手又飞了"]

const RED_PACKET_PROBABILITY_POSITIVE_HIT_TITLES = ["红包偏爱你", "手气开挂", "顺手截胡"]
const RED_PACKET_PROBABILITY_POSITIVE_MISS_TITLES = ["就差一手", "好运擦肩", "差点抢到"]
const RED_PACKET_PROBABILITY_NEGATIVE_HIT_TITLES = ["逆风抢到", "霉运没压住", "硬是拿下"]
const RED_PACKET_PROBABILITY_NEGATIVE_MISS_TITLES = ["手气被按住", "红包溜走了", "霉运先一步"]
const RED_PACKET_POINT_POSITIVE_TITLES = ["红包加码", "财运加餐", "手气真值钱"]
const RED_PACKET_POINT_NEGATIVE_TITLES = ["到手缩水", "红包漏财", "这一手亏了"]

function pickRandomCopy<T>(items: readonly T[]) {
  if (items.length === 0) {
    throw new Error("copy source is empty")
  }

  return items[randomInt(items.length)]
}

function formatSignedPoints(value: number) {
  return `${value > 0 ? "+" : ""}${value}`
}

function formatProbability(value: number) {
  return Number(value.toFixed(2))
}

function getPrimaryAppliedRule(traces: AppliedPointEffectTrace[]) {
  return traces.find((trace) => trace.badgeIconText || trace.badgeName) ?? traces[0] ?? null
}

function getAppliedBadges(traces: AppliedPointEffectTrace[]): PostRewardPoolEffectFeedbackBadge[] {
  const seen = new Set<string>()
  const badges: PostRewardPoolEffectFeedbackBadge[] = []

  for (const trace of traces) {
    if (!trace.badgeIconText && !trace.badgeName) {
      continue
    }

    const key = `${trace.badgeName ?? ""}::${trace.badgeIconText ?? ""}::${trace.badgeColor ?? ""}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    badges.push({
      name: trace.badgeName ?? null,
      iconText: trace.badgeIconText ?? null,
      color: trace.badgeColor ?? null,
    })
  }

  return badges
}

function getAppliedEffectNames(traces: AppliedPointEffectTrace[]) {
  return Array.from(new Set(traces.map((trace) => trace.ruleName).filter(Boolean))).join("、")
}

function getAppliedBadgeNames(traces: AppliedPointEffectTrace[]) {
  return Array.from(new Set(
    traces
      .map((trace) => trace.badgeName?.trim())
      .filter((name): name is string => Boolean(name)),
  ))
}

function buildJackpotProbabilityFeedback(params: {
  preparedProbability: PreparedProbabilityValue
  claimed: boolean
}): PostRewardPoolEffectFeedbackEvent | null {
  const adjustment = Number((params.preparedProbability.finalProbability - params.preparedProbability.baseProbability).toFixed(2))
  if (adjustment === 0 || params.preparedProbability.appliedRules.length === 0) {
    return null
  }

  const effectNames = getAppliedEffectNames(params.preparedProbability.appliedRules)
  const before = formatProbability(params.preparedProbability.baseProbability)
  const after = formatProbability(params.preparedProbability.finalProbability)
  const positive = adjustment > 0

  if (positive && params.claimed) {
    return {
      kind: "probability",
      tone: "positive",
      title: pickRandomCopy(JACKPOT_PROBABILITY_POSITIVE_HIT_TITLES),
      description: `${effectNames}把中奖概率从 ${before}% 抬到了 ${after}%，这次顺利命中聚宝盆。`,
      badgeNames: getAppliedBadgeNames(params.preparedProbability.appliedRules),
    }
  }

  if (positive) {
    return {
      kind: "probability",
      tone: "positive",
      title: pickRandomCopy(JACKPOT_PROBABILITY_POSITIVE_MISS_TITLES),
      description: `你是人间的小确幸，${effectNames}给你提升了中奖概率，从 ${before}% 拉到 ${after}% ，但这次还是没中。`,
      badgeNames: getAppliedBadgeNames(params.preparedProbability.appliedRules),
    }
  }

  if (params.claimed) {
    return {
      kind: "probability",
      tone: "negative",
      title: pickRandomCopy(JACKPOT_PROBABILITY_NEGATIVE_HIT_TITLES),
      description: `${effectNames}把中奖概率从 ${before}% 压到了 ${after}% ，你还是硬生生命中了聚宝盆。`,
      badgeNames: getAppliedBadgeNames(params.preparedProbability.appliedRules),
    }
  }

  return {
    kind: "probability",
    tone: "negative",
    title: pickRandomCopy(JACKPOT_PROBABILITY_NEGATIVE_MISS_TITLES),
    description: `${effectNames}把中奖概率从 ${before}% 压到了 ${after}% ，这次没能命中聚宝盆。`,
    badgeNames: getAppliedBadgeNames(params.preparedProbability.appliedRules),
  }
}

function buildJackpotPointFeedback(params: {
  preparedReward: PreparedPointDelta
  pointName: string
}): PostRewardPoolEffectFeedbackEvent | null {
  const adjustment = params.preparedReward.finalDelta - params.preparedReward.baseDelta
  if (adjustment === 0 || params.preparedReward.appliedRules.length === 0) {
    return null
  }

  const effectNames = getAppliedEffectNames(params.preparedReward.appliedRules)
  const positive = adjustment > 0
  const finalDelta = params.preparedReward.finalDelta

  if (positive) {
    return {
      kind: "points",
      tone: "positive",
      title: pickRandomCopy(JACKPOT_POINT_POSITIVE_TITLES),
      description: `${effectNames}让这次聚宝盆额外多拿了 ${adjustment} ${params.pointName}，最终到手 ${finalDelta} ${params.pointName}。`,
      badgeNames: getAppliedBadgeNames(params.preparedReward.appliedRules),
    }
  }

  if (finalDelta < 0) {
    return {
      kind: "points",
      tone: "negative",
      title: pickRandomCopy(JACKPOT_POINT_NEGATIVE_TITLES),
      description: `${effectNames}直接把奖励翻成了倒扣，原本 ${params.preparedReward.baseDelta} ${params.pointName} 的聚宝盆，最后反而损失了 ${Math.abs(finalDelta)} ${params.pointName}。`,
      badgeNames: getAppliedBadgeNames(params.preparedReward.appliedRules),
    }
  }

  return {
    kind: "points",
    tone: "negative",
    title: pickRandomCopy(JACKPOT_POINT_NEGATIVE_TITLES),
    description: `${effectNames}吃掉了 ${Math.abs(adjustment)} ${params.pointName}，原本 ${params.preparedReward.baseDelta} ${params.pointName} 的聚宝盆，最后只到手 ${formatSignedPoints(finalDelta)} ${params.pointName}。`,
    badgeNames: getAppliedBadgeNames(params.preparedReward.appliedRules),
  }
}

export function buildJackpotEffectFeedback(params: {
  preparedProbability: PreparedProbabilityValue
  preparedReward?: PreparedPointDelta | null
  claimed: boolean
  pointName: string
}): PostRewardPoolEffectFeedback | null {
  const events = [
    buildJackpotProbabilityFeedback({
      preparedProbability: params.preparedProbability,
      claimed: params.claimed,
    }),
    params.preparedReward
      ? buildJackpotPointFeedback({
          preparedReward: params.preparedReward,
          pointName: params.pointName,
        })
      : null,
  ].filter(Boolean) as PostRewardPoolEffectFeedbackEvent[]

  if (events.length === 0) {
    return null
  }

  const primaryRule = getPrimaryAppliedRule([
    ...params.preparedProbability.appliedRules,
    ...(params.preparedReward?.appliedRules ?? []),
  ])
  const appliedBadges = getAppliedBadges([
    ...params.preparedProbability.appliedRules,
    ...(params.preparedReward?.appliedRules ?? []),
  ])

  return {
    badgeName: primaryRule?.badgeName ?? null,
    badgeIconText: primaryRule?.badgeIconText ?? null,
    badgeColor: primaryRule?.badgeColor ?? null,
    badges: appliedBadges,
    events,
  }
}

function buildRedPacketProbabilityFeedback(params: {
  preparedProbability?: PreparedProbabilityValue | null
  claimed: boolean
}): PostRewardPoolEffectFeedbackEvent | null {
  if (!params.preparedProbability) {
    return null
  }

  const adjustment = Number((params.preparedProbability.finalProbability - params.preparedProbability.baseProbability).toFixed(2))
  if (adjustment === 0 || params.preparedProbability.appliedRules.length === 0) {
    return null
  }

  const effectNames = getAppliedEffectNames(params.preparedProbability.appliedRules)
  const before = formatProbability(params.preparedProbability.baseProbability)
  const after = formatProbability(params.preparedProbability.finalProbability)
  const positive = adjustment > 0

  if (positive && params.claimed) {
    return {
      kind: "probability",
      tone: "positive",
      title: pickRandomCopy(RED_PACKET_PROBABILITY_POSITIVE_HIT_TITLES),
      description: `${effectNames}把这次红包随机命中率从 ${before}% 拉到了 ${after}% ，红包顺利落到了你手上。`,
      badgeNames: getAppliedBadgeNames(params.preparedProbability.appliedRules),
    }
  }

  if (positive) {
    return {
      kind: "probability",
      tone: "positive",
      title: pickRandomCopy(RED_PACKET_PROBABILITY_POSITIVE_MISS_TITLES),
      description: `${effectNames}已经把这次红包随机命中率从 ${before}% 拉到了 ${after}% ，但红包还是被别人抢走了。`,
      badgeNames: getAppliedBadgeNames(params.preparedProbability.appliedRules),
    }
  }

  if (params.claimed) {
    return {
      kind: "probability",
      tone: "negative",
      title: pickRandomCopy(RED_PACKET_PROBABILITY_NEGATIVE_HIT_TITLES),
      description: `${effectNames}把这次红包随机命中率从 ${before}% 压到了 ${after}% ，你还是把红包抢到了手。`,
      badgeNames: getAppliedBadgeNames(params.preparedProbability.appliedRules),
    }
  }

  return {
    kind: "probability",
    tone: "negative",
    title: pickRandomCopy(RED_PACKET_PROBABILITY_NEGATIVE_MISS_TITLES),
    description: `${effectNames}把这次红包随机命中率从 ${before}% 压到了 ${after}% ，这次红包落到了别人手里。`,
    badgeNames: getAppliedBadgeNames(params.preparedProbability.appliedRules),
  }
}

function buildRedPacketPointFeedback(params: {
  preparedReward?: PreparedPointDelta | null
  pointName: string
}): PostRewardPoolEffectFeedbackEvent | null {
  if (!params.preparedReward) {
    return null
  }

  const adjustment = params.preparedReward.finalDelta - params.preparedReward.baseDelta
  if (adjustment === 0 || params.preparedReward.appliedRules.length === 0) {
    return null
  }

  const effectNames = getAppliedEffectNames(params.preparedReward.appliedRules)
  const positive = adjustment > 0
  const finalDelta = params.preparedReward.finalDelta

  if (positive) {
    return {
      kind: "points",
      tone: "positive",
      title: pickRandomCopy(RED_PACKET_POINT_POSITIVE_TITLES),
      description: `${effectNames}让这次红包额外多拿了 ${adjustment} ${params.pointName}，最终到手 ${finalDelta} ${params.pointName}。`,
      badgeNames: getAppliedBadgeNames(params.preparedReward.appliedRules),
    }
  }

  if (finalDelta < 0) {
    return {
      kind: "points",
      tone: "negative",
      title: pickRandomCopy(RED_PACKET_POINT_NEGATIVE_TITLES),
      description: `${effectNames}直接把红包翻成了倒扣，原本 ${params.preparedReward.baseDelta} ${params.pointName} 的红包，最后反而损失了 ${Math.abs(finalDelta)} ${params.pointName}。`,
      badgeNames: getAppliedBadgeNames(params.preparedReward.appliedRules),
    }
  }

  return {
    kind: "points",
    tone: "negative",
    title: pickRandomCopy(RED_PACKET_POINT_NEGATIVE_TITLES),
    description: `${effectNames}吃掉了 ${Math.abs(adjustment)} ${params.pointName}，原本 ${params.preparedReward.baseDelta} ${params.pointName} 的红包，最后只到手 ${formatSignedPoints(finalDelta)} ${params.pointName}。`,
    badgeNames: getAppliedBadgeNames(params.preparedReward.appliedRules),
  }
}

export function buildRedPacketEffectFeedback(params: {
  preparedProbability?: PreparedProbabilityValue | null
  preparedReward?: PreparedPointDelta | null
  claimed: boolean
  pointName: string
}): PostRewardPoolEffectFeedback | null {
  const events = [
    buildRedPacketProbabilityFeedback({
      preparedProbability: params.preparedProbability,
      claimed: params.claimed,
    }),
    params.claimed
      ? buildRedPacketPointFeedback({
          preparedReward: params.preparedReward,
          pointName: params.pointName,
        })
      : null,
  ].filter(Boolean) as PostRewardPoolEffectFeedbackEvent[]

  if (events.length === 0) {
    return null
  }

  const primaryRule = getPrimaryAppliedRule([
    ...(params.preparedProbability?.appliedRules ?? []),
    ...(params.preparedReward?.appliedRules ?? []),
  ])
  const appliedBadges = getAppliedBadges([
    ...(params.preparedProbability?.appliedRules ?? []),
    ...(params.preparedReward?.appliedRules ?? []),
  ])

  return {
    badgeName: primaryRule?.badgeName ?? null,
    badgeIconText: primaryRule?.badgeIconText ?? null,
    badgeColor: primaryRule?.badgeColor ?? null,
    badges: appliedBadges,
    events,
  }
}
