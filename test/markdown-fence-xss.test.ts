import assert from "node:assert/strict"
import { register } from "node:module"
import test from "node:test"

/**
 * Regression test: XSS via fake markdown code fences.
 *
 * Background - src/lib/markdown/render.ts shipped an HTML sanitizer that used
 * /^\s*(?:```|~~~)/ to decide whether a line starts a code fence. Once it
 * believed it was inside a fence, it copied the line through WITHOUT sanitizing.
 * markdown-it's fence rule is stricter: an indent of >= 4 spaces is not a fence,
 * and a backtick fence whose info string contains a backtick is not a fence
 * either. When the two disagree, an attacker gets a line that the sanitizer
 * skips but markdown-it still emits as raw HTML (the renderer is configured with
 * `html: true`) - persistent stored XSS in posts, comments, messages, previews.
 *
 * Bypasses verified against the real renderer before the fix:
 *   4-space-indented ```, ```a``b (backtick in info string), NBSP indent, ~~~ variant.
 *
 * NOTE: this file is ASCII-only on purpose. Rewriting a UTF-8 (no BOM) file with
 * Windows PowerShell Set-Content makes it decode the bytes as GBK and
 * double-encode the text; that corrupted a previous version of this file.
 */

// The production module carries a `server-only` guard - map it to an empty module
// before importing. test/*.test.ts is transpiled to CJS, so no top-level await:
// import lazily and cache the promise.
const stubUrl = `data:text/javascript,${encodeURIComponent("export {}")}`
register(
  `data:text/javascript,${encodeURIComponent(`
    export function resolve(specifier, context, next) {
      if (specifier === "server-only") {
        return { url: ${JSON.stringify(stubUrl)}, shortCircuit: true }
      }
      return next(specifier, context)
    }
  `)}`,
  import.meta.url,
)

type RenderMarkdown = (input: string) => Promise<string>

let renderMarkdownPromise: Promise<RenderMarkdown> | null = null

function getRenderMarkdown(): Promise<RenderMarkdown> {
  if (!renderMarkdownPromise) {
    renderMarkdownPromise = import("../src/lib/markdown/render").then(
      (mod) => mod.renderMarkdown as unknown as RenderMarkdown,
    )
  }
  return renderMarkdownPromise
}

/**
 * True when the rendered HTML contains executable markup.
 * Escaped entities are stripped first, so that an inert `&lt;img ... onerror=...&gt;`
 * is not mistaken for a live injection.
 */
function hasRawExecutableHtml(html: string): boolean {
  const withoutEscaped = html.replace(/&lt;[^&]*?&gt;/g, "")
  return /<[a-z][^>]*\son(?:error|load|click)\s*=/i.test(withoutEscaped)
    || /<iframe\b/i.test(withoutEscaped)
    || /<script\b/i.test(withoutEscaped)
}

const ATTACKS: Array<[string, string]> = [
  ["raw HTML (control: must be escaped anyway)", "<img src=x onerror=alert(1)>"],
  ["inside a legitimate fence", "```\n<img src=x onerror=alert(1)>\n```"],
  ["4-space indented fake fence", "    ```\n<img src=x onerror=alert(1)>\n```"],
  ["backtick inside the info string", "```a``b\n<img src=x onerror=alert(1)>\n```"],
  ["fake fence plus iframe", "    ```\n<iframe src=\"https://evil.example/x\"></iframe>\n```"],
  ["fake fence plus svg onload", "    ```\n<svg onload=alert(1)></svg>\n```"],
  ["NBSP-indented fake fence", "\u00a0```\n<img src=x onerror=alert(1)>\n```"],
  ["tilde fake fence", "    ~~~\n<img src=x onerror=alert(1)>\n~~~"],
  ["tab-indented fake fence", "\t```\n<img src=x onerror=alert(1)>\n```"],
  ["unclosed fence plus injection", "```\n<img src=x onerror=alert(1)>"],
  ["closing fence shorter than opening", "````\n<img src=x onerror=alert(1)>\n```\n<img src=x onerror=alert(2)>"],
]

test("markdown HTML sanitizer cannot be bypassed with fake code fences", async () => {
  const renderMarkdown = await getRenderMarkdown()

  for (const [label, input] of ATTACKS) {
    const html = await renderMarkdown(input)
    assert.equal(
      hasRawExecutableHtml(html),
      false,
      `${label} produced unescaped executable HTML: ${html.slice(0, 200)}`,
    )
  }
})

test("legitimate fenced code blocks still render as code", async () => {
  const renderMarkdown = await getRenderMarkdown()

  const html = await renderMarkdown("```js\nconst a = 1\nconsole.log(a)\n```")

  // 代码块应渲染成 pre/code（带 hljs 高亮），内容以文本形式保留。
  // 注意：高亮会把关键字拆进 <span>，所以不能断言 "const a = 1" 是连续文本；
  // 改为剥掉标签后再比对，这样断言的是"内容还在"，而不是"HTML 结构长什么样"。
  assert.match(html, /<pre[^>]*md-code-block/i)
  assert.match(html, /<code[^>]*hljs/i)
  assert.match(html, /language-js|<span>js<\/span>/)
  assert.match(stripTags(html), /const a = 1/)
  assert.match(stripTags(html), /console\.log\(a\)/)
  assert.doesNotMatch(html, /<p[^>]*>const/)
})

/** 去掉标签并还原实体，仅用于内容断言 */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
}

test("angle brackets inside legitimate fences stay inert", async () => {
  const renderMarkdown = await getRenderMarkdown()

  const html = await renderMarkdown("```html\n<script>alert(1)</script>\n```")

  assert.equal(hasRawExecutableHtml(html), false)
  assert.match(html, /&lt;script&gt;|&lt;\/script&gt;|<span/)
})
