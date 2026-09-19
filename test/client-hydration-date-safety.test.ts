import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

/**
 * Hydration-safety guard for date rendering in client components.
 *
 * The server runs in UTC (the container has no TZ) while visitors are typically
 * UTC+8. Any `new Date(x).toLocaleString()` / `.toLocaleDateString()` evaluated
 * during render therefore produces a *different string* on the server than in
 * the browser, which React reports as a hydration mismatch and then re-renders
 * the subtree on the client.
 *
 * The repo already ships deterministic formatters (src/lib/formatters.ts) that
 * pin the timezone to Asia/Shanghai via Intl: `formatDateTime`, `serializeDate`,
 * `serializeDateTime`. Client components must use those instead.
 *
 * This test scans every file under src/components that declares "use client" and
 * fails if it renders with a locale-dependent date method.
 */

const COMPONENTS_DIR = path.join(process.cwd(), "src/components")

async function listFilesRecursively(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursively(full))
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(full)
    }
  }

  return files
}

/** Strip line comments and block comments so commented-out code does not trip the scan. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
}

const LOCALE_DEPENDENT_DATE_CALL = /\.toLocale(?:String|DateString|TimeString)\s*\(/

test("client components do not render locale-dependent date strings", async () => {
  const files = await listFilesRecursively(COMPONENTS_DIR)
  const offenders: string[] = []

  for (const file of files) {
    const source = await readFile(file, "utf8")

    // 只检查客户端组件：服务端组件不会水合，本地时区差异不会造成不一致
    if (!/^\s*["']use client["']/m.test(source)) {
      continue
    }

    const code = stripComments(source)
    if (LOCALE_DEPENDENT_DATE_CALL.test(code)) {
      const relative = path.relative(process.cwd(), file).replace(/\\/g, "/")
      const line = code.split("\n").findIndex((text) => LOCALE_DEPENDENT_DATE_CALL.test(text)) + 1
      offenders.push(`${relative}:${line}`)
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `client components must use @/lib/formatters (formatDateTime/serializeDate) instead of toLocale*:\n  ${offenders.join("\n  ")}`,
  )
})

test("the deterministic formatters pin the business timezone", async () => {
  const source = await readFile(path.join(process.cwd(), "src/lib/formatters.ts"), "utf8")

  assert.match(source, /BUSINESS_TIME_ZONE\s*=\s*"Asia\/Shanghai"/)
  assert.match(source, /export function formatDateTime/)
  assert.match(source, /export function serializeDate/)
})
