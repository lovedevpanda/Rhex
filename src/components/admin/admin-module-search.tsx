"use client"

import Link from "next/link"
import { Search, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getAdminSettingsHref } from "@/lib/admin-settings-navigation"
import { cn } from "@/lib/utils"

interface AdminModuleSearchItem {
  href: string
  label: string
  category: string
  description: string
  keywords: string[]
}

const ADMIN_MODULE_SEARCH_ITEMS: AdminModuleSearchItem[] = [
  { href: "/admin", label: "总览", category: "后台", description: "查看用户、帖子、举报和趋势总览。", keywords: ["首页", "概览", "数据面板", "统计", "趋势", "控制台", "后台首页", "仪表盘"] },
  { href: "/admin?tab=users", label: "用户管理", category: "模块", description: "查看用户资料、状态、积分和登录记录。", keywords: ["用户", "账号", "昵称", "改昵称", "修改昵称", "昵称修改", "昵称价格", "禁言", "封禁", "积分", "用户积分", "会员用户", "用户状态"] },
  { href: "/admin?tab=posts", label: "帖子管理", category: "模块", description: "筛选帖子、审核内容、置顶和精华。", keywords: ["帖子", "发帖", "帖子审核", "审核帖子", "精华", "置顶", "下线", "下线帖子", "帖子下线", "离线帖子", "推荐帖子"] },
  { href: "/admin?tab=comments", label: "评论管理", category: "模块", description: "筛选评论、处理审核、上下线回复内容。", keywords: ["评论", "回复", "评论审核", "审核评论", "下线评论", "恢复评论", "待审核评论", "评论管理"] },
  { href: "/admin?tab=structure", label: "版块管理", category: "模块", description: "维护分区、节点和发帖权限。", keywords: ["版块", "分区", "节点", "导航", "发帖权限", "板块", "栏目", "论坛结构"] },
  { href: "/admin?tab=board-applications", label: "节点申请处理", category: "模块", description: "集中审核前台节点申请，处理通过、驳回与状态流转。", keywords: ["节点申请", "板块申请", "节点申请审核", "审核节点申请", "申请节点", "待审核节点申请", "节点申请处理"] },
  { href: "/admin?tab=levels", label: "等级系统", category: "模块", description: "配置等级、经验和升级规则。", keywords: ["等级", "经验", "升级", "level", "成长值", "等级规则"] },
  { href: "/admin?tab=badges", label: "勋章系统", category: "模块", description: "配置勋章、授予规则和展示。", keywords: ["勋章", "徽章", "badge", "成就", "佩戴勋章"] },
  { href: "/admin?tab=verifications", label: "认证系统", category: "模块", description: "审核认证类型和用户认证申请。", keywords: ["认证", "实名", "资质", "审核", "认证申请", "实名审核"] },
  { href: "/admin?tab=verifications&verificationSubTab=types", label: "认证类型", category: "模块子页", description: "配置认证类型、展示样式和申请字段。", keywords: ["认证类型", "认证配置", "实名类型", "资质类型", "新增认证类型", "编辑认证类型"] },
  { href: "/admin?tab=verifications&verificationSubTab=reviews", label: "认证审核", category: "模块子页", description: "独立处理用户认证申请、通过与驳回。", keywords: ["认证审核", "审核认证", "认证申请审核", "实名审核", "资质审核", "待审核认证"] },
  { href: "/admin?tab=announcements", label: "站点文档", category: "模块", description: "统一管理公告与帮助文档，支持内部文档和链接跳转。", keywords: ["公告", "帮助文档", "文档", "站点文档", "通知", "置顶公告", "slug"] },
  { href: "/admin?tab=reports", label: "举报中心", category: "模块", description: "处理帖子、回复和用户举报。", keywords: ["举报", "投诉", "违规", "风控", "举报处理"] },
  { href: "/admin?tab=logs", label: "日志中心", category: "模块", description: "查看管理员、登录、积分、上传、支付和 VIP 订单日志。", keywords: ["日志", "操作记录", "登录日志", "积分日志", "上传日志", "支付流水", "审计日志"] },
  { href: "/admin?tab=logs&logSubTab=admin", label: "管理员日志", category: "日志子页", description: "查看管理员处理举报、审核、封禁、置顶等后台操作记录。", keywords: ["管理员日志", "后台日志", "操作日志", "审核日志", "封禁日志", "禁言日志", "帖子审核日志"] },
  { href: "/admin?tab=logs&logSubTab=login", label: "用户登录日志", category: "日志子页", description: "查看用户登录时间、账号和 IP 等登录记录。", keywords: ["登录日志", "用户登录日志", "登录记录", "登录ip", "登录 IP", "账号登录"] },
  { href: "/admin?tab=logs&logSubTab=checkins", label: "签到日志", category: "日志子页", description: "查看正常签到、补签和每日签到记录。", keywords: ["签到日志", "签到记录", "签到", "补签", "补签日志", "每日签到", "补签记录"] },
  { href: "/admin?tab=logs&logSubTab=points", label: "积分日志", category: "日志子页", description: "查看积分收入、支出和各类积分变动记录。", keywords: ["积分日志", "积分记录", "积分变动", "积分收入", "积分支出", "扣积分", "加积分"] },
  { href: "/admin?tab=logs&logSubTab=uploads", label: "上传日志", category: "日志子页", description: "查看头像、帖子图片和附件上传记录。", keywords: ["上传日志", "上传记录", "图片上传日志", "头像上传日志", "附件上传日志", "帖子图片上传"] },
  { href: "/admin?tab=logs&logSubTab=payments", label: "支付流水", category: "日志子页", description: "查看支付网关下单、支付状态、到账履约和第三方流水号。", keywords: ["支付流水", "支付网关流水", "支付日志", "支付订单", "支付单号", "商户单号", "第三方流水", "支付记录"] },
  { href: "/admin?tab=logs&logSubTab=orders", label: "VIP 订单日志", category: "日志子页", description: "查看 VIP 购买、积分支付和时长变更记录。", keywords: ["VIP订单日志", "VIP订单", "购买记录", "付款记录", "会员订单"] },
  { href: "/admin?tab=security", label: "内容安全", category: "模块", description: "维护敏感词和内容审核规则。", keywords: ["敏感词", "内容安全", "审核词", "security", "违禁词", "屏蔽词"] },
  { href: "/admin/apps", label: "应用中心", category: "模块", description: "查看站点内置应用列表和各应用后台入口。", keywords: ["应用", "应用中心", "小程序", "功能模块", "独立应用", "应用后台", "应用列表"] },
  { href: "/admin/apps/ai-reply", label: "AI 助手后台", category: "应用设置", description: "配置 AI 开关、模型接口、提示词、代理账号和异步回复任务。", keywords: ["ai", "大模型", "智能回复", "ai 助手", "代理账号", "提示词", "模型接口", "base url", "api key", "评论机器人", "自动回帖", "@ai"] },
  { href: "/admin/apps/gobang", label: "五子棋应用后台", category: "应用设置", description: "配置五子棋免费次数、门票积分、AI 难度和获胜奖励。", keywords: ["五子棋", "gobang", "五子棋后台", "五子棋设置", "每日普通免费次数", "每日 VIP 免费次数", "普通用户每日总次数", "VIP 用户每日总次数", "门票积分", "超额门票积分", "AI 难度", "获胜奖励", "前台入口名称"] },
  { href: "/admin/apps/yinyang-contract", label: "阴阳契应用后台", category: "应用设置", description: "配置阴阳契税率、彩头范围与每日发起应战次数。", keywords: ["阴阳契", "阴阳契后台", "阴阳契设置", "税率", "税率基点", "彩头", "最小彩头", "最大彩头", "每日发起次数", "每日应战次数", "前台入口名称"] },
  { href: "/admin/apps/self-serve-ads", label: "自助广告位应用后台", category: "应用设置", description: "配置首页广告位价格、布局、插槽，并审核广告订单。", keywords: ["自助广告位", "广告位", "广告位后台", "广告设置", "广告审核", "广告订单", "图片广告", "文字广告", "图片广告价格", "文字广告价格", "图片广告位数量", "文字广告位数量", "首页显示广告卡片", "卡片标题", "占位按钮文案", "侧栏插槽", "侧栏排序值", "广告价格"] },
  { href: "/admin/apps/payment-gateway", label: "支付网关后台", category: "应用设置", description: "管理支付网关基础配置、充值套餐、通道启停和场景路由规则。", keywords: ["支付网关", "支付后台", "充值套餐", "支付路由", "支付通道", "payment gateway", "订单超时", "自定义充值", "积分充值"] },
  { href: "/admin/apps/payment-gateway/alipay", label: "支付宝接口配置", category: "应用设置子页", description: "单独管理支付宝 AppId、沙箱、公钥模式、证书模式和敏感密钥。", keywords: ["支付宝", "alipay", "支付宝接口", "支付宝配置", "appid", "seller id", "沙箱", "公钥模式", "证书模式", "私钥", "支付宝公钥", "根证书"] },
  { href: "/admin/apps/rss-harvest", label: "RSS 抓取中心", category: "应用设置", description: "配置 RSS 地址、抓取频率、任务启停、持久化队列与爬虫日志。", keywords: ["rss", "抓取", "采集", "rss抓取", "feed", "atom", "爬虫", "抓取队列", "抓取日志", "任务调度", "定时抓取"] },
  { href: "/admin/apps/rss-harvest/entries", label: "RSS 采集数据", category: "应用设置子页", description: "查看 RSS 入库内容，支持分页、审核、编辑、单删和批量处理。", keywords: ["rss数据", "采集数据", "rss入库", "rss审核", "批量审核", "批量删除", "rss内容管理", "采集内容"] },
  { href: getAdminSettingsHref("profile"), label: "基础信息", category: "站点设置", description: "站点名称、描述、Logo 和基础展示信息。", keywords: ["站点名称", "站点描述", "logo", "基础设置", "profile", "站点信息", "网站标题", "网站描述"] },
  { href: getAdminSettingsHref("profile", "branding"), label: "品牌基础", category: "站点设置子页", description: "配置站点名称、Logo 文案和 Slogan。", keywords: ["品牌基础", "站点名称", "logo文案", "slogan"] },
  { href: getAdminSettingsHref("profile", "homepage"), label: "首页展示", category: "站点设置子页", description: "配置帖子链接模式、首页 feed、左右侧栏展示和搜索开关。", keywords: ["首页展示", "帖子链接显示模式", "slug模式", "id模式", "首页帖子列表形式", "画廊模式", "右侧统计卡片", "站点公告", "站内搜索", "左侧导航", "左侧导航模式", "左侧展示模式", "隐藏左侧导航", "吸附左侧导航", "左侧默认隐藏"] },
  { href: getAdminSettingsHref("profile", "seo"), label: "SEO 与统计", category: "站点设置子页", description: "配置站点描述、SEO 关键字和页脚统计代码。", keywords: ["seo", "统计代码", "页脚统计代码", "站点seo关键字", "metadata keywords", "站点描述"] },
  { href: getAdminSettingsHref("markdown-emoji"), label: "Markdown 表情", category: "站点设置", description: "配置 Markdown 短码表情和 SVG 图标。", keywords: ["markdown", "表情", "emoji", "短码", "markdown 表情", "表情短码"] },
  { href: getAdminSettingsHref("footer-links"), label: "页脚导航", category: "站点设置", description: "配置页脚链接和外部导航。", keywords: ["页脚", "footer", "链接", "导航", "页脚链接", "底部导航"] },
  { href: getAdminSettingsHref("apps"), label: "应用导航", category: "站点设置", description: "配置头部应用入口和图标。", keywords: ["应用导航", "头部导航", "app", "header", "顶部应用", "应用入口"] },
  { href: getAdminSettingsHref("registration"), label: "注册与邀请", category: "站点设置", description: "注册开关、邀请码、邮箱手机验证和邀请策略。", keywords: ["注册", "邀请", "邀请码", "邀请注册", "验证码", "邮箱验证", "手机验证", "邮箱验证码", "手机验证码", "注册开关", "邀请奖励", "邀请码购买", "购买邀请码"] },
  { href: getAdminSettingsHref("registration", "invite"), label: "注册与邀请码", category: "站点设置子页", description: "控制注册开关、邀请码策略和邀请奖励。", keywords: ["注册与邀请码", "允许新用户注册", "显示邀请码输入框", "注册必须邀请码", "积分购买邀请码", "初始注册赠送积分", "邀请人奖励", "被邀请人奖励"] },
  { href: getAdminSettingsHref("registration", "captcha"), label: "注册验证码", category: "站点设置子页", description: "配置注册和登录验证码模式，以及 Turnstile 密钥。", keywords: ["注册验证码", "登录验证码", "turnstile", "turnstile site key", "turnstile secret key", "图形验证码", "pow验证码", "工作量证明"] },
  { href: getAdminSettingsHref("registration", "fields"), label: "注册表单字段", category: "站点设置子页", description: "配置邮箱、手机、昵称、性别和邀请人字段。", keywords: ["注册表单字段", "邮箱必填", "邮箱验证", "手机必填", "手机验证", "昵称必填", "性别必填", "邀请人输入框"] },
  { href: getAdminSettingsHref("registration", "security"), label: "账号安全", category: "站点设置子页", description: "配置异地登录邮件提醒和修改密码时的邮箱验证策略。", keywords: ["账号安全", "安全", "登录ip提醒", "登录 IP 提醒", "异地登录", "邮箱安全提醒", "修改密码邮件验证", "改密邮箱验证", "密码安全"] },
  { href: getAdminSettingsHref("registration", "email-templates"), label: "邮件模板", category: "站点设置子页", description: "配置注册验证码和找回密码邮件的主题、纯文本与 HTML 模板。", keywords: ["邮件模板", "注册邮件模板", "找回密码邮件模板", "验证码邮件模板", "邮件主题模板", "html邮件模板", "文本邮件模板"] },
  { href: getAdminSettingsHref("registration", "auth"), label: "第三方登录", category: "站点设置子页", description: "配置 GitHub、Google 和 Passkey 登录参数。", keywords: ["第三方登录", "github登录", "google登录", "passkey", "github client id", "github client secret", "google client id", "passkey rp id", "passkey origin"] },
  { href: getAdminSettingsHref("registration", "smtp"), label: "SMTP 邮件", category: "站点设置子页", description: "配置 SMTP 主机、端口、账号和发件人信息。", keywords: ["smtp", "邮件发送", "smtp主机", "smtp端口", "smtp账号", "smtp密码", "授权码", "发件人地址", "ssl", "tls"] },
  { href: getAdminSettingsHref("board-applications"), label: "节点申请设置", category: "站点设置", description: "单独控制前台节点申请入口和申请开关。", keywords: ["节点申请", "开启节点申请", "关闭节点申请", "板块申请", "节点申请开关", "前台节点申请入口", "节点申请设置"] },
  { href: getAdminSettingsHref("interaction"), label: "互动与热度", category: "站点设置", description: "配置打赏、热度、评论和互动规则。", keywords: ["互动", "热度", "打赏", "评论", "点赞", "回帖", "回复"] },
  { href: getAdminSettingsHref("interaction", "comments"), label: "评论展示", category: "站点设置子页", description: "配置游客评论可见性、楼中楼默认展开数量和评论分页。", keywords: ["评论展示", "游客可查看评论", "评论区一页显示数", "楼中楼默认展开条数", "评论分页", "回复显示"] },
  { href: getAdminSettingsHref("interaction", "content-limits"), label: "内容限制", category: "站点设置子页", description: "配置发帖标题、正文、回复的字数限制，以及帖子和评论的可编辑时长。", keywords: ["内容限制", "标题最小字数", "标题最大字数", "正文最小字数", "正文最大字数", "回复最小字数", "回复最大字数", "字数限制", "帖子可编辑分钟数", "评论可编辑分钟数", "编辑时效", "编辑分钟数"] },
  { href: getAdminSettingsHref("interaction", "anonymous-post"), label: "匿名发帖", category: "站点设置子页", description: "配置匿名发帖开关、价格、次数和匿名回复身份规则。", keywords: ["匿名发帖", "匿名回复", "匿名马甲", "匿名发帖价格", "每日匿名发帖次数", "匿名帖默认匿名回复"] },
  { href: getAdminSettingsHref("interaction", "tipping"), label: "打赏送礼", category: "站点设置子页", description: "配置帖子打赏开关、次数限制、礼物列表和打赏送礼税。", keywords: ["打赏送礼", "帖子打赏", "每日可打赏次数", "单帖可打赏次数", "裸积分打赏档位", "礼物打赏", "打赏税", "送礼税", "税率BPS"] },
  { href: getAdminSettingsHref("interaction", "gates"), label: "发布门槛", category: "站点设置子页", description: "配置发帖、评论的邮箱验证门槛和注册时长门槛。", keywords: ["发布门槛", "发帖门槛", "评论门槛", "邮箱验证门槛", "注册时长门槛", "注册分钟数", "发帖限制", "评论限制"] },
  { href: getAdminSettingsHref("interaction", "reward-pool"), label: "红包与聚宝盆", category: "站点设置子页", description: "配置帖子红包、随机命中概率、聚宝盆积分池和中奖概率。", keywords: ["红包与聚宝盆", "帖子红包", "红包最大积分", "每日发红包积分上限", "红包随机命中概率", "聚宝盆", "初始积分", "回复递增积分", "聚宝盆回复中奖概率"] },
  { href: getAdminSettingsHref("interaction", "heat"), label: "热度算法", category: "站点设置子页", description: "配置帖子热度权重、阈值和颜色色板。", keywords: ["热度算法", "浏览权重", "回复权重", "点赞权重", "打赏次数权重", "打赏积分权重", "热度阈值", "热度颜色", "颜色色板"] },
  { href: getAdminSettingsHref("interaction", "preview"), label: "热度预览", category: "站点设置子页", description: "实时预览热度分数和颜色阶段表现。", keywords: ["热度预览", "热度分数", "颜色预览", "浏览数", "回复数", "点赞数", "打赏次数", "打赏积分"] },
  { href: getAdminSettingsHref("friend-links"), label: "友情链接", category: "站点设置", description: "管理友情链接展示、申请和审核。", keywords: ["友情链接", "友链", "link", "合作站点", "友链审核"] },
  { href: getAdminSettingsHref("registration", "invite-codes"), label: "邀请码管理", category: "站点设置子页", description: "在注册与邀请设置里管理邀请码列表、购买和使用。", keywords: ["邀请码", "邀请", "注册码", "invite code", "购买邀请码", "邀请码列表", "邀请码管理"] },
  { href: getAdminSettingsHref("vip", "redeem-codes"), label: "兑换码管理", category: "站点设置子页", description: "在积分与VIP设置里管理兑换码生成和兑换。", keywords: ["兑换码", "兑换", "redeem", "礼品码", "卡密"] },
  { href: getAdminSettingsHref("vip"), label: "积分与VIP", category: "站点设置", description: "管理积分名称、VIP 价格和会员权益。", keywords: ["积分", "vip", "会员", "vip1", "vip2", "vip3", "会员权益", "vip价格", "积分费用", "积分规则", "补签", "补签价格", "补签费用", "签到", "签到奖励", "签到奖励数量", "签到积分", "改名价格", "改昵称", "修改昵称", "昵称价格", "下线帖子", "帖子下线", "下线费用", "邀请码价格", "购买邀请码价格"] },
  { href: getAdminSettingsHref("upload"), label: "上传", category: "站点设置", description: "配置上传方式、格式和大小限制。", keywords: ["上传", "图片", "上传图片", "图片上传", "头像上传", "封面图", "封面上传", "附件", "附件上传", "上传大小", "图片格式", "上传格式", "存储", "oss", "对象存储"] },
  { href: getAdminSettingsHref("upload", "watermark"), label: "水印配置", category: "站点设置子页", description: "配置图片水印文字、位置、透明度、字号和边距。", keywords: ["水印配置", "图片水印", "水印文字", "水印位置", "水印透明度", "水印字号", "水印边距", "上传水印"] },
  { href: getAdminSettingsHref("upload", "attachment"), label: "附件配置", category: "站点设置子页", description: "配置附件上传下载开关、等级门槛、格式和大小限制。", keywords: ["附件配置", "附件上传", "附件下载", "附件格式", "附件大小", "附件门槛", "附件等级限制", "附件VIP限制"] },
]

