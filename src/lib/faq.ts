import type { Metadata } from "next"

import { getSiteSettings } from "@/lib/site-settings"

export interface FaqTabItem {
  href: string
  label: string
  description: string
}

export const FAQ_TABS: FaqTabItem[] = [
  {
    href: "/faq",
    label: "总览",
    description: "快速总览整套系统能力与阅读路径。",
  },
  {
    href: "/faq/level-system",
    label: "等级系统",
    description: "说明升级条件、成长逻辑和等级用途。",
  },
  {
    href: "/faq/badge-system",
    label: "勋章系统",
    description: "说明勋章规则、领取方式和展示机制。",
  },
  {
    href: "/faq/post-heat",
    label: "帖子热度",
    description: "说明热度分数、颜色档位和计算方式。",
  },
  {
    href: "/faq/points-system",
    label: "积分系统",
    description: "说明积分来源、消耗场景和门槛用途。",
  },
  {
    href: "/faq/verification-system",
    label: "认证系统",
    description: "说明认证类型、申请流程、审核状态与展示效果。",
  },
  {
    href: "/faq/social-system",
    label: "关注与拉黑",
    description: "说明关注维度、拉黑边界与社交行为限制。",
  },
]

export async function buildFaqMetadata(title: string, description: string): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `${title} - ${settings.siteName}`,
    description,
    openGraph: {
      title: `${title} - ${settings.siteName}`,
      description,
      type: "website",
    },
  }
}
