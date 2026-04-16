"use client"

import { AddonEditor } from "@/components/addon-editor"
import { Button } from "@/components/ui/button"
import { IconPicker } from "@/components/ui/icon-picker"
import type {
  BoardSidebarLinkDraft,
  ModalMode,
  StructureFormState,
} from "@/components/admin/admin-structure.types"
import {
  BoardSidebarLinkEditor,
  Field,
  getStructureAccessFieldHelp,
  getStructureNumericFieldHelp,
  postTypeOptions,
  SelectField,
  TextAreaField,
  Toggle,
} from "@/components/admin/admin-structure.shared"
import type { ZoneItem } from "@/lib/admin-structure-management"
import { POST_LIST_DISPLAY_MODE_DEFAULT, POST_LIST_DISPLAY_MODE_GALLERY } from "@/lib/post-list-display"
import { POST_LIST_LOAD_MODE_INFINITE, POST_LIST_LOAD_MODE_PAGINATION } from "@/lib/post-list-load-mode"
import { Plus } from "lucide-react"

interface StructureTabProps {
  modal: Exclude<ModalMode, null>
  zones: ZoneItem[]
  form: StructureFormState
  isBoard: boolean
  isModeratorBoardEdit: boolean
  updateField: <K extends keyof StructureFormState>(
    field: K,
    value: StructureFormState[K],
  ) => void
  togglePostType: (type: string) => void
  updateSidebarLink: (
    index: number,
    key: keyof BoardSidebarLinkDraft,
    value: BoardSidebarLinkDraft[keyof BoardSidebarLinkDraft],
  ) => void
  addSidebarLink: () => void
  removeSidebarLink: (index: number) => void
}

export function StructureBasicTab({
  modal,
  zones,
  form,
  isBoard,
  isModeratorBoardEdit,
  updateField,
}: StructureTabProps) {
  return (
    <div className="rounded-[24px] border border-border p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={isBoard ? "节点名称" : "分区名称"} value={form.name} onChange={(value) => updateField("name", value)} placeholder={isBoard ? "如 摄影" : "如 生活方式"} />
        <Field label="标识 slug" value={form.slug} onChange={(value) => updateField("slug", value)} placeholder={isBoard ? "如 camera" : "如 lifestyle"} />
        <IconPicker
          label="图标"
          value={form.icon}
          onChange={(value) => updateField("icon", value)}
          popoverTitle={isBoard ? "选择节点图标" : "选择分区图标"}
          containerClassName="space-y-2 md:col-span-2"
          triggerClassName="flex h-11 w-full items-center gap-3 rounded-full border border-border bg-background px-4 text-left text-sm transition-colors hover:bg-accent"
          textareaRows={4}
        />
        <Field label="排序" value={form.sortOrder} onChange={(value) => updateField("sortOrder", value)} placeholder="数字越小越靠前" />
        {isBoard ? (
          isModeratorBoardEdit ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">所属分区</p>
              <div className="flex h-11 items-center rounded-full border border-border bg-background px-4 text-sm text-muted-foreground">
                {modal.kind === "edit-board" ? (modal.item.zoneName ?? "未分配分区") : "当前节点所属分区"}
              </div>
            </div>
          ) : (
            <SelectField label="所属分区" value={form.zoneId} onValueChange={(value) => updateField("zoneId", value)} options={zones.map((zone) => ({ value: zone.id, label: zone.name }))} />
          )
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5"><p className="text-sm font-medium">隐藏</p></div>
            <Toggle label="在左侧导航隐藏" checked={form.hiddenFromSidebar} onChange={(value) => updateField("hiddenFromSidebar", value)} />
          </div>
        )}
      </div>

      {!isBoard ? (
        <TextAreaField label="描述" value={form.description} onChange={(value) => updateField("description", value)} placeholder="填写结构描述，帮助用户理解这个分区或节点的定位" className="mt-4" rows={5} />
      ) : null}
    </div>
  )
}

