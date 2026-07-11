/**
 * Payment callbacks must prove the amount they are crediting. A verified
 * callback without an amount is not sufficient evidence to fulfill an order.
 */
export function validatePaidNotificationAmount(
  amountFen: number | null | undefined,
  expectedAmountFen: number,
): string | null {
  if (!Number.isSafeInteger(expectedAmountFen) || expectedAmountFen <= 0) {
    return "支付订单金额无效"
  }

  if (typeof amountFen !== "number" || !Number.isSafeInteger(amountFen) || amountFen <= 0) {
    return "异步通知缺少有效支付金额"
  }

  return amountFen === expectedAmountFen ? null : "异步通知金额与订单金额不匹配"
}

/**
 * Alipay's total_amount is a decimal CNY string. Do not use floating-point
 * rounding for a security boundary: it accepts malformed precision and can
 * turn large values into an unsafe integer.
 */
export function parsePositiveCnyAmountFen(value: string | null | undefined): number | null {
  const normalized = value?.trim() ?? ""
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(normalized)
  if (!match) {
    return null
  }

  const yuan = Number(match[1])
  const fractional = (match[2] ?? "").padEnd(2, "0")
  const fen = yuan * 100 + Number(fractional)

  return Number.isSafeInteger(fen) && fen > 0 ? fen : null
}

/**
 * If a merchant identity is configured, the signed callback must contain the
 * same identity. Treating an omitted field as a match weakens merchant binding.
 */
export function matchesConfiguredPaymentIdentity(
  expected: string | null | undefined,
  actual: string | null | undefined,
) {
  const normalizedExpected = expected?.trim() ?? ""
  if (!normalizedExpected) {
    return true
  }

  return (actual?.trim() ?? "") === normalizedExpected
}