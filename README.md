<div align="center">

# Rhex

**现代化全功能论坛系统**

一个面向正式部署、长期维护和二次开发的开源社区平台。

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

[在线演示](https://rhex.im/) · [GitHub](https://github.com/lovedevpanda/Rhex) · [Gitee](https://gitee.com/rhex/Rhex)

</div>

---

## 📖 目录

- [项目简介](#-项目简介)
- [适用场景](#-适用场景)
- [功能预览](#-功能预览)
- [核心功能](#-核心功能)
- [技术栈](#️-技术栈)
- [快速开始](#-快速开始)
- [生产环境部署](#-生产环境部署)
- [常用脚本](#-常用脚本)
- [项目结构](#-项目结构)
- [部署建议](#-部署建议)
- [社区支持](#-社区支持)
- [参与贡献](#-参与贡献)
- [License](#-license)

---

## 💡 项目简介

Rhex 基于 **Next.js App Router** + **Prisma** + **PostgreSQL** 构建，是一套开箱即用的社区系统。内置论坛、用户成长、通知私信、管理后台、内容审核、邀请与兑换、文件上传、应用中心等完整能力，适合搭建兴趣社区、知识社区、品牌论坛和内部讨论平台。

## 🎯 适用场景

| 场景 | 说明 |
|------|------|
| **垂直兴趣社区** | 搭建技术论坛、游戏社区、创作者社区等垂直领域平台 |
| **知识沉淀型社区** | 以 Markdown 为核心的长文社区，支持公式、图表、代码高亮 |
| **企业内部论坛** | 公司内部讨论平台、产品用户社区、会员社区底座 |
| **运营型社区** | 积分、VIP、邀请、活动、应用中心等运营工具齐全 |

## 📸 功能预览

<details>
<summary><b>首页与社区导航</b> — 左右栏布局 · 分区节点导航 · 列表/画廊模式切换</summary>

![首页预览](./docs/preview/home-overview.png)

</details>

<details>
<summary><b>画廊模式</b> — 封面图卡片流 · 悬停预览 · 懒加载</summary>

![画廊模式](./docs/preview/gallery-mode.png)

</details>

<details>
<summary><b>帖子详情</b> — Markdown 渲染 · 代码高亮 · KaTeX · Mermaid · 图片灯箱</summary>

![帖子详情](./docs/preview/post-detail.png)

</details>

<details>
<summary><b>个人主页</b> — 等级 · 勋章 · 认证 · VIP · 积分 · 签到</summary>

![用户主页](./docs/preview/profile-center.png)

</details>

<details>
<summary><b>后台管理</b> — 用户 · 帖子 · 举报 · 日志 · 内容安全 · 站点设置</summary>

![后台总览](./docs/preview/admin-dashboard.png)

</details>

<details>
<summary><b>站点设置</b> — 注册策略 · 积分/VIP · 上传 · 友情链接 · 邀请码/兑换码</summary>

![后台设置](./docs/preview/admin-settings.png)

</details>

<details>
<summary><b>应用中心</b> — 内置五子棋 · 阴阳契 · 自助广告位 · 独立后台配置</summary>

![应用中心](./docs/preview/apps-center.png)

</details>

## ✨ 核心功能

<table>
<tr>
<td width="50%" valign="top">

### 论坛与内容

- 分区 / 节点 / 标签 / 帖子分类
- 普通帖、悬赏帖、投票帖、抽奖帖
- 封面图、画廊模式、精华、置顶、下线、审核
- 回复、楼中楼、点赞、收藏、关注、举报
- 隐藏内容 / 回复解锁 / 付费解锁 / 最低等级可见
- 红包帖、RSS 输出、全文搜索

</td>
<td width="50%" valign="top">

### Markdown 与编辑器

- 代码高亮 (highlight.js)
- KaTeX 数学公式
- Mermaid 流程图 / 图表
- Task List、脚注、上下标、缩写、定义列表
- 安全 HTML 白名单处理
- 图片灯箱、媒体嵌入

</td>
</tr>
<tr>
<td valign="top">

### 用户与成长体系

- 注册 / 登录 / 找回密码 / Passkey / OAuth
- 等级系统、勋章系统、认证系统
- 积分系统、签到、补签
- VIP 多等级差异化权益
- 邀请码、兑换码、邀请奖励

</td>
<td valign="top">

### 社区互动

- 站内通知与未读提示
- 实时私信
- `@` 提及通知
- 公告、友情链接、帮助页、FAQ
- 用户黑名单与屏蔽

</td>
</tr>
<tr>
<td valign="top">

### 后台管理

- 仪表盘总览
- 用户 / 帖子 / 分区 / 节点管理
- 等级 / 勋章 / 认证配置
- 举报中心、日志中心
- 内容安全与敏感词过滤
- 后台全局搜索

</td>
<td valign="top">

### 站点与运营

- 站点信息、Logo、SEO、页脚导航
- 注册策略：开关 / 验证码 / 邮箱验证 / 邀请注册
- 积分 / VIP / 签到 / 补签等价格配置
- 上传策略：本地存储 / OSS / 格式与大小限制
- Markdown 自定义表情
- 首页统计卡片开关

</td>
</tr>
<tr>
<td colspan="2" valign="top">

### 内置应用中心

| 应用 | 说明 |
|------|------|
| 🎮 五子棋 | 免费次数、门票积分、AI 难度、获胜奖励 |
| ☯ 阴阳契 | 税率、彩头范围、每日发起/应战限制 |
| 📢 自助广告位 | 首页广告卡片、价格、插槽、广告订单审核 |

</td>
</tr>
</table>

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| **框架** | Next.js 16 (App Router) + React 19 |
| **样式** | Tailwind CSS 3.4 |
| **数据库** | PostgreSQL |
| **ORM** | Prisma |
| **鉴权** | Session Cookie + Passkey (WebAuthn) + OAuth |
| **运行环境** | Node.js 20+ |

## 🚀 快速开始

### 前置条件

- [Node.js](https://nodejs.org/) 20+
- [PostgreSQL](https://www.postgresql.org/) 16+
- [npm](https://www.npmjs.com/)

### 1. 克隆项目

```bash
git clone https://github.com/lovedevpanda/Rhex.git
cd Rhex
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 并修改为你的实际配置：

```bash
cp .env.example .env
```

```env
# 必填
DATABASE_URL="postgresql://postgres:password@localhost:5432/bbs?schema=public"
SESSION_SECRET="替换为一个长随机字符串"
CAPTCHA_SECRET_KEY="替换为一个长随机字符串"

# 可选：初始管理员账号（仅首次初始化时使用）
SEED_ADMIN_USERNAME="admin"
SEED_ADMIN_PASSWORD="ChangeMe_123456"
SEED_ADMIN_EMAIL="admin@rhex.im"
SEED_ADMIN_NICKNAME="秦始皇"
```

### 4. 初始化数据库

```bash
npm run setup:dev
```

> 该命令会自动校验环境变量、生成 Prisma Client、同步数据库结构，并在需要时写入基础种子数据（站点配置、分区节点、管理员账号、等级体系、勋章规则）。

### 5. 启动开发服务

```bash
npm run dev
```

启动后访问：

| 入口 | 地址 |
|------|------|
| 前台 | http://localhost:3000 |
| 后台 | http://localhost:3000/admin |

> ⚠️ 默认管理员账号 `admin` / `ChangeMe_123456`，请首次登录后立即修改密码。

## 🌐 生产环境部署

**标准流程：**

```bash
npm run build
npm run start
```

**一键构建并启动：**

```bash
npm run start:prod
```

**首次部署（初始化 + 构建 + 启动）：**

```bash
npm run setup:start:prod
```

### 部署检查清单

- [ ] 修改默认管理员用户名和密码
- [ ] 配置站点名称、描述、Logo 和 SEO
- [ ] 检查注册策略、验证码、邮件和邀请配置
- [ ] 配置上传策略（本地存储 / OSS）
- [ ] 配置 HTTPS 和反向代理
- [ ] 设置数据库备份和监控
- [ ] 按业务需要补充分区、节点和权限

## 📋 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发环境 |
| `npm run build` | 构建生产包 |
| `npm run start` | 启动生产服务 |
| `npm run start:prod` | 构建并启动生产服务 |
| `npm run setup:dev` | 开发环境初始化 |
| `npm run setup:prod` | 生产环境初始化 |
| `npm run setup:start` | 初始化 + 启动开发服务 |
| `npm run setup:start:prod` | 初始化 + 构建 + 启动生产服务 |
| `npm run prisma:generate` | 生成 Prisma Client |
| `npm run prisma:push` | 同步数据库结构 |
| `npm run prisma:seed` | 执行种子脚本 |
| `npm run lint` | 运行 ESLint 检查 |

## 📁 项目结构

```text
Rhex/
├── src/
│   ├── app/            # 页面、路由、API Route
│   ├── components/     # UI 组件与交互层
│   ├── db/             # 数据访问层
│   ├── hooks/          # 复用 React Hook
│   ├── lib/            # 业务逻辑与领域服务
│   └── types/          # TypeScript 类型声明
├── prisma/             # 数据模型 (schema) 与种子数据
├── scripts/            # 初始化与构建辅助脚本
├── plugins/            # 插件与扩展能力
├── public/             # 静态资源
├── docs/               # 文档与截图
└── package.json
```


## 社区支持

<div align="center">

**学 AI，上 L 站**

[![LINUX DO](https://img.shields.io/badge/LINUX%20DO-社区支持-blue?style=for-the-badge)](https://linux.do)

本项目在 [LINUX DO](https://linux.do) 社区发布与交流，感谢佬友们的支持与反馈。

</div>

---

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的修改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

## 📄 License

本项目基于 [MIT License](./LICENSE) 开源。