export function StructureContentTab({
  form,
  updateField,
  updateSidebarLink,
  addSidebarLink,
  removeSidebarLink,
}: StructureTabProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-border p-5">
        <h4 className="text-sm font-semibold">节点描述</h4>
        <TextAreaField label="描述" value={form.description} onChange={(value) => updateField("description", value)} placeholder="填写结构描述，帮助用户理解这个分区或节点的定位" className="mt-4" rows={5} />
      </div>

      <div className="rounded-[24px] border border-border p-5">
        <h4 className="text-sm font-semibold">节点侧栏</h4>
        <div className="mt-4 space-y-2">
          {form.sidebarLinks.length > 0 ? (
            <div className="hidden items-center gap-3 px-3 text-[11px] font-medium text-muted-foreground lg:grid lg:grid-cols-[120px_minmax(0,1fr)_110px_120px_80px]">
              <span>图标 / 标题</span>
              <span>URL</span>
              <span>标题颜色</span>
              <span className="text-right">操作</span>
            </div>
          ) : null}
          {form.sidebarLinks.map((item, index) => (
            <BoardSidebarLinkEditor
              key={`sidebar-link-${index}`}
              item={item}
              index={index}
              onChange={updateSidebarLink}
              onRemove={removeSidebarLink}
            />
          ))}
          <Button type="button" variant="outline" className="h-9 rounded-full px-4 text-xs" onClick={addSidebarLink}>
            <Plus className="mr-2 h-4 w-4" />新增节点链接
          </Button>
        </div>
      </div>

      <div className="rounded-[24px] border border-border p-5">
        <h4 className="text-sm font-semibold">节点规则</h4>
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">节点规则 Markdown</p>
          <AddonEditor context="admin" value={form.rulesMarkdown} onChange={(value) => updateField("rulesMarkdown", value)} placeholder="留空时前台显示系统默认节点规则" minHeight={220} uploadFolder="posts" />
        </div>
      </div>
    </div>
  )
}

