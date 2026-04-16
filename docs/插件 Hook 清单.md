# 插件 Hook 清单


当前宿主把扩展点分成 5 类：

- `slot`：插入 UI 块
- `surface`：覆盖宿主默认 UI 区块
- `action hook`：在生命周期点执行副作用逻辑
- `waterfall`：同步串行改写数据
- `asyncWaterfall`：异步串行改写数据

## 通用规则

- 所有扩展点都按 `order` 升序执行
- 同 `order` 下按 `addonId:key` 稳定排序
- `slot` 返回 `AddonRenderResult | null`
- `surface` 返回 `AddonRenderResult | null`
- `action hook` 返回 `void`
- `waterfall / asyncWaterfall` 返回下一个值；返回 `undefined` 时保留上一个值
- hook 执行失败时，宿主默认记录 lifecycle log 并继续后续插件
- `before` action hook 在宿主显式传入 `throwOnError: true` 时可中断主流程
- `surface` 只会选择一个插件生效；命中失败时自动回退宿主默认 UI
- 宿主通过 `<AddonSlotRenderer slot="..." props={{ ... }} />` 或 `<AddonSurfaceRenderer surface="..." props={{ ... }} />` 调用时，当前点位上下文会进入 `context.props`

## Action Hook

| Hook | 分类 | 说明 | 返回值 |
| --- | --- | --- | --- |
| `auth.login.before` | auth | 登录成功写入会话前执行副作用或拦截逻辑 | `void` |
| `auth.login.after` | auth | 登录成功后执行副作用逻辑 | `void` |
| `auth.register.before` | auth | 注册写入账户前执行副作用或拦截逻辑 | `void` |
| `auth.register.after` | auth | 注册成功后执行副作用逻辑 | `void` |
| `auth.identity.bind.before` | auth | 第三方身份绑定到现有账户前执行副作用或拦截逻辑 | `void` |
| `auth.identity.bind.after` | auth | 第三方身份绑定完成后执行副作用逻辑 | `void` |
| `auth.identity.unbind.before` | auth | 第三方身份解绑前执行副作用或拦截逻辑 | `void` |
| `auth.identity.unbind.after` | auth | 第三方身份解绑后执行副作用逻辑 | `void` |
| `auth.password.change.before` | auth | 已登录用户修改密码前执行副作用或拦截逻辑 | `void` |
| `auth.password.change.after` | auth | 已登录用户修改密码后执行副作用逻辑 | `void` |
| `auth.password.reset.before` | auth | 通过找回密码流程重置密码前执行副作用或拦截逻辑 | `void` |
| `auth.password.reset.after` | auth | 通过找回密码流程重置密码后执行副作用逻辑 | `void` |
| `post.create.before` | post | 帖子创建前执行副作用或拦截逻辑 | `void` |
| `post.create.after` | post | 帖子创建成功后执行副作用逻辑 | `void` |
| `comment.create.before` | comment | 评论创建前执行副作用或拦截逻辑 | `void` |
| `comment.create.after` | comment | 评论创建成功后执行副作用逻辑 | `void` |
| `message.send.before` | message | 私信发送前执行副作用或拦截逻辑 | `void` |
| `message.send.after` | message | 私信发送成功后执行副作用逻辑 | `void` |
| `payment.paid.before` | payment | 支付到账后的宿主处理前执行副作用逻辑 | `void` |
| `payment.paid.after` | payment | 支付到账后执行副作用逻辑 | `void` |
| `invite-code.purchase.before` | invite | 邀请码购买扣点前执行副作用或拦截逻辑 | `void` |
| `invite-code.purchase.after` | invite | 邀请码购买成功后执行副作用逻辑 | `void` |
| `redeem-code.redeem.before` | redeem | 兑换码核销前执行副作用或拦截逻辑 | `void` |
| `redeem-code.redeem.after` | redeem | 兑换码核销成功后执行副作用逻辑 | `void` |
| `user.update.before` | user | 用户资料更新写入前执行副作用或拦截逻辑 | `void` |
| `user.update.after` | user | 用户资料更新后执行副作用逻辑 | `void` |
| `user.notification-settings.update.before` | user | 用户通知设置写入前执行副作用或拦截逻辑 | `void` |
| `user.notification-settings.update.after` | user | 用户通知设置更新后执行副作用逻辑 | `void` |
| `addon.config.changed.before` | system | 插件配置写入前执行副作用或拦截逻辑 | `void` |
| `addon.config.changed.after` | system | 插件配置变更后执行副作用逻辑 | `void` |

