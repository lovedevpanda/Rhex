export type VerificationFieldType = "text" | "textarea" | "number" | "url"

export type VerificationFormField = {
  id: string
  label: string
  type: VerificationFieldType
  placeholder?: string
  required: boolean
  helpText?: string
  sortOrder: number
}

const VALID_FIELD_TYPES = new Set<VerificationFieldType>(["text", "textarea", "number", "url"])

function normalizeVerificationFormField(
  item: Record<string, unknown>,
  index: number,
  options?: {
    allowFallbackLabel?: boolean
    coerceInvalidType?: boolean
  },
): VerificationFormField | null {
  const rawType = String(item.type ?? "text")
  const type = VALID_FIELD_TYPES.has(rawType as VerificationFieldType)
    ? rawType as VerificationFieldType
    : options?.coerceInvalidType
      ? "text"
      : null

  if (!type) {
    return null
  }

  const fallbackLabel = options?.allowFallbackLabel ? "字段" : ""
  const label = String(item.label ?? fallbackLabel).trim()
  if (!label) {
    return null
  }

  return {
    id: String(item.id ?? `field_${index + 1}`).trim() || `field_${index + 1}`,
    label,
    type,
    placeholder: String(item.placeholder ?? "").trim() || undefined,
    required: item.required === true,
    helpText: String(item.helpText ?? "").trim() || undefined,
    sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
  }
}

export function parseVerificationFormSchema(
  input?: string | null,
  options?: {
    allowFallbackLabel?: boolean
    coerceInvalidType?: boolean
  },
): VerificationFormField[] {
  if (!input?.trim()) {
    return []
  }

  try {
    const parsed = JSON.parse(input) as Array<Record<string, unknown>>
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((item, index) => normalizeVerificationFormField(item, index, options))
      .filter((item): item is VerificationFormField => Boolean(item))
      .sort((left, right) => left.sortOrder - right.sortOrder)
  } catch {
    return []
  }
}
