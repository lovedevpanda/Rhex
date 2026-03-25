"use client"

import { useMemo } from "react"

interface UseContentSafetyOptions {
  maxLength?: number
  forbiddenWords?: string[]
}

export function useContentSafety(value: string, options: UseContentSafetyOptions = {}) {
  return useMemo(() => {
    const normalized = value.trim()
    const forbiddenWords = options.forbiddenWords ?? []
    const hitWord = forbiddenWords.find((word) => normalized.includes(word)) ?? null
    const overLimit = typeof options.maxLength === "number" && normalized.length > options.maxLength

    return {
      length: normalized.length,
      overLimit,
      hitWord,
      valid: !overLimit && !hitWord,
    }
  }, [options.forbiddenWords, options.maxLength, value])
}
