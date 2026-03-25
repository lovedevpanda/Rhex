import {
  BadgeRuleOperator,
  BadgeRuleType,
  BoardStatus,
  PrismaClient,
  UserRole,
  UserStatus,
} from "@prisma/client"
import { hashSync } from "bcryptjs"

const prisma = new PrismaClient()

const APP_VERSION = "1.0.0"
const DEFAULT_ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME?.trim() || "admin"
const DEFAULT_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD?.trim() || "ChangeMe_123456"
const DEFAULT_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL?.trim() || undefined
const DEFAULT_ADMIN_NICKNAME = process.env.SEED_ADMIN_NICKNAME?.trim() || "站长"
const RESET_DATABASE = process.env.SEED_RESET_DATABASE === "true"


const defaultLevelDefinitions = [
  { level: 1, name: "旅人", color: "#64748b", icon: "🌱", requireCheckInDays: 0, requirePostCount: 0, requireCommentCount: 0, requireLikeCount: 0 },
  { level: 2, name: "初见", color: "#3b82f6", icon: "🪴", requireCheckInDays: 1, requirePostCount: 1, requireCommentCount: 1, requireLikeCount: 0 },
  { level: 3, name: "常客", color: "#06b6d4", icon: "☕", requireCheckInDays: 7, requirePostCount: 3, requireCommentCount: 10, requireLikeCount: 5 },
  { level: 4, name: "活跃者", color: "#14b8a6", icon: "🔥", requireCheckInDays: 15, requirePostCount: 8, requireCommentCount: 25, requireLikeCount: 15 },
  { level: 5, name: "同好", color: "#22c55e", icon: "🌿", requireCheckInDays: 30, requirePostCount: 15, requireCommentCount: 50, requireLikeCount: 40 },
  { level: 6, name: "砥柱", color: "#eab308", icon: "🛠️", requireCheckInDays: 90, requirePostCount: 30, requireCommentCount: 100, requireLikeCount: 100 },
  { level: 7, name: "达人", color: "#f97316", icon: "🏹", requireCheckInDays: 180, requirePostCount: 60, requireCommentCount: 180, requireLikeCount: 220 },
  { level: 8, name: "名士", color: "#a855f7", icon: "👑", requireCheckInDays: 365, requirePostCount: 100, requireCommentCount: 300, requireLikeCount: 400 },
  { level: 9, name: "传奇", color: "#ef4444", icon: "🐉", requireCheckInDays: 720, requirePostCount: 180, requireCommentCount: 500, requireLikeCount: 800 },
] as const

