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
 * Inline-SVG hardening, and the href regression it once caused.
 *
 * Icon values reach the page through dangerouslySetInnerHTML (LevelIcon -> level icons,
 * badges, VIP accents, app icons, gift icons, footer icons, markdown emoji), so any value
 * that arrives there must be non-executable.
 *
 * Part 1 - the original bypass. The guard required whitespace before `on*=`:
 *
 *     /\s(?:on[a-z]+|style|src)\s*=/
 *
 * HTML also accepts `/` as an attribute separator, so `<svg/onload=alert(1)>` parses as an
 * `svg` element with a real onload handler while passing that check untouched. Verified
 * against the unpatched function: `<svg/onload=...>`, `<svg id=x/onload=...>`,
 * `<svg\t/onload=...>` and `<a xlink:href="#x" /onclick=...>` were all returned as-is.
 *
 * Part 2 - the regression the first fix introduced. The first attempt added `href` to the
 * blanket deny-list and normalized by replacing every `/`, which also rewrote the *inside*
 * of quoted attribute values. Every legitimate icon using `<use href="#icon">` or a
 * gradient anchor was then rejected, and LevelIcon silently fell back to a placeholder
 * glyph. Quoted literals must survive normalization untouched, and href must only be
 * restricted to same-document `#fragment` references.
 *
 * ASCII-only file: rewriting a UTF-8 (no BOM) file with Windows PowerShell Set-Content
 * makes it decode the bytes as GBK and double-encode the text.
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
  "<svg><a href=\"https://evil.example/\">x</a></svg>",
  "<svg><use href=\"https://evil.example/x.svg#a\"/></svg>",
  "<svg><image href=\"https://evil.example/x.png\" /></svg>",
  "<svg><set attributeName=x to=y /></svg>",
  "<?xml version=\"1.0\"?><svg/onload=alert(1)></svg>",
  "<!-- c --><svg/onload=alert(1)></svg>",
  "<svg><rect style=\"fill:url(https://evil.example/x)\" /></svg>",
]

const LEGITIMATE = [
  "<svg><rect width=10 height=10 /></svg>",
  "<svg viewBox=\"0 0 24 24\"><path d=\"M4 4h16v16H4z\" /></svg>",
  "<svg><circle cx=5 cy=5 r=4 fill=\"#fff\" /></svg>",
  "<svg><g><path d=\"M0 0L10 10\" /></g></svg>",
  // same-document fragment references must keep working
  "<svg viewBox=\"0 0 24 24\"><use href=\"#icon\"/></svg>",
  "<svg viewBox=\"0 0 24 24\"><use xlink:href=\"#icon\"/></svg>",
  "<svg><a href=\"#anchor\"><rect width=4 height=4 /></a></svg>",
  "<svg><defs><linearGradient id=\"g\"><stop offset=\"0\" /></linearGradient></defs><rect fill=\"url(#g)\" /></svg>",
]

test("sanitizeInlineSvgMarkup rejects every slash-separated handler variant", () => {
  for (const attack of ATTACKS) {
    assert.equal(sanitizeInlineSvgMarkup(attack), null, `must reject: ${attack}`)
  }
})

test("sanitizeInlineSvgMarkup keeps ordinary icons and fragment references", () => {
  for (const markup of LEGITIMATE) {
    assert.notEqual(sanitizeInlineSvgMarkup(markup), null, `must accept: ${markup}`)
  }
})

