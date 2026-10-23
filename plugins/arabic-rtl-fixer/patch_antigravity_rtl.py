#!/usr/bin/env python3
"""
Antigravity 2.0 Arabic / RTL BiDi Formatting Patcher
====================================================
Fixes mixed Arabic & English (Right-to-Left / Left-to-Right) text rendering
in the Antigravity 2.0 desktop application.

Usage:
  python patch_antigravity_rtl.py           # Apply RTL fix
  python patch_antigravity_rtl.py --restore # Restore original files
"""

import os
import sys
import json
import struct
import shutil
import hashlib

MARKER_PREFIX = "/* === ANTIGRAVITY_RTL_BIDI_FIX_"
RTL_INJECTION_MARKER = "/* === ANTIGRAVITY_RTL_BIDI_FIX_V3 === */"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INJECTION_JS_PATH = os.path.join(SCRIPT_DIR, "lib", "injection.js")

if os.path.exists(INJECTION_JS_PATH):
    with open(INJECTION_JS_PATH, "r", encoding="utf-8") as f:
        RTL_INJECTION_CODE = f.read()
else:
    RTL_INJECTION_CODE = r"""
/* === ANTIGRAVITY_RTL_BIDI_FIX_V2 === */
(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const RTL_CSS = `
        p, h1, h2, h3, h4, h5, h6, li, blockquote, dd, dt,
        [data-quotable="true"],
        [data-testid="comment-card-text"],
        [data-lexical-editor="true"] p {
            unicode-bidi: plaintext !important;
            text-align: start !important;
        }
        ul[dir="rtl"], ol[dir="rtl"],
        ul:has(> li[dir="rtl"]), ol:has(> li[dir="rtl"]) {
            direction: rtl !important;
            text-align: right !important;
            padding-right: 1.75rem !important;
            padding-left: 0 !important;
        }
        li[dir="rtl"] {
            direction: rtl !important;
            text-align: right !important;
        }
        blockquote[dir="rtl"], blockquote:has(> p[dir="rtl"]) {
            direction: rtl !important;
            text-align: right !important;
            border-left: none !important;
            border-right: 4px solid var(--border, #555) !important;
        }
        pre, pre code, .katex, .katex-display {
            direction: ltr !important;
            unicode-bidi: isolate !important;
            text-align: left !important;
        }
        :not(pre) > code {
            direction: ltr !important;
            unicode-bidi: isolate !important;
            display: inline-block;
        }
    `;

    const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const STRONG_CHAR_REGEX = /[A-Za-z\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const TARGET_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, ul, ol, blockquote, [data-quotable="true"]';

    function detectDir(text) {
        if (!text) return null;
        const match = text.match(STRONG_CHAR_REGEX);
        if (!match) return null;
        return ARABIC_REGEX.test(match[0]) ? 'rtl' : 'ltr';
    }

    function hasArabic(text) {
        return !!text && ARABIC_REGEX.test(text);
    }

    function applyRtlToElement(el) {
        if (!el || !el.tagName) return;
        const tag = el.tagName.toLowerCase();
        if (tag === 'pre' || tag === 'code' || el.closest('pre, code, .katex')) return;

        const text = el.textContent || '';
        if (tag === 'ul' || tag === 'ol') {
            if (hasArabic(text) && el.getAttribute('dir') !== 'rtl') el.setAttribute('dir', 'rtl');
            return;
        }
        if (!text.trim()) {
            if (!el.hasAttribute('dir')) el.setAttribute('dir', 'auto');
            return;
        }
        if (detectDir(text) === 'rtl') {
            if (el.getAttribute('dir') !== 'rtl') el.setAttribute('dir', 'rtl');
        } else if (hasArabic(text)) {
            const arCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
            const enCount = (text.match(/[A-Za-z]/g) || []).length;
            const targetDir = arCount >= enCount * 0.4 ? 'rtl' : 'auto';
            if (el.getAttribute('dir') !== targetDir) el.setAttribute('dir', targetDir);
        } else if (!el.hasAttribute('dir')) {
            el.setAttribute('dir', 'auto');
        }
    }

    function processSubtree(root) {
        if (!root || !root.querySelectorAll) return;
        if (root.matches && root.matches(TARGET_SELECTOR)) applyRtlToElement(root);
        const elements = root.querySelectorAll(TARGET_SELECTOR);
        for (let i = 0; i < elements.length; i++) applyRtlToElement(elements[i]);
    }

    const SIDECAR_PREFIX = 'plugin://arabic-rtl-fixer--';
    const BRIDGE_GRACE_MS = 1500;

    function bridgeFrame(frame) {
        if (frame.__agyRtlBridge) return;
        const src = frame.getAttribute('src') || '';
        if (!src.startsWith(SIDECAR_PREFIX)) return;
        frame.__agyRtlBridge = true;

        let loaded = false;
        frame.addEventListener('load', () => { loaded = true; }, { once: true });

        setTimeout(async () => {
            if (loaded || !frame.isConnected || frame.getAttribute('src') !== src) return;
            try {
                const url = new URL(src);
                const res = await fetch(src, { cache: 'no-store' });
                if (!res.ok) return;
                let html = await res.text();
                const safeSrc = JSON.stringify(src).replace(/</g, '\\u003c');
                const boot = `<base href="${url.protocol}//${url.host}/">` +
                    `<script>window.__SIDECAR_URL = ${safeSrc};</` + `script>`;
                html = /<head[^>]*>/i.test(html)
                    ? html.replace(/<head[^>]*>/i, (m) => m + boot)
                    : boot + html;
                if (!frame.isConnected || loaded) return;
                frame.src = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
            } catch (err) {
                console.warn('[arabic-rtl-fixer] sidecar bridge failed:', err);
            }
        }, BRIDGE_GRACE_MS);
    }

    function scanFrames(root) {
        if (!root || root.nodeType !== 1) return;
        if (root.tagName === 'IFRAME') bridgeFrame(root);
        const frames = root.querySelectorAll ? root.querySelectorAll('iframe') : [];
        for (let i = 0; i < frames.length; i++) bridgeFrame(frames[i]);
    }

    function injectIntoDocument(doc) {
        if (!doc || !doc.head || doc.__agyRtlInjected) return;
        doc.__agyRtlInjected = true;

        const style = doc.createElement('style');
        style.id = 'antigravity-rtl-bidi-style';
        style.textContent = RTL_CSS;
        doc.head.appendChild(style);

        processSubtree(doc.body || doc.documentElement);
        scanFrames(doc.body || doc.documentElement);

        let pendingNodes = new Set();
        let scheduled = false;

        const flush = () => {
            scheduled = false;
            const nodes = Array.from(pendingNodes);
            pendingNodes.clear();
            for (const node of nodes) {
                if (node.nodeType === 1) {
                    processSubtree(node);
                } else if (node.nodeType === 3 && node.parentElement) {
                    const block = node.parentElement.closest(TARGET_SELECTOR);
                    if (block) applyRtlToElement(block);
                    const list = node.parentElement.closest('ul, ol');
                    if (list) applyRtlToElement(list);
                }
            }
        };

        const observer = new MutationObserver((mutations) => {
            for (let i = 0; i < mutations.length; i++) {
                const m = mutations[i];
                if (m.type === 'characterData') {
                    pendingNodes.add(m.target);
                } else if (m.type === 'childList') {
                    if (m.target && m.target.nodeType === 1) pendingNodes.add(m.target);
                    for (let j = 0; j < m.addedNodes.length; j++) {
                        const added = m.addedNodes[j];
                        pendingNodes.add(added);
                        scanFrames(added);
                    }
                }
            }
            if (pendingNodes.size > 0 && !scheduled) {
                scheduled = true;
                requestAnimationFrame(flush);
            }
        });

        observer.observe(doc.documentElement, {
            childList: true,
            subtree: true,
            characterData: true,
        });
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', () => injectIntoDocument(document));
    } else {
        injectIntoDocument(document);
    }
})();
"""