export function StructurePolicyTab({
  form,
  isBoard,
  isModeratorBoardEdit,
  updateField,
  togglePostType,
}: StructureTabProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-border p-5">
        <h4 className="text-sm font-semibold">积分与频率设置</h4>
        {isModeratorBoardEdit ? (
          <p className="mt-2 text-xs leading-6 text-muted-foreground">编辑节点时，这四项只能填写留空、0 或负数；留空表示继续继承分区设置。</p>
        ) : null}
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="发帖积分" help={getStructureNumericFieldHelp({ field: "postPointDelta", isBoard, isModeratorBoardEdit })} value={form.postPointDelta} onChange={(value) => updateField("postPointDelta", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          <Field label="回复积分" help={getStructureNumericFieldHelp({ field: "replyPointDelta", isBoard, isModeratorBoardEdit })} value={form.replyPointDelta} onChange={(value) => updateField("replyPointDelta", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          <Field label="发帖间隔(秒)" help={getStructureNumericFieldHelp({ field: "postIntervalSeconds", isBoard, isModeratorBoardEdit })} value={form.postIntervalSeconds} onChange={(value) => updateField("postIntervalSeconds", value)} placeholder={isBoard ? "留空继承分区" : "默认 120"} />
          <Field label="回复间隔(秒)" help={getStructureNumericFieldHelp({ field: "replyIntervalSeconds", isBoard, isModeratorBoardEdit })} value={form.replyIntervalSeconds} onChange={(value) => updateField("replyIntervalSeconds", value)} placeholder={isBoard ? "留空继承分区" : "默认 3"} />
        </div>
      </div>

      <div className="rounded-[24px] border border-border p-5">
        <h4 className="text-sm font-semibold">支持的帖子类型</h4>
        <div className="mt-4 flex flex-wrap gap-3">
          {postTypeOptions.map((item) => (
            <Button key={item.value} type="button" variant={form.allowedPostTypes.includes(item.value) ? "default" : "outline"} className="rounded-full px-4 py-2 text-sm" onClick={() => togglePostType(item.value)} aria-pressed={form.allowedPostTypes.includes(item.value)}>
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-[24px] border border-border p-5">
        <h4 className="text-sm font-semibold">帖子列表</h4>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <SelectField label="首页展示" value={form.showInHomeFeed} onValueChange={(value) => updateField("showInHomeFeed", value)} options={[
              ...(isBoard ? [{ value: "", label: "继承分区" }] : []),
              { value: "true", label: "在首页显示" },
              { value: "false", label: "不在首页显示" },
            ]} />
            <p className="text-xs leading-6 text-muted-foreground">{isBoard ? "留空时自动继承分区；显式设置后优先使用节点自己的首页展示规则。" : "关闭后，这个分区下未覆盖显示规则的节点帖子将不进入首页。"}</p>
          </div>
          <div className="space-y-2">
            <SelectField label="帖子列表形式" value={form.postListDisplayMode} onValueChange={(value) => updateField("postListDisplayMode", value)} options={[
              { value: "", label: isBoard ? "继承分区" : "默认列表" },
              { value: POST_LIST_DISPLAY_MODE_DEFAULT, label: "普通列表" },
              { value: POST_LIST_DISPLAY_MODE_GALLERY, label: "画廊模式" },
            ]} />
            <p className="text-xs leading-6 text-muted-foreground">{isBoard ? "留空时自动继承分区；显式设置后优先使用节点自己的列表形式。" : "留空时使用站点默认普通列表；设置后该分区下未覆盖的节点会继承这里。"}</p>
          </div>
          <div className="space-y-2">
            <SelectField label="帖子加载方式" value={form.postListLoadMode} onValueChange={(value) => updateField("postListLoadMode", value)} options={[
              ...(isBoard ? [{ value: "", label: "继承分区" }] : []),
              { value: POST_LIST_LOAD_MODE_PAGINATION, label: "分页加载" },
              { value: POST_LIST_LOAD_MODE_INFINITE, label: "无限下拉" },
            ]} />
            <p className="text-xs leading-6 text-muted-foreground">{isBoard ? "留空时自动继承分区；显式设置后优先使用节点自己的加载方式。" : "分区可配置为传统分页或滚动到底自动继续加载。"}</p>
          </div>
        </div>
      </div>

      {isBoard && !isModeratorBoardEdit ? (
        <div className="rounded-[24px] border border-border p-5">
          <h4 className="text-sm font-semibold">管理策略</h4>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Toggle label="版主可提取节点金库" checked={form.moderatorsCanWithdrawTreasury} onChange={(value) => updateField("moderatorsCanWithdrawTreasury", value)} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function StructureAccessTab({
  form,
  isBoard,
  updateField,
}: StructureTabProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-border p-5">
        <h4 className="text-sm font-semibold">浏览 / 发帖 / 回复权限</h4>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="浏览最低积分" help={getStructureAccessFieldHelp({ field: "minViewPoints", isBoard })} value={form.minViewPoints} onChange={(value) => updateField("minViewPoints", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          <Field label="浏览最低等级" help={getStructureAccessFieldHelp({ field: "minViewLevel", isBoard })} value={form.minViewLevel} onChange={(value) => updateField("minViewLevel", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          <Field label="浏览最低 VIP 等级" help={getStructureAccessFieldHelp({ field: "minViewVipLevel", isBoard })} value={form.minViewVipLevel} onChange={(value) => updateField("minViewVipLevel", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          <Field label="发帖最低积分" help={getStructureAccessFieldHelp({ field: "minPostPoints", isBoard })} value={form.minPostPoints} onChange={(value) => updateField("minPostPoints", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          <Field label="发帖最低等级" help={getStructureAccessFieldHelp({ field: "minPostLevel", isBoard })} value={form.minPostLevel} onChange={(value) => updateField("minPostLevel", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          <Field label="发帖最低 VIP 等级" help={getStructureAccessFieldHelp({ field: "minPostVipLevel", isBoard })} value={form.minPostVipLevel} onChange={(value) => updateField("minPostVipLevel", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          <Field label="回复最低积分" help={getStructureAccessFieldHelp({ field: "minReplyPoints", isBoard })} value={form.minReplyPoints} onChange={(value) => updateField("minReplyPoints", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          <Field label="回复最低等级" help={getStructureAccessFieldHelp({ field: "minReplyLevel", isBoard })} value={form.minReplyLevel} onChange={(value) => updateField("minReplyLevel", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          <Field label="回复最低 VIP 等级" help={getStructureAccessFieldHelp({ field: "minReplyVipLevel", isBoard })} value={form.minReplyVipLevel} onChange={(value) => updateField("minReplyVipLevel", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
        </div>
      </div>

      <div className="rounded-[24px] border border-border p-5">
        <h4 className="text-sm font-semibold">审核策略</h4>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Toggle label="开启发帖审核" checked={form.requirePostReview} onChange={(value) => updateField("requirePostReview", value)} />
          <Toggle label="开启回帖审核" checked={form.requireCommentReview} onChange={(value) => updateField("requireCommentReview", value)} />
        </div>
      </div>
    </div>
  )
}
