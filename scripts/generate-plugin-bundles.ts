import fs from "node:fs/promises"
import path from "node:path"

interface PluginManifest {
  id: string
  slug: string
  entry: {
    server: string
    web?: string
    admin?: string
    sidebar?: string
  }
}

const projectRoot = process.cwd()
const pluginsRoot = path.join(projectRoot, "plugins")
const outputPath = path.join(projectRoot, "src/lib/plugin-bundle-registry.generated.ts")

function toImportName(slug: string, suffix: string) {
  const normalized = slug.replace(/[^a-zA-Z0-9]+/g, "-").split("-").filter(Boolean)
  const base = normalized.map((part, index) => {
    if (index === 0) {
      return part.toLowerCase()
    }
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  }).join("") || "plugin"

  return `${base}${suffix}`
}

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function discoverPluginManifests() {
  if (!await pathExists(pluginsRoot)) {
    return [] as Array<{ rootDir: string; manifest: PluginManifest }>
  }

  const entries = await fs.readdir(pluginsRoot, { withFileTypes: true })
  const manifests = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const rootDir = path.join(pluginsRoot, entry.name)
    const manifestPath = path.join(rootDir, "plugin.manifest.json")
    if (!await pathExists(manifestPath)) {
      return null
    }

    const raw = await fs.readFile(manifestPath, "utf8")
    const manifest = JSON.parse(raw) as PluginManifest
    return {
      rootDir,
      manifest,
    }
  }))

  return manifests.filter((item): item is { rootDir: string; manifest: PluginManifest } => Boolean(item))
}

function buildEntryImport(slug: string, entryFile: string | undefined, suffix: string) {
  if (!entryFile) {
    return null
  }

  return {
    importName: toImportName(slug, suffix),
    importPath: `@/plugins/${slug}/${entryFile.replace(/\.tsx?$/, "")}`,
  }
}

function buildApiImport(slug: string) {
  return {
    importName: toImportName(slug, "Api"),
    importPath: `@/plugins/${slug}/api`,
  }
}

function buildPluginIndexEntry(manifest: PluginManifest, imports: {
  server: { importName: string }
  web: { importName: string } | null
  admin: { importName: string } | null
  sidebar: { importName: string } | null
  api: { importName: string } | null
}) {
  const lines = [
    `server: ${imports.server.importName},`,
  ]

  if (imports.web) {
    lines.push(`web: ${imports.web.importName},`)
  }
  if (imports.admin) {
    lines.push(`admin: ${imports.admin.importName},`)
  }
  if (imports.sidebar) {
    lines.push(`sidebarComponent: ${imports.sidebar.importName},`)
  }
  if (imports.api) {
    lines.push(`apiModule: ${imports.api.importName},`)
  }

  return `  "${manifest.id}": {\n    ${lines.join("\n    ")}\n  },\n  "${manifest.slug}": {\n    ${lines.join("\n    ")}\n  },`
}

async function main() {
  const plugins = await discoverPluginManifests()

  const importLines: string[] = []
  const registryEntries: string[] = []

  for (const { manifest, rootDir } of plugins) {
    const serverImport = buildEntryImport(manifest.slug, manifest.entry.server, "Server")
    const webImport = buildEntryImport(manifest.slug, manifest.entry.web, "WebPage")
    const adminImport = buildEntryImport(manifest.slug, manifest.entry.admin, "AdminPage")
    const sidebarImport = buildEntryImport(manifest.slug, manifest.entry.sidebar, "SidebarPage")
    const apiFilePath = path.join(rootDir, "api.ts")
    const apiImport = await pathExists(apiFilePath) ? buildApiImport(manifest.slug) : null

    if (!serverImport) {
      continue
    }

    importLines.push(`import ${serverImport.importName} from "${serverImport.importPath}"`)
    if (webImport) {
      importLines.push(`import ${webImport.importName} from "${webImport.importPath}"`)
    }
    if (adminImport) {
      importLines.push(`import ${adminImport.importName} from "${adminImport.importPath}"`)
    }
    if (sidebarImport) {
      importLines.push(`import ${sidebarImport.importName} from "${sidebarImport.importPath}"`)
    }
    if (apiImport) {
      importLines.push(`import * as ${apiImport.importName} from "${apiImport.importPath}"`)
    }

    registryEntries.push(buildPluginIndexEntry(manifest, {
      server: serverImport,
      web: webImport,
      admin: adminImport,
      sidebar: sidebarImport,
      api: apiImport,
    }))
  }

  const content = `${importLines.join("\n")}

import type { PluginApiModule, PluginPageComponent, PluginServerDefinition, SidebarPluginComponent } from "@/lib/plugin-types"

export interface GeneratedPluginBundleEntry {
  server: PluginServerDefinition
  web?: PluginPageComponent
  admin?: PluginPageComponent
  sidebarComponent?: SidebarPluginComponent
  apiModule?: PluginApiModule
}

export const generatedPluginBundleRegistry: Record<string, GeneratedPluginBundleEntry> = {
${registryEntries.join("\n")}
}
`

  await fs.writeFile(outputPath, content, "utf8")
  console.log(`Generated plugin bundle registry for ${plugins.length} plugin(s).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
