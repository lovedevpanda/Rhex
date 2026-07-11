import assert from "node:assert/strict"
import test from "node:test"

import { UserRole } from "@/db/types"
import { requireConfiguredOAuthOrigin } from "@/lib/auth-provider-config"
import { isAdminActorEligible } from "@/lib/moderator-permissions"

test("only active or muted administrators and moderators are eligible for admin access", () => {
  assert.equal(isAdminActorEligible({ role: UserRole.ADMIN, status: "ACTIVE" }), true)
  assert.equal(isAdminActorEligible({ role: UserRole.MODERATOR, status: "ACTIVE" }), true)
  assert.equal(isAdminActorEligible({ role: UserRole.ADMIN, status: "MUTED" }), true)
  assert.equal(isAdminActorEligible({ role: UserRole.MODERATOR, status: "MUTED" }), true)
})

test("restricted and non-privileged accounts cannot become admin actors", () => {
  assert.equal(isAdminActorEligible({ role: UserRole.ADMIN, status: "BANNED" }), false)
  assert.equal(isAdminActorEligible({ role: UserRole.MODERATOR, status: "INACTIVE" }), false)
  assert.equal(isAdminActorEligible({ role: UserRole.USER, status: "ACTIVE" }), false)
  assert.equal(isAdminActorEligible(null), false)
})


test("OAuth redirects require a configured, origin-only HTTP(S) site URL", () => {
  assert.equal(requireConfiguredOAuthOrigin("https://community.example/"), "https://community.example")
  assert.equal(requireConfiguredOAuthOrigin("http://localhost:3000"), "http://localhost:3000")
  assert.throws(() => requireConfiguredOAuthOrigin(null), /SITE_URL/)
  assert.throws(() => requireConfiguredOAuthOrigin("https://community.example/app"), /SITE_URL/)
  assert.throws(() => requireConfiguredOAuthOrigin("javascript:alert(1)"), /SITE_URL/)
})
