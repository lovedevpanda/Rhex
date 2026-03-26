"use client"

import {  useCallback, useMemo, useRef, useState } from "react"
import { ImagePlus, List, ListOrdered, SmilePlus, Table2, TextQuote } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DEFAULT_MARKDOWN_EMOJI_ITEMS, type MarkdownEmojiItem } from "@/lib/markdown-emoji"



interface RichPostEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: number
}

function insertText(source: string, selectionStart: number, selectionEnd: number, before: string, after = "") {
  return `${source.slice(0, selectionStart)}${before}${source.slice(selectionStart, selectionEnd)}${after}${source.slice(selectionEnd)}`
}

function getBlockInsertPrefix(source: string, position: number) {
  if (position <= 0) {
    return ""
  }

  const previousChar = source[position - 1]
  if (previousChar === "\n") {
    return source[position - 2] === "\n" ? "" : "\n"
  }

  return "\n\n"
}


export function RichPostEditor({ value, onChange, placeholder, minHeight = 260 }: RichPostEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const selectionRef = useRef({ start: 0, end: 0 })
  const [uploading, setUploading] = useState(false)
  const [markdownEmojiMap] = useState<MarkdownEmojiItem[]>(DEFAULT_MARKDOWN_EMOJI_ITEMS)
  const [message, setMessage] = useState("")


  const stats = useMemo(() => ({
    chars: value.length,
    paragraphs: value.split(/\n{2,}/).filter(Boolean).length,
  }), [value])

  const syncSelection = useCallback(() => {
    const element = textareaRef.current
    if (!element) {
      return selectionRef.current
    }

    const nextSelection = {
      start: element.selectionStart,
      end: element.selectionEnd,
    }
    selectionRef.current = nextSelection
    return nextSelection
  }, [])

  const restoreSelection = useCallback((start: number, end: number = start) => {
    setTimeout(() => {
      const element = textareaRef.current
      if (!element) {
        return
      }

      element.focus()
      element.setSelectionRange(start, end)
      selectionRef.current = { start, end }
    }, 0)
  }, [])

  const handleToolbarMouseDown = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    syncSelection()
    event.preventDefault()
  }, [syncSelection])

  function applyWrap(before: string, after = "") {

    const element = textareaRef.current
    if (!element) {
      onChange(`${value}${before}${after}`)
      return
    }

    const { start, end } = syncSelection()
    const nextValue = insertText(value, start, end, before, after)
    onChange(nextValue)
    restoreSelection(start + before.length, end + before.length)
  }

  function insertTemplate(template: string) {
    const element = textareaRef.current
    if (!element) {
      const prefix = getBlockInsertPrefix(value, value.length)
      onChange(`${value}${prefix}${template}`)
      return
    }

    const { start, end } = syncSelection()
    const prefix = getBlockInsertPrefix(value, start)
    const insertedText = prefix + template
    const nextValue = insertText(value, start, end, insertedText)
    onChange(nextValue)
    const caretPosition = start + insertedText.length
    restoreSelection(caretPosition, caretPosition)
  }





  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setUploading(true)
    setMessage("")
    const formData = new FormData()
    formData.append("file", file)
    formData.append("folder", "posts")

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    })
    const result = await response.json()
    setUploading(false)
    event.target.value = ""

    if (!response.ok) {
      setMessage(result.message ?? "图片上传失败")
      return
    }

    const imageMarkdown = `![${file.name}](${result.data?.urlPath ?? ""})`
    insertTemplate(imageMarkdown)
    setMessage("图片已插入正文")
  }

  return (
    <div className="space-y-3 rounded-[24px] border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onMouseDown={handleToolbarMouseDown} onClick={() => applyWrap("**", "**")}>加粗</Button>

        <Button type="button" variant="outline" onMouseDown={handleToolbarMouseDown} onClick={() => applyWrap("`", "`")}>行内代码</Button>

        <Button type="button" variant="outline" onMouseDown={handleToolbarMouseDown} onClick={() => insertTemplate(":smile: :heart: :rocket:")}>表情</Button>

        <Button type="button" variant="outline" onClick={() => insertTemplate("- 列表项 1\n- 列表项 2")}>
          <List className="mr-1 h-4 w-4" />
          列表
        </Button>
        <Button type="button" variant="outline" onClick={() => insertTemplate("1. 步骤一\n2. 步骤二")}>
          <ListOrdered className="mr-1 h-4 w-4" />
          有序
        </Button>
        <Button type="button" variant="outline" onMouseDown={handleToolbarMouseDown} onClick={() => applyWrap("> ")}>
          <TextQuote className="mr-1 h-4 w-4" />
          引用
        </Button>

        <Button type="button" variant="outline" onMouseDown={handleToolbarMouseDown} onClick={() => insertTemplate("| 列 1 | 列 2 |\n| --- | --- |\n| 内容 A | 内容 B |")}> 

          <Table2 className="mr-1 h-4 w-4" />
          表格
        </Button>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-accent/50">
          <ImagePlus className="h-4 w-4" />
          <span>{uploading ? "上传中..." : "插入图片"}</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        <Button type="button" variant="outline" onClick={() => insertTemplate("## 小标题")}>小标题</Button>
        <Button type="button" variant="outline" onMouseDown={handleToolbarMouseDown} onClick={() => applyWrap(`:${markdownEmojiMap[0]?.shortcode ?? "smile"}: :${markdownEmojiMap[1]?.shortcode ?? "heart"}: :${markdownEmojiMap[2]?.shortcode ?? "rocket"}: `)}>
          <SmilePlus className="mr-1 h-4 w-4" />
          常用表情
        </Button>
        {markdownEmojiMap.slice(0, 8).map((emoji) => (
          <Button
            key={emoji.shortcode}
            type="button"
            variant="outline"
            className="gap-1.5"
            onMouseDown={handleToolbarMouseDown}
            onClick={() => applyWrap(`:${emoji.shortcode}: `)}
            title={`${emoji.label}（:${emoji.shortcode}:）`}
          >
            <span>{emoji.icon}</span>
            <span className="max-w-16 truncate text-xs">{emoji.label}</span>
          </Button>
        ))}

      </div>


      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-w-0 rounded-[18px] border border-border bg-background px-3 py-3 text-sm leading-7 outline-none sm:rounded-[20px] sm:px-4"

        style={{ minHeight }}
        placeholder={placeholder}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <p>支持图片、表情短码、列表、引用、表格和基础 Markdown 标记，前台会自动渲染。</p>
        <p>{stats.paragraphs} 段 · {stats.chars} 字</p>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  )
}

