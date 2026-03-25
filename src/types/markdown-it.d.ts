declare module "markdown-it" {
  export interface MarkdownItOptions {
    html?: boolean
    linkify?: boolean
    typographer?: boolean
    breaks?: boolean
    highlight?: (code: string, language: string) => string
  }

  export type PluginSimple = (md: MarkdownIt) => void
  export type PluginWithOptions<T = unknown> = (md: MarkdownIt, options?: T) => void
  export type PluginWithParams = (md: MarkdownIt, ...params: unknown[]) => void

  export interface RendererLike {
    rules: Record<string, ((tokens: unknown[], index: number, options: unknown, env: unknown, self: { renderToken: (tokens: unknown[], index: number, options: unknown) => string }) => string) | undefined>
  }

  export default class MarkdownIt {
    constructor(options?: MarkdownItOptions)
    render(src: string): string
    use(plugin: PluginSimple): this
    use<T>(plugin: PluginWithOptions<T>, options?: T): this
    use(plugin: PluginWithParams, ...params: unknown[]): this
    renderer: RendererLike
  }
}