## Waterfall

| Hook | 分类 | 说明 | 返回值 |
| --- | --- | --- | --- |
| `post.slug.value` | post | 串行改写帖子最终 slug | `string` |

## AsyncWaterfall

| Hook | 分类 | 说明 | 返回值 |
| --- | --- | --- | --- |
| `navigation.primary.items` | navigation | 串行改写站点主导航项数组 | `NavigationItem[]` |
| `home.sidebar.hot-topics.items` | home | 串行改写首页右栏热点帖子列表 | `HomeSidebarHotTopic[]` |
| `settings.post-management.tabs` | settings | 串行扩展用户设置页“帖子管理”的插件 tab 列表 | `AddonSettingsPostManagementTab[]` |

## Surface

命名规则：

- 如果宿主同时开放了 `xxx.before` 和 `xxx.after` 两个 slot，中间那块默认 UI 通常会同步开放一个 `xxx` surface
- 例如 `search.hero.before` / `search.hero.after` 对应 `search.hero`
- 例如 `topup.payment.before` / `topup.payment.after` 对应 `topup.payment`
- 例如 `messages.thread.before` / `messages.thread.after` 对应 `messages.thread`
- 例如 `post.create.tools.before` / `post.create.tools.after` 对应 `post.create.tools`
- 例如 `post.author.name.before` / `post.author.name.after` 对应 `post.author.name`
- 例如 `post.author.badges.before` / `post.author.badges.after` 对应 `post.author.badges`

当前已接入的一批常用 surface 包括：

- 页面主体类：`about.page`、`announcements.page`、`auth.complete.page`、`auth.forgot-password.page`、`auth.passkey.page`、`badge.page`、`board.page`、`collections.page`、`funs.page`、`help.page`、`history.page`、`notifications.page`、`prison.page`、`search.page`、`settings.page`、`tag.page`、`tags.page`、`terms.page`、`topup.page`、`topup.result.page`、`vip.page`、`write.page`
- 头部 / Hero 类：`about.hero`、`announcement.hero`、`announcements.hero`、`auth.complete.panel`、`auth.forgot-password.panel`、`auth.passkey.panel`、`badge.hero`、`board.hero`、`collections.hero`、`friend-links.hero`、`search.hero`、`terms.hero`、`vip.hero`、`write.header`
- 帖子作者类：`post.header`、`post.author.row`、`post.author.meta`、`post.author.verification`、`post.author.name`、`post.author.badges`
- 评论作者类：`comment.author.row`、`comment.author.meta`、`comment.author.verification`、`comment.author.name`、`comment.author.badges`
- 内容 / 列表类：`about.highlights`、`about.principles`、`announcement.content`、`announcements.content`、`board.content`、`faq.content`、`friend-links.content`、`notifications.list`、`post.create.form`、`post.create.tools`、`post.create.editor`、`post.create.enhancements`、`post.create.submit`、`prison.content`、`search.results`、`settings.content`、`settings.profile`、`settings.invite`、`settings.post-management`、`settings.board-applications`、`settings.level`、`settings.badges`、`settings.verifications`、`settings.points`、`settings.follows`、`tag.content`、`terms.content`、`topup.payment`、`topup.redeem`、`topup.result.panel`、`vip.actions`、`vip.levels`
- 侧栏 / 辅助区块类：`about.sidebar`、`badge.sidebar`、`board.sidebar`、`collections.sidebar`、`funs.sidebar`、`help.sidebar`、`prison.sidebar`、`tag.sidebar`、`tags.sidebar`、`terms.sidebar`
- 交互区块类：`layout.footer`、`messages.page`、`messages.header`、`messages.sidebar`、`messages.thread`、`collection.hero`、`collection.pending`、`collection.content`、`history.panel`

说明：

