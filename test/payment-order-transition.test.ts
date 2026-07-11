import assert from "node:assert/strict"
import test from "node:test"

import {
  getPaymentOrderTransitionSourceStatuses,
  resolvePaymentOrderStatusTransition,
} from "../src/lib/payment-order-transition"

test("payment order transitions do not regress paid or terminal orders", () => {
  assert.equal(resolvePaymentOrderStatusTransition("PENDING", "WAIT_BUYER_PAY"), "WAIT_BUYER_PAY")
  assert.equal(resolvePaymentOrderStatusTransition("WAIT_BUYER_PAY", "PAID"), "PAID")
  assert.equal(resolvePaymentOrderStatusTransition("PAID", "CLOSED"), "PAID")
  assert.equal(resolvePaymentOrderStatusTransition("CLOSED", "PAID"), "CLOSED")
  assert.equal(resolvePaymentOrderStatusTransition("REFUNDED", "PAID"), "REFUNDED")
})

test("payment order transition guards allow only one open-to-paid winner", () => {
  assert.deepEqual(getPaymentOrderTransitionSourceStatuses("PAID"), ["PENDING", "WAIT_BUYER_PAY"])
  assert.deepEqual(getPaymentOrderTransitionSourceStatuses("WAIT_BUYER_PAY"), ["PENDING"])
  assert.deepEqual(getPaymentOrderTransitionSourceStatuses("REFUNDED"), [])
})