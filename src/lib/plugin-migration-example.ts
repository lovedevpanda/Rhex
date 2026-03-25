export const pluginMigrationExecutorNotes = {
  guarantees: [
    "插件迁移按文件名顺序执行。",
    "已执行过的迁移文件会记录到 plugins/<slug>/.plugin-state/migrations.json。",
    "重复安装同一插件时，只会执行新增迁移，不会重复执行旧迁移。",
    "当前版本支持 SQL 文件迁移，不执行任意脚本。",
  ],
}
