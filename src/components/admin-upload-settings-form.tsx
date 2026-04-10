"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { TextField } from "@/components/ui/text-field"
import { saveAdminSiteSettings } from "@/lib/admin-site-settings-client"
import type { UploadProvider } from "@/lib/upload-provider"

interface AdminUploadSettingsFormProps {
  initialSettings: {
    uploadProvider: UploadProvider
    uploadLocalPath: string
    uploadBaseUrl?: string | null
    uploadOssBucket?: string | null
    uploadOssRegion?: string | null
    uploadOssEndpoint?: string | null
    uploadS3CredentialsConfigured: boolean
    uploadS3ForcePathStyle: boolean
    uploadRequireLogin: boolean
    uploadAllowedImageTypes: string[]
    uploadMaxFileSizeMb: number
    uploadAvatarMaxFileSizeMb: number
    markdownImageUploadEnabled: boolean
  }
}

export function AdminUploadSettingsForm({ initialSettings }: AdminUploadSettingsFormProps) {
  const router = useRouter()
  const [uploadProvider, setUploadProvider] = useState(initialSettings.uploadProvider)
  const [uploadLocalPath, setUploadLocalPath] = useState(initialSettings.uploadLocalPath)
  const [uploadBaseUrl, setUploadBaseUrl] = useState(initialSettings.uploadBaseUrl ?? "")
  const [uploadOssBucket, setUploadOssBucket] = useState(initialSettings.uploadOssBucket ?? "")
  const [uploadOssRegion, setUploadOssRegion] = useState(initialSettings.uploadOssRegion ?? "")
  const [uploadOssEndpoint, setUploadOssEndpoint] = useState(initialSettings.uploadOssEndpoint ?? "")
  const [uploadS3AccessKeyId, setUploadS3AccessKeyId] = useState("")
  const [uploadS3SecretAccessKey, setUploadS3SecretAccessKey] = useState("")
  const [uploadS3ForcePathStyle, setUploadS3ForcePathStyle] = useState(initialSettings.uploadS3ForcePathStyle)
  const [uploadRequireLogin, setUploadRequireLogin] = useState(initialSettings.uploadRequireLogin)
  const [uploadAllowedImageTypes, setUploadAllowedImageTypes] = useState(initialSettings.uploadAllowedImageTypes.join(", "))
  const [uploadMaxFileSizeMb, setUploadMaxFileSizeMb] = useState(String(initialSettings.uploadMaxFileSizeMb))
  const [uploadAvatarMaxFileSizeMb, setUploadAvatarMaxFileSizeMb] = useState(String(initialSettings.uploadAvatarMaxFileSizeMb))
  const [markdownImageUploadEnabled, setMarkdownImageUploadEnabled] = useState(initialSettings.markdownImageUploadEnabled)
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()
  const useRemoteStorage = uploadProvider === "s3"

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        setFeedback("")
        startTransition(async () => {
          const result = await saveAdminSiteSettings({
            uploadProvider,
            uploadLocalPath,
            uploadBaseUrl,
            uploadOssBucket,
            uploadOssRegion,
            uploadOssEndpoint,
            uploadS3AccessKeyId,
            uploadS3SecretAccessKey,
            uploadS3ForcePathStyle,
            uploadRequireLogin,
            uploadAllowedImageTypes,
            uploadMaxFileSizeMb: Number(uploadMaxFileSizeMb),
            uploadAvatarMaxFileSizeMb: Number(uploadAvatarMaxFileSizeMb),
            markdownImageUploadEnabled,
            section: "upload",
          })
          setFeedback(result.message)
          if (result.ok) {
            router.refresh()
          }
        })
      }}
    >
      <div className="space-y-4 rounded-[22px] border border-border bg-card p-4">
        <div>
          <h3 className="text-sm font-semibold">上传与存储配置</h3>
          <p className="mt-1 text-xs text-muted-foreground">统一配置本地上传或 S3 兼容对象存储，兼容 Cloudflare R2 等 endpoint 模式服务。</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SelectField label="存储策略" value={uploadProvider} onChange={(value) => setUploadProvider(value as UploadProvider)} options={[{ value: "local", label: "本地存储" }, { value: "s3", label: "S3 兼容对象存储" }]} />
          <TextField label="本地上传目录" value={uploadLocalPath} onChange={setUploadLocalPath} placeholder="如 uploads" />
          <TextField label="资源访问基础 URL" value={uploadBaseUrl} onChange={setUploadBaseUrl} placeholder={useRemoteStorage ? "如 https://cdn.example.com 或 https://pub-xxx.r2.dev" : "留空则自动使用 /uploads"} />
          {useRemoteStorage ? <TextField label="Bucket" value={uploadOssBucket} onChange={setUploadOssBucket} placeholder="如 my-bucket" /> : null}
          {useRemoteStorage ? <TextField label="Region" value={uploadOssRegion} onChange={setUploadOssRegion} placeholder="R2 可填 auto" /> : null}
          {useRemoteStorage ? <TextField label="Endpoint" value={uploadOssEndpoint} onChange={setUploadOssEndpoint} placeholder="如 https://<accountid>.r2.cloudflarestorage.com" /> : null}
          {useRemoteStorage ? <TextField label="Access Key ID" value={uploadS3AccessKeyId} onChange={setUploadS3AccessKeyId} placeholder={initialSettings.uploadS3CredentialsConfigured ? "留空则保持当前 Access Key ID" : "填写对象存储 Access Key ID"} /> : null}
          {useRemoteStorage ? <TextField label="Secret Access Key" type="password" value={uploadS3SecretAccessKey} onChange={setUploadS3SecretAccessKey} placeholder={initialSettings.uploadS3CredentialsConfigured ? "留空则保持当前 Secret Access Key" : "填写对象存储 Secret Access Key"} /> : null}
          {useRemoteStorage ? <SwitchField label="强制 Path-Style" checked={uploadS3ForcePathStyle} onChange={setUploadS3ForcePathStyle} description="R2、MinIO 等自定义 endpoint 通常建议开启；若使用原生 AWS S3 虚拟主机风格，可关闭。" /> : null}
          <SwitchField label="必须登录后上传" checked={uploadRequireLogin} onChange={setUploadRequireLogin} description="关闭后游客也能调用上传接口，但当前上传记录仍依赖用户归属，通常建议保持开启。" />
          <SwitchField label="Markdown 图片上传" checked={markdownImageUploadEnabled} onChange={setMarkdownImageUploadEnabled} description="关闭后，Markdown 编辑器中的图片按钮会改为手动插入远程图片 URL，不再触发本地图片上传。" />
          <TextField label="允许图片格式" value={uploadAllowedImageTypes} onChange={setUploadAllowedImageTypes} placeholder="如 jpg, jpeg, png, gif, webp" />
          <NumberField label="通用图片大小上限（MB）" value={uploadMaxFileSizeMb} onChange={setUploadMaxFileSizeMb} min={1} />
          <NumberField label="头像大小上限（MB）" value={uploadAvatarMaxFileSizeMb} onChange={setUploadAvatarMaxFileSizeMb} min={1} />
        </div>
        <p className="text-xs leading-6 text-muted-foreground">
          {useRemoteStorage
            ? `对象存储模式下会直接上传到 S3 兼容接口；图片最终访问地址优先使用“资源访问基础 URL”，未填写时会尝试用 endpoint 自动拼接。${initialSettings.uploadS3CredentialsConfigured ? "当前已保存对象存储密钥，留空提交将继续沿用。" : "当前尚未保存对象存储密钥。"}`
            : "本地存储模式下，文件会写入站点服务器的本地上传目录；资源访问基础 URL 留空时默认使用 /uploads。"}
        </p>
        <div className="flex items-center gap-3">
          <Button disabled={isPending} className="h-10 rounded-full px-4 text-xs">{isPending ? "保存中..." : "保存上传设置"}</Button>
          {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
        </div>
      </div>
    </form>
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
