# Add-on security boundary

Rhex add-ons are **trusted code**, not sandboxed extensions. Install and enable
an add-on only when its package, publisher, and update channel are trusted by
the deployment owner.

## Server execution

A server add-on module runs in the Rhex server's Node.js process. It can run
module top-level code and, like any other process code, can potentially access
server environment variables, files, database clients, network clients, and
process APIs. Rhex does not provide a filesystem, process, database, or network
sandbox for add-ons.

`manifest.permissions` gates Rhex-provided SDK capabilities only. It is not an
operating-system permission model and must not be treated as one. The runtime's
best-effort `fetch` permission check is likewise not a sandbox: trusted code
can use other Node APIs or mutate process globals.

Before server add-on code is evaluated, the deployment owner must explicitly
acknowledge this boundary by setting:

```text
RHEX_ADDON_TRUSTED_CODE_ACKNOWLEDGED=I_UNDERSTAND_ADDONS_RUN_WITH_FULL_SERVER_PRIVILEGES
```

Without that exact setting, server add-on execution and enabled installation
are refused. A package may be staged disabled without evaluating its server
module so an operator can inspect its manifest first.

## Browser execution

Client add-on HTML, CSS, scripts, and client modules run in the visitor's page
context and normally share the site's origin. They can affect page behavior and
access anything available to same-origin browser code for that visitor. Treat
these assets as trusted site code; do not use them for untrusted third-party
widgets.

An add-on page may return navigation or redirect behavior. If it derives a
destination from user input, the add-on author is responsible for applying an
appropriate allowlist and avoiding open redirects.

## Package validation is not malicious-code containment

The installer validates the manifest, rejects unsafe ZIP paths and duplicate
archive targets, applies compressed/uncompressed resource limits, and avoids
honoring archive symlink metadata. These measures reduce parser and extraction
risk; they do **not** make a malicious add-on safe to execute.

For third-party code that cannot be fully trusted, run it outside the Rhex
process and origin (for example, an independently isolated service or hosted
integration) and connect through a narrowly scoped API.
