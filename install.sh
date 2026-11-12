#!/usr/bin/env bash
set -euo pipefail

# Antigravity Plugins - Root Linux Installer (Omarchy / Arch / Linux)
# Usage: curl -fsSL https://raw.githubusercontent.com/3B00D-0/antigravity-plugins/main/install.sh | bash

PLUGIN_URL="https://raw.githubusercontent.com/3B00D-0/antigravity-plugins/main/plugins/arabic-rtl-fixer/install.sh"

if command -v curl >/dev/null 2>&1; then
    curl -fsSL "${PLUGIN_URL}" | bash
elif command -v wget >/dev/null 2>&1; then
    wget -qO- "${PLUGIN_URL}" | bash
else
    echo "[!] curl or wget is required." >&2
    exit 1
fi