- 服务端静态区块一般通过 `render(context)` 接管
- `messages.page`、`settings.page` 属于 hybrid surface：先尝试服务端 `render(context)`，未命中再回退到 `clientModule`
- `messages.header`、`messages.sidebar`、`messages.thread`、`collection.hero`、`collection.pending`、`collection.content`、`history.panel`、`settings.content`、`post.create.form`、`post.create.tools`、`post.create.editor`、`post.create.enhancements`、`post.create.submit`、`comment.author.row`、`comment.author.meta`、`comment.author.verification`、`comment.author.name`、`comment.author.badges` 属于 client-only surface：只支持 `clientModule`
- 如果某个只有单边 slot、纯插入位、或宿主没有默认内容的点位，通常不会对应 surface

## Slot

### 认证

| Slot | 说明 |
| --- | --- |
| `auth.login.captcha` | 在登录表单验证码区域插入 UI |
| `auth.login.form.after` | 在登录表单字段后插入 UI |
| `auth.register.captcha` | 在注册表单验证码区域插入 UI |
| `auth.register.form.after` | 在注册表单字段后插入 UI |
| `post.create.captcha` | 在发帖页验证码区域插入 UI |

### 全局布局

| Slot | 说明 |
| --- | --- |
| `layout.head.before` | 在全站 head 前段插入资源或标记 |
| `layout.head.after` | 在全站 head 尾段插入资源或标记 |
| `layout.header.left` | 在站点头部左侧插入内容 |
| `layout.header.center` | 在站点头部中部插入内容 |
| `layout.header.right` | 在站点头部右侧插入内容 |
| `layout.footer.before` | 在全站页脚主体前插入内容 |
| `layout.footer.after` | 在全站页脚主体后插入内容 |
| `layout.body.start` | 在 body 起始处插入内容 |
| `layout.body.end` | 在 body 结束前插入内容 |
| `layout.sidebar.left.top` | 在左侧边栏顶部插入内容 |
| `layout.sidebar.left.bottom` | 在左侧边栏底部插入内容 |
| `layout.sidebar.right.top` | 在右侧边栏顶部插入内容 |
| `layout.sidebar.right.middle` | 在右侧边栏中部插入内容 |
| `layout.sidebar.right.bottom` | 在右侧边栏底部插入内容 |

### 首页 / 节点 / 帖子

| Slot | 说明 |
| --- | --- |
| `home.right.top` | 在首页右栏顶部插入内容 |
| `home.right.middle` | 在首页右栏中部插入内容 |
| `home.right.bottom` | 在首页右栏底部插入内容 |
| `board.right.top` | 在节点页右栏顶部插入内容 |
| `board.right.middle` | 在节点页右栏中部插入内容 |
| `board.right.bottom` | 在节点页右栏底部插入内容 |
| `post.header.before` | 在帖子详情头部信息区前插入内容 |
| `post.header.after` | 在帖子详情头部信息区后插入内容 |
| `post.author.row.before` | 在帖子作者行前插入内容 |
| `post.author.row.after` | 在帖子作者行后插入内容 |
| `post.author.meta.before` | 在帖子作者元信息区前插入内容 |
| `post.author.meta.after` | 在帖子作者元信息区后插入内容 |
| `post.author.verification.before` | 在帖子作者认证标识前插入内容 |
| `post.author.verification.after` | 在帖子作者认证标识后插入内容 |
| `post.author.name.before` | 在帖子作者用户名区域前插入内容 |
| `post.author.name.after` | 在帖子作者用户名区域后插入内容 |
| `post.author.badges.before` | 在帖子作者勋章区域前插入内容 |
| `post.author.badges.after` | 在帖子作者勋章区域后插入内容 |
| `post.body.before` | 在帖子正文前插入内容 |
| `post.body.after` | 在帖子正文后插入内容 |
| `post.sidebar.top` | 在帖子右栏顶部插入内容 |
| `post.sidebar.bottom` | 在帖子右栏底部插入内容 |
| `comment.item.after` | 在单条评论内容后插入内容 |

### 用户设置

