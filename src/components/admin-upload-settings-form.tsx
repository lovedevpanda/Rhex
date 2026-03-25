"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"

interface AdminUploadSettingsFormProps {
  initialSettings: {
    uploadProvider: string
    uploadLocalPath: string
    uploadBaseUrl?: string | null
    uploadOssBucket?: string | null
    uploadOssRegion?: string | null
    uploadOssEndpoint?: string | null
    uploadRequireLogin: boolean
    uploadAllowedImageTypes: string[]
    uploadMaxFileSizeMb: number
    uploadAvatarMaxFileSizeMb: number
  }
}

export function AdminUploadSettingsForm({ initialSettings }: AdminUploadSettingsFormProps) {
  const [uploadProvider, setUploadProvider] = useState(initialSettings.uploadProvider)
  const [uploadLocalPath, setUploadLocalPath] = useState(initialSettings.uploadLocalPath)
  const [uploadBaseUrl, setUploadBaseUrl] = useState(initialSettings.uploadBaseUrl ?? "")
  const [uploadOssBucket, setUploadOssBucket] = useState(initialSettings.uploadOssBucket ?? "")
  const [uploadOssRegion, setUploadOssRegion] = useState(initialSettings.uploadOssRegion ?? "")
  const [uploadOssEndpoint, setUploadOssEndpoint] = useState(initialSettings.uploadOssEndpoint ?? "")
  const [uploadRequireLogin, setUploadRequireLogin] = useState(initialSettings.uploadRequireLogin)
  const [uploadAllowedImageTypes, setUploadAllowedImageTypes] = useState(initialSettings.uploadAllowedImageTypes.join(", "))
  const [uploadMaxFileSizeMb, setUploadMaxFileSizeMb] = useState(String(initialSettings.uploadMaxFileSizeMb))
  const [uploadAvatarMaxFileSizeMb, setUploadAvatarMaxFileSizeMb] = useState(String(initialSettings.uploadAvatarMaxFileSizeMb))
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        setFeedback("")
        startTransition(async () => {
          const response = await fetch("/api/admin/site-settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uploadProvider,
              uploadLocalPath,
              uploadBaseUrl,
              uploadOssBucket,
              uploadOssRegion,
              uploadOssEndpoint,
              uploadRequireLogin,
              uploadAllowedImageTypes,
              uploadMaxFileSizeMb: Number(uploadMaxFileSizeMb),
              uploadAvatarMaxFileSizeMb: Number(uploadAvatarMaxFileSizeMb),
              section: "upload",
            }),
          })
          const result = await response.json()
          setFeedback(result.message ?? (response.ok ? "保存成功" : "保存失败"))
        })
      }}
    >
      <div className="space-y-4 rounded-[22px] border border-border bg-card p-4">
        <div>
          <h3 className="text-sm font-semibold">上传与存储配置</h3>
          <p className="mt-1 text-xs text-muted-foreground">统一配置本地上传路径、预留 OSS 参数，以及上传安全规则。</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SelectField label="存储策略" value={uploadProvider} onChange={setUploadProvider} options={[{ value: "local", label: "本地存储" }, { value: "oss", label: "OSS（预留）" }]} />
          <Field label="本地上传目录" value={uploadLocalPath} onChange={setUploadLocalPath} placeholder="如 uploads" />
          <Field label="资源访问基础 URL" value={uploadBaseUrl} onChange={setUploadBaseUrl} placeholder="留空则自动使用 /uploads" />
          <Field label="OSS Bucket" value={uploadOssBucket} onChange={setUploadOssBucket} placeholder="如 my-bucket" />
          <Field label="OSS Region" value={uploadOssRegion} onChange={setUploadOssRegion} placeholder="如 ap-guangzhou" />
          <Field label="OSS Endpoint" value={uploadOssEndpoint} onChange={setUploadOssEndpoint} placeholder="如 https://oss.example.com" />
          <SwitchField label="必须登录后上传" checked={uploadRequireLogin} onChange={setUploadRequireLogin} description="关闭后游客也能调用上传接口，但当前上传记录仍依赖用户归属，通常建议保持开启。" />
          <Field label="允许图片格式" value={uploadAllowedImageTypes} onChange={setUploadAllowedImageTypes} placeholder="如 jpg, jpeg, png, gif, webp" />
          <NumberField label="通用图片大小上限（MB）" value={uploadMaxFileSizeMb} onChange={setUploadMaxFileSizeMb} min={1} />
          <NumberField label="头像大小上限（MB）" value={uploadAvatarMaxFileSizeMb} onChange={setUploadAvatarMaxFileSizeMb} min={1} />
        </div>
        <p className="text-xs leading-6 text-muted-foreground">支持统一控制上传登录要求、图片扩展名白名单和大小限制；头像限制会优先使用专属阈值。</p>
        <div className="flex items-center gap-3">
          <Button disabled={isPending} className="h-10 rounded-full px-4 text-xs">{isPending ? "保存中..." : "保存上传设置"}</Button>
          {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
        </div>
      </div>
    </form>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" />
    </div>
  )
}

function NumberField({ label, value, onChange, min }: { label: string; value: string; onChange: (value: string) => void; min?: number }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <input type="number" min={min} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" />
    </div>
  )
}

function SwitchField({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (value: boolean) => void; description?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start justify-between gap-3 rounded-[20px] border border-border bg-background px-4 py-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        {description ? <p className="text-xs leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4" />
    </label>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none">
        {options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </div>
  )
}
