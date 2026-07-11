import assert from "node:assert/strict"
import test from "node:test"

import { sanitizeInlineSvgMarkup } from "../src/lib/icon-source"

test("inline SVG level icons reject executable markup and external references", () => {
  for (const payload of [
    '<svg onload="alert(1)"><path d="M0 0" /></svg>',
    '<svg><script>alert(1)</script></svg>',
    '<svg><foreignObject><img src=x onerror=alert(1) /></foreignObject></svg>',
    '<svg><use href="https://attacker.invalid/icon.svg#x" /></svg>',
    '<svg><use href=&#106;avascript:alert(1) /></svg>',
    '<svg><path fill="url(https://attacker.invalid/paint)" /></svg>',
    '<svg><style>@import url(https://attacker.invalid/style.css)</style></svg>',
  ]) {
    assert.equal(sanitizeInlineSvgMarkup(payload), null, payload)
  }
})

test("inline SVG level icons allow inert local vector markup", () => {
  const svg = '<svg viewBox="0 0 24 24" fill="none"><path fill="currentColor" d="M0 0h24v24H0z" /></svg>'
  assert.equal(sanitizeInlineSvgMarkup(svg), svg)
})
