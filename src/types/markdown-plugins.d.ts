declare module "markdown-it-abbr" {
  import type MarkdownIt from "markdown-it"
  const plugin: MarkdownIt.PluginSimple
  export default plugin
}

declare module "markdown-it-attrs" {
  import type MarkdownIt from "markdown-it"
  const plugin: MarkdownIt.PluginWithOptions<Record<string, unknown>>
  export default plugin
}

declare module "markdown-it-container" {
  import type MarkdownIt from "markdown-it"
  const plugin: MarkdownIt.PluginWithParams
  export default plugin
}

declare module "markdown-it-deflist" {
  import type MarkdownIt from "markdown-it"
  const plugin: MarkdownIt.PluginSimple
  export default plugin
}

declare module "markdown-it-footnote" {
  import type MarkdownIt from "markdown-it"
  const plugin: MarkdownIt.PluginSimple
  export default plugin
}

declare module "markdown-it-ins" {
  import type MarkdownIt from "markdown-it"
  const plugin: MarkdownIt.PluginSimple
  export default plugin
}

declare module "markdown-it-mark" {
  import type MarkdownIt from "markdown-it"
  const plugin: MarkdownIt.PluginSimple
  export default plugin
}

declare module "markdown-it-sub" {
  import type MarkdownIt from "markdown-it"
  const plugin: MarkdownIt.PluginSimple
  export default plugin
}

declare module "markdown-it-sup" {
  import type MarkdownIt from "markdown-it"
  const plugin: MarkdownIt.PluginSimple
  export default plugin
}

declare module "markdown-it-task-lists" {
  import type MarkdownIt from "markdown-it"
  const plugin: MarkdownIt.PluginWithOptions<{ enabled?: boolean; label?: boolean; labelAfter?: boolean }>
  export default plugin
}

declare module "@traptitech/markdown-it-katex" {
  import type MarkdownIt from "markdown-it"
  const plugin: MarkdownIt.PluginWithOptions<Record<string, unknown>>
  export default plugin
}

declare module "highlight.js" {
  interface HighlightResult {
    value: string
    language?: string
  }

  interface HighlightOptions {
    language: string
    ignoreIllegals?: boolean
  }

  interface HighlightJs {
    highlight(code: string, options: HighlightOptions): HighlightResult
    highlightAuto(code: string): HighlightResult
    getLanguage(language: string): boolean
  }

  const hljs: HighlightJs
  export default hljs
}