const defaultBadges = [
  {
    name: "初来乍到",
    code: "first-post",
    description: "完成首次发帖，正式在社区留下自己的第一条主题。",
    iconText: "📝",
    color: "#3b82f6",
    category: "创作里程碑",
    sortOrder: 10,
    status: true,
    isHidden: false,
    rules: [
      { ruleType: BadgeRuleType.POST_COUNT, operator: BadgeRuleOperator.GTE, value: "1", sortOrder: 0 },
    ],
  },
  {
    name: "初次发声",
    code: "first-comment",
    description: "完成首次回复，开始参与社区互动。",
    iconText: "💬",
    color: "#14b8a6",
    category: "互动成长",
    sortOrder: 20,
    status: true,
    isHidden: false,
    rules: [
      { ruleType: BadgeRuleType.COMMENT_COUNT, operator: BadgeRuleOperator.GTE, value: "1", sortOrder: 0 },
    ],
  },
  {
    name: "被看见的人",
    code: "liked-10",
    description: "累计获得 10 个赞，内容开始被更多人认可。",
    iconText: "✨",
    color: "#f59e0b",
    category: "互动成长",
    sortOrder: 30,
    status: true,
    isHidden: false,
    rules: [
      { ruleType: BadgeRuleType.RECEIVED_LIKE_COUNT, operator: BadgeRuleOperator.GTE, value: "10", sortOrder: 0 },
    ],
  },
  {
    name: "持续创作",
    code: "post-10",
    description: "累计发布 10 篇主题，保持稳定创作输出。",
    iconText: "🧠",
    color: "#8b5cf6",
    category: "创作里程碑",
    sortOrder: 40,
    status: true,
    isHidden: false,
    rules: [
      { ruleType: BadgeRuleType.POST_COUNT, operator: BadgeRuleOperator.GTE, value: "10", sortOrder: 0 },
    ],
  },
  {
    name: "热心回复者",
    code: "comment-100",
    description: "累计回复达到 100 次，是社区讨论的稳定参与者。",
    iconText: "🗨️",
    color: "#06b6d4",
    category: "互动成长",
    sortOrder: 50,
    status: true,
    isHidden: false,
    rules: [
      { ruleType: BadgeRuleType.COMMENT_COUNT, operator: BadgeRuleOperator.GTE, value: "100", sortOrder: 0 },
    ],
  },
  {
    name: "百日守望",
    code: "checkin-100",
    description: "累计签到 100 天，已经养成稳定回访的习惯。",
    iconText: "📅",
    color: "#22c55e",
    category: "社区资历",
    sortOrder: 60,
    status: true,
    isHidden: false,
    rules: [
      { ruleType: BadgeRuleType.CHECK_IN_DAYS, operator: BadgeRuleOperator.GTE, value: "100", sortOrder: 0 },
    ],
  },
  {
    name: "论坛老鸟",
    code: "checkin-1000",
    description: "累计签到 1000 天，见证社区从冷启动走向成熟。",
    iconText: "🦉",
    color: "#f97316",
    category: "社区资历",
    sortOrder: 70,
    status: true,
    isHidden: false,
    rules: [
      { ruleType: BadgeRuleType.CHECK_IN_DAYS, operator: BadgeRuleOperator.GTE, value: "1000", sortOrder: 0 },
    ],
  },
  {
    name: "伯乐",
    code: "invite-10",
    description: "成功邀请 10 位用户加入社区，为论坛带来新的活力。",
    iconText: "🎯",
    color: "#ec4899",
    category: "社区贡献",
    sortOrder: 80,
    status: true,
    isHidden: false,
    rules: [
      { ruleType: BadgeRuleType.INVITE_COUNT, operator: BadgeRuleOperator.GTE, value: "10", sortOrder: 0 },
    ],
  },
  {
    name: "高阶会员",
    code: "vip-level-1",
    description: "开通会员身份，支持社区长期运转。",
    iconText: "💎",
    color: "#a855f7",
    category: "会员身份",
    sortOrder: 90,
    status: true,
    isHidden: false,
    rules: [
      { ruleType: BadgeRuleType.VIP_LEVEL, operator: BadgeRuleOperator.GTE, value: "1", sortOrder: 0 },
    ],
  },
  {
    name: "九段高手",
    code: "level-9",
    description: "用户等级达到 9 级，是社区最核心的长期贡献者之一。",
    iconText: "🐉",
    color: "#dc2626",
    category: "成长荣誉",
    sortOrder: 100,
    status: true,
    isHidden: false,
    rules: [
      { ruleType: BadgeRuleType.LEVEL, operator: BadgeRuleOperator.GTE, value: "9", sortOrder: 0 },
    ],
  },
] as const

async function resetDatabase() {
  await prisma.userBadge.deleteMany()
  await prisma.badgeRule.deleteMany()
  await prisma.badge.deleteMany()
  await prisma.verificationCode.deleteMany()
  await prisma.redeemCode.deleteMany()
  await prisma.inviteCode.deleteMany()
  await prisma.userLevelProgress.deleteMany()
  await prisma.levelDefinition.deleteMany()
  await prisma.userLoginLog.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.adminLog.deleteMany()
  await prisma.announcement.deleteMany()
  await prisma.report.deleteMany()
  await prisma.upload.deleteMany()
  await prisma.userCheckInLog.deleteMany()
  await prisma.postTip.deleteMany()
  await prisma.directMessage.deleteMany()
  await prisma.conversationParticipant.deleteMany()
  await prisma.conversation.deleteMany()
  await prisma.pollVote.deleteMany()
  await prisma.pollOption.deleteMany()
  await prisma.like.deleteMany()
  await prisma.favorite.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.pointLog.deleteMany()
  await prisma.postTag.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.postAppendix.deleteMany()
  await prisma.post.deleteMany()
  await prisma.boardFollow.deleteMany()
  await prisma.board.deleteMany()
  await prisma.zone.deleteMany()
  await prisma.siteSetting.deleteMany()
  await prisma.user.deleteMany()
}

