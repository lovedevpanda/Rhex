export const pluginPackageExample = {
  installSteps: [
    "将插件包目录放入宿主项目 plugins/<plugin-slug>/",
    "确保插件包包含 plugin.manifest.json、server.ts，以及可选的 web.tsx/admin.tsx。",
    "宿主启动后通过注册表或目录扫描发现插件包。",
    "管理员在后台安装插件并保存业务配置。",
    "插件通过统一入口 /funs/<plugin-slug> 和 /admin/plugins/<plugin-slug> 挂载页面。",
  ],
}
