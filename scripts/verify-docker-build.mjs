import { existsSync, readFileSync, readdirSync, statSync } from "fs"
import path from "path"

const projectRoot = process.cwd()

const requiredSourceRoutes = [
  "src/app/uploads/[...path]/route.ts",
]

const forbiddenDockerIgnorePatterns = new Set([
  "uploads/**",
  "public/uploads/**",
  "addons/**",
])

function fail(message, details = []) {
  console.error(`\n[docker-build-verify] ${message}`)

  for (const detail of details) {
    console.error(`  - ${detail}`)
  }

  process.exit(1)
}

function readTextFile(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8")
}

function assertSourceRoutesExist() {
  const missingRoutes = requiredSourceRoutes.filter((relativePath) => !existsSync(path.join(projectRoot, relativePath)))

  if (missingRoutes.length > 0) {
    fail("required source route is missing before Docker build", missingRoutes)
  }
}

function assertDockerIgnoreDoesNotHideAppRoutes() {
  const dockerIgnorePath = path.join(projectRoot, ".dockerignore")

  if (!existsSync(dockerIgnorePath)) {
    return
  }

  const badPatterns = readTextFile(".dockerignore")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .filter((line) => forbiddenDockerIgnorePatterns.has(line))

  if (badPatterns.length > 0) {
    fail(".dockerignore contains patterns that can hide app routes during Docker build", [
      ...badPatterns.map((pattern) => `${pattern} can also match nested routes such as src/app/uploads`),
      "Use anchored patterns like /uploads/** only if persisted runtime data must be excluded.",
    ])
  }
}

function walkFiles(rootDirectory) {
  const files = []
  const stack = [rootDirectory]

  while (stack.length > 0) {
    const currentDirectory = stack.pop()

    for (const entry of readdirSync(currentDirectory)) {
      const entryPath = path.join(currentDirectory, entry)
      const entryStat = statSync(entryPath)

      if (entryStat.isDirectory()) {
        stack.push(entryPath)
        continue
      }

      files.push(entryPath)
    }
  }

  return files
}

function assertNextBuildContainsUploadRoute() {
  const nextServerAppPath = path.join(projectRoot, ".next/server/app")

  if (!existsSync(nextServerAppPath)) {
    fail("Next.js build output is missing; run this check after `next build`", [
      ".next/server/app was not found",
    ])
  }

  const manifestCandidates = [
    ".next/server/app-paths-manifest.json",
    ".next/server/middleware-manifest.json",
  ]

  const manifestHasUploadRoute = manifestCandidates.some((relativePath) => {
    const absolutePath = path.join(projectRoot, relativePath)
    return existsSync(absolutePath) && readFileSync(absolutePath, "utf8").includes("uploads/[...path]/route")
  })

  const fileHasUploadRoute = walkFiles(nextServerAppPath).some((filePath) => {
    const normalizedPath = filePath.split(path.sep).join("/")
    return normalizedPath.includes("/uploads/[...path]/") && /\/route\.(js|mjs)$/.test(normalizedPath)
  })

  if (!manifestHasUploadRoute && !fileHasUploadRoute) {
    fail("Next.js build output does not contain the /uploads/[...path] file route", [
      "This usually means Docker ignored src/app/uploads during build.",
      "If this image is deployed, CDN image URLs under /uploads/* will return a Next.js HTML 404 page.",
      "Check .dockerignore and rebuild the image from a source tree that includes src/app/uploads/[...path]/route.ts.",
    ])
  }
}

assertSourceRoutesExist()
assertDockerIgnoreDoesNotHideAppRoutes()
assertNextBuildContainsUploadRoute()

console.log("[docker-build-verify] OK: /uploads/[...path] route is present in the Docker build output.")
