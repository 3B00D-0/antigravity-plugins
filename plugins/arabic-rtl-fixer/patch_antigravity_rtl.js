process.noAsar = true;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RTL_INJECTION_MARKER = "/* === ANTIGRAVITY_RTL_BIDI_FIX_V1 === */";

const RTL_INJECTION_CODE = `
/* === ANTIGRAVITY_RTL_BIDI_FIX_V1 === */
(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const RTL_CSS = \`
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
    \`;

    const ARABIC_REGEX = /[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]/;
    const STRONG_CHAR_REGEX = /[A-Za-z\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]/;

    function detectDir(text) {
        if (!text) return null;
        const match = text.match(STRONG_CHAR_REGEX);
        if (!match) return null;
        return ARABIC_REGEX.test(match[0]) ? 'rtl' : 'ltr';
    }

    function hasArabic(text) {
        return text && ARABIC_REGEX.test(text);
    }

    const TARGET_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, ul, ol, blockquote, [data-quotable="true"]';

    function applyRtlToElement(el) {
        if (!el || !el.tagName) return;
        const tag = el.tagName.toLowerCase();
        if (tag === 'pre' || tag === 'code' || el.closest('pre, code, .katex')) return;

        if (tag === 'ul' || tag === 'ol') {
            const text = el.textContent || '';
            if (hasArabic(text)) {
                const firstStrong = detectDir(text);
                if (firstStrong === 'rtl' || ARABIC_REGEX.test(text)) {
                    if (el.getAttribute('dir') !== 'rtl') el.setAttribute('dir', 'rtl');
                }
            }
            return;
        }

        const text = el.textContent || '';
        if (!text.trim()) {
            if (!el.hasAttribute('dir')) el.setAttribute('dir', 'auto');
            return;
        }

        const firstDir = detectDir(text);
        if (firstDir === 'rtl') {
            if (el.getAttribute('dir') !== 'rtl') el.setAttribute('dir', 'rtl');
        } else if (hasArabic(text)) {
            const arCount = (text.match(/[\\u0600-\\u06FF]/g) || []).length;
            const enCount = (text.match(/[A-Za-z]/g) || []).length;
            const targetDir = arCount >= enCount * 0.4 ? 'rtl' : 'auto';
            if (el.getAttribute('dir') !== targetDir) el.setAttribute('dir', targetDir);
        } else {
            if (!el.hasAttribute('dir')) el.setAttribute('dir', 'auto');
        }
    }

    function processSubtree(root) {
        if (!root || !root.querySelectorAll) return;
        if (root.matches && root.matches(TARGET_SELECTOR)) {
            applyRtlToElement(root);
        }
        const elements = root.querySelectorAll(TARGET_SELECTOR);
        for (let i = 0; i < elements.length; i++) {
            applyRtlToElement(elements[i]);
        }
    }

    function injectIntoDocument(doc) {
        if (!doc || !doc.head || doc.__agyRtlInjected) return;
        doc.__agyRtlInjected = true;

        const style = doc.createElement('style');
        style.id = 'antigravity-rtl-bidi-style';
        style.textContent = RTL_CSS;
        doc.head.appendChild(style);

        processSubtree(doc.body || doc.documentElement);

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
                    if (m.target && m.target.nodeType === 1) {
                        pendingNodes.add(m.target);
                    }
                    for (let j = 0; j < m.addedNodes.length; j++) {
                        pendingNodes.add(m.addedNodes[j]);
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
`;

function getAntigravityDir() {
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Local');
    const candidates = [
        path.join(localAppData, 'Programs', 'antigravity'),
        path.join(localAppData, 'antigravity')
    ];
    for (const c of candidates) {
        if (fs.existsSync(path.join(c, 'Antigravity.exe'))) return c;
    }
    throw new Error('Could not find Antigravity installation directory.');
}

function sha256(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex');
}