async function ensureSiteSettings() {
  const existing = await prisma.siteSetting.findFirst({ orderBy: { createdAt: "asc" } })

  if (existing) {
    return existing
  }

  const siteSettingsData = {
    siteName: "Rhex 论坛系统",
    siteSlogan: "专注长期讨论与高质量交流",
    siteDescription: "Rhex 论坛系统是一个适合开源部署的现代论坛基础站点，默认提供可维护的正式初始化数据。",
    siteLogoText: "Rhex 论坛系统",
    siteLogoPath: null,
    siteSeoKeywords: "Rhex,Rhex 论坛系统,论坛,社区,Next.js,Prisma",
    pointName: "积分",
    footerLinksJson: JSON.stringify([
      { label: "关于", href: "/about" },
      { label: "小黑屋", href: "/prison" },
      { label: "帮助", href: "/help" },
      { label: "FAQ", href: "/faq" },
      { label: "协议", href: "/terms" },
    ]),
    analyticsCode: null,
    friendLinksEnabled: true,
    friendLinkApplicationEnabled: true,
    friendLinkAnnouncement: "欢迎与本站交换友情链接，请先添加本站链接后再提交申请。",
    checkInEnabled: true,
    checkInReward: 5,
    checkInMakeUpCardPrice: 0,
    checkInVipMakeUpCardPrice: 0,
    inviteRewardInviter: 0,
    inviteRewardInvitee: 0,
    registrationEnabled: true,
    registrationRequireInviteCode: false,
    registerInviteCodeEnabled: true,
    inviteCodePurchaseEnabled: false,
    inviteCodePrice: 0,
    registerCaptchaMode: "OFF",
    loginCaptchaMode: "OFF",
    turnstileSiteKey: null,
    nicknameChangePointCost: 0,
    tippingEnabled: false,
    tippingDailyLimit: 3,
    tippingPerPostLimit: 1,
    tippingAmounts: "10,30,50,100",
    heatViewWeight: 1,
    heatCommentWeight: 8,
    heatLikeWeight: 6,
    heatTipCountWeight: 10,
    heatTipPointsWeight: 1,
    heatStageThresholds: "0,80,180,320,520,780,1100,1500,2000",
    heatStageColors: "#4A4A4A,#808080,#9B8F7F,#B87333,#C4A777,#E8C547,#FFA500,#D96C3B,#C41E3A",
    registerEmailEnabled: false,
    registerEmailRequired: false,
    registerEmailVerification: false,
    registerPhoneEnabled: false,
    registerPhoneRequired: false,
    registerPhoneVerification: false,
    registerNicknameEnabled: true,
    registerNicknameRequired: false,
    registerGenderEnabled: false,
    registerGenderRequired: false,
    registerInviterEnabled: true,
    smtpEnabled: false,
    smtpHost: null,
    smtpPort: null,
    smtpUser: null,
    smtpPass: null,
    smtpFrom: null,
    smtpSecure: false,
    vipMonthlyPrice: 3000,
    vipQuarterlyPrice: 8000,
    vipYearlyPrice: 30000,
    uploadProvider: "local",
    uploadLocalPath: "uploads",
    uploadBaseUrl: null,
    uploadOssBucket: null,
    uploadOssRegion: null,
    uploadOssEndpoint: null,
    uploadRequireLogin: true,
    uploadAllowedImageTypes: "jpg,jpeg,png,gif,webp",
    uploadMaxFileSizeMb: 5,
    uploadAvatarMaxFileSizeMb: 2,
    pluginStateJson: "{}",
  }

  return prisma.siteSetting.create({ data: siteSettingsData })
}

