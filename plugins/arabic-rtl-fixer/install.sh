#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://raw.githubusercontent.com/3B00D-0/antigravity-plugins/main/plugins/arabic-rtl-fixer"
PLUGIN_DIR="${HOME}/.gemini/config/plugins/arabic-rtl-fixer"
SIDECAR_DIR="${PLUGIN_DIR}/sidecars/rtl_fixer_panel"
ASSETS_DIR="${PLUGIN_DIR}/assets"
LIB_DIR="${PLUGIN_DIR}/lib"

echo ""
echo "================================================================"
echo "   Antigravity 2.0 - Arabic / RTL Formatting Fix (Linux/Arch)   "
echo "================================================================"
echo ""

mkdir -p "${SIDECAR_DIR}" "${ASSETS_DIR}" "${LIB_DIR}"

SCRIPT_DIR=""
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

fetch_file() {
    local rel="$1"
    local dest="${PLUGIN_DIR}/${rel}"
    mkdir -p "$(dirname "${dest}")"
    if [[ -n "${SCRIPT_DIR}" && -f "${SCRIPT_DIR}/${rel}" ]]; then
        cp -f "${SCRIPT_DIR}/${rel}" "${dest}"
    elif command -v curl >/dev/null 2>&1; then
        curl -fsSL "${REPO_URL}/${rel}?t=$(date +%s)" -o "${dest}"
    elif command -v wget >/dev/null 2>&1; then
        wget -qO "${dest}" "${REPO_URL}/${rel}"
    else
        echo "[!] Neither curl nor wget found." >&2
        exit 1
    fi
}

echo "[1/3] Installing Antigravity UI Plugin to: ${PLUGIN_DIR}"
FILES=(
    "plugin.json"
    "install.sh"
    "assets/logo.svg"
    "lib/patcher.cjs"
    "lib/injection.js"
    "patch_antigravity_rtl.js"
    "patch_antigravity_rtl.py"
    "sidecars/rtl_fixer_panel/sidecar.json"
    "sidecars/rtl_fixer_panel/server.cjs"
    "sidecars/rtl_fixer_panel/ui.html"
)

for rel in "${FILES[@]}"; do
    fetch_file "${rel}"
done

chmod +x "${PLUGIN_DIR}/install.sh" "${PLUGIN_DIR}/patch_antigravity_rtl.js" "${PLUGIN_DIR}/patch_antigravity_rtl.py"
echo "  [+] UI Plugin & Sidecar installed."

echo "[2/3] Patching Antigravity 2.0 interface (creating automatic backup)..."
PATCH_JS="${PLUGIN_DIR}/patch_antigravity_rtl.js"
PATCH_PY="${PLUGIN_DIR}/patch_antigravity_rtl.py"

run_patcher() {
    local runner=()
    if command -v node >/dev/null 2>&1; then
        runner=(node "${PATCH_JS}")
    else
        local agy_bin=""
        for cand in /opt/antigravity/antigravity /opt/Antigravity/antigravity /usr/lib/antigravity/antigravity "${HOME}/.local/share/antigravity/antigravity"; do
            if [[ -x "${cand}" ]]; then
                agy_bin="${cand}"
                break
            fi
        done
        if [[ -n "${agy_bin}" ]]; then
            runner=(env ELECTRON_RUN_AS_NODE=1 "${agy_bin}" "${PATCH_JS}")
        elif command -v python3 >/dev/null 2>&1; then
            runner=(python3 "${PATCH_PY}")
        elif command -v python >/dev/null 2>&1; then
            runner=(python "${PATCH_PY}")
        else
            echo "[!] Could not find Node.js, Antigravity binary, or Python 3." >&2
            return 1
        fi
    fi

    if "${runner[@]}"; then
        return 0
    fi

    if command -v sudo >/dev/null 2>&1; then
        echo "[*] System Antigravity directory requires root privileges; retrying with sudo..."
        if [[ -e /dev/tty ]]; then
            sudo -E "${runner[@]}" </dev/tty
        else
            sudo -E "${runner[@]}"
        fi
    else
        return 1
    fi
}

run_patcher

echo ""
echo "[3/3] Complete. Restart Antigravity 2.0 (or press Ctrl+Shift+N) to apply."
echo ""
