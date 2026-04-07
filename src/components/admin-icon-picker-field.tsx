"use client"

import { useMemo, useState } from "react"
import { Loader2, Upload } from "lucide-react"

import { LevelIcon } from "@/components/level-icon"
import { PickerPopover } from "@/components/admin-picker-popover"
import { toast } from "@/components/ui/toast"

interface AdminIconPickerFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  presets?: string[]
  previewColor?: string
  triggerClassName?: string
  containerClassName?: string
  textareaRows?: number
  description?: string
  popoverTitle?: string
  uploadFolder?: "avatars" | "posts" | "comments" | "friend-links" | "site-logo" | "icon"
  hideLabel?: boolean
  triggerMode?: "full" | "icon"
}

const DEFAULT_ICON_PRESETS = ["🌱", "⭐", "🔥", "⚡", "💎", "👑", "🛡️", "🚀", "🎯", "🏆", "🌈", "🧠", "📚", "💬", "📷", "🌿"]

export function AdminIconPickerField({
  label,
  value,
  onChange,
  placeholder = "输入 emoji、SVG、图片 URL，或上传后的本地路径",
  presets = DEFAULT_ICON_PRESETS,
  previewColor,
  triggerClassName,
  containerClassName,
  textareaRows = 4,
  description = "支持 emoji、内联 SVG、远程图片 URL 和上传后的本地资源路径。",
  popoverTitle,
  uploadFolder = "icon",
  hideLabel = false,
  triggerMode = "full",
}: AdminIconPickerFieldProps) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const normalizedValue = useMemo(() => value?.trim() || "", [value])
  const title = popoverTitle ?? `选择${label}`

  async function uploadIcon(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件后再上传", `${label}上传失败`)
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    formData.append("folder", uploadFolder)

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      const result = await response.json()

      if (!response.ok || result.code !== 0) {
        toast.error(result.message ?? `${label}上传失败`, `${label}上传失败`)
        return
      }

      const uploadedPath = String(result.data?.urlPath ?? "").trim()
      if (!uploadedPath) {
        toast.error("上传成功，但未返回可用地址", `${label}上传失败`)
        return
      }

      onChange(uploadedPath)
      toast.success("图片已上传并回填到当前图标", `${label}上传成功`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `${label}上传失败，请稍后重试`, `${label}上传失败`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={containerClassName ?? "space-y-1"}>
      {hideLabel ? null : <p className="text-[11px] font-medium text-muted-foreground">{label}</p>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={triggerClassName ?? (triggerMode === "icon" ? "flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-background text-left text-sm transition-colors hover:bg-accent" : "flex h-11 w-full items-center gap-3 rounded-full border border-border bg-background px-4 text-left text-sm transition-colors hover:bg-accent")}
        >
          <span className={triggerMode === "icon" ? "inline-flex h-4 w-4 shrink-0 items-center justify-center text-foreground/80" : "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground/80"}>
            <LevelIcon icon={normalizedValue} color={previewColor} className="h-4 w-4 text-sm" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
          </span>
          {triggerMode === "icon" ? null : <span className="min-w-0 flex-1 truncate">{normalizedValue || placeholder}</span>}
        </button>

        {open ? (
          <div className={triggerMode === "icon" ? "absolute left-0 top-full z-[140] mt-2 w-80 max-w-[calc(100vw-2rem)]" : "absolute left-0 top-full z-[140] mt-2 w-full min-w-[20rem]"}>
            <PickerPopover title={title} onClose={() => setOpen(false)}>
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium text-muted-foreground">自定义图标</p>
                    <LevelIcon icon={normalizedValue} color={previewColor} className="h-4 w-4 text-sm" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[11px] font-medium transition hover:bg-accent">
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {uploading ? "上传中..." : "上传图片"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) {
                            void uploadIcon(file)
                          }
                          event.target.value = ""
                        }}
                      />
                    </label>
                    <p className="text-[11px] text-muted-foreground">上传后会自动回填资源路径，也可继续手动改成 emoji、SVG 或 URL。</p>
                  </div>
                  <textarea
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    rows={textareaRows}
                    className="min-h-[88px] w-full rounded-2xl border border-border bg-background px-3 py-2 text-xs leading-5 outline-none transition-colors focus:border-foreground/30"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">{description}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {presets.map((preset) => {
                    const active = normalizedValue === preset
                    return (
                      <button
                        key={preset}
                        type="button"
                        className={active ? "flex h-7 min-w-7 items-center justify-center rounded-full border border-foreground/15 bg-accent px-2 text-sm shadow-sm" : "flex h-7 min-w-7 items-center justify-center rounded-full border border-border bg-background px-2 text-sm transition-colors hover:bg-accent"}
                        onClick={() => {
                          onChange(preset)
                          setOpen(false)
                        }}
                        aria-label={`使用图标 ${preset}`}
                      >
                        {preset}
                      </button>
                    )
                  })}
                </div>
              </div>
            </PickerPopover>
          </div>
        ) : null}
      </div>
    </div>
  )
}
