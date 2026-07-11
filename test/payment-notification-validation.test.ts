import assert from "node:assert/strict"
import test from "node:test"

import {
  matchesConfiguredPaymentIdentity,
  parsePositiveCnyAmountFen,
  validatePaidNotificationAmount,
} from "../src/lib/payment-notification-validation"

test("paid payment notifications require an exact, positive integer amount", () => {
  assert.equal(validatePaidNotificationAmount(100, 100), null)
  assert.equal(validatePaidNotificationAmount(null, 100), "异步通知缺少有效支付金额")
  assert.equal(validatePaidNotificationAmount(0, 100), "异步通知缺少有效支付金额")
  assert.equal(validatePaidNotificationAmount(99, 100), "异步通知金额与订单金额不匹配")
  assert.equal(validatePaidNotificationAmount(100.5, 100), "异步通知缺少有效支付金额")
})

test("Alipay CNY callback amounts are parsed without float rounding", () => {
  assert.equal(parsePositiveCnyAmountFen("12"), 1200)
  assert.equal(parsePositiveCnyAmountFen("12.3"), 1230)
  assert.equal(parsePositiveCnyAmountFen("12.30"), 1230)
  assert.equal(parsePositiveCnyAmountFen("0.01"), 1)
  assert.equal(parsePositiveCnyAmountFen("12.345"), null)
  assert.equal(parsePositiveCnyAmountFen("1e2"), null)
  assert.equal(parsePositiveCnyAmountFen("0"), null)
})

test("configured callback identities reject omitted fields", () => {
  assert.equal(matchesConfiguredPaymentIdentity("app-123", "app-123"), true)
  assert.equal(matchesConfiguredPaymentIdentity("app-123", ""), false)
  assert.equal(matchesConfiguredPaymentIdentity("seller-456", null), false)
  assert.equal(matchesConfiguredPaymentIdentity(null, null), true)
})