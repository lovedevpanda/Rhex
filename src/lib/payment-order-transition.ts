/**
 * Payment providers can redeliver notifications out of order. Keep the
 * persisted order state monotonic: only an unpaid, open order can become
 * waiting, paid, or closed. Refund processing has a separate ledger and
 * must not be inferred from a generic "closed" notification.
 */
export type PaymentOrderTransitionStatus =
  | "PENDING"
  | "WAIT_BUYER_PAY"
  | "PAID"
  | "CLOSED"
  | "FAILED"
  | "REFUNDING"
  | "REFUNDED"

const OPEN_ORDER_STATUSES: readonly PaymentOrderTransitionStatus[] = [
  "PENDING",
  "WAIT_BUYER_PAY",
]

export function resolvePaymentOrderStatusTransition(
  currentStatus: PaymentOrderTransitionStatus,
  requestedStatus: PaymentOrderTransitionStatus,
): PaymentOrderTransitionStatus {
  if (!OPEN_ORDER_STATUSES.includes(currentStatus)) {
    return currentStatus
  }

  switch (requestedStatus) {
    case "WAIT_BUYER_PAY":
      return currentStatus === "PENDING" ? "WAIT_BUYER_PAY" : currentStatus
    case "PAID":
    case "CLOSED":
      return requestedStatus
    default:
      return currentStatus
  }
}

export function getPaymentOrderTransitionSourceStatuses(
  requestedStatus: PaymentOrderTransitionStatus,
): readonly PaymentOrderTransitionStatus[] {
  switch (requestedStatus) {
    case "WAIT_BUYER_PAY":
      return ["PENDING"]
    case "PAID":
    case "CLOSED":
      return OPEN_ORDER_STATUSES
    default:
      return []
  }
}