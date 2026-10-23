# <img src="plugins/arabic-rtl-fixer/assets/logo.svg" width="32" height="32" align="absmiddle" alt="Logo" /> antigravity-plugins

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows)](https://github.com/3B00D-0/antigravity-plugins)
[![Target](https://img.shields.io/badge/Antigravity-2.0%2B-10B981)](https://github.com/3B00D-0/antigravity-plugins)

A curated monorepo of plugins, UI patches, and sidecar extensions for the **Google Antigravity 2.0** desktop client.

---

## Available Plugins

| Plugin | Version | Description | Install |
| :--- | :---: | :--- | :--- |
| <img src="plugins/arabic-rtl-fixer/assets/logo.svg" width="22" align="absmiddle" /> **[arabic-rtl-fixer](plugins/arabic-rtl-fixer)** | `1.2.0` | Fixes mixed Arabic & English (RTL/LTR) bidirectional text rendering, list markers, and parentheses in Antigravity 2.0. | [Docs](plugins/arabic-rtl-fixer/README.md) |

---

## Featured: `arabic-rtl-fixer`

Fixes bidirectional (RTL/LTR) text rendering for Arabic, Hebrew, and Persian inside Antigravity 2.0.

| Before (Default Antigravity 2.0) | After (`arabic-rtl-fixer`) |
| :---: | :---: |
| ![Before RTL Fix](plugins/arabic-rtl-fixer/assets/before.png) | ![After RTL Fix](plugins/arabic-rtl-fixer/assets/after.png) |
| *Sentences split around inline English terms, numbers (`1.`) and bullets (`•`) stay stuck on the left, and parentheses flip.* | *Natural right-to-left alignment, inline English terms stay in logical order, and list markers align on the right.* |

### Quick Install (PowerShell)

```powershell
irm https://raw.githubusercontent.com/3B00D-0/antigravity-plugins/main/plugins/arabic-rtl-fixer/install.ps1 | iex
```

*(Or install via the root dispatcher: `irm https://raw.githubusercontent.com/3B00D-0/antigravity-plugins/main/install.ps1 | iex`)*

---

## Repository Structure

```text
antigravity-plugins/
├── plugins/
│   └── arabic-rtl-fixer/       # RTL/BiDi UI patch & Aux Pane sidecar plugin
│       ├── assets/             # Plugin vector logo & synthetic comparison previews
│       ├── sidecars/           # Aux Pane Web UI server & control panel
│       ├── plugin.json         # Antigravity plugin manifest
│       ├── install.ps1         # 1-command standalone installer
│       └── README.md           # Plugin documentation
├── install.ps1                 # Root installer entry point
└── LICENSE                     # MIT License
```

## License

Released under the [MIT License](LICENSE).
