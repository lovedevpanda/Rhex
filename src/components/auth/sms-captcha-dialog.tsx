"use client"

import { useState } from "react"

import { AuthInlineMessage } from "@/components/auth/auth-form-primitives"
import { BuiltinCaptchaField } from "@/components/auth/builtin-captcha-field"
import { PowCaptchaField } from "@/components/auth/pow-captcha-field"
import { TurnstileCaptchaField } from "@/components/auth/turnstile-captcha-field"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { Spinner } from "@/components/ui/spinner"
import type { SiteSettingsData } from "@/lib/site-settings"

export interface SmsCaptchaPayload {
  captchaToken?: string
  builtinCaptchaCode?: string
  powNonce?: string
}

interface SmsCaptchaDialogProps {
  open: boolean
  mode: SiteSettingsData["smsCaptchaMode"]
  siteKey?: string | null
  sending: boolean
  onClose: () => void
  onVerified: (payload: SmsCaptchaPayload) => void | Promise<void>
}

export function SmsCaptchaDialog(props: SmsCaptchaDialogProps) {
  if (!props.open || props.mode === "OFF") {
    return null
  }

  return <SmsCaptchaDialogContent key={props.mode} {...props} />
}

function SmsCaptchaDialogContent({
  open,
  mode,
  siteKey,
  sending,
  onClose,
  onVerified,
}: SmsCaptchaDialogProps) {
  const [captchaToken, setCaptchaToken] = useState("")
  const [builtinCaptchaCode, setBuiltinCaptchaCode] = useState("")
  const [powNonce, setPowNonce] = useState("")
  const [message, setMessage] = useState("")


  const turnstileMissing = mode === "TURNSTILE" && !siteKey
  const canSubmit = !sending && !turnstileMissing && (
    (mode === "TURNSTILE" && Boolean(captchaToken))
    || (mode === "BUILTIN" && Boolean(captchaToken) && Boolean(builtinCaptchaCode.trim()))
    || (mode === "POW" && Boolean(captchaToken) && Boolean(powNonce))
  )

  async function handleSubmit() {
    if (!canSubmit) {
      setMessage(mode === "POW" ? "请先完成工作量证明验证" : "请先完成验证码验证")
      return
    }

    await onVerified({
      captchaToken,
      builtinCaptchaCode,
      powNonce,
    })
  }

  return (
    <Modal
      open={open}
      title="发送短信前验证"
      description="完成站内验证后继续发送短信验证码。"
      closeDisabled={sending}
      onClose={onClose}
      footer={(
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={sending} onClick={onClose}>
            取消
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={() => void handleSubmit()}>
            {sending ? (
              <>
                <Spinner data-icon="inline-start" />
                发送中...
              </>
            ) : (
              "继续发送"
            )}
          </Button>
        </div>
      )}
    >
      <div className="flex flex-col gap-4">
        {turnstileMissing ? (
          <AuthInlineMessage tone="destructive">站点未完成 Turnstile 验证码配置，请联系管理员。</AuthInlineMessage>
        ) : null}

        {mode === "TURNSTILE" && siteKey ? (
          <TurnstileCaptchaField siteKey={siteKey} onTokenChange={setCaptchaToken} />
        ) : null}

        {mode === "BUILTIN" ? (
          <BuiltinCaptchaField
            code={builtinCaptchaCode}
            onCodeChange={setBuiltinCaptchaCode}
            onTokenChange={setCaptchaToken}
            onLoadError={setMessage}
          />
        ) : null}

        {mode === "POW" ? (
          <PowCaptchaField
            scope="sms"
            onTokenChange={setCaptchaToken}
            onNonceChange={setPowNonce}
            onLoadError={setMessage}
          />
        ) : null}

        {message ? <AuthInlineMessage tone="destructive">{message}</AuthInlineMessage> : null}
      </div>
    </Modal>
  )
}

