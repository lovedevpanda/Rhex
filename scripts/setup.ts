import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { config as loadDotenv } from "dotenv"
import { resolve } from "node:path"

interface RequiredEnvSpec {
  key: string
  description: string
  example?: string
}

type SetupMode = "development" | "production"
type SeedDecision = "run" | "skip"

interface CommandResult {
  status: number | null
  stdout: string
  stderr: string
}

interface DatabaseState {
  siteSettingTableExists: boolean | null
  siteSettingsCount: number | null
  zoneCount: number | null
  boardCount: number | null
  adminCount: number | null
  inspectionOk: boolean
}

const requiredEnvSpecs: RequiredEnvSpec[] = [
  {
    key: "DATABASE_URL",
    description: "PostgreSQL 连接串",
    example: "postgresql://postgres:password@localhost:5432/bbs?schema=public",
  },
  {
    key: "SESSION_SECRET",
    description: "服务端会话签名密钥",
    example: "请替换为足够长的随机字符串",
  },
]

function readEnvValue(key: string) {
  const value = process.env[key]
  return typeof value === "string" ? value.trim() : ""
}

function isTruthyEnv(key: string) {
  return readEnvValue(key).toLowerCase() === "true"
}

function validateEnv() {
  const missing = requiredEnvSpecs.filter((item) => readEnvValue(item.key).length === 0)

  if (missing.length === 0) {
    return
  }

  const envFilePath = resolve(process.cwd(), ".env")
  const hasEnvFile = existsSync(envFilePath)
  const tips = missing.map((item) => {
    const suffix = item.example ? `，例如：${item.example}` : ""
    return `- ${item.key}：${item.description}${suffix}`
  })

  console.error("安装中止：缺少必要环境变量。")
  console.error(hasEnvFile ? `已检测到 .env 文件：${envFilePath}` : `未检测到 .env 文件，请先创建：${envFilePath}`)
  console.error(tips.join("\n"))
  process.exit(1)
}

function runCommand(command: string, args: string[], options?: { captureOutput?: boolean }) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: options?.captureOutput ? "pipe" : "inherit",
    encoding: "utf8",
    shell: process.platform === "win32",
    env: process.env,
  })

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  } satisfies CommandResult
}