test("normalization collapses slash separators but preserves quoted values", () => {
  assert.match(normalizeSvgMarkupForInspection("<svg/onload=alert(1)>"), /<svg onload=alert\(1\)>/)
  assert.match(normalizeSvgMarkupForInspection("<svg><a /onclick=x></a></svg>"), /onclick/)

  // the regression: a `/` inside a quoted attribute value is not a separator
  const withFragment = normalizeSvgMarkupForInspection("<svg><use href=\"#a/b\"/></svg>")
  assert.match(withFragment, /#a\/b/, "quoted value must survive normalization")

  const withPath = normalizeSvgMarkupForInspection("<svg><path d=\"M0 0L1/2\"/></svg>")
  assert.match(withPath, /M0 0L1\/2/, "quoted path data must survive normalization")
})

test("isSvgMarkup is unchanged by the hardening", () => {
  assert.equal(isSvgMarkup("<svg></svg>"), true)
  assert.equal(isSvgMarkup("<svg/onload=alert(1)></svg>"), true)
  assert.equal(isSvgMarkup("https://example.com/x.svg"), false)
})

/* -------------------------------------------------------------------------- */
/* markdown emoji                                                              */
/* -------------------------------------------------------------------------- */

function emojiItemWith(icon: string) {
  return [{ shortcode: "evil", label: "evil", icon, group: "default" }]
}

test("markdown emoji never inlines an un-sanitized SVG", () => {
  for (const attack of ATTACKS) {
    const html = renderMarkdownEmojiHtml("evil", emojiItemWith(attack))
    assert.ok(html, "shortcode resolves")

    // Acceptable: a sanitizer-approved SVG is inlined, or the value falls back to the
    // escaped-text branch. What must never appear is a *live* executable structure, so
    // these assertions look for real tags rather than the literal text "onload=", which
    // also occurs inside an inert `&lt;svg onload=...&gt;`.
    assert.doesNotMatch(html, /<script\b/i, `script leaked for: ${attack}`)
    assert.doesNotMatch(html, /<iframe\b/i, `iframe leaked for: ${attack}`)
    assert.doesNotMatch(html, /<svg\b[^>]*\son[a-z]+\s*=/i, `handler in a live svg tag for: ${attack}`)

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

test("markdown emoji still renders clean SVG icons and text icons", () => {
  const svgHtml = renderMarkdownEmojiHtml("evil", emojiItemWith("<svg><rect width=10 height=10 /></svg>"))
  assert.ok(svgHtml)
  assert.match(svgHtml, /md-emoji-svg/)
  assert.match(svgHtml, /<rect width=10 height=10/)
})

/* -------------------------------------------------------------------------- */
/* upload paths: SVG is an admin-only capability                               */
/* -------------------------------------------------------------------------- */

test("public upload routes do not widen the extension list for the icon folder", async () => {
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

test("SVG content is refused unless a caller opts in explicitly", async () => {
  const upload = await readFile(path.join(process.cwd(), "src/lib/upload.ts"), "utf8")

  // the gate must live in the shared prepare helpers, so it also covers routes whose
  // allow-list is a list of arbitrary extensions (attachments, direct messages) where the
  // uploader controls the original filename
  assert.match(upload, /allowSvg\?: boolean/)
  assert.match(upload, /detectedMime === "image\/svg\+xml" && !options\?\.allowSvg/)

  // prepareUploadedFile and prepareBinaryUploadedFile must both check it
  const gateCount = (upload.match(/detectedMime === "image\/svg\+xml" && !options\?\.allowSvg/g) ?? []).length
  assert.equal(gateCount >= 2, true, "both prepare helpers must apply the gate")

  // only the two admin icon routes may opt in
  const optInFiles = [
    "src/app/api/admin/site-settings/icon-upload/route.ts",
    "src/app/api/admin/site-settings/markdown-emoji/upload/route.ts",
  ]
  for (const file of optInFiles) {
    const source = await readFile(path.join(process.cwd(), file), "utf8")
    assert.match(source, /allowSvg: true/, `${file} should opt in`)
  }

  const publicRoutes = [
    "src/app/api/upload/route.ts",
    "src/app/api/upload/remote-image/route.ts",
    "src/app/api/attachments/upload/route.ts",
    "src/app/api/messages/upload/route.ts",
  ]
  for (const file of publicRoutes) {
    const source = await readFile(path.join(process.cwd(), file), "utf8")
    assert.doesNotMatch(source, /allowSvg/, `${file} must not opt in`)
  }
})

test("attachment uploads verify the detected MIME against the extension allow-list", async () => {
  const source = await readFile(path.join(process.cwd(), "src/app/api/attachments/upload/route.ts"), "utf8")

  // the original hole: only the original file name was checked, so `x.zip` whose content
  // is an SVG was stored as attachments-<hash>.svg and served as image/svg+xml
  assert.match(source, /prepareBinaryUploadedFile\(/)
  assert.match(
    source,
    /isAllowedUploadMimeType\(preparedFile\.detectedMime, allowedExtensions\)/,
    "attachments upload must cross-check the detected MIME type",
  )
})
