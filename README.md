## Rhex 论坛系统 `v1.0.0`

> 注意项目正在迭代中，运用到线上需谨慎!

一个面向正式部署与长期维护的现代论坛系统，基于 `Next.js App Router`、`Prisma` 与 `PostgreSQL` 构建。

`Rhex` 提供分区、板块、帖子、评论、等级、徽章、通知、私信、管理员后台等核心能力，并保持清晰的分层结构，便于二次开发与长期演进。

### 项目简介

- **演示站**：[https://rhex.im/](https://rhex.im/)
- **问题反馈**：当前如发现 Bug，也请直接在演示站内反馈

本项目适合以下场景：


- **自建社区**：搭建垂直论坛、兴趣社区、知识讨论站
- **团队内部讨论平台**：用于组织、项目组或产品用户社区
- **二次开发底座**：在现有论坛模型上扩展会员、插件、激励体系等能力

### 核心特性

- **完整论坛模型**：分区、板块、主题、评论、关注、收藏、点赞、举报、公告
- **后台管理能力**：支持站点设置、内容管理、结构管理、用户管理、审核与运营
- **用户成长体系**：默认包含等级、积分、徽章、签到、VIP 等成长能力
- **站内互动能力**：支持通知、私信、@ 提及、打赏、邀请码等机制
- **可扩展架构**：遵循分层设计，便于维护、重构与功能扩展

### 技术栈

- **前端框架**：`Next.js 14`、`React 18`
- **样式方案**：`Tailwind CSS`
- **数据库**：`PostgreSQL`
- **ORM**：`Prisma`
- **认证方式**：基于数据库用户与服务端 Session Cookie
- **运行环境**：`Node.js 20+`

### 功能概览

当前项目已具备的主要模块包括：

- **社区结构**：分区、板块、标签、帖子分类
- **内容系统**：发帖、评论、楼中楼、Markdown 扩展渲染
- **互动系统**：点赞、收藏、关注、通知、私信、提及
- **用户系统**：注册、登录、找回密码、个人资料、等级进度
- **成长系统**：积分、签到、徽章、VIP、邀请码、兑换码
- **运营系统**：公告、友情链接、举报处理、后台日志
- **安全与风控**：验证码开关、内容安全校验、权限控制
- **插件能力**：包含插件注册与构建相关基础设施

### 环境要求

- **Node.js**：`20+`
- **PostgreSQL**：`14+`

### 快速开始

#### 1. 安装依赖

```bash
npm install
```

#### 2. 创建环境变量

在项目根目录创建 `.env` 文件，至少包含以下必填内容：

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/bbs?schema=public"
SESSION_SECRET="replace_this_with_a_long_random_secret"
CAPTCHA_SECRET_KEY="replace_this_with_a_long_random_secret"
```


#### 3. 初始化数据库与基础数据

开发环境推荐直接执行：

```bash
npm run setup:dev
```

该命令会自动完成：

- 校验必要环境变量
- 生成 `Prisma Client`
- 使用 `prisma db push` 同步数据库结构
- 探测当前数据库状态
- 在需要时写入基础业务数据

#### 4. 启动开发服务器

```bash
npm run dev
```

启动后默认访问本地开发地址：`http://localhost:3000`

### 生产环境启动

```bash
npm run build
npm run start
```

或者使用项目内置命令：

```bash
npm run start:prod
```

如果你希望在生产模式下先执行初始化再启动，可使用：

```bash
npm run setup:start:prod
```

### 初始化数据说明

默认情况下，`prisma/seed.ts` 会写入以下核心数据：

- **站点基础配置**：站点名称、SEO、上传策略、注册策略等
- **论坛基础结构**：默认分区与板块
- **管理员账号**：用于首次登录后台
- **等级体系**：默认 9 个等级
- **徽章体系**：内置基础徽章规则


### 可选环境变量

初始化相关变量：

- `SEED_ADMIN_USERNAME`：初始管理员用户名，默认 `admin`
- `SEED_ADMIN_PASSWORD`：初始管理员密码，默认 `ChangeMe_123456`
- `SEED_ADMIN_EMAIL`：初始管理员邮箱
- `SEED_ADMIN_NICKNAME`：初始管理员昵称，默认 `站长`
- `SEED_RESET_DATABASE=true`：执行 seed 前清空现有业务数据
- `SETUP_FORCE_SEED=true`：即使数据库已有核心数据也强制重新执行 seed

验证码相关变量：

- `TURNSTILE_SECRET_KEY`：Cloudflare Turnstile 服务端密钥
- `CAPTCHA_SECRET_KEY`：内置验证码相关密钥（如使用）

数据库缓存相关变量（可选）：

- `DB_CLIENT_CACHE_LOG`
- `DB_CLIENT_CACHE_TTL_MS`
- `DB_CLIENT_CACHE_MAX_ENTRIES`
- `DB_CLIENT_CACHE_MAX_VALUE_BYTES`
- `DB_CLIENT_CACHE_MAX_HEAP_MB`
- `DB_CLIENT_CACHE_CLEANUP_INTERVAL_MS`

如果你暂时只是本地开发，通常只配置 `DATABASE_URL` 与 `SESSION_SECRET` 即可启动主流程。

### 演示内容导入

如果你想在本地快速预览一个更完整的社区氛围，可以手动导入演示内容。

在类 Unix 环境中：

```bash
SEED_RESET_DATABASE=true SEED_WITH_DEMO_CONTENT=true npm run prisma:seed
```

在 Windows PowerShell 中：

```powershell
$env:SEED_RESET_DATABASE="true"; $env:SEED_WITH_DEMO_CONTENT="true"; npm run prisma:seed
```

### 常用脚本

- `npm run dev`：启动开发环境
- `npm run build`：构建生产包
- `npm run start`：启动生产服务
- `npm run start:prod`：构建并启动生产服务
- `npm run setup:dev`：开发环境初始化
- `npm run setup:prod`：生产环境初始化
- `npm run setup:start`：初始化后启动开发服务
- `npm run setup:start:prod`：初始化后启动生产服务
- `npm run prisma:generate`：生成 Prisma Client
- `npm run prisma:push`：同步数据库结构
- `npm run prisma:seed`：执行种子数据脚本
- `npm run plugins:generate`：生成插件构建产物
- `npm run version:sync`：同步发布版本内容

### 项目结构

项目遵循相对清晰的职责拆分：

- `src/app`：页面、路由处理器、站点入口
- `src/components`：通用 UI 组件
- `src/db`：数据库访问层、查询与持久化逻辑
- `src/lib`：业务逻辑层与领域服务
- `prisma`：数据库模型与种子脚本
- `scripts`：项目初始化与构建辅助脚本
- `plugins`：插件相关资源与扩展能力

其中：

- **数据库相关代码** 建议统一维护在 `src/db`
- **业务逻辑相关代码** 建议统一维护在 `src/lib`

这有助于长期保持可维护性与职责边界清晰。

### 首次部署后的建议操作

完成首次部署后，建议优先处理以下事项：

- **立即修改默认管理员密码**
- **更新站点名称、Logo、SEO 信息**
- **检查注册、上传、验证码、邮箱等策略配置**
- **决定是否开放公开注册**
- **根据实际业务补充分区与板块结构**
- **配置 HTTPS、反向代理、日志与数据库备份**

### 适合二次开发的方向

如果你准备继续扩展，这个项目比较适合往以下方向演进：

- **会员体系增强**：订阅、付费权限、专属板块
- **内容策略增强**：审核流、敏感词、推荐算法、热度机制
- **站内交易或激励系统**：积分商城、任务系统、勋章活动
- **插件化扩展**：围绕现有插件基础设施做模块化能力封装
- **运维能力增强**：监控、审计、缓存、异步任务、对象存储

### License

本项目采用 **MIT License**。

你可以自由使用、修改、分发以及商业化，但需要保留原始版权与许可证声明。