interface AdminModuleSearchProps {
  className?: string
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function normalizeComparableText(value: string) {
  return normalizeText(value).replace(/\s+/g, "")
}

function getSearchScore(item: AdminModuleSearchItem, keyword: string) {
  const normalizedKeyword = normalizeText(keyword)
  const compactKeyword = normalizeComparableText(keyword)

  if (!normalizedKeyword) {
    return 0
  }

  const normalizedLabel = normalizeText(item.label)
  const compactLabel = normalizeComparableText(item.label)
  const normalizedCategory = normalizeText(item.category)
  const normalizedDescription = normalizeText(item.description)
  const normalizedKeywords = item.keywords.map((entry) => normalizeText(entry))
  const compactKeywords = item.keywords.map((entry) => normalizeComparableText(entry))
  const searchableText = [normalizedLabel, normalizedCategory, normalizedDescription, ...normalizedKeywords].join(" ")
  const compactSearchableText = [compactLabel, normalizeComparableText(item.category), normalizeComparableText(item.description), ...compactKeywords].join("")

  if (normalizedLabel === normalizedKeyword || compactLabel === compactKeyword) {
    return 120
  }

  if (normalizedKeywords.some((entry) => entry === normalizedKeyword) || compactKeywords.some((entry) => entry === compactKeyword)) {
    return 100
  }

  if (normalizedLabel.startsWith(normalizedKeyword) || compactLabel.startsWith(compactKeyword)) {
    return 80
  }

  if (normalizedKeywords.some((entry) => entry.startsWith(normalizedKeyword)) || compactKeywords.some((entry) => entry.startsWith(compactKeyword))) {
    return 70
  }

  if (normalizedLabel.includes(normalizedKeyword) || compactLabel.includes(compactKeyword)) {
    return 50
  }

  if (normalizedKeywords.some((entry) => entry.includes(normalizedKeyword)) || compactKeywords.some((entry) => entry.includes(compactKeyword))) {
    return 40
  }

  if (normalizedDescription.includes(normalizedKeyword) || normalizedCategory.includes(normalizedKeyword)) {
    return 20
  }

  if (searchableText.includes(normalizedKeyword) || compactSearchableText.includes(compactKeyword)) {
    return 10
  }

  return 0
}

export function AdminModuleSearch({ className }: AdminModuleSearchProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [keyword, setKeyword] = useState("")
  const [open, setOpen] = useState(false)

  const normalizedKeyword = normalizeText(keyword)
  const results = useMemo(() => {
    if (!normalizedKeyword) {
      return []
    }

    return ADMIN_MODULE_SEARCH_ITEMS
      .map((item) => {
        const score = getSearchScore(item, normalizedKeyword)

        return score > 0 ? { ...item, score } : null
      })
      .filter(Boolean)
      .sort((left, right) => (right?.score ?? 0) - (left?.score ?? 0))
      .slice(0, 8) as Array<AdminModuleSearchItem & { score: number }>
  }, [normalizedKeyword])

  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (!containerRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [open])

  return (
    <div ref={containerRef} className={cn("relative w-full max-w-md", className)}>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background/90 px-3 py-2 shadow-xs">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          className="h-8 border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
          placeholder="搜索后台功能，例如：签到日志、邀请码"
          maxLength={30}
        />
        {keyword ? (
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => {
              setKeyword("")
              setOpen(false)
            }}
            aria-label="清空后台搜索"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {open && normalizedKeyword ? (
        <Card className="absolute right-0 top-[calc(100%+10px)] z-50 w-full overflow-hidden border-none shadow-2xl">
          {results.length > 0 ? (
            <CardContent className="max-h-[360px] overflow-y-auto p-2">
              {results.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg px-3 py-3 transition-colors hover:bg-muted"
                  onClick={() => setOpen(false)}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{item.category}</Badge>
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                  </div>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">{item.description}</p>
                </Link>
              ))}
            </CardContent>
          ) : (
            <CardContent className="px-4 py-5 text-sm text-muted-foreground">
              没有找到相关后台入口，试试更短的关键词。
            </CardContent>
          )}
        </Card>
      ) : null}
    </div>
  )
}
