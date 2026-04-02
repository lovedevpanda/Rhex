import type { ToolbarTipDefinition } from "@/components/refined-rich-post-editor/types"

export const EDITOR_LINE_HEIGHT_REM = 1.75
export const EDITOR_LINE_NUMBER_GUTTER_WIDTH_CLASS = "w-7"
export const EDITOR_FALLBACK_LINE_HEIGHT_PX = 28

export const VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov", ".m3u8"]
export const AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"]
export const COMMON_EMBED_HOSTS = new Set([
  "player.bilibili.com",
  "www.bilibili.com",
  "music.163.com",
  "www.youtube.com",
  "youtube.com",
  "youtu.be",
  "v.qq.com",
])

export const TOOLBAR_TIPS = {
  heading: {
    label: "标题层级",
    shortcuts: {
      windows: ["Ctrl+1-6", "Ctrl+0"],
      mac: ["Cmd+1-6", "Cmd+0"],
      default: ["Ctrl+1-6", "Ctrl+0"],
    },
    description: "快速切换标题等级或恢复正文。",
  },
  bold: { label: "加粗", shortcuts: { windows: ["Ctrl+B"], mac: ["Cmd+B"], default: ["Ctrl+B"] } },
  underline: { label: "下划线", shortcuts: { windows: ["Ctrl+U"], mac: ["Cmd+U"], default: ["Ctrl+U"] } },
  strike: { label: "删除线", shortcuts: { windows: ["Alt+Shift+5"], mac: ["Cmd+Shift+5"], default: ["Alt+Shift+5"] } },
  highlight: { label: "高亮", description: "插入 ==高亮内容== 标记。" },
  code: {
    label: "代码格式",
    shortcuts: {
      windows: ["Ctrl+Shift+`", "Ctrl+Shift+K"],
      mac: ["Cmd+Shift+`", "Cmd+Option+C"],
      default: ["Ctrl+Shift+`", "Ctrl+Shift+K"],
    },
    description: "支持行内代码和代码块。",
  },
  quote: { label: "引用", shortcuts: { windows: ["Ctrl+Shift+Q"], mac: ["Cmd+Shift+Q"], default: ["Ctrl+Shift+Q"] } },
  list: {
    label: "列表格式",
    shortcuts: {
      windows: ["Ctrl+Shift+L", "Ctrl+Shift+O"],
      mac: ["Cmd+Shift+L", "Cmd+Shift+O"],
      default: ["Ctrl+Shift+L", "Ctrl+Shift+O"],
    },
    description: "支持无序列表、有序列表和待办列表。",
  },
  link: { label: "插入链接", shortcuts: { windows: ["Ctrl+K"], mac: ["Cmd+K"], default: ["Ctrl+K"] } },
  table: {
    label: "插入表格",
    shortcuts: {
      windows: ["Ctrl+T", "Alt+Up/Down"],
      mac: ["Cmd+T", "Option+Up/Down"],
      default: ["Ctrl+T", "Alt+Up/Down"],
    },
    description: "支持插入表格，以及表格行增删和移动。",
  },
  divider: { label: "分割线", shortcuts: { windows: ["Ctrl+Shift+-"], mac: ["Cmd+Shift+-"], default: ["Ctrl+Shift+-"] } },
  alignment: {
    label: "内容对齐",
    shortcuts: {
      windows: ["Ctrl+Alt+L", "Ctrl+Shift+C/R/J"],
      mac: ["Cmd+Option+L", "Cmd+Shift+C/R/J"],
      default: ["Ctrl+Alt+L", "Ctrl+Shift+C/R/J"],
    },
    description: "左对齐使用无冲突键位。",
  },
  media: { label: "插入媒体", description: "插入音频、视频或 iframe 媒体标记。" },
  emoji: { label: "表情", description: "插入 Markdown 表情短码。" },
  base64: { label: "Base64 编码", description: "打开模态框输入文本，插入时自动按 UTF-8 编码为 Base64。" },
  imageUpload: {
    label: "添加图片",
    shortcuts: {
      windows: ["Ctrl+Shift+I"],
      mac: ["Cmd+Shift+I"],
      default: ["Ctrl+Shift+I"],
    },
    description: "打开图片上传面板。",
  },
  imageRemote: {
    label: "添加图片",
    shortcuts: {
      windows: ["Ctrl+Shift+I"],
      mac: ["Cmd+Shift+I"],
      default: ["Ctrl+Shift+I"],
    },
    description: "打开远程图片地址插入面板。",
  },
  help: { label: "Markdown 帮助", description: "查看完整语法、扩展能力和快捷键说明。" },
} satisfies Record<string, ToolbarTipDefinition>
