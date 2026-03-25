import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const projectRoot = process.cwd()

export async function regeneratePluginBundles() {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm"
  const scriptPath = path.join(projectRoot, "scripts", "generate-plugin-bundles.ts")

  try {
    await execFileAsync(npmCommand, ["run", "plugins:generate"], {
      cwd: projectRoot,
      windowsHide: true,
      timeout: 60_000,
    })
  } catch {
    await execFileAsync(process.execPath, [scriptPath], {
      cwd: projectRoot,
      windowsHide: true,
      timeout: 60_000,
    })
  }
}
