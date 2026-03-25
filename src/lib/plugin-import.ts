import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"

import AdmZip from "adm-zip"

import { validatePluginManifest } from "@/lib/plugin-loader"
import { regeneratePluginBundles } from "@/lib/plugin-regeneration"
import type { PluginManifest } from "@/lib/plugin-types"

type ZipEntry = AdmZip.IZipEntry

const pluginsRoot = path.join(process.cwd(), "plugins")
const requiredEntries = ["plugin.manifest.json", "server.ts"]

function sanitizeSegment(input: string) {
  return input.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "plugin"
}

async function ensureDirectory(targetPath: string) {
  await fs.mkdir(targetPath, { recursive: true })
}

async function removeDirectory(targetPath: string) {
  await fs.rm(targetPath, { recursive: true, force: true })
}

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function assertSafeEntryName(entryName: string) {
  const normalized = entryName.replace(/\\/g, "/")
  if (!normalized || normalized.startsWith("/") || normalized.includes("../") || normalized.includes("..\\")) {
    throw new Error(`插件包包含非法路径：${entryName}`)
  }
}

async function readManifestFromExtractedDir(rootDir: string): Promise<PluginManifest> {
  const manifestPath = path.join(rootDir, "plugin.manifest.json")
  const raw = await fs.readFile(manifestPath, "utf8")
  const parsed = JSON.parse(raw) as unknown
  return validatePluginManifest(parsed)
}

export async function installPluginZip(file: File) {
  if (!file.name.toLowerCase().endsWith(".zip")) {
    throw new Error("仅支持上传 zip 插件包")
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const zip = new AdmZip(buffer)
  const entries = zip.getEntries()

  if (entries.length === 0) {
    throw new Error("插件包为空")
  }

  entries.forEach((entry: ZipEntry) => assertSafeEntryName(entry.entryName))
  const allEntryNames = entries.map((entry: ZipEntry) => entry.entryName.replace(/\\/g, "/"))

  requiredEntries.forEach((entryName) => {
    const exists = allEntryNames.some((item: string) => item === entryName || item.endsWith(`/${entryName}`))
    if (!exists) {
      throw new Error(`插件包缺少必要文件：${entryName}`)
    }
  })

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bbs-plugin-"))

  try {
    zip.extractAllTo(tempRoot, true)

    const manifestAtRoot = await pathExists(path.join(tempRoot, "plugin.manifest.json"))
    const candidateRoot = manifestAtRoot ? tempRoot : path.join(tempRoot, sanitizeSegment(path.parse(file.name).name))
    const manifest = await readManifestFromExtractedDir(candidateRoot)
    const targetDir = path.join(pluginsRoot, sanitizeSegment(manifest.slug))

    await ensureDirectory(pluginsRoot)
    await removeDirectory(targetDir)
    await fs.cp(candidateRoot, targetDir, { recursive: true })
    await regeneratePluginBundles()

    return {
      manifest,
      targetDir,
    }
  } finally {
    await removeDirectory(tempRoot)
  }
}
