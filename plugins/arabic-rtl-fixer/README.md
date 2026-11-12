<div align="center">
  <img src="assets/logo.svg" width="84" height="84" alt="Arabic RTL Fixer Logo" />
  <h1>arabic-rtl-fixer</h1>
  <p>Bidirectional (RTL/LTR) text rendering fix and Aux Pane control panel for Google Antigravity 2.0.</p>
</div>

---

## Overview

By default, Antigravity 2.0 mounts Markdown paragraphs (`<p>`), headings (`<h1>`–`<h6>`), and list items (`<li>`) inside a strict `direction: ltr` container without `unicode-bidi: plaintext` or `dir="auto"`. Whenever an Arabic paragraph contains an inline English term or parentheses, the browser's BiDi algorithm splits the line and reverses the sentence order.

`arabic-rtl-fixer` patches `preload.js` with a lightweight `MutationObserver` and CSS isolation layer, and registers a local UI sidecar in the Antigravity **Plugins** menu.

## Visual Comparison

| Before (Default Antigravity 2.0) | After (`arabic-rtl-fixer`) |
| :---: | :---: |
| ![Before RTL Fix](assets/before.png) | ![After RTL Fix](assets/after.png) |

## Installation

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/3B00D-0/antigravity-plugins/main/plugins/arabic-rtl-fixer/install.ps1 | iex
```

### Linux / Arch / Omarchy (Bash)

```bash
curl -fsSL https://raw.githubusercontent.com/3B00D-0/antigravity-plugins/main/plugins/arabic-rtl-fixer/install.sh | bash
```

After running, reopen Antigravity 2.0 (or press `Ctrl + Shift + N`).

## Technical Details

1. **BiDi Isolation (`preload.js`)**: Applies prose-aware `dir="rtl"` / `dir="ltr"` / `unicode-bidi: isolate` detection across `<p>`, `<h1>`–`<h6>`, `<li>`, `<ul>`, `<ol>`, `<blockquote>`, alert callouts, `<table>`, `<th>`, `<td>`, and plaintext Arabic `<pre>` blocks while keeping code (`<code>`, `<pre>`) and `.katex` math strictly `ltr`.
2. **Cross-Platform ASAR Patcher (`Windows` & `Linux`)**: Appends the updated `preload.js` to `app.asar`, recalculates the Chromium Pickle header and SHA-256 block hashes, updates the ASAR integrity resource in `Antigravity.exe` on Windows, and maintains version-synced `.bak` backups automatically.
3. **Sidecar Panel**: Installs under `~/.gemini/config/plugins/arabic-rtl-fixer` so you can check status, re-apply after app updates, check GitHub for plugin updates, or restore original files directly from the Antigravity **Plugins** tab.