function patch() {
    const appDir = getAntigravityDir();
    const asarPath = path.join(appDir, 'resources', 'app.asar');
    const asarBak = path.join(appDir, 'resources', 'app.asar.bak');
    const exePath = path.join(appDir, 'Antigravity.exe');
    const exeBak = path.join(appDir, 'Antigravity.exe.bak');

    console.log('[*] Found Antigravity at:', appDir);

    if (!fs.existsSync(asarBak)) {
        fs.copyFileSync(asarPath, asarBak);
        console.log('[+] Created backup: resources/app.asar.bak');
    }
    if (!fs.existsSync(exeBak)) {
        fs.copyFileSync(exePath, exeBak);
        console.log('[+] Created backup: Antigravity.exe.bak');
    }

    const asarBytes = fs.readFileSync(asarBak);
    const p1 = asarBytes.readUInt32LE(4);
    const p3 = asarBytes.readUInt32LE(12);
    const oldHeaderJsonBytes = asarBytes.subarray(16, 16 + p3);
    const oldHeaderHash = sha256(oldHeaderJsonBytes);
    const header = JSON.parse(oldHeaderJsonBytes.toString('utf8'));
    const dataOffset = p1 + 8;
    const payload = asarBytes.subarray(dataOffset);

    const preloadInfo = header.files.dist.files['preload.js'];
    const origOffset = parseInt(preloadInfo.offset, 10);
    const origSize = preloadInfo.size;
    const origPreload = payload.subarray(origOffset, origOffset + origSize).toString('utf8');

    const newPreloadStr = origPreload.includes(RTL_INJECTION_MARKER)
        ? origPreload
        : origPreload + '\n' + RTL_INJECTION_CODE;
    const newPreloadBytes = Buffer.from(newPreloadStr, 'utf8');

    const newOffset = payload.length;
    const newSize = newPreloadBytes.length;
    const newPreloadHash = sha256(newPreloadBytes);

    preloadInfo.offset = String(newOffset);
    preloadInfo.size = newSize;
    preloadInfo.integrity = {
        algorithm: 'SHA256',
        hash: newPreloadHash,
        blockSize: 4194304,
        blocks: [newPreloadHash]
    };

    const newHeaderJsonBytes = Buffer.from(JSON.stringify(header), 'utf8');
    const newP3 = newHeaderJsonBytes.length;
    const paddingLen = (4 - (newP3 % 4)) % 4;
    const paddedHeaderJson = Buffer.concat([newHeaderJsonBytes, Buffer.alloc(paddingLen, 0)]);
    const newP2 = newP3 + paddingLen + 4;
    const newP1 = newP2 + 4;
    const newHeaderHash = sha256(newHeaderJsonBytes);

    const headerPrefix = Buffer.alloc(16);
    headerPrefix.writeUInt32LE(4, 0);
    headerPrefix.writeUInt32LE(newP1, 4);
    headerPrefix.writeUInt32LE(newP2, 8);
    headerPrefix.writeUInt32LE(newP3, 12);

    const newAsarBytes = Buffer.concat([headerPrefix, paddedHeaderJson, payload, newPreloadBytes]);

    const fd = fs.openSync(asarPath, 'r+');
    fs.writeSync(fd, newAsarBytes, 0, newAsarBytes.length, 0);
    fs.ftruncateSync(fd, newAsarBytes.length);
    fs.closeSync(fd);
    console.log('[+] Patched resources/app.asar');

    const exeBytes = fs.readFileSync(exeBak);
    const oldHashBuf = Buffer.from(oldHeaderHash, 'ascii');
    const newHashBuf = Buffer.from(newHeaderHash, 'ascii');
    const idx = exeBytes.indexOf(oldHashBuf);
    if (idx === -1) throw new Error('Could not find ASAR integrity hash in Antigravity.exe.bak');
    newHashBuf.copy(exeBytes, idx);

    const tempOldExe = exePath + '.running_old';
    try {
        fs.writeFileSync(exePath, exeBytes);
    } catch (e) {
        if (fs.existsSync(tempOldExe)) {
            try { fs.unlinkSync(tempOldExe); } catch (_) {}
        }
        fs.renameSync(exePath, tempOldExe);
        fs.writeFileSync(exePath, exeBytes);
    }
    console.log('[+] Updated ASAR integrity checksum in Antigravity.exe');
    console.log('\n[SUCCESS] Antigravity 2.0 Arabic/RTL fix is installed!');
    console.log('-> Please press Ctrl+Shift+N (or restart Antigravity 2.0) to see the fix.');
}

patch();
