import assert from "node:assert/strict"
import test from "node:test"

import {
  PaymentCallbackUrlError,
  resolvePaymentCallbackUrl,
} from "../src/lib/payment-callback-origin"

function expectFailure(
  callback: () => unknown,
  code: PaymentCallbackUrlError["code"],
) {
  assert.throws(callback, (error: unknown) => (
    error instanceof PaymentCallbackUrlError && error.code === code
  ))
}

test("payment callbacks require an explicitly configured canonical origin", () => {
  expectFailure(
    () => resolvePaymentCallbackUrl("/api/payments/notify/alipay", null),
    "MISSING_CANONICAL_ORIGIN",
  )
})

test("payment callbacks are resolved from the configured canonical origin", () => {
  assert.equal(
    resolvePaymentCallbackUrl("/api/payments/notify/alipay", "https://pay.example.test/"),
    "https://pay.example.test/api/payments/notify/alipay",
  )
  assert.equal(
    resolvePaymentCallbackUrl("https://pay.example.test/topup/result", "https://pay.example.test"),
    "https://pay.example.test/topup/result",
  )
})

test("payment callbacks reject host-header-style external targets", () => {
  for (const target of ["https://attacker.example/notify", "//attacker.example/notify"]) {
    expectFailure(
      () => resolvePaymentCallbackUrl(target, "https://pay.example.test"),
      "EXTERNAL_TARGET",
    )
  }
})

test("payment callback canonical origins cannot carry a path or credentials", () => {
  expectFailure(
    () => resolvePaymentCallbackUrl("/notify", "https://pay.example.test/subpath"),
    "INVALID_CANONICAL_ORIGIN",
  )
  expectFailure(
    () => resolvePaymentCallbackUrl("/notify", "https://user:pass@pay.example.test"),
    "INVALID_CANONICAL_ORIGIN",
  )
})
