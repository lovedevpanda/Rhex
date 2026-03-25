import fs from "node:fs/promises"
import path from "node:path"

import { prisma } from "@/db/client"
import { loadPluginServer } from "@/lib/plugin-loader"

interface PluginMigrationRecord {
  pluginId: string
  files: string[]
}

type PluginMigrationState = Record<string, PluginMigrationRecord>

function parseMigrationState(raw: string | null | undefined): PluginMigrationState {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as PluginMigrationState
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

async function ensureMigrationStateFile(rootDir: string) {
  const stateDir = path.join(rootDir, ".plugin-state")
  const stateFilePath = path.join(stateDir, "migrations.json")

  await fs.mkdir(stateDir, { recursive: true })

  try {
    await fs.access(stateFilePath)
  } catch {
    await fs.writeFile(stateFilePath, "{}", "utf8")
  }

  return stateFilePath
}

async function readMigrationState(rootDir: string) {
  const stateFilePath = await ensureMigrationStateFile(rootDir)
  const raw = await fs.readFile(stateFilePath, "utf8")
  return {
    stateFilePath,
    state: parseMigrationState(raw),
  }
}

async function writeMigrationState(stateFilePath: string, state: PluginMigrationState) {
  await fs.writeFile(stateFilePath, JSON.stringify(state, null, 2), "utf8")
}

async function readPluginMigrationFiles(pluginId: string) {
  const loaded = await loadPluginServer(pluginId)
  if (!loaded) {
    throw new Error("插件不存在")
  }

  const migrationsDir = path.join(loaded.rootDir, "migrations")

  try {
    const entries = await fs.readdir(migrationsDir, { withFileTypes: true })
    const upFiles = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".sql") && !entry.name.toLowerCase().endsWith(".down.sql"))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, "en"))
    const downFiles = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".down.sql"))
      .map((entry) => entry.name)
      .sort((left, right) => right.localeCompare(left, "en"))

    return {
      pluginId: loaded.manifest.id,
      rootDir: loaded.rootDir,
      upFiles,
      downFiles,
    }
  } catch {
    return {
      pluginId: loaded.manifest.id,
      rootDir: loaded.rootDir,
      upFiles: [],
      downFiles: [],
    }
  }
}

function splitSqlStatements(sql: string) {
  return sql
    .split(/;\s*(?:\r?\n|$)/g)
    .map((statement) => statement.trim())
    .filter(Boolean)
}

function extractCreatedTables(sql: string) {
  const matches = sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"([^"]+)"/gi)
  return Array.from(matches, (match) => match[1])
}

async function tableExists(tableName: string) {
  const result = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1) AS "exists"`,
    tableName,
  )
  return Boolean(result[0]?.exists)
}

async function executeSqlFile(rootDir: string, fileName: string) {
  const sql = await fs.readFile(path.join(rootDir, "migrations", fileName), "utf8")
  const statements = splitSqlStatements(sql)

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement)
  }
}

async function repairMigrationStateIfNeeded(rootDir: string, pluginState: PluginMigrationRecord) {
  const removedFiles: string[] = []


  for (const file of [...pluginState.files]) {
    const sql = await fs.readFile(path.join(rootDir, "migrations", file), "utf8")
    const createdTables = extractCreatedTables(sql)
    if (createdTables.length === 0) {
      continue
    }

    const tableStates = await Promise.all(createdTables.map((tableName) => tableExists(tableName)))
    const allTablesExist = tableStates.every(Boolean)
    if (!allTablesExist) {
      pluginState.files = pluginState.files.filter((item) => item !== file)
      removedFiles.push(file)
    }
  }

  return removedFiles
}

export async function runPluginMigrations(pluginId: string) {
  const migrationFiles = await readPluginMigrationFiles(pluginId)
  const { stateFilePath, state: migrationState } = await readMigrationState(migrationFiles.rootDir)
  const pluginState = migrationState[pluginId] ?? { pluginId, files: [] }
  const repairedFiles = await repairMigrationStateIfNeeded(migrationFiles.rootDir, pluginState)

  const pendingFiles = migrationFiles.upFiles.filter((file) => !pluginState.files.includes(file))

  for (const file of pendingFiles) {
    await executeSqlFile(migrationFiles.rootDir, file)
    pluginState.files.push(file)
  }

  migrationState[pluginId] = pluginState
  await writeMigrationState(stateFilePath, migrationState)

  return {
    pluginId,
    stateFilePath,
    repairedFiles,
    executedFiles: pendingFiles,
    appliedCount: pluginState.files.length,
  }
}

export async function purgePluginMigrations(pluginId: string) {
  const migrationFiles = await readPluginMigrationFiles(pluginId)
  const { stateFilePath, state: migrationState } = await readMigrationState(migrationFiles.rootDir)

  for (const file of migrationFiles.downFiles) {
    await executeSqlFile(migrationFiles.rootDir, file)
  }

  delete migrationState[pluginId]
  await writeMigrationState(stateFilePath, migrationState)

  return {
    pluginId,
    stateFilePath,
    revertedFiles: migrationFiles.downFiles,
  }
}
