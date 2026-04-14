export type RuntimeErrorLevel = "info" | "warn" | "error"

export interface RuntimeErrorOptions {
  area: string
  action: string
  message: string
  cause?: unknown
  level?: RuntimeErrorLevel
  metadata?: Record<string, unknown>
}

export class AppRuntimeError extends Error {
  readonly area: string
  readonly action: string
  readonly level: RuntimeErrorLevel
  readonly metadata?: Record<string, unknown>
  override readonly cause?: unknown

  constructor(options: RuntimeErrorOptions) {
    super(options.message)
    this.name = "AppRuntimeError"
    this.area = options.area
    this.action = options.action
    this.level = options.level ?? "error"
    this.metadata = options.metadata
    this.cause = options.cause
  }
}

export function toAppRuntimeError(options: RuntimeErrorOptions) {
  return new AppRuntimeError(options)
}

export function isAppRuntimeError(error: unknown): error is AppRuntimeError {
  return error instanceof AppRuntimeError
}

export function logRuntimeError(error: unknown, fallback: Omit<RuntimeErrorOptions, "cause">) {
  const normalized = isAppRuntimeError(error)
    ? error
    : toAppRuntimeError({
        ...fallback,
        cause: error,
      })

  const payload = {
    area: normalized.area,
    action: normalized.action,
    message: normalized.message,
    metadata: normalized.metadata,
    cause: normalized.cause,
  }

  if (normalized.level === "info") {
    if (process.env.NODE_ENV === "production") {
      return normalized
    }

    console.info("[runtime]", payload)
    return normalized
  }

  if (normalized.level === "warn") {
    console.warn("[runtime]", payload)
    return normalized
  }

  console.error("[runtime]", payload)
  return normalized
}

export async function withRuntimeFallback<T>(
  task: () => Promise<T>,
  options: Omit<RuntimeErrorOptions, "cause"> & { fallback: T },
): Promise<T> {
  try {
    return await task()
  } catch (error) {
    logRuntimeError(error, options)
    return options.fallback
  }
}