| Slot | 说明 |
| --- | --- |
| `settings.page.before` | 在用户设置页主体前插入内容 |
| `settings.page.after` | 在用户设置页主体后插入内容 |
| `settings.sidebar.top` | 在用户设置页侧栏顶部插入内容 |
| `settings.sidebar.bottom` | 在用户设置页侧栏底部插入内容 |
| `settings.content.before` | 在当前设置分区内容前插入内容 |
| `settings.content.after` | 在当前设置分区内容后插入内容 |
| `settings.profile.before` | 在资料设置分区前插入内容 |
| `settings.profile.after` | 在资料设置分区后插入内容 |
| `settings.invite.before` | 在邀请中心分区前插入内容 |
| `settings.invite.after` | 在邀请中心分区后插入内容 |
| `settings.post-management.before` | 在帖子管理分区前插入内容 |
| `settings.post-management.after` | 在帖子管理分区后插入内容 |
| `settings.board-applications.before` | 在节点申请分区前插入内容 |
| `settings.board-applications.after` | 在节点申请分区后插入内容 |
| `settings.level.before` | 在我的等级分区前插入内容 |
| `settings.level.after` | 在我的等级分区后插入内容 |
| `settings.badges.before` | 在勋章中心分区前插入内容 |
| `settings.badges.after` | 在勋章中心分区后插入内容 |
| `settings.verifications.before` | 在账号认证分区前插入内容 |
| `settings.verifications.after` | 在账号认证分区后插入内容 |
| `settings.points.before` | 在积分明细分区前插入内容 |
| `settings.points.after` | 在积分明细分区后插入内容 |
| `settings.follows.before` | 在我的关注分区前插入内容 |
| `settings.follows.after` | 在我的关注分区后插入内容 |

### 积分 / VIP

| Slot | 说明 |
| --- | --- |
| `topup.page.before` | 在积分充值页主体前插入内容 |
| `topup.page.after` | 在积分充值页主体后插入内容 |
| `topup.payment.before` | 在充值方案区前插入内容 |
| `topup.payment.after` | 在充值方案区后插入内容 |
| `topup.redeem.before` | 在兑换码区前插入内容 |
| `topup.redeem.after` | 在兑换码区后插入内容 |
| `vip.page.before` | 在 VIP 页主体前插入内容 |
| `vip.page.after` | 在 VIP 页主体后插入内容 |
| `vip.hero.before` | 在 VIP 顶部介绍区前插入内容 |
| `vip.hero.after` | 在 VIP 顶部介绍区后插入内容 |
| `vip.actions.before` | 在 VIP 购买操作区前插入内容 |
| `vip.actions.after` | 在 VIP 购买操作区后插入内容 |
| `vip.levels.before` | 在 VIP 等级权益区前插入内容 |
| `vip.levels.after` | 在 VIP 等级权益区后插入内容 |

### 帮助 / 关于

| Slot | 说明 |
| --- | --- |
| `help.page.before` | 在帮助页主体前插入内容 |
| `help.page.after` | 在帮助页主体后插入内容 |
| `help.sidebar.before` | 在帮助页右侧栏前插入内容 |
| `help.sidebar.after` | 在帮助页右侧栏后插入内容 |
| `help.document.before` | 在帮助文档区前插入内容 |
| `help.document.after` | 在帮助文档区后插入内容 |
| `about.page.before` | 在关于页主体前插入内容 |
| `about.page.after` | 在关于页主体后插入内容 |
| `about.hero.before` | 在关于页顶部介绍区前插入内容 |
| `about.hero.after` | 在关于页顶部介绍区后插入内容 |
| `about.highlights.before` | 在关于页亮点说明区前插入内容 |
| `about.highlights.after` | 在关于页亮点说明区后插入内容 |
| `about.principles.before` | 在关于页社区原则区前插入内容 |
| `about.principles.after` | 在关于页社区原则区后插入内容 |
| `about.sidebar.before` | 在关于页右侧栏前插入内容 |
| `about.sidebar.after` | 在关于页右侧栏后插入内容 |

### 发帖页 / 功能区

| Slot | 说明 |
| --- | --- |
| `write.page.before` | 在发帖页主体前插入内容 |
| `write.page.after` | 在发帖页主体后插入内容 |
| `write.header.before` | 在发帖页标题区前插入内容 |
| `write.header.after` | 在发帖页标题区后插入内容 |
| `post.create.form.before` | 在发帖表单整体前插入内容 |
| `post.create.form.after` | 在发帖表单整体后插入内容 |
| `post.create.tools.before` | 在发帖基础设置区前插入内容 |
| `post.create.tools.after` | 在发帖基础设置区后插入内容 |
| `post.create.editor.before` | 在发帖正文编辑器前插入内容 |
| `post.create.editor.after` | 在发帖正文编辑器后插入内容 |
| `post.create.enhancements.before` | 在发帖增强功能区前插入内容 |
| `post.create.enhancements.after` | 在发帖增强功能区后插入内容 |
| `post.create.submit.before` | 在发帖提交区前插入内容 |
| `post.create.submit.after` | 在发帖提交区后插入内容 |

