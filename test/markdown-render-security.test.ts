import assert from "node:assert/strict"
import test from "node:test"

import { renderMarkdown } from "../src/lib/markdown/render"

function assertNoExecutableMarkup(html: string) {
  assert.doesNotMatch(html, /<(?:a|img|svg|span|p)\b[^>]*\bon[a-z]+\s*=/i)
  assert.doesNotMatch(html, /<a\b[^>]*\bhref\s*=\s*["']?\s*javascript:/i)
  assert.doesNotMatch(html, /<(?:img|svg|script)\b/i)
}

test("markdown escapes multi-line raw HTML rather than passing event handlers to the browser", () => {
  for (const payload of [
    "<img\nsrc=x onerror=alert(1)>",
    "<svg\nonload=alert(1)>",
    '<a\nhref="javascript:alert(1)">x</a>',
    '<span\nclass="md-wavy" onmouseover="alert(1)">x</span>',
    '<p\nalign="center" onclick="alert(1)">x</p>',
  ]) {
    const html = renderMarkdown(payload, [])
    assertNoExecutableMarkup(html)
    assert.match(html, /&lt;/)
  }
})

test("markdown keeps only the documented raw HTML subset with exact attributes", () => {
  const html = renderMarkdown('<p align="center"><span class="md-wavy">safe</span><ruby>漢<rt>kan</rt></ruby></p>', [])

  assert.match(html, /<p align="center" class="[^"]*text-center/)
  assert.match(html, /<span class="md-wavy">safe<\/span>/)
  assert.match(html, /<ruby>漢<rt>kan<\/rt><\/ruby>/)
})

test("markdown code fences retain raw HTML as inert highlighted code", () => {
  const html = renderMarkdown("```html\n<img src=x onerror=alert(1)>\n```", [])

  assert.match(html, /&lt;/)
  assert.doesNotMatch(html, /<img\b/i)
})
