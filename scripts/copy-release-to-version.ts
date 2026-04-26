import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs"
import { basename, join, resolve } from "node:path"

const workspaceRoot = resolve(__dirname, "../")
const versionDirectory = join(resolve(__dirname, "../../"), "version/Rhex")

const includeEntries = [
  "LICENSE",
  "src",
  ".npmrc",
  ".gitignore",
  "docs",
  "public",
  "prisma",
  "docker-compose.yml",
  
  ".env.docker.example",
  "Dockerfile",

  "write-guard.config.ts",
  "scripts",
  "package.json",
  "pnpm-lock.yaml",
  "components.json",
  "tsconfig.json",
  "next.config.mjs",
  "next-env.d.ts",
  "postcss.config.js",
  "README.md",
  ".env.example",
] as const

const preserveEntries = new Set<string>([".gitkeep"])

function ensureDirectory(targetPath: string) {
  if (!existsSync(targetPath)) {
    mkdirSync(targetPath, { recursive: true })
  }
}

function resetVersionDirectory() {
  ensureDirectory(versionDirectory)

  for (const entry of readdirSync(versionDirectory)) {
    if (preserveEntries.has(entry)) {
      continue
    }
    if (entry === '.git') {
      continue
    }
    rmSync(join(versionDirectory, entry), { recursive: true, force: true })
  }
}

function copyEntry(entryName: string) {
  const sourcePath = join(workspaceRoot, entryName)

  if (!existsSync(sourcePath)) {
    throw new Error(`未找到需要复制的文件或目录: ${entryName}`)
  }

  const targetPath = join(versionDirectory, basename(entryName))

  if (entryName === "public") {
    cpSync(sourcePath, targetPath, {
      recursive: true,
      force: true,
      filter: (src) => {
        const relative = src.replace(sourcePath, "").replace(/\\/g, "/")
        return !relative.startsWith("/uploads")
      },
    })
  } else {
    cpSync(sourcePath, targetPath, { recursive: true, force: true })
  }
}

function main() {
  resetVersionDirectory()
  includeEntries.forEach(copyEntry)
  console.log(`已同步 ${includeEntries.length} 项内容到 ${versionDirectory}`)
}

main()