export const pluginSystemNotes = {
  design: [
    "插件通过自动生成的 bundle registry 进行静态注册，避免运行时任意执行代码带来的不确定性，同时不再手写维护 registry 文件。",

    "安装/卸载状态与配置独立保存在 SiteSetting.pluginStateJson 中，不污染主业务表结构。",
    "卸载默认走软卸载，隐藏入口但保留历史数据和积分流水，做到无损撤出。",
    "插件与积分系统通过统一适配层对接，避免每个游戏重复写积分事务代码。",
  ],
}