async function ensureLevelDefinitions() {
  for (const item of defaultLevelDefinitions) {
    await prisma.levelDefinition.upsert({
      where: { level: item.level },
      update: {},
      create: { ...item },
    })
  }
}

async function ensureDefaultBadges() {
  for (const badge of defaultBadges) {
    const existingBadge = await prisma.badge.findUnique({
      where: { code: badge.code },
      select: { id: true },
    })

    if (existingBadge) {
      continue
    }

    await prisma.badge.create({
      data: {
        name: badge.name,
        code: badge.code,
        description: badge.description,
        iconText: badge.iconText,
        color: badge.color,
        category: badge.category,
        sortOrder: badge.sortOrder,
        status: badge.status,
        isHidden: badge.isHidden,
      },
    })

    const savedBadge = await prisma.badge.findUniqueOrThrow({
      where: { code: badge.code },
      select: { id: true },
    })

    await prisma.badgeRule.createMany({
      data: badge.rules.map((rule) => ({
        badgeId: savedBadge.id,
        ruleType: rule.ruleType,
        operator: rule.operator,
        value: rule.value,
        sortOrder: rule.sortOrder,
      })),
    })
  }
}

async function ensureBaseTaxonomy() {
  const existingZone = await prisma.zone.findUnique({
    where: { slug: "general" },
  })

  const defaultZone = existingZone ?? await prisma.zone.create({
    data: {
      name: "默认分区",
      slug: "general",
      description: "开源部署后的默认初始分区，可在后台继续扩展为你自己的社区结构。",
      icon: "📚",
      sortOrder: 1,
    },
  })

  const boardSpecs = [
    { name: "公告", slug: "announcements", description: "发布站点公告、版本更新与重要通知。", sortOrder: 1 },
    { name: "综合讨论", slug: "general-discussion", description: "默认公共讨论节点，适合承接社区早期的大多数主题。", sortOrder: 2 },
    { name: "反馈建议", slug: "feedback", description: "收集使用反馈、功能建议与问题报告。", sortOrder: 3 },
  ] as const

  const boards = await Promise.all(boardSpecs.map(async (item) => {
    const existingBoard = await prisma.board.findUnique({
      where: { slug: item.slug },
    })

    if (existingBoard) {
      return existingBoard
    }

    return prisma.board.create({
      data: {
        zoneId: defaultZone.id,
        name: item.name,
        slug: item.slug,
        description: item.description,
        status: BoardStatus.ACTIVE,
        sortOrder: item.sortOrder,
      },
    })
  }))

  return {
    zone: defaultZone,
    boards: {
      announcementBoard: boards[0],
      discussionBoard: boards[1],
      feedbackBoard: boards[2],
    },
  }
}

async function ensureAdminUser() {
  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { username: DEFAULT_ADMIN_USERNAME },
        { role: UserRole.ADMIN },
      ],
    },
    orderBy: { createdAt: "asc" },
  })

  if (existingAdmin) {
    return existingAdmin
  }

  return prisma.user.create({
    data: {
      username: DEFAULT_ADMIN_USERNAME,
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash: hashSync(DEFAULT_ADMIN_PASSWORD, 10),
      nickname: DEFAULT_ADMIN_NICKNAME,
      bio: `论坛 ${APP_VERSION} 初始管理员账号，请首次登录后立即修改密码与站点信息。`,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      points: 0,
      level: 1,
    },
  })
}




async function main() {
  if (RESET_DATABASE) {
    await resetDatabase()
  }

  await ensureSiteSettings()
  await ensureLevelDefinitions()
  await ensureDefaultBadges()
  await ensureBaseTaxonomy()
  await ensureAdminUser()

  console.log(`Seed completed for forum v${APP_VERSION}.`)
  console.log(`Admin username: ${DEFAULT_ADMIN_USERNAME}`)
  console.log(`Admin password: ${DEFAULT_ADMIN_PASSWORD}`)
  console.log("Initial posts/comments/messages: disabled")

}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
