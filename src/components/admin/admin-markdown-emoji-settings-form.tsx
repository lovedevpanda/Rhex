"use client"

import { useRouter } from "next/navigation"
import {
  CheckSquare,
  FolderPlus,
  MoveRight,
  Pencil,
  Plus,
  Ruler,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { useMemo, useRef, useState, useTransition } from "react"

import { SettingsInputField, SettingsSection } from "@/components/admin/admin-settings-fields"
import { LevelIcon } from "@/components/level-icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { IconPicker } from "@/components/ui/icon-picker"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { saveAdminSiteSettings, uploadAdminMarkdownEmojiFiles } from "@/lib/admin-site-settings-client"
import {
  DEFAULT_MARKDOWN_EMOJI_GROUP,
  DEFAULT_MARKDOWN_EMOJI_ITEMS,
  MARKDOWN_EMOJI_DISPLAY_SIZE_MAX,
  MARKDOWN_EMOJI_DISPLAY_SIZE_MIN,
  type MarkdownEmojiItem,
  formatMarkdownEmojiDisplaySize,
  normalizeMarkdownEmojiDisplaySize,
  normalizeMarkdownEmojiGroup,
  normalizeMarkdownEmojiItems,
  normalizeOptionalMarkdownEmojiItems,
} from "@/lib/markdown-emoji"
import { cn } from "@/lib/utils"

interface AdminMarkdownEmojiSettingsFormProps {
  initialItems: MarkdownEmojiItem[]
}

interface GroupSummary {
  name: string
  count: number
}

interface VisibleEmojiEntry {
  item: MarkdownEmojiItem
  index: number
  group: string
}

const ALL_GROUPS_VALUE = "__all__"

function cloneDefaultMarkdownEmojiItems() {
  return DEFAULT_MARKDOWN_EMOJI_ITEMS.map((item) => ({ ...item }))
}

function getEmojiGroup(item: MarkdownEmojiItem) {
  return normalizeMarkdownEmojiGroup(item.group)
}

function withEmojiDisplaySize(item: MarkdownEmojiItem, displaySize: number | undefined): MarkdownEmojiItem {
  if (typeof displaySize === "number") {
    return { ...item, displaySize }
  }

  const next = { ...item }
  delete next.displaySize
  return next
}

function normalizeEditableShortcode(value: string) {
  return value
    .replace(/^:+|:+$/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .replace(/^[_-]+|[_-]+$/g, "")
    .toLowerCase()
    .slice(0, 32)
}

function normalizeShortcodeBase(value: string) {
  const normalized = normalizeEditableShortcode(value)
  if (!normalized) {
    return "emoji"
  }

  return /^[a-z0-9]/.test(normalized) ? normalized : `emoji_${normalized}`.slice(0, 32)
}

function buildUniqueShortcode(baseValue: string, usedShortcodes: Set<string>) {
  const base = normalizeShortcodeBase(baseValue)
  let candidate = base
  let suffix = 2

  while (usedShortcodes.has(candidate)) {
    const suffixText = `_${suffix}`
    candidate = `${base.slice(0, Math.max(1, 32 - suffixText.length))}${suffixText}`
    suffix += 1
  }

  usedShortcodes.add(candidate)
  return candidate
}

function buildNewEmojiItem(group: string, currentItems: MarkdownEmojiItem[]): MarkdownEmojiItem {
  const usedShortcodes = new Set(currentItems.map((item) => normalizeEditableShortcode(item.shortcode)).filter(Boolean))

  return {
    shortcode: buildUniqueShortcode(`emoji_${currentItems.length + 1}`, usedShortcodes),
    label: "新表情",
    icon: "😀",
    group,
  }
}

function buildGroupSummaries(items: MarkdownEmojiItem[]) {
  const groups = new Map<string, GroupSummary>()

  for (const item of items) {
    const group = getEmojiGroup(item)
    groups.set(group, {
      name: group,
      count: (groups.get(group)?.count ?? 0) + 1,
    })
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (left.name === DEFAULT_MARKDOWN_EMOJI_GROUP) {
      return -1
    }
    if (right.name === DEFAULT_MARKDOWN_EMOJI_GROUP) {
      return 1
    }

    return left.name.localeCompare(right.name, "zh-Hans-CN")
  })
}

function getUnifiedDisplaySize(items: MarkdownEmojiItem[]) {
  if (items.length === 0) {
    return ""
  }

  const values = items.map((item) => formatMarkdownEmojiDisplaySize(item.displaySize))
  const firstValue = values[0] ?? ""
  return values.every((value) => value === firstValue) ? firstValue : ""
}

function hasMixedDisplaySizes(items: MarkdownEmojiItem[]) {
  return new Set(items.map((item) => formatMarkdownEmojiDisplaySize(item.displaySize))).size > 1
}

export function AdminMarkdownEmojiSettingsForm({ initialItems }: AdminMarkdownEmojiSettingsFormProps) {
  const router = useRouter()
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [items, setItems] = useState<MarkdownEmojiItem[]>(() => normalizeMarkdownEmojiItems(initialItems))
  const [requestedActiveGroup, setActiveGroup] = useState(() => normalizeMarkdownEmojiGroup(initialItems[0]?.group))
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(() => new Set())
  const [groupDraft, setGroupDraft] = useState("")
  const [groupDisplaySizeDraftSelection, setGroupDisplaySizeDraftSelection] = useState(() => ({
    scope: "",
    value: "",
  }))
  const [itemDisplaySizeDrafts, setItemDisplaySizeDrafts] = useState<Record<number, string>>({})
  const [moveTargetGroupSelection, setMoveTargetGroupSelection] = useState(() => ({
    sourceGroup: normalizeMarkdownEmojiGroup(initialItems[0]?.group),
    value: normalizeMarkdownEmojiGroup(initialItems[0]?.group),
  }))
  const [searchQuery, setSearchQuery] = useState("")
  const [isUploadPending, startUploadTransition] = useTransition()
  const [isPending, startTransition] = useTransition()

  const groups = useMemo(() => buildGroupSummaries(items), [items])
  const activeGroup = requestedActiveGroup === ALL_GROUPS_VALUE || groups.some((group) => group.name === requestedActiveGroup)
    ? requestedActiveGroup
    : (groups[0]?.name ?? DEFAULT_MARKDOWN_EMOJI_GROUP)
  const activeConcreteGroup = activeGroup === ALL_GROUPS_VALUE ? DEFAULT_MARKDOWN_EMOJI_GROUP : normalizeMarkdownEmojiGroup(activeGroup)
  const moveTargetGroup = moveTargetGroupSelection.sourceGroup === activeGroup
    ? moveTargetGroupSelection.value
    : activeConcreteGroup
  const setMoveTargetGroup = (value: string) => {
    setMoveTargetGroupSelection({ sourceGroup: activeGroup, value })
  }
  const visibleEntries = useMemo<VisibleEmojiEntry[]>(() => {
    const query = searchQuery.trim().toLowerCase()

    return items
      .map((item, index) => ({
        item,
        index,
        group: getEmojiGroup(item),
      }))
      .filter(({ item, group }) => {
        if (activeGroup !== ALL_GROUPS_VALUE && group !== activeConcreteGroup) {
          return false
        }

        if (!query) {
          return true
        }

        return [item.shortcode, item.label, group].some((value) => value.toLowerCase().includes(query))
      })
  }, [activeConcreteGroup, activeGroup, items, searchQuery])
  const visibleIndexes = useMemo(() => visibleEntries.map((entry) => entry.index), [visibleEntries])
  const selectedCount = selectedIndexes.size
  const selectedVisibleCount = visibleIndexes.filter((index) => selectedIndexes.has(index)).length
  const previewEntries = visibleEntries.slice(0, 80)
  const activeGroupItems = useMemo(() => {
    if (activeGroup === ALL_GROUPS_VALUE) {
      return []
    }

    return items.filter((item) => getEmojiGroup(item) === activeConcreteGroup)
  }, [activeConcreteGroup, activeGroup, items])
  const activeGroupDisplaySize = useMemo(() => getUnifiedDisplaySize(activeGroupItems), [activeGroupItems])
  const activeGroupHasMixedDisplaySizes = useMemo(() => hasMixedDisplaySizes(activeGroupItems), [activeGroupItems])

  const activeGroupScope = `${activeGroup}:${activeGroupDisplaySize}`
  const groupDisplaySizeDraft = groupDisplaySizeDraftSelection.scope === activeGroupScope
    ? groupDisplaySizeDraftSelection.value
    : activeGroupDisplaySize
  const setGroupDisplaySizeDraft = (value: string) => {
    setGroupDisplaySizeDraftSelection({ scope: activeGroupScope, value })
  }

  function clearUploadInput() {
    if (uploadInputRef.current) {
      uploadInputRef.current.value = ""
    }
  }

  function updateItem(index: number, patch: Partial<MarkdownEmojiItem>) {
    setItems((current) => current.map((row, rowIndex) => {
      if (rowIndex !== index) {
        return row
      }

      const next = { ...row, ...patch }
      if ("displaySize" in patch && typeof patch.displaySize === "undefined") {
        delete next.displaySize
      }

      return next
    }))
  }

  function handleItemDisplaySizeChange(index: number, value: string) {
    setItemDisplaySizeDrafts((current) => ({ ...current, [index]: value }))

    if (!value.trim()) {
      updateItem(index, { displaySize: undefined })
      setItemDisplaySizeDrafts((current) => {
        const next = { ...current }
        delete next[index]
        return next
      })
      return
    }

    const displaySize = normalizeMarkdownEmojiDisplaySize(value)
    if (typeof displaySize !== "number") {
      return
    }

    updateItem(index, { displaySize })
  }

  function handleItemDisplaySizeBlur(index: number) {
    setItemDisplaySizeDrafts((current) => {
      if (!(index in current)) {
        return current
      }

      const next = { ...current }
      delete next[index]
      return next
    })
  }

  function handleUploadFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? [])
    if (files.length === 0) {
      return
    }

    const targetGroup = activeConcreteGroup
    const targetDisplaySize = normalizeMarkdownEmojiDisplaySize(
      getUnifiedDisplaySize(items.filter((item) => getEmojiGroup(item) === targetGroup)),
    )

    startUploadTransition(async () => {
      const result = await uploadAdminMarkdownEmojiFiles(files, targetGroup)
      if (!result.ok) {
        toast.error(result.message, "上传失败")
        clearUploadInput()
        return
      }

      const usedShortcodes = new Set(items.map((item) => normalizeEditableShortcode(item.shortcode)).filter(Boolean))
      const importedItems: MarkdownEmojiItem[] = []
      let renamedCount = 0

      for (const item of result.data.items) {
        const originalShortcode = normalizeEditableShortcode(item.shortcode)
        if (!originalShortcode) {
          continue
        }

        const shortcode = usedShortcodes.has(originalShortcode)
          ? buildUniqueShortcode(originalShortcode, usedShortcodes)
          : originalShortcode

        if (shortcode !== originalShortcode) {
          renamedCount += 1
        } else {
          usedShortcodes.add(shortcode)
        }

        importedItems.push({
          ...item,
          shortcode,
          group: normalizeMarkdownEmojiGroup(item.group ?? targetGroup),
          ...(typeof targetDisplaySize === "number" ? { displaySize: targetDisplaySize } : {}),
        })
      }

      setItems(normalizeMarkdownEmojiItems([...items, ...importedItems]))
      setActiveGroup(targetGroup)

      const renamedText = renamedCount > 0 ? `，${renamedCount} 个重复短码已自动改名` : ""
      toast.success(`已上传 ${importedItems.length} 个表情到 ${targetGroup}${renamedText}`, "上传完成")

      clearUploadInput()
    })
  }

  function handleCreateGroup() {
    if (!groupDraft.trim()) {
      toast.warning("请填写分组名称", "分组管理")
      return
    }

    const group = normalizeMarkdownEmojiGroup(groupDraft)
    if (groups.some((item) => item.name === group)) {
      setActiveGroup(group)
      toast.info("已切换到现有分组", "分组管理")
      return
    }

    setItems((current) => [...current, buildNewEmojiItem(group, current)])
    setActiveGroup(group)
    setGroupDraft("")
    toast.success("已创建分组并添加一个表情", "分组管理")
  }

  function handleRenameGroup() {
    if (activeGroup === ALL_GROUPS_VALUE) {
      toast.warning("请先选择一个具体分组", "分组管理")
      return
    }

    if (!groupDraft.trim()) {
      toast.warning("请填写新的分组名称", "分组管理")
      return
    }

    const nextGroup = normalizeMarkdownEmojiGroup(groupDraft)
    if (nextGroup === activeConcreteGroup) {
      toast.info("分组名称没有变化", "分组管理")
      return
    }

    setItems((current) => current.map((item) => getEmojiGroup(item) === activeConcreteGroup ? { ...item, group: nextGroup } : item))
    setActiveGroup(nextGroup)
    setGroupDraft("")
    setSelectedIndexes(new Set())
    toast.success("分组已重命名", "分组管理")
  }

  function handleDeleteActiveGroup() {
    if (activeGroup === ALL_GROUPS_VALUE) {
      toast.warning("请先选择一个具体分组", "分组管理")
      return
    }

    const groupCount = groups.find((group) => group.name === activeConcreteGroup)?.count ?? 0
    if (groupCount <= 0) {
      return
    }

    if (groupCount >= items.length) {
      toast.warning("至少保留一个 Markdown 表情", "分组管理")
      return
    }

    if (!window.confirm(`确认删除「${activeConcreteGroup}」分组下的 ${groupCount} 个表情吗？`)) {
      return
    }

    setItems((current) => current.filter((item) => getEmojiGroup(item) !== activeConcreteGroup))
    setSelectedIndexes(new Set())
    setItemDisplaySizeDrafts({})
    toast.success("分组表情已删除", "分组管理")
  }

  function handleApplyDisplaySizeToActiveGroup() {
    if (activeGroup === ALL_GROUPS_VALUE) {
      toast.warning("请先选择一个具体分组", "显示大小")
      return
    }

    const hasDraft = groupDisplaySizeDraft.trim().length > 0
    const displaySize = normalizeMarkdownEmojiDisplaySize(groupDisplaySizeDraft)
    if (hasDraft && typeof displaySize !== "number") {
      toast.warning("请输入有效的显示大小", "显示大小")
      return
    }

    setItems((current) => current.map((item) => (
      getEmojiGroup(item) === activeConcreteGroup
        ? withEmojiDisplaySize(item, displaySize)
        : item
    )))

    if (typeof displaySize === "number") {
      setGroupDisplaySizeDraft(formatMarkdownEmojiDisplaySize(displaySize))
      toast.success(`已将「${activeConcreteGroup}」分组显示大小设为 ${displaySize}em`, "显示大小")
      return
    }

    toast.success(`已恢复「${activeConcreteGroup}」分组默认显示大小`, "显示大小")
  }

  function handleAddItem() {
    const targetGroup = activeConcreteGroup
    setItems((current) => {
      const targetDisplaySize = normalizeMarkdownEmojiDisplaySize(
        getUnifiedDisplaySize(current.filter((item) => getEmojiGroup(item) === targetGroup)),
      )

      return [...current, withEmojiDisplaySize(buildNewEmojiItem(targetGroup, current), targetDisplaySize)]
    })
    setActiveGroup(targetGroup)
  }

  function handleDeleteItem(index: number) {
    if (items.length <= 1) {
      toast.warning("至少保留一个 Markdown 表情", "删除表情")
      return
    }

    setItems((current) => current.filter((_, rowIndex) => rowIndex !== index))
    setSelectedIndexes(new Set())
    setItemDisplaySizeDrafts({})
  }

  function toggleSelectedIndex(index: number, checked: boolean) {
    setSelectedIndexes((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(index)
      } else {
        next.delete(index)
      }

      return next
    })
  }

  function handleSelectVisible() {
    if (visibleIndexes.length === 0) {
      return
    }

    setSelectedIndexes((current) => {
      const next = new Set(current)
      for (const index of visibleIndexes) {
        next.add(index)
      }

      return next
    })
  }

  function handleMoveSelected() {
    if (selectedCount === 0) {
      toast.warning("请先选择表情", "批量移动")
      return
    }

    const targetGroup = normalizeMarkdownEmojiGroup(moveTargetGroup)
    setItems((current) => current.map((item, index) => selectedIndexes.has(index) ? { ...item, group: targetGroup } : item))
    setActiveGroup(targetGroup)
    setMoveTargetGroup(targetGroup)
    setSelectedIndexes(new Set())
    toast.success(`已移动 ${selectedCount} 个表情到 ${targetGroup}`, "批量移动")
  }

  function handleDeleteSelected() {
    if (selectedCount === 0) {
      toast.warning("请先选择表情", "批量删除")
      return
    }

    if (selectedCount >= items.length) {
      toast.warning("至少保留一个 Markdown 表情", "批量删除")
      return
    }

    if (!window.confirm(`确认删除已选择的 ${selectedCount} 个表情吗？`)) {
      return
    }

    setItems((current) => current.filter((_, index) => !selectedIndexes.has(index)))
    setSelectedIndexes(new Set())
    setItemDisplaySizeDrafts({})
    toast.success(`已删除 ${selectedCount} 个表情`, "批量删除")
  }

  function handleRestoreDefaults() {
    if (!window.confirm("确认恢复默认 Markdown 表情吗？")) {
      return
    }

    setItems(cloneDefaultMarkdownEmojiItems())
    setActiveGroup(DEFAULT_MARKDOWN_EMOJI_GROUP)
    setSelectedIndexes(new Set())
    setItemDisplaySizeDrafts({})
    setGroupDraft("")
    setMoveTargetGroup(DEFAULT_MARKDOWN_EMOJI_GROUP)
  }

  function resolveItemsForSubmit() {
    if (activeGroup === ALL_GROUPS_VALUE || groupDisplaySizeDraft === activeGroupDisplaySize) {
      return items
    }

    const hasDraft = groupDisplaySizeDraft.trim().length > 0
    const displaySize = normalizeMarkdownEmojiDisplaySize(groupDisplaySizeDraft)
    if (hasDraft && typeof displaySize !== "number") {
      return null
    }

    return items.map((item) => (
      getEmojiGroup(item) === activeConcreteGroup
        ? withEmojiDisplaySize(item, displaySize)
        : item
    ))
  }

  function handleSubmit() {
    const itemsForSubmit = resolveItemsForSubmit()
    if (!itemsForSubmit) {
      toast.warning("请输入有效的显示大小", "保存失败")
      return
    }

    const normalizedItems = normalizeOptionalMarkdownEmojiItems(itemsForSubmit, [])
    if (normalizedItems.length === 0) {
      toast.warning("至少需要一个有效的 Markdown 表情", "保存失败")
      return
    }

    if (normalizedItems.length !== itemsForSubmit.length) {
      toast.warning("存在空图标、非法短码或重复短码，请修正后再保存", "保存失败")
      return
    }

    startTransition(async () => {
      const result = await saveAdminSiteSettings({
        markdownEmojiMap: normalizedItems,
        section: "site-markdown-emoji",
      })
      if (!result.ok) {
        toast.error(result.message, "保存失败")
        return
      }

      setItems(normalizedItems)
      toast.success(result.message, "保存成功")
      router.refresh()
    })
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        handleSubmit()
      }}
    >
      <SettingsSection
        title="Markdown 表情"
        description="独立配置 Markdown 短码表情，例如 `:smile:`、`:rocket:`，支持按分组展示，也支持 emoji、图片链接与完整 SVG 图标。"
      >
        <div className="grid gap-4 xl:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-3 rounded-xl border border-border bg-muted/25 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">分组</div>
              <Badge variant="outline">{items.length}</Badge>
            </div>
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant={activeGroup === ALL_GROUPS_VALUE ? "secondary" : "ghost"}
                className="w-full justify-between"
                onClick={() => setActiveGroup(ALL_GROUPS_VALUE)}
              >
                <span className="truncate">全部分组</span>
                <Badge variant="outline">{items.length}</Badge>
              </Button>
              {groups.map((group) => (
                <Button
                  key={group.name}
                  type="button"
                  variant={activeGroup === group.name ? "secondary" : "ghost"}
                  className="w-full justify-between"
                  onClick={() => setActiveGroup(group.name)}
                >
                  <span className="truncate">{group.name}</span>
                  <Badge variant="outline">{group.count}</Badge>
                </Button>
              ))}
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">分组名称</span>
              <Input
                value={groupDraft}
                onChange={(event) => setGroupDraft(event.target.value)}
                placeholder="新分组或目标名称"
                className="h-11 rounded-xl bg-background px-4 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={handleCreateGroup}>
                <FolderPlus data-icon="inline-start" />
                新建
              </Button>
              <Button type="button" variant="outline" disabled={activeGroup === ALL_GROUPS_VALUE} onClick={handleRenameGroup}>
                <Pencil data-icon="inline-start" />
                重命名
              </Button>
              <Button type="button" variant="destructive" className="col-span-2" disabled={activeGroup === ALL_GROUPS_VALUE} onClick={handleDeleteActiveGroup}>
                <Trash2 data-icon="inline-start" />
                删除当前分组
              </Button>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">前台显示大小</span>
                {activeGroupHasMixedDisplaySizes ? <Badge variant="secondary">不一致</Badge> : null}
              </div>
              <Input
                type="number"
                min={MARKDOWN_EMOJI_DISPLAY_SIZE_MIN}
                max={MARKDOWN_EMOJI_DISPLAY_SIZE_MAX}
                step="0.1"
                value={groupDisplaySizeDraft}
                onChange={(event) => setGroupDisplaySizeDraft(event.target.value)}
                placeholder="默认"
                disabled={activeGroup === ALL_GROUPS_VALUE}
                className="h-10 rounded-xl bg-background px-4 text-sm"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                单位 em，范围 {MARKDOWN_EMOJI_DISPLAY_SIZE_MIN}-{MARKDOWN_EMOJI_DISPLAY_SIZE_MAX}，留空恢复默认。
              </p>
              <Button type="button" variant="outline" disabled={activeGroup === ALL_GROUPS_VALUE || activeGroupItems.length === 0} onClick={handleApplyDisplaySizeToActiveGroup}>
                <Ruler data-icon="inline-start" />
                应用到当前分组
              </Button>
            </div>
          </aside>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">本地批量上传</span>
                    <Badge variant="secondary">上传到 {activeConcreteGroup}</Badge>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">支持 png、jpg、gif、webp、avif、svg；文件名会自动生成短码。</p>
                </div>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.gif,.webp,.avif,.svg,image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml"
                  multiple
                  className="sr-only"
                  onChange={(event) => handleUploadFiles(event.target.files)}
                />
                <Button type="button" variant="outline" disabled={isUploadPending} onClick={() => uploadInputRef.current?.click()}>
                  <Upload data-icon="inline-start" />
                  {isUploadPending ? "上传中..." : "选择文件"}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <label className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="text-sm font-medium">搜索</span>
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="短码、名称或分组"
                    className="h-11 rounded-xl bg-background px-4 text-sm"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{selectedVisibleCount}/{visibleEntries.length}</Badge>
                  <Button type="button" variant="outline" disabled={visibleEntries.length === 0} onClick={handleSelectVisible}>
                    <CheckSquare data-icon="inline-start" />
                    选择当前结果
                  </Button>
                  <Button type="button" variant="ghost" disabled={selectedCount === 0} onClick={() => setSelectedIndexes(new Set())}>
                    <X data-icon="inline-start" />
                    清空选择
                  </Button>
                  <Button type="button" variant="outline" onClick={handleAddItem}>
                    <Plus data-icon="inline-start" />
                    新增表情
                  </Button>
                </div>
              </div>

              {selectedCount > 0 ? (
                <div className="flex flex-col gap-2 rounded-xl bg-muted/45 p-3 md:flex-row md:items-end">
                  <Badge variant="secondary">已选 {selectedCount}</Badge>
                  <label className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="text-sm font-medium">移动到分组</span>
                    <Input
                      value={moveTargetGroup}
                      onChange={(event) => setMoveTargetGroup(event.target.value)}
                      className="h-10 rounded-xl bg-background px-4 text-sm"
                    />
                  </label>
                  <Button type="button" variant="outline" onClick={handleMoveSelected}>
                    <MoveRight data-icon="inline-start" />
                    批量移动
                  </Button>
                  <Button type="button" variant="destructive" onClick={handleDeleteSelected}>
                    <Trash2 data-icon="inline-start" />
                    删除所选
                  </Button>
                </div>
              ) : null}
            </div>

            {visibleEntries.length > 0 ? (
              <div className="flex flex-col gap-3">
                {visibleEntries.map(({ item, index, group }) => {
                  const selected = selectedIndexes.has(index)

                  return (
                    <div
                      key={`markdown-emoji-${index}`}
                      className={cn(
                        "rounded-xl border border-border bg-muted/30 p-3",
                        selected && "border-primary bg-primary/5",
                      )}
                    >
                      <div className="grid gap-3 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-start">
                        <div className="flex items-center gap-3 xl:pt-7">
                          <Checkbox
                            checked={selected}
                            aria-label={`选择 ${item.label || item.shortcode}`}
                            onCheckedChange={(checked) => toggleSelectedIndex(index, Boolean(checked))}
                          />
                          <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-background">
                            <EmojiPreview icon={item.icon} label={item.label} className="size-6 text-xl" />
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[140px_140px_120px_minmax(0,1fr)]">
                          <SettingsInputField
                            label="短码"
                            value={item.shortcode}
                            onChange={(value) => updateItem(index, { shortcode: normalizeEditableShortcode(value) })}
                            placeholder="如 smile"
                          />
                          <SettingsInputField
                            label="分组"
                            value={group}
                            onChange={(value) => updateItem(index, { group: value })}
                            placeholder="如 默认 / 表情 / 颜文字"
                          />
                          <SettingsInputField
                            label="大小(em)"
                            type="number"
                            min={MARKDOWN_EMOJI_DISPLAY_SIZE_MIN}
                            max={MARKDOWN_EMOJI_DISPLAY_SIZE_MAX}
                            step="0.1"
                            value={itemDisplaySizeDrafts[index] ?? formatMarkdownEmojiDisplaySize(item.displaySize)}
                            onChange={(value) => handleItemDisplaySizeChange(index, value)}
                            onBlur={() => handleItemDisplaySizeBlur(index)}
                            placeholder="默认"
                            inputClassName="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <div className="flex flex-col gap-3 md:col-span-2 xl:col-span-1">
                            <SettingsInputField
                              label="显示名称"
                              value={item.label}
                              onChange={(value) => updateItem(index, { label: value })}
                              placeholder="如 微笑"
                            />
                            <IconPicker
                              label="图标"
                              value={item.icon}
                              onChange={(value) => updateItem(index, { icon: value })}
                              popoverTitle="选择 Markdown 表情图标"
                              containerClassName="flex flex-col gap-2"
                              triggerClassName="flex h-11 w-full items-center gap-3 rounded-xl border border-border bg-background px-4 text-left text-sm transition-colors hover:bg-accent"
                              textareaRows={4}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end xl:pt-7">
                          <Button type="button" variant="outline" size="sm" disabled={items.length <= 1} onClick={() => handleDeleteItem(index)}>
                            <Trash2 data-icon="inline-start" />
                            删除
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                当前筛选没有匹配的表情。
              </div>
            )}

            <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-card/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">使用方式预览</p>
                <Badge variant="outline">{activeGroup === ALL_GROUPS_VALUE ? "全部分组" : activeConcreteGroup}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {previewEntries.length > 0 ? previewEntries.map(({ item, index, group }) => (
                  <Badge key={`preview-${index}-${item.shortcode}`} variant="outline" className="h-auto gap-2 py-1.5">
                    <EmojiPreview icon={item.icon} label={item.label} />
                    <span className="text-muted-foreground">{group}</span>
                    <span>{item.label}</span>
                    <code>:{item.shortcode}:</code>
                  </Badge>
                )) : (
                  <span className="text-sm text-muted-foreground">暂无可预览表情</span>
                )}
                {visibleEntries.length > previewEntries.length ? (
                  <Badge variant="secondary">还有 {visibleEntries.length - previewEntries.length} 个</Badge>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" onClick={handleRestoreDefaults}>
                <RotateCcw data-icon="inline-start" />
                恢复默认
              </Button>
            </div>
          </div>
        </div>
      </SettingsSection>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>{isPending ? "保存中..." : "保存 Markdown 表情"}</Button>
      </div>
    </form>
  )
}

function EmojiPreview({ icon, label, className }: { icon: string; label: string; className?: string }) {
  return (
    <LevelIcon
      icon={icon}
      title={label}
      className={cn("size-4 text-sm", className)}
      emojiClassName="text-inherit"
      svgClassName="[&>svg]:block"
    />
  )
}
