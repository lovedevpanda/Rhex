"use client"

import Image from "next/image"
import { useCallback, useRef, useState } from "react"

interface BuiltinCaptchaFieldProps {
  code: string
  onCodeChange: (value: string) => void
  onTokenChange: (value: string) => void
  onLoadError?: (message: string) => void
}

type CaptchaResponse = {
  code?: number
  message?: string
  data?: {
    imageDataUrl?: string
    captchaToken?: string
  }
}

export function BuiltinCaptchaField({ code, onCodeChange, onTokenChange, onLoadError }: BuiltinCaptchaFieldProps) {
  const [captchaUrl, setCaptchaUrl] = useState("")
  const hasInitializedRef = useRef(false)

  const refreshCaptcha = useCallback(async () => {
    const response = await fetch(`/api/auth/captcha?ts=${Date.now()}`, { cache: "no-store" })
    const result = await response.json() as CaptchaResponse

    if (!response.ok || result.code !== 0) {
      onLoadError?.(result.message ?? "验证码加载失败")
      return
    }

    setCaptchaUrl(result.data?.imageDataUrl ?? "")
    onTokenChange(result.data?.captchaToken ?? "")
    onCodeChange("")
  }, [onCodeChange, onLoadError, onTokenChange])

  const handleMount = useCallback((node: HTMLDivElement | null) => {
    if (!node || hasInitializedRef.current) {
      return
    }

    hasInitializedRef.current = true
    void refreshCaptcha()
  }, [refreshCaptcha])

  return (
    <div ref={handleMount} className="space-y-3 rounded-[24px]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">验证码</p>
        <button type="button" className="text-xs text-primary hover:opacity-80" onClick={() => void refreshCaptcha()}>刷新验证码</button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {captchaUrl ? (
          <Image
            src={captchaUrl}
            alt="图形验证码"
            width={132}
            height={44}
            unoptimized
            className="h-11 w-[132px] rounded-xl bg-card"
          />
        ) : null}
        <input value={code} onChange={(event) => onCodeChange(event.target.value.toUpperCase())} placeholder="输入图中验证码" className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none sm:max-w-[220px]" />
      </div>
    </div>
  )
}