### FAQ / 通知 / 私信 / 搜索

| Slot | 说明 |
| --- | --- |
| `faq.page.before` | 在 FAQ 页面主体前插入内容 |
| `faq.page.after` | 在 FAQ 页面主体后插入内容 |
| `faq.tabs.before` | 在 FAQ 顶部专题导航前插入内容 |
| `faq.tabs.after` | 在 FAQ 顶部专题导航后插入内容 |
| `faq.content.before` | 在 FAQ 正文区前插入内容 |
| `faq.content.after` | 在 FAQ 正文区后插入内容 |
| `notifications.page.before` | 在通知页主体前插入内容 |
| `notifications.page.after` | 在通知页主体后插入内容 |
| `notifications.toolbar.before` | 在通知工具区前插入内容 |
| `notifications.toolbar.after` | 在通知工具区后插入内容 |
| `notifications.list.before` | 在通知列表前插入内容 |
| `notifications.list.after` | 在通知列表后插入内容 |
| `messages.page.before` | 在私信页主体前插入内容 |
| `messages.page.after` | 在私信页主体后插入内容 |
| `messages.header.before` | 在私信标题区前插入内容 |
| `messages.header.after` | 在私信标题区后插入内容 |
| `messages.sidebar.before` | 在私信会话侧栏前插入内容 |
| `messages.sidebar.after` | 在私信会话侧栏后插入内容 |
| `messages.thread.before` | 在私信会话正文前插入内容 |
| `messages.thread.after` | 在私信会话正文后插入内容 |
| `search.page.before` | 在搜索页主体前插入内容 |
| `search.page.after` | 在搜索页主体后插入内容 |
| `search.hero.before` | 在搜索顶部搜索区前插入内容 |
| `search.hero.after` | 在搜索顶部搜索区后插入内容 |
| `search.results.before` | 在搜索结果区前插入内容 |
| `search.results.after` | 在搜索结果区后插入内容 |

### 标签 / 用户主页

| Slot | 说明 |
| --- | --- |
| `tags.page.before` | 在标签广场页主体前插入内容 |
| `tags.page.after` | 在标签广场页主体后插入内容 |
| `tags.hero.before` | 在标签广场顶部介绍区前插入内容 |
| `tags.hero.after` | 在标签广场顶部介绍区后插入内容 |
| `tags.content.before` | 在标签广场内容区前插入内容 |
| `tags.content.after` | 在标签广场内容区后插入内容 |
| `tags.sidebar.before` | 在标签广场右侧栏前插入内容 |
| `tags.sidebar.after` | 在标签广场右侧栏后插入内容 |
| `tag.page.before` | 在单标签页主体前插入内容 |
| `tag.page.after` | 在单标签页主体后插入内容 |
| `tag.hero.before` | 在单标签页顶部介绍区前插入内容 |
| `tag.hero.after` | 在单标签页顶部介绍区后插入内容 |
| `tag.content.before` | 在单标签帖子流前插入内容 |
| `tag.content.after` | 在单标签帖子流后插入内容 |
| `tag.sidebar.before` | 在单标签右侧栏前插入内容 |
| `tag.sidebar.after` | 在单标签右侧栏后插入内容 |
| `user.page.before` | 在用户主页主体前插入内容 |
| `user.page.after` | 在用户主页主体后插入内容 |
| `user.sidebar.before` | 在用户主页左侧资料栏前插入内容 |
| `user.sidebar.after` | 在用户主页左侧资料栏后插入内容 |
| `user.profile.before` | 在用户主页概览区前插入内容 |
| `user.profile.after` | 在用户主页概览区后插入内容 |
| `user.activity.before` | 在用户主页动态区前插入内容 |
| `user.activity.after` | 在用户主页动态区后插入内容 |

### 内容流 / 节点 / 合集

