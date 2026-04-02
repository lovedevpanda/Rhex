import type { Metadata } from "next"

import { SiteHeader } from "@/components/site-header"
import { getCurrentUser } from "@/lib/auth"
import { getGobangAppConfig } from "@/lib/app-config"
import { getGobangPlayerSummary, type GobangMatch, type GobangPlayerSummary, GobangPage, listGobangMatches } from "@/lib/gobang"

import { buildMetadataKeywords } from "@/lib/seo"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `五子棋 - ${settings.siteName}`,
    description: `在 ${settings.siteName} 体验五子棋人机对战，支持免费与付费挑战、积分奖励与历史战绩回看。`,
    keywords: buildMetadataKeywords(settings.siteSeoKeywords, ["五子棋", "五子棋小游戏", "gomoku", "Gobang", "人机对战", "积分挑战"]),
  }
}

export default async function GobangFunPage() {
  const [config, user] = await Promise.all([
    getGobangAppConfig(),
    getCurrentUser(),
  ])

  const fallbackSummary: GobangPlayerSummary = {
    pointName: "积分",
    points: 0,
    freeTotal: 0,
    freeUsed: 0,
    freeRemaining: 0,
    paidTotal: 0,
    paidUsed: 0,
    paidRemaining: 0,
    challengeStatus: "not_started",
  }

  const [initialMatches, initialSummary]: [GobangMatch[], GobangPlayerSummary] = user
    ? await Promise.all([
      listGobangMatches(user.id),
      getGobangPlayerSummary(user),
    ])
    : [[], fallbackSummary]


  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1 py-8">
        <div className="space-y-6">
          <GobangPage config={config} initialMatches={initialMatches} initialSummary={initialSummary} />
        </div>
      </div>
    </div>
  )
}