def get_antigravity_dir():
    local_app_data = os.environ.get("LOCALAPPDATA", os.path.expanduser(r"~\AppData\Local"))
    candidates = [
        os.path.join(local_app_data, "Programs", "antigravity"),
        os.path.join(local_app_data, "antigravity"),
    ]
    for c in candidates:
        if os.path.exists(os.path.join(c, "Antigravity.exe")):
            return c
    raise FileNotFoundError("Could not find Antigravity installation directory.")


def patch_antigravity():
    app_dir = get_antigravity_dir()
    asar_path = os.path.join(app_dir, "resources", "app.asar")
    asar_bak = os.path.join(app_dir, "resources", "app.asar.bak")
    exe_path = os.path.join(app_dir, "Antigravity.exe")
    exe_bak = os.path.join(app_dir, "Antigravity.exe.bak")

    print(f"[*] Found Antigravity at: {app_dir}")

    # Inspect current app.asar
    with open(asar_path, "rb") as f:
        current_asar_bytes = f.read()

    p0, p1, p2, p3 = struct.unpack("<IIII", current_asar_bytes[:16])
    cur_header = json.loads(current_asar_bytes[16 : 16 + p3].decode("utf-8"))
    cur_preload_info = cur_header["files"]["dist"]["files"]["preload.js"]
    cur_offset = p1 + 8 + int(cur_preload_info["offset"])
    cur_preload = current_asar_bytes[cur_offset : cur_offset + cur_preload_info["size"]].decode("utf-8")

    # If current app.asar is clean (not patched with any version), refresh backups!
    if MARKER_PREFIX not in cur_preload:
        print("[+] Refreshing clean backups from current installed version...")
        shutil.copy2(asar_path, asar_bak)
        shutil.copy2(exe_path, exe_bak)
    elif not os.path.exists(asar_bak) or not os.path.exists(exe_bak):
        raise RuntimeError("Antigravity is already patched but backups are missing. Reinstall or verify installation.")

    # Always read from clean backup
    with open(asar_bak, "rb") as f:
        asar_bytes = f.read()

    p0, p1, p2, p3 = struct.unpack("<IIII", asar_bytes[:16])
    old_header_json_bytes = asar_bytes[16 : 16 + p3]
    old_header_hash = hashlib.sha256(old_header_json_bytes).hexdigest()
    header = json.loads(old_header_json_bytes.decode("utf-8"))
    data_offset = p1 + 8
    payload = asar_bytes[data_offset:]

    preload_info = header["files"]["dist"]["files"]["preload.js"]
    orig_offset = int(preload_info["offset"])
    orig_size = preload_info["size"]
    orig_preload = payload[orig_offset : orig_offset + orig_size].decode("utf-8")

    new_preload_str = orig_preload + "\n" + RTL_INJECTION_CODE
    new_preload_bytes = new_preload_str.encode("utf-8")

    new_offset = len(payload)
    new_size = len(new_preload_bytes)
    new_preload_hash = hashlib.sha256(new_preload_bytes).hexdigest()

    preload_info["offset"] = str(new_offset)
    preload_info["size"] = new_size
    preload_info["integrity"] = {
        "algorithm": "SHA256",
        "hash": new_preload_hash,
        "blockSize": 4194304,
        "blocks": [new_preload_hash],
    }

    new_payload = payload + new_preload_bytes

    new_header_json_bytes = json.dumps(header, separators=(",", ":")).encode("utf-8")
    new_p3 = len(new_header_json_bytes)
    padding_len = (4 - (new_p3 % 4)) % 4
    padded_header_json = new_header_json_bytes + (b"\x00" * padding_len)
    new_p2 = new_p3 + padding_len + 4
    new_p1 = new_p2 + 4

    new_header_hash = hashlib.sha256(new_header_json_bytes).hexdigest()

    new_asar_bytes = (
        struct.pack("<IIII", 4, new_p1, new_p2, new_p3)
        + padded_header_json
        + new_payload
    )

    with open(exe_bak, "rb") as f:
        exe_bytes = f.read()

    old_hash_bytes = old_header_hash.encode("ascii")
    new_hash_bytes = new_header_hash.encode("ascii")

    if old_hash_bytes not in exe_bytes:
        raise RuntimeError("Could not locate original ASAR header hash in Antigravity.exe.bak!")

    patched_exe_bytes = exe_bytes.replace(old_hash_bytes, new_hash_bytes)

    temp_old_exe = exe_path + ".running_old"
    try:
        with open(exe_path, "wb") as f:
            f.write(patched_exe_bytes)
    except PermissionError:
        if os.path.exists(temp_old_exe):
            try:
                os.remove(temp_old_exe)
            except OSError:
                pass
        os.rename(exe_path, temp_old_exe)
        with open(exe_path, "wb") as f:
            f.write(patched_exe_bytes)

    with open(asar_path, "r+b") as f:
        f.seek(0)
        f.write(new_asar_bytes)
        f.truncate(len(new_asar_bytes))

    print(f"[+] Patched resources/app.asar (hash: {new_header_hash[:16]}...)")
    print("[+] Updated ASAR integrity checksum in Antigravity.exe")
    print("\n[SUCCESS] Antigravity 2.0 Arabic/RTL fix is installed!")
    print("-> Please press Ctrl+Shift+N (or restart Antigravity 2.0) to see the fix.")


