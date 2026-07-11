import assert from "node:assert/strict"
import test from "node:test"

import { normalizeAddonExternalAuthRedirectTo } from "../src/lib/addon-external-auth-bridge"

import {
  ADDON_TRUSTED_CODE_ACKNOWLEDGEMENT,
  ADDON_TRUSTED_CODE_ACKNOWLEDGEMENT_ENV,
  getAddonManifestPermissionDeclarationErrors,
  getAddonTrustedCodeExecutionStatus,
  resolveAddonPermissionSet,
} from "../src/addons-host/runtime/permissions"

function withTrustedCodeAcknowledgement(value: string | undefined, task: () => void) {
  const previous = process.env[ADDON_TRUSTED_CODE_ACKNOWLEDGEMENT_ENV]

  try {
    if (value === undefined) {
      delete process.env[ADDON_TRUSTED_CODE_ACKNOWLEDGEMENT_ENV]
    } else {
      process.env[ADDON_TRUSTED_CODE_ACKNOWLEDGEMENT_ENV] = value
    }

    task()
  } finally {
    if (previous === undefined) {
      delete process.env[ADDON_TRUSTED_CODE_ACKNOWLEDGEMENT_ENV]
    } else {
      process.env[ADDON_TRUSTED_CODE_ACKNOWLEDGEMENT_ENV] = previous
    }
  }
}

test("addon execution remains disabled unless the exact trusted-code acknowledgement is set", () => {
  withTrustedCodeAcknowledgement(undefined, () => {
    const status = getAddonTrustedCodeExecutionStatus()

    assert.equal(status.acknowledged, false)
    assert.equal(status.environmentVariable, ADDON_TRUSTED_CODE_ACKNOWLEDGEMENT_ENV)
    assert.equal(status.requiredValue, ADDON_TRUSTED_CODE_ACKNOWLEDGEMENT)
  })

  withTrustedCodeAcknowledgement("true", () => {
    assert.equal(getAddonTrustedCodeExecutionStatus().acknowledged, false)
  })

  withTrustedCodeAcknowledgement(ADDON_TRUSTED_CODE_ACKNOWLEDGEMENT, () => {
    assert.equal(getAddonTrustedCodeExecutionStatus().acknowledged, true)
  })
})

test("manifest permissions cannot claim a sandbox and unknown permissions grant no capability", () => {
  const declarationErrors = getAddonManifestPermissionDeclarationErrors([
    "sandbox:strict",
    "not:real",
  ])

  assert.equal(declarationErrors.length, 2)
  assert.match(declarationErrors[0], /不提供安全沙箱/)
  assert.match(declarationErrors[1], /不受 Rhex 支持/)

  const permissions = resolveAddonPermissionSet([
    "network:external",
    "not:real",
    "route:public",
    "slot:post.detail.sidebar",
  ])

  assert.deepEqual(
    [...permissions].sort(),
    ["network:external", "page:public", "slot:register"],
  )
})
test("addon external-auth redirect targets remain on the local origin", () => {
  const fallback = "/settings?tab=profile&profileTab=accounts"

  assert.equal(normalizeAddonExternalAuthRedirectTo("/settings?tab=profile#accounts"), "/settings?tab=profile#accounts")
  assert.equal(normalizeAddonExternalAuthRedirectTo("//attacker.example/steal"), fallback)
  assert.equal(normalizeAddonExternalAuthRedirectTo("/\\attacker.example/steal"), fallback)
  assert.equal(normalizeAddonExternalAuthRedirectTo("https://attacker.example/steal"), fallback)
})
