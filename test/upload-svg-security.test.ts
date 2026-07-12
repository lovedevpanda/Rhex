import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import {
  getSafeUntrustedImageExtensions,
  isSafeUntrustedImageMimeType,
} from "../src/lib/upload-rules"

const root = process.cwd()

async function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8")
}

test("untrusted image upload rules exclude SVG regardless of configured extension spelling", () => {
  assert.deepEqual(
    getSafeUntrustedImageExtensions(["png", " SVG ", ".jpg", "png", "webp"]),
    ["png", "jpg", "webp"],
  )
  assert.equal(isSafeUntrustedImageMimeType("image/png"), true)
  assert.equal(isSafeUntrustedImageMimeType(" IMAGE/SVG+XML "), false)
})

test("all user-controlled image upload paths reject SVG and inspect the detected MIME type", async () => {
  const sources = await Promise.all([
    readSource("src/app/api/upload/route.ts"),
    readSource("src/app/api/upload/remote-image/route.ts"),
    readSource("src/app/api/messages/upload/route.ts"),
  ])

  for (const source of sources) {
    assert.match(source, /getSafeUntrustedImageExtensions/)
    assert.match(source, /isSafeUntrustedImageMimeType\(preparedFile\.detectedMime\)/)
    assert.doesNotMatch(source, /folder === "icon" \? \["svg"\]/)
  }
})

test("locally served historical SVG uploads are sandboxed", async () => {
  const source = await readSource("src/app/uploads/[...path]/route.ts")

  assert.match(source, /const contentType = getUploadMimeType\(fileName\)/)
  assert.match(source, /contentType === "image\/svg\+xml"/)
  assert.match(source, /"Content-Security-Policy": "sandbox"/)
})