function runStep(command: string, args: string[], label: string) {
  console.log(`\n>>> ${label}`)
  const result = runCommand(command, args)

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function resolveSetupMode(): SetupMode {
  const rawMode = readEnvValue("SETUP_MODE").toLowerCase()

  if (rawMode === "development" || rawMode === "production") {
    return rawMode
  }

  return process.env.NODE_ENV === "production" ? "production" : "development"
}

function shouldForceSeed() {
  return isTruthyEnv("SETUP_FORCE_SEED")
}

function shouldResetDatabase() {
  return isTruthyEnv("SEED_RESET_DATABASE")
}

function runSchemaStep() {
  runStep("npx", ["prisma", "db", "push"], "同步数据库结构")
}

function runPrismaScript<T>(script: string) {
  const result = spawnSync("npx", ["tsx", "--eval", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
    env: process.env,
  })

  const stdout = result.stdout ?? ""
  const stderr = result.stderr ?? ""

  if (result.status !== 0) {
    return { ok: false as const, value: null as T | null, error: `${stdout}\n${stderr}`.trim() }
  }

  try {
    return { ok: true as const, value: JSON.parse(stdout) as T, error: "" }
  } catch {
    return { ok: false as const, value: null as T | null, error: stdout.trim() || stderr.trim() }
  }
}

function inspectDatabaseState(): DatabaseState {
  const inspectionResult = runPrismaScript<DatabaseState>(`
    const { PrismaClient, UserRole } = require("@prisma/client");
    const prisma = new PrismaClient();
    (async () => {
      try {
        const [siteSettingsCount, zoneCount, boardCount, adminCount] = await Promise.all([
          prisma.siteSetting.count(),
          prisma.zone.count(),
          prisma.board.count(),
          prisma.user.count({ where: { role: UserRole.ADMIN } }),
        ]);
        process.stdout.write(JSON.stringify({
          siteSettingTableExists: true,
          siteSettingsCount,
          zoneCount,
          boardCount,
          adminCount,
          inspectionOk: true,
        }));
      } catch {
        process.stdout.write(JSON.stringify({
          siteSettingTableExists: null,
          siteSettingsCount: null,
          zoneCount: null,
          boardCount: null,
          adminCount: null,
          inspectionOk: false,
        }));
      } finally {
        await prisma.$disconnect();
      }
    })();
  `)

  if (!inspectionResult.ok || !inspectionResult.value) {
    return {
      siteSettingTableExists: null,
      siteSettingsCount: null,
      zoneCount: null,
      boardCount: null,
      adminCount: null,
      inspectionOk: false,
    }
  }

  return inspectionResult.value
}

function shouldRunSeed(state: DatabaseState): SeedDecision {
  if (shouldForceSeed()) {
    return "run"
  }

  if (!state.inspectionOk) {
    return "skip"
  }

  const hasCoreTables = state.siteSettingTableExists === true
  const hasSeededSiteSettings = (state.siteSettingsCount ?? 0) > 0
  const hasSeededZones = (state.zoneCount ?? 0) > 0
  const hasSeededBoards = (state.boardCount ?? 0) > 0
  const hasAdminUser = (state.adminCount ?? 0) > 0

  if (hasCoreTables && hasSeededSiteSettings && hasSeededZones && hasSeededBoards && hasAdminUser) {
    return "skip"
  }

  return "run"
}

function printDatabaseState(state: DatabaseState) {
  console.log("\n数据库状态：")
  console.log(`- 状态探测：${state.inspectionOk ? "成功" : "失败"}`)
  console.log(`- SiteSetting 表存在：${state.siteSettingTableExists === null ? "未知" : state.siteSettingTableExists ? "是" : "否"}`)
  console.log(`- 站点配置数量：${state.siteSettingsCount ?? "未知"}`)
  console.log(`- 分区数量：${state.zoneCount ?? "未知"}`)
  console.log(`- 板块数量：${state.boardCount ?? "未知"}`)
  console.log(`- 管理员数量：${state.adminCount ?? "未知"}`)
}

function statefulSkipReason(state: DatabaseState) {
  if (!state.inspectionOk) {
    return "数据库状态探测失败，为避免误判导致重复 seed 或误触发危险流程，本次仅同步 Prisma Client 与数据库结构，不自动写入初始化数据。"
  }

  return "检测到数据库已完成核心初始化，当前执行仅用于补齐 Prisma Client、同步数据库结构，并避免重复 seed。"
}

function main() {
  loadDotenv({ path: resolve(process.cwd(), ".env") })

  validateEnv()

  const mode = resolveSetupMode()
  console.log(`Setup mode: ${mode}`)
  console.log("Schema strategy: prisma db push")

  runStep("npx", ["prisma", "generate"], "生成 Prisma Client")
  runSchemaStep()

  const databaseState = inspectDatabaseState()
  printDatabaseState(databaseState)

  const seedDecision = shouldRunSeed(databaseState)

  if (seedDecision === "run") {
    if (shouldResetDatabase()) {
      console.warn("\n警告：检测到 SEED_RESET_DATABASE=true，接下来 seed 脚本会清空现有业务数据。")
    }

    runStep("npx", ["tsx", "prisma/seed.ts"], shouldForceSeed() ? "强制执行初始化数据写入" : "写入初始业务数据")
  } else {
    console.log("\n>>> 跳过初始化数据写入")
    console.log(statefulSkipReason(databaseState))
  }

  console.log("\n安装完成：数据库结构已对齐，初始化数据按需处理完成。")
}

main()
