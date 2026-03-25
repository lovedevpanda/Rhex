import { runPluginMigrations } from "@/lib/plugin-migrations"

async function main() {
  const pluginId = process.argv[2]
  if (!pluginId) {
    throw new Error("缺少插件 ID")
  }

  const result = await runPluginMigrations(pluginId)
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