def restore_antigravity():
    app_dir = get_antigravity_dir()
    asar_path = os.path.join(app_dir, "resources", "app.asar")
    asar_bak = os.path.join(app_dir, "resources", "app.asar.bak")
    exe_path = os.path.join(app_dir, "Antigravity.exe")
    exe_bak = os.path.join(app_dir, "Antigravity.exe.bak")

    if os.path.exists(asar_bak):
        with open(asar_bak, "rb") as src, open(asar_path, "r+b") as dst:
            data = src.read()
            dst.seek(0)
            dst.write(data)
            dst.truncate(len(data))
        print("[+] Restored resources/app.asar from backup.")
    else:
        print("[!] No app.asar.bak found.")

    if os.path.exists(exe_bak):
        temp_old_exe = exe_path + ".running_old"
        try:
            shutil.copy2(exe_bak, exe_path)
        except PermissionError:
            if os.path.exists(temp_old_exe):
                try:
                    os.remove(temp_old_exe)
                except OSError:
                    pass
            os.rename(exe_path, temp_old_exe)
            shutil.copy2(exe_bak, exe_path)
        print("[+] Restored Antigravity.exe from backup.")
    else:
        print("[!] No Antigravity.exe.bak found.")


if __name__ == "__main__":
    if "--restore" in sys.argv:
        restore_antigravity()
    else:
        patch_antigravity()