| Slot | 说明 |
| --- | --- |
| `feed.page.before` | 在首页内容流主体前插入内容 |
| `feed.page.after` | 在首页内容流主体后插入内容 |
| `feed.main.before` | 在首页内容流列表前插入内容 |
| `feed.main.after` | 在首页内容流列表后插入内容 |
| `feed.sidebar.before` | 在首页右侧栏前插入内容 |
| `feed.sidebar.after` | 在首页右侧栏后插入内容 |
| `feed.latest.before` | 在首页 / 最新流专属区前插入内容 |
| `feed.latest.after` | 在首页 / 最新流专属区后插入内容 |
| `feed.new.before` | 在新贴流专属区前插入内容 |
| `feed.new.after` | 在新贴流专属区后插入内容 |
| `feed.hot.before` | 在热门流专属区前插入内容 |
| `feed.hot.after` | 在热门流专属区后插入内容 |
| `feed.following.before` | 在关注流专属区前插入内容 |
| `feed.following.after` | 在关注流专属区后插入内容 |
| `feed.universe.before` | 在宇宙流专属区前插入内容 |
| `feed.universe.after` | 在宇宙流专属区后插入内容 |
| `board.page.before` | 在节点页主体前插入内容 |
| `board.page.after` | 在节点页主体后插入内容 |
| `board.hero.before` | 在节点顶部介绍卡前插入内容 |
| `board.hero.after` | 在节点顶部介绍卡后插入内容 |
| `board.content.before` | 在节点帖子流前插入内容 |
| `board.content.after` | 在节点帖子流后插入内容 |
| `board.sidebar.before` | 在节点右侧栏前插入内容 |
| `board.sidebar.after` | 在节点右侧栏后插入内容 |
| `collections.page.before` | 在合集广场页主体前插入内容 |
| `collections.page.after` | 在合集广场页主体后插入内容 |
| `collections.hero.before` | 在合集广场顶部介绍区前插入内容 |
| `collections.hero.after` | 在合集广场顶部介绍区后插入内容 |
| `collections.content.before` | 在合集广场内容区前插入内容 |
| `collections.content.after` | 在合集广场内容区后插入内容 |
| `collections.sidebar.before` | 在合集广场右侧栏前插入内容 |
| `collections.sidebar.after` | 在合集广场右侧栏后插入内容 |
| `collection.page.before` | 在单合集页主体前插入内容 |
| `collection.page.after` | 在单合集页主体后插入内容 |
| `collection.hero.before` | 在单合集头部信息区前插入内容 |
| `collection.hero.after` | 在单合集头部信息区后插入内容 |
| `collection.pending.before` | 在单合集待审核区前插入内容 |
| `collection.pending.after` | 在单合集待审核区后插入内容 |
| `collection.content.before` | 在单合集已收录帖子区前插入内容 |
| `collection.content.after` | 在单合集已收录帖子区后插入内容 |
| `collection.sidebar.before` | 在单合集页右侧栏前插入内容 |
| `collection.sidebar.after` | 在单合集页右侧栏后插入内容 |

### 公告 / 足迹 / 友情链接 / 节点目录 / 勋章详情

| Slot | 说明 |
| --- | --- |
| `announcements.page.before` | 在公告列表页主体前插入内容 |
| `announcements.page.after` | 在公告列表页主体后插入内容 |
| `announcements.hero.before` | 在公告列表顶部说明区前插入内容 |
| `announcements.hero.after` | 在公告列表顶部说明区后插入内容 |
| `announcements.content.before` | 在公告列表区前插入内容 |
| `announcements.content.after` | 在公告列表区后插入内容 |
| `announcement.page.before` | 在单公告页主体前插入内容 |
| `announcement.page.after` | 在单公告页主体后插入内容 |
| `announcement.hero.before` | 在单公告头部信息区前插入内容 |
| `announcement.hero.after` | 在单公告头部信息区后插入内容 |
| `announcement.content.before` | 在单公告正文区前插入内容 |
| `announcement.content.after` | 在单公告正文区后插入内容 |
| `history.page.before` | 在足迹页主体前插入内容 |
| `history.page.after` | 在足迹页主体后插入内容 |
| `history.panel.before` | 在足迹面板前插入内容 |
| `history.panel.after` | 在足迹面板后插入内容 |
| `friend-links.page.before` | 在友情链接页主体前插入内容 |
| `friend-links.page.after` | 在友情链接页主体后插入内容 |
| `friend-links.hero.before` | 在友情链接顶部说明区前插入内容 |
| `friend-links.hero.after` | 在友情链接顶部说明区后插入内容 |
| `friend-links.content.before` | 在友情链接目录区前插入内容 |
| `friend-links.content.after` | 在友情链接目录区后插入内容 |
| `funs.page.before` | 在全部节点页主体前插入内容 |
| `funs.page.after` | 在全部节点页主体后插入内容 |
| `funs.content.before` | 在全部节点内容区前插入内容 |
| `funs.content.after` | 在全部节点内容区后插入内容 |
| `funs.sidebar.before` | 在全部节点右侧栏前插入内容 |
| `funs.sidebar.after` | 在全部节点右侧栏后插入内容 |
| `badge.page.before` | 在勋章详情页主体前插入内容 |
| `badge.page.after` | 在勋章详情页主体后插入内容 |
| `badge.hero.before` | 在勋章详情顶部介绍区前插入内容 |
| `badge.hero.after` | 在勋章详情顶部介绍区后插入内容 |
| `badge.sidebar.before` | 在勋章详情右侧栏前插入内容 |
| `badge.sidebar.after` | 在勋章详情右侧栏后插入内容 |

