/**
 * Resolve payment provider callback URLs without consulting request headers.
 * Payment providers must call a stable, explicitly configured site origin.
 */
export type PaymentCallbackUrlErrorCode =
  | "MISSING_CANONICAL_ORIGIN"
  | "INVALID_CANONICAL_ORIGIN"
  | "INVALID_TARGET"
  | "EXTERNAL_TARGET"

export class PaymentCallbackUrlError extends Error {
  constructor(
    public readonly code: PaymentCallbackUrlErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "PaymentCallbackUrlError"
  }
}

function readCanonicalOrigin(configuredOrigin: string | null | undefined) {
  const rawOrigin = configuredOrigin?.trim()
  if (!rawOrigin) {
    throw new PaymentCallbackUrlError(
      "MISSING_CANONICAL_ORIGIN",
      "支付回调要求显式配置 canonical site origin",
    )
  }

  let parsed: URL
  try {
    parsed = new URL(rawOrigin)
  } catch {
    throw new PaymentCallbackUrlError(
      "INVALID_CANONICAL_ORIGIN",
      "配置的 canonical site origin 不是合法 URL",
    )
  }

  if (
    (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new PaymentCallbackUrlError(
      "INVALID_CANONICAL_ORIGIN",
      "配置的 canonical site origin 必须是无路径的 HTTP(S) origin",
    )
  }

  return parsed
}

export function resolvePaymentCallbackUrl(
  target: string,
  configuredOrigin: string | null | undefined,
) {
  const canonicalOrigin = readCanonicalOrigin(configuredOrigin)

  let resolved: URL
  try {
    resolved = new URL(target, canonicalOrigin)
  } catch {
    throw new PaymentCallbackUrlError("INVALID_TARGET", "支付回调地址不是合法 URL")
  }

  if (resolved.origin !== canonicalOrigin.origin) {
    throw new PaymentCallbackUrlError(
      "EXTERNAL_TARGET",
      "支付回调地址必须属于配置的 canonical site origin",
    )
  }

  return resolved.toString()
}
