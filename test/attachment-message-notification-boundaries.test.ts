import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import { isCanonicalMessageFileRouteSegment } from "@/app/api/messages/files/[uploadId]/[filename]/route"

test("message file URLs use the canonical uploaded filename segment", () => {
  assert.equal(isCanonicalMessageFileRouteSegment("quarterly report.pdf", "quarterly report.pdf"), true)
  assert.equal(isCanonicalMessageFileRouteSegment("quarterly%20report.pdf", "quarterly report.pdf"), true)
  assert.equal(isCanonicalMessageFileRouteSegment("other-file.pdf", "quarterly report.pdf"), false)
  assert.equal(isCanonicalMessageFileRouteSegment("bad%ZZname", "bad%ZZname"), true)
})

test("shared message files require an active conversation participant", async () => {
  const source = await readFile(path.join(process.cwd(), "src/app/api/messages/files/[uploadId]/[filename]/route.ts"), "utf8")

  assert.match(source, /some:\s*\{\s*userId: requesterId,\s*archivedAt: null\s*\}/)
  assert.ok(
    source.indexOf("isCanonicalMessageFileRouteSegment(filename, upload.originalName)")
      < source.indexOf("prisma.directMessage.findFirst"),
    "reject non-canonical filenames before looking up a shared message",
  )
})

test("attachment purchases deduplicate before either point transfer", async () => {
  const [serviceSource, querySource] = await Promise.all([
    readFile(path.join(process.cwd(), "src/lib/post-attachments.ts"), "utf8"),
    readFile(path.join(process.cwd(), "src/db/post-attachment-queries.ts"), "utf8"),
  ])
  const insertIndex = serviceSource.indexOf("const purchaseInsert = await createPostAttachmentPurchase")
  const duplicateReturnIndex = serviceSource.indexOf("if (purchaseInsert.count === 0)")
  const debitIndex = serviceSource.indexOf("await applyPointDelta")

  assert.ok(insertIndex >= 0)
  assert.ok(duplicateReturnIndex > insertIndex)
  assert.ok(debitIndex > duplicateReturnIndex)
  assert.match(serviceSource, /if \(purchaseInsert\.count === 0\) \{[\s\S]{0,160}return \{ alreadyOwned: true \}/)
  assert.match(querySource, /postAttachmentPurchase\.createMany\(\{[\s\S]{0,240}skipDuplicates: true/)
})

test("notification read and delete mutations stay scoped to the current user", async () => {
  const source = await readFile(path.join(process.cwd(), "src/db/notification-queries.ts"), "utf8")

  assert.match(source, /markNotificationAsRead[\s\S]*?where:\s*\{[\s\S]*?id: notificationId,[\s\S]*?userId,[\s\S]*?isRead: false/)
  assert.match(source, /deleteNotificationByUserId[\s\S]*?where:\s*\{[\s\S]*?id: notificationId,[\s\S]*?userId,/)
  assert.match(source, /deleteAllNotificationsByUserId[\s\S]*?where:\s*\{\s*userId,/)
})
