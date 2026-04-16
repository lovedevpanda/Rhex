import type { AddonAuthFieldValue, AddonAuthFields } from "@/addons-host/auth-types"

export const ADDON_FIELD_PREFIX = "addon:"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function appendAddonField(
  fields: AddonAuthFields,
  key: string,
  value: string,
) {
  const currentValue = fields[key]
  if (typeof currentValue === "undefined") {
    fields[key] = value
    return
  }

  fields[key] = Array.isArray(currentValue)
    ? [...currentValue, value]
    : [currentValue, value]
}

function normalizeAddonFieldValue(value: unknown): AddonAuthFieldValue | null {
  if (typeof value === "string") {
    return value
  }

  if (Array.isArray(value)) {
    const normalizedValues = value.filter(
      (item): item is string => typeof item === "string",
    )
    return normalizedValues.length > 0 ? normalizedValues : null
  }

  return null
}

export function collectAddonFormFieldsFromFormData(formData: FormData) {
  const fields: AddonAuthFields = {}

  for (const [fieldName, rawValue] of formData.entries()) {
    if (!fieldName.startsWith(ADDON_FIELD_PREFIX)) {
      continue
    }

    const normalizedFieldName = fieldName
      .slice(ADDON_FIELD_PREFIX.length)
      .trim()
    if (!normalizedFieldName || typeof rawValue !== "string") {
      continue
    }

    appendAddonField(fields, normalizedFieldName, rawValue)
  }

  return fields
}

export function readAddonFormFieldsFromBody(body: unknown) {
  if (!isRecord(body) || !isRecord(body.addonFields)) {
    return {} satisfies AddonAuthFields
  }

  const fields: AddonAuthFields = {}

  for (const [key, value] of Object.entries(body.addonFields)) {
    const normalizedKey = key.trim()
    const normalizedValue = normalizeAddonFieldValue(value)
    if (!normalizedKey || !normalizedValue) {
      continue
    }

    fields[normalizedKey] = normalizedValue
  }

  return fields
}
