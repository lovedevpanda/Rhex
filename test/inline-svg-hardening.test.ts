import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import {
  isSvgMarkup,
  normalizeSvgMarkupForInspection,
  sanitizeInlineSvgMarkup,
} from "../src/lib/icon-source"
import { renderMarkdownEmojiHtml } from "../src/lib/markdown-emoji"

/**
 * Inline-SVG hardening.
 *
 * Icon values are injected into the page with dangerouslySetInnerHTML (LevelIcon,
 * badges, VIP accents, app icons, gift icons, footer icons, markdown emoji), so any
 * value that reaches those paths must be non-executable.
 *
 * Regression background: the guard regex required whitespace before `on*=`:
 *
 *     /\s(?:on[a-z]+|style|src)\s*=/
 *
 * But HTML also treats `/` as an attribute separator, so `<svg/onload=alert(1)>`
 * parses as an `svg` element with a real `onload` handler while sailing past that
 * check. Verified against the unpatched function - these were all returned unchanged:
 *
 *   <svg/onload=alert(1)>
 *   <svg id=x/onload=alert(1)>
 *   <svg\t/onload=alert(1)>
 *   <svg><a xlink:href="#x" /onclick=alert(1)>
 *
 * ASCII-only file: rewriting a UTF-8 (no BOM) file with Windows PowerShell
 * Set-Content makes it decode the bytes as GBK and double-encode the text.
 */

const ATTACKS = [
  "<svg onload=alert(1)></svg>",
  "<svg/onload=alert(1)></svg>",
  "<svg id=x/onload=alert(1)></svg>",
  "<svg\t/onload=alert(1)></svg>",
  "<svg\n/onload=alert(1)></svg>",
  "<svg><a xlink:href=\"#x\" /onclick=alert(1)></svg>",
  "<svg><script>alert(1)</script></svg>",
  "<svg><style>*{}</style></svg>",
  "<svg><foreignObject><body onload=alert(1)></body></foreignObject></svg>",
  "<svg><a href=\"javascript:alert(1)\">x</a></svg>",
  "<svg><image href=\"https://evil.example/x.png\" /></svg>",
  "<svg><set attributeName=x to=y /></svg>",
  "<?xml version=\"1.0\"?><svg/onload=alert(1)></svg>",
  "<!-- c --><svg/onload=alert(1)></svg>",
]

const LEGITIMATE = [
  "<svg><rect width=10 height=10 /></svg>",
  "<svg viewBox=\"0 0 24 24\"><path d=\"M4 4h16v16H4z\" /></svg>",
  "<svg><circle cx=5 cy=5 r=4 fill=\"#fff\" /></svg>",
  "<svg><g><path d=\"M0 0L10 10\" /></g></svg>",
]

test("sanitizeInlineSvgMarkup rejects every slash-separated handler variant", () => {
  for (const attack of ATTACKS) {
    assert.equal(
      sanitizeInlineSvgMarkup(attack),
      null,
      `must reject: ${attack}`,
    )
  }
})

test("sanitizeInlineSvgMarkup still accepts ordinary icon markup", () => {
  for (const markup of LEGITIMATE) {
    assert.notEqual(
      sanitizeInlineSvgMarkup(markup),
      null,
      `must accept: ${markup}`,
    )
  }
})

test("normalizeSvgMarkupForInspection collapses slash-separated attributes", () => {
  // the normalization only rewrites separators; it must not change semantics
  assert.match(normalizeSvgMarkupForInspection("<svg/onload=alert(1)>"), /<svg onload=alert\(1\)>/)
  assert.match(normalizeSvgMarkupForInspection("<svg><a /onclick=x></a></svg>"), /onclick/)

  // a legitimate self-closing tag keeps its meaning (still parseable)
  const normalized = normalizeSvgMarkupForInspection("<svg><rect width=10 height=10 /></svg>")
  assert.match(normalized, /<rect width=10 height=10/)
})

test("isSvgMarkup is unchanged by the hardening", () => {
  assert.equal(isSvgMarkup("<svg></svg>"), true)
  assert.equal(isSvgMarkup("<svg/onload=alert(1)></svg>"), true)
  assert.equal(isSvgMarkup("https://example.com/x.svg"), false)
})

/* -------------------------------------------------------------------------- */
/* markdown emoji                                                              */
/* -------------------------------------------------------------------------- */

const EMOJI_ITEMS = [
  { shortcode: "smile", label: "smile", icon: "😀", group: "default" },
]

function emojiItemWith(icon: string) {
  return [{ shortcode: "evil", label: "evil", icon, group: "default" }]
}

test("markdown emoji never inlines an un-sanitized SVG", () => {
  for (const attack of ATTACKS) {
    const html = renderMarkdownEmojiHtml("evil", emojiItemWith(attack))
    assert.ok(html, "shortcode resolves")

    // Acceptable outcomes: (a) a clean SVG is inlined, or (b) the value falls back to the
    // escaped-text branch. What must never happen is a *live* executable structure, so the
    // assertions look for real tags/attributes rather than the literal text "onload=",
    // which also appears inside an inert `&lt;svg onload=...&gt;`.
    assert.doesNotMatch(html, /<script\b/i, `script leaked for: ${attack}`)
    assert.doesNotMatch(html, /<iframe\b/i, `iframe leaked for: ${attack}`)
    assert.doesNotMatch(html, /<svg\b[^>]*\son[a-z]+\s*=/i, `handler inside a live svg tag for: ${attack}`)

    // If the SVG branch was taken at all, it must be the sanitizer-approved markup,
    // so re-running the sanitizer on the inlined value must succeed.
    const inlined = /<span class="md-emoji-icon">([\s\S]*?)<\/span>/.exec(html)?.[1]
    if (inlined) {
      assert.notEqual(
        sanitizeInlineSvgMarkup(inlined),
        null,
        `inlined svg was not sanitizer-approved for: ${attack}`,
      )
    }
  }
})

test("markdown emoji still renders a clean SVG icon inline", () => {
  const html = renderMarkdownEmojiHtml("evil", emojiItemWith("<svg><rect width=10 height=10 /></svg>"))
  assert.ok(html)
  assert.match(html, /md-emoji-svg/)
  assert.match(html, /<rect width=10 height=10/)
})

test("markdown emoji still renders plain text icons", () => {
  const html = renderMarkdownEmojiHtml("smile", EMOJI_ITEMS)
  assert.ok(html)
  assert.match(html, /md-emoji-text/)
})

/* -------------------------------------------------------------------------- */
/* upload route: SVG is an admin-only capability                               */
/* -------------------------------------------------------------------------- */

test("the public upload routes do not widen the extension list for the icon folder", async () => {
  for (const file of ["src/app/api/upload/route.ts", "src/app/api/upload/remote-image/route.ts"]) {
    const source = await readFile(path.join(process.cwd(), file), "utf8")

    assert.doesNotMatch(
      source,
      /folder === "icon" \? \["svg"\]/,
      `${file} must not grant svg uploads to any logged-in user`,
    )
    assert.match(source, /uploadAllowedImageTypes/)
  }
})

test("the dedicated admin icon upload route still exists", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src/app/api/admin/site-settings/icon-upload/route.ts"),
    "utf8",
  )

  assert.match(source, /folder: "icon"/)
  assert.match(source, /admin\.siteSettings\.manage|createAdminRouteHandler/)
})
