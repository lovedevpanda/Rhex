export const HOST_APPS = [
  {
    id: "ai-reply",
    slug: "ai-reply",
    name: "AI 助手",
    description: "配置 AI 代理账号、模型接口、提示词与提及后自动回帖任务。",
    href: "/admin/apps/ai-reply",
    adminHref: "/admin/apps/ai-reply",
    category: "智能",
  },
  {
    id: "gobang",
    slug: "gobang",
    name: "五子棋",
    description: "人机对战应用，支持每日免费场次、付费挑战与胜利奖励。",
    href: "/funs/gobang",
    adminHref: "/admin/apps/gobang",
    category: "游戏",
  },
  {
    id: "yinyang-contract",
    slug: "yinyang-contract",
    name: "阴阳契",
    description: "双选项积分挑战应用，支持托管彩头、税率配置、战绩统计与盈利排行榜。",
    href: "/funs/yinyang-contract",
    adminHref: "/admin/apps/yinyang-contract",
    category: "游戏",
  },
  {
    id: "self-serve-ads",
    slug: "self-serve-ads",
    name: "自助广告位",
    description: "首页广告位投放系统，支持图片与文字广告购买、审核与展示。",
    href: "/funs/self-serve-ads",
    adminHref: "/admin/apps/self-serve-ads",
    category: "运营",
  },
  {
    id: "rss-harvest",
    slug: "rss-harvest",
    name: "RSS 抓取中心",
    description: "外部 RSS/Atom 抓取后台，支持定时任务、持久化队列、失败重试、日志追踪与手动启停。",
    href: "/admin/apps/rss-harvest",
    adminHref: "/admin/apps/rss-harvest",
    category: "采集",
  },
  {
    id: "worker",
    slug: "worker",
    name: "Worker 中心",
    description: "后台任务 worker 诊断页，查看队列状态、竞拍结算进度、死信告警和在线 worker 连接。",
    href: "/admin/apps/worker",
    adminHref: "/admin/apps/worker",
    category: "系统",
  },
  {
    id: "payment-gateway",
    slug: "payment-gateway",
    name: "支付网关",
    description: "统一管理支付渠道、路由规则、内置与插件化支付提供方配置，以及异步通知与履约状态。",
    href: "/admin/apps/payment-gateway",
    adminHref: "/admin/apps/payment-gateway",
    category: "交易",
  },
] as const


export type HostAppItem = (typeof HOST_APPS)[number]

export function getHostAppBySlug(slug: string) {
  return HOST_APPS.find((item) => item.slug === slug) ?? null
}
