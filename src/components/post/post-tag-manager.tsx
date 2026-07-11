"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { MAX_MANUAL_TAGS } from "@/lib/post-tags"

interface EditableTag {
  id: string
  name: string
  slug: string
}

interface PostTagManagerProps {
  postId: string
  tags: EditableTag[]
}

interface UpdateTagsResponse {
  code?: number
  message?: string
  data?: {
    tags?: EditableTag[]
  }
}

function normalizeTagList(tags: string[]) {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const tag of tags) {
    const value = tag.trim()
    const key = value.toLowerCase()
    if (!value || seen.has(key)) {
      continue
    }

    seen.add(key)
    normalized.push(value)
    if (normalized.length >= MAX_MANUAL_TAGS) {
      break
    }
  }

  return normalized
}

function parseTagInput(value: string) {
  return value.split(/[\n,，、]+/).map((item) => item.trim()).filter(Boolean)
}

export function PostTagManager({ postId, tags }: PostTagManagerProps) {
  const router = useRouter()
  const initialNames = useMemo(() => tags.map((tag) => tag.name), [tags])
  const [open, setOpen] = useState(false)
  const [tagNames, setTagNames] = useState<string[]>(initialNames)
  const [tagInput, setTagInput] = useState("")
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState("")
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)

  function openModal() {
    setTagNames(initialNames)
    setTagInput("")
    setEditingIndex(null)
    setEditingValue("")
    setMessage("")
    setOpen(true)
  }

  function closeModal() {
    if (saving) {
      return
    }

    setOpen(false)
    setTagInput("")
    setEditingIndex(null)
    setEditingValue("")
    setMessage("")
    setTagNames(initialNames)
  }

  function addTags(values: string[]) {
    if (tagNames.length >= MAX_MANUAL_TAGS) {
      setMessage(`最多只能设置 ${MAX_MANUAL_TAGS} 个标签`)
      return
    }

    const nextTags = normalizeTagList([...tagNames, ...values])
    setTagNames(nextTags)
    setTagInput("")
    setMessage(nextTags.length >= MAX_MANUAL_TAGS ? `已达到 ${MAX_MANUAL_TAGS} 个标签上限` : "")
  }

  function confirmInput() {
    const values = parseTagInput(tagInput)
    if (values.length === 0) {
      setMessage("请输入标签名称")
      return
    }

    addTags(values)
  }

  function startEditing(index: number) {
    setEditingIndex(index)
    setEditingValue(tagNames[index] ?? "")
    setMessage("")
  }

  function commitEditing(index = editingIndex) {
    if (index === null) {
      return
    }

    const value = editingValue.trim()
    if (!value) {
      setMessage("标签名称不能为空")
      return
    }

    const nextTags = normalizeTagList(tagNames.map((tag, currentIndex) => currentIndex === index ? value : tag))
    setTagNames(nextTags)
    setEditingIndex(null)
    setEditingValue("")
    setMessage("")
  }

  function removeTag(tagName: string) {
    setTagNames(tagNames.filter((tag) => tag.toLowerCase() !== tagName.toLowerCase()))
    setMessage("")
  }

  async function saveTags() {
    setSaving(true)
    setMessage("")

    try {
      const response = await fetch("/api/admin/posts/tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId,
          tags: tagNames,
        }),
      })
      const result = await response.json() as UpdateTagsResponse

      if (!response.ok) {
        setMessage(result.message ?? "保存失败，请稍后重试")
        return
      }

      setOpen(false)
      setMessage("")
      router.refresh()
    } catch {
      setMessage("保存失败，请检查网络后重试")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="xs" onClick={openModal}>
        {tags.length > 0 ? "编辑标签" : "添加标签"}
      </Button>

      <Modal
        open={open}
        onClose={closeModal}
        closeDisabled={saving}
        title="编辑主题标签"
        description={`管理员和版主可以直接调整该帖子的主题标签，最多 ${MAX_MANUAL_TAGS} 个。`}
        size="md"
        footer={(
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">当前 {tagNames.length} / {MAX_MANUAL_TAGS} 个标签</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" onClick={closeModal} disabled={saving}>取消</Button>
              <Button type="button" onClick={saveTags} disabled={saving}>
                {saving ? "保存中..." : "保存标签"}
              </Button>
            </div>
          </div>
        )}
      >
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  confirmInput()
                }
              }}
              placeholder="输入标签后回车，可用逗号批量添加"
              disabled={saving || tagNames.length >= MAX_MANUAL_TAGS}
            />
            <Button type="button" variant="outline" onClick={confirmInput} disabled={saving || tagNames.length >= MAX_MANUAL_TAGS}>添加</Button>
          </div>

          <div className="flex min-h-24 flex-wrap content-start items-start gap-2 rounded-xl border bg-background p-3">
            {tagNames.length === 0 ? <p className="text-sm text-muted-foreground">当前还没有标签，可以在上方输入后添加。</p> : null}
            {tagNames.map((tagName, index) => (
              editingIndex === index ? (
                <div key={`${tagName}-${index}`} className="inline-flex self-start items-center gap-2 rounded-full border bg-accent px-3 py-1">
                  <span className="text-sm text-muted-foreground">#</span>
                  <Input
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        commitEditing(index)
                      }
                      if (event.key === "Escape") {
                        setEditingIndex(null)
                        setEditingValue("")
                      }
                    }}
                    className="h-7 min-w-24 border-0 bg-transparent px-0 focus-visible:ring-0"
                    autoFocus
                    disabled={saving}
                  />
                  <Button type="button" variant="ghost" size="xs" onClick={() => commitEditing(index)} disabled={saving}>完成</Button>
                </div>
              ) : (
                <div key={`${tagName}-${index}`} className="inline-flex self-start items-center gap-2 rounded-full border bg-accent px-3 py-1 text-sm">
                  <button type="button" className="transition-opacity hover:opacity-80" onClick={() => startEditing(index)} disabled={saving}>
                    #{tagName}
                  </button>
                  <Button type="button" variant="ghost" size="xs" onClick={() => removeTag(tagName)} disabled={saving}>删除</Button>
                </div>
              )
            ))}
          </div>

          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </div>
      </Modal>
    </>
  )
}