### 协议 / 小黑屋 / 认证流程 / 充值结果

| Slot | 说明 |
| --- | --- |
| `terms.page.before` | 在论坛协议页主体前插入内容 |
| `terms.page.after` | 在论坛协议页主体后插入内容 |
| `terms.hero.before` | 在论坛协议顶部介绍区前插入内容 |
| `terms.hero.after` | 在论坛协议顶部介绍区后插入内容 |
| `terms.content.before` | 在论坛协议正文区前插入内容 |
| `terms.content.after` | 在论坛协议正文区后插入内容 |
| `terms.sidebar.before` | 在论坛协议页右侧栏前插入内容 |
| `terms.sidebar.after` | 在论坛协议页右侧栏后插入内容 |
| `prison.page.before` | 在小黑屋页主体前插入内容 |
| `prison.page.after` | 在小黑屋页主体后插入内容 |
| `prison.hero.before` | 在小黑屋顶部说明区前插入内容 |
| `prison.hero.after` | 在小黑屋顶部说明区后插入内容 |
| `prison.content.before` | 在小黑屋名单区前插入内容 |
| `prison.content.after` | 在小黑屋名单区后插入内容 |
| `prison.sidebar.before` | 在小黑屋页右侧栏前插入内容 |
| `prison.sidebar.after` | 在小黑屋页右侧栏后插入内容 |
| `auth.forgot-password.page.before` | 在找回密码页主体前插入内容 |
| `auth.forgot-password.page.after` | 在找回密码页主体后插入内容 |
| `auth.forgot-password.panel.before` | 在找回密码面板前插入内容 |
| `auth.forgot-password.panel.after` | 在找回密码面板后插入内容 |
| `auth.passkey.page.before` | 在 Passkey 页面主体前插入内容 |
| `auth.passkey.page.after` | 在 Passkey 页面主体后插入内容 |
| `auth.passkey.panel.before` | 在 Passkey 面板前插入内容 |
| `auth.passkey.panel.after` | 在 Passkey 面板后插入内容 |
| `auth.complete.page.before` | 在第三方登录补全页主体前插入内容 |
| `auth.complete.page.after` | 在第三方登录补全页主体后插入内容 |
| `auth.complete.panel.before` | 在第三方登录补全面板前插入内容 |
| `auth.complete.panel.after` | 在第三方登录补全面板后插入内容 |
| `topup.result.page.before` | 在充值结果页主体前插入内容 |
| `topup.result.page.after` | 在充值结果页主体后插入内容 |
| `topup.result.panel.before` | 在充值结果面板前插入内容 |
| `topup.result.panel.after` | 在充值结果面板后插入内容 |

```js
api.registerActionHook({
  key: "after-login-sync",
  hook: "auth.login.after",
  async handle(context) {
    // ...
  },
})
```

## 示例

```js
api.registerWaterfallHook({
  key: "slug-prefix",
  hook: "post.slug.value",
  transform(context) {
    return `topic-${context.value}`
  },
})

api.registerAsyncWaterfallHook({
  key: "prepend-navigation",
  hook: "navigation.primary.items",
  async transform(context) {
    return [
      { label: "活动", href: "/events", activePrefix: "/events" },
      ...context.value,
    ]
  },
})
```
