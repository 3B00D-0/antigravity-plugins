/* === ANTIGRAVITY_RTL_BIDI_FIX_V5 === */
(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // ------------------------------------------------------------------
    // 1. RTL / BiDi formatting
    // ------------------------------------------------------------------
    const RTL_CSS = `
        /* Block elements BiDi & text alignment */
        p, h1, h2, h3, h4, h5, h6, blockquote, dd, dt,
        caption, figcaption, details, summary,
        [data-quotable="true"],
        [data-testid="comment-card-text"],
        [data-lexical-editor="true"] p {
            unicode-bidi: plaintext !important;
            text-align: start !important;
        }

        /* Explicit direction overrides for paragraphs & headings */
        p[dir="rtl"], h1[dir="rtl"], h2[dir="rtl"], h3[dir="rtl"],
        h4[dir="rtl"], h5[dir="rtl"], h6[dir="rtl"],
        [data-quotable="true"][dir="rtl"],
        [data-testid="comment-card-text"][dir="rtl"] {
            direction: rtl !important;
            text-align: right !important;
            unicode-bidi: isolate !important;
        }
        p[dir="ltr"], h1[dir="ltr"], h2[dir="ltr"], h3[dir="ltr"],
        h4[dir="ltr"], h5[dir="ltr"], h6[dir="ltr"],
        [data-quotable="true"][dir="ltr"],
        [data-testid="comment-card-text"][dir="ltr"] {
            direction: ltr !important;
            text-align: left !important;
            unicode-bidi: isolate !important;
        }

        /* Lists: High specificity to beat Antigravity's [&>ol:not(.contains-task-list)]:!pl-4 */
        html body ul[dir="rtl"],
        html body ol[dir="rtl"],
        html body [dir="rtl"] > ul:not([dir="ltr"]),
        html body [dir="rtl"] > ol:not([dir="ltr"]) {
            direction: rtl !important;
            text-align: right !important;
            padding-right: 1.75rem !important;
            padding-left: 0 !important;
            margin-right: 0 !important;
            list-style-position: outside !important;
        }
        html body ul[dir="ltr"],
        html body ol[dir="ltr"] {
            direction: ltr !important;
            text-align: left !important;
            padding-left: 1.75rem !important;
            padding-right: 0 !important;
            margin-left: 0 !important;
            list-style-position: outside !important;
        }

        /* List items: DO NOT use unicode-bidi: plaintext on li, or ::marker decouples from line alignment! */
        html body li[dir="rtl"],
        html body ul[dir="rtl"] > li:not([dir="ltr"]),
        html body ol[dir="rtl"] > li:not([dir="ltr"]) {
            direction: rtl !important;
            text-align: right !important;
            unicode-bidi: isolate !important;
        }
        html body li[dir="ltr"],
        html body ul[dir="ltr"] > li:not([dir="rtl"]),
        html body ol[dir="ltr"] > li:not([dir="rtl"]) {
            direction: ltr !important;
            text-align: left !important;
            unicode-bidi: isolate !important;
        }
        /* Child paragraphs inside list items must inherit list item direction */
        html body li[dir="rtl"] > p {
            direction: rtl !important;
            text-align: right !important;
            unicode-bidi: isolate !important;
        }
        html body li[dir="ltr"] > p {
            direction: ltr !important;
            text-align: left !important;
            unicode-bidi: isolate !important;
        }

        /* Blockquotes & GitHub-style Callouts / Alerts (NOTE, TIP, IMPORTANT, WARNING, CAUTION) */
        html body blockquote[dir="rtl"],
        html body blockquote:has(> p[dir="rtl"]),
        html body div[class*="border-l"][dir="rtl"],
        html body div[class*="border-l"]:has(> p[dir="rtl"]) {
            direction: rtl !important;
            text-align: right !important;
            border-left-width: 0px !important;
            border-right-width: 4px !important;
            border-right-style: solid !important;
            padding-right: 1rem !important;
            padding-left: 0.5rem !important;
        }
        html body .markdown-alert[dir="rtl"],
        html body .markdown-alert:has(> p[dir="rtl"]) {
            direction: rtl !important;
            text-align: right !important;
            border-left: none !important;
            border-right: 4px solid currentColor !important;
            padding-right: 1rem !important;
            padding-left: 0 !important;
        }

        /* Tables & Table Cells (full BiDi isolation & alignment) */
        html body table[dir="rtl"] {
            direction: rtl !important;
        }
        html body table[dir="ltr"] {
            direction: ltr !important;
        }
        th, td, caption, figcaption {
            unicode-bidi: plaintext !important;
        }
        html body th[dir="rtl"]:not([style*="text-align: center"]):not([style*="text-align:center"]),
        html body td[dir="rtl"]:not([style*="text-align: center"]):not([style*="text-align:center"]) {
            direction: rtl !important;
            text-align: right !important;
            unicode-bidi: isolate !important;
        }
        html body th[dir="rtl"][style*="text-align: center"],
        html body th[dir="rtl"][style*="text-align:center"],
        html body td[dir="rtl"][style*="text-align: center"],
        html body td[dir="rtl"][style*="text-align:center"] {
            direction: rtl !important;
            text-align: center !important;
            unicode-bidi: isolate !important;
        }
        html body th[dir="ltr"]:not([style*="text-align: center"]):not([style*="text-align:center"]),
        html body td[dir="ltr"]:not([style*="text-align: center"]):not([style*="text-align:center"]) {
            direction: ltr !important;
            text-align: left !important;
            unicode-bidi: isolate !important;
        }

        /* Code & Math preservation */
        pre:not([dir="rtl"]),
        pre:not([dir="rtl"]) code,
        .katex,
        .katex-display {
            direction: ltr !important;
            unicode-bidi: isolate !important;
            text-align: left !important;
        }
        /* Plaintext / copy-paste code blocks that are predominantly Arabic */
        html body pre[dir="rtl"],
        html body pre[dir="rtl"] code {
            direction: rtl !important;
            unicode-bidi: plaintext !important;
            text-align: right !important;
        }

        /* Inline code badges & file pills: isolate so they never invert surrounding Arabic punctuation/arrows */
        :not(pre) > code:not([dir="rtl"]) {
            direction: ltr !important;
            unicode-bidi: isolate !important;
        }
        :not(pre) > code[dir="rtl"] {
            direction: rtl !important;
            unicode-bidi: isolate !important;
        }
        p[dir="rtl"] a,
        li[dir="rtl"] a,
        td[dir="rtl"] a,
        th[dir="rtl"] a {
            unicode-bidi: isolate !important;
        }
    `;

    const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const ARABIC_GLOBAL_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
    const STRONG_CHAR_REGEX = /[A-Za-z\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const TECH_TOKEN_REGEX = /https?:\/\/\S+|\b[\w./\\-]+\.(?:md|py|js|cjs|mjs|ts|tsx|jsx|json|ino|scad|stl|html|css|sh|bat|ps1|yaml|yml|toml|txt|csv|pdf|png|jpg|svg|exe|asar)\b/gi;
    const TARGET_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, ul, ol, blockquote, pre, code, table, th, td, caption, figcaption, dd, dt, details, summary, [data-quotable="true"], [data-testid="comment-card-text"], .markdown-alert, div[class*="border-l"]';

    function detectDir(text) {
        if (!text) return null;
        const match = text.match(STRONG_CHAR_REGEX);
        if (!match) return null;
        return ARABIC_REGEX.test(match[0]) ? 'rtl' : 'ltr';
    }

    function hasArabic(text) {
        return !!text && ARABIC_REGEX.test(text);
    }

    function countChars(text) {
        if (!text) return { ar: 0, en: 0 };
        const ar = (text.match(ARABIC_GLOBAL_REGEX) || []).length;
        const en = (text.match(/[A-Za-z]/g) || []).length;
        return { ar, en };
    }

    /**
     * Extracts natural prose text from an element by excluding technical inline children
     * (<code>, <pre>, <kbd>, <samp>, .katex, file links) and stripping URLs/filenames.
     * This prevents English badges like `1. Solar Panel (Basmala)` -> `solar_test.md`
     * from tricking an Arabic sentence into LTR mode, while keeping English sentences
     * that quote Arabic inside `<code>` strictly in LTR mode.
     */
    function getProseText(el) {
        if (!el) return '';
        let raw = '';
        const walk = (node) => {
            for (let child = node.firstChild; child; child = child.nextSibling) {
                if (child.nodeType === 3) {
                    raw += child.nodeValue;
                } else if (child.nodeType === 1) {
                    const t = child.tagName.toLowerCase();
                    if (t === 'pre' || t === 'code' || t === 'kbd' || t === 'samp' || t === 'script' || t === 'style') continue;
                    if (child.classList && (child.classList.contains('katex') || child.classList.contains('katex-display'))) continue;
                    walk(child);
                }
            }
        };
        walk(el);
        return raw.replace(TECH_TOKEN_REGEX, ' ');
    }

    /**
     * Determines whether an element with mixed text should be 'rtl' or 'ltr'.
     */
    function resolveElementDir(el, fullText) {
        if (!hasArabic(fullText)) {
            return /[A-Za-z]/.test(fullText) ? 'ltr' : null;
        }
        const prose = getProseText(el);
        const { ar: proseAr, en: proseEn } = countChars(prose);

        // If there is natural prose outside <code>/filenames:
        if (proseAr + proseEn > 0) {
            if (proseAr === 0) return 'ltr'; // Arabic was only inside <code> quotes inside an English sentence!
            if (detectDir(prose) === 'rtl') return 'rtl';
            if (proseAr >= proseEn * 0.35) return 'rtl';
            return 'ltr';
        }

        // Fallback when all text is inside child tags (e.g. a line made entirely of <code> or <a>):
        const { ar, en } = countChars(fullText);
        if (detectDir(fullText) === 'rtl' || ar >= en * 0.5) return 'rtl';
        return 'ltr';
    }

    function applyRtlToElement(el) {
        if (!el || !el.tagName) return;
        const tag = el.tagName.toLowerCase();
        if (el.closest('.katex, .katex-display')) return;

        // Inline <code>
        if (tag === 'code') {
            if (el.parentElement && el.parentElement.tagName.toLowerCase() === 'pre') return;
            const codeText = el.textContent || '';
            const targetDir = hasArabic(codeText) ? 'rtl' : 'ltr';
            if (el.getAttribute('dir') !== targetDir) el.setAttribute('dir', targetDir);
            return;
        }

        // <pre> blocks: keep code LTR, but allow Arabic plaintext copy-paste blocks to flow RTL
        if (tag === 'pre') {
            const preText = el.textContent || '';
            if (hasArabic(preText)) {
                const { ar, en } = countChars(preText);
                const targetDir = (ar > en * 0.6) ? 'rtl' : 'ltr';
                if (el.getAttribute('dir') !== targetDir) el.setAttribute('dir', targetDir);
            } else if (el.getAttribute('dir') !== 'ltr') {
                el.setAttribute('dir', 'ltr');
            }
            return;
        }

        if (el.closest('pre, code')) return;

        // Skip generic divs unless they are callout/alert boxes or explicit target containers
        if (tag === 'div') {
            const cls = typeof el.className === 'string' ? el.className : '';
            const isCallout = cls.includes('border-l') || cls.includes('markdown-alert') ||
                el.getAttribute('data-quotable') === 'true' ||
                el.getAttribute('data-testid') === 'comment-card-text';
            if (!isCallout) return;
        }

        const text = el.textContent || '';

        // Table container
        if (tag === 'table') {
            const targetDir = resolveElementDir(el, text) || 'ltr';
            if (el.getAttribute('dir') !== targetDir) el.setAttribute('dir', targetDir);
            return;
        }

        // Lists (ul / ol): ensure list and its items align consistently
        if (tag === 'ul' || tag === 'ol') {
            const items = Array.from(el.children).filter((c) => c.tagName && c.tagName.toLowerCase() === 'li');
            let rtlItems = 0;
            let ltrItems = 0;
            for (const item of items) {
                const itemDir = resolveElementDir(item, item.textContent || '');
                if (itemDir === 'rtl') rtlItems++;
                else if (itemDir === 'ltr') ltrItems++;
            }
            const listDir = (rtlItems > 0 && rtlItems >= ltrItems)
                ? 'rtl'
                : (resolveElementDir(el, text) || 'ltr');
            if (el.getAttribute('dir') !== listDir) el.setAttribute('dir', listDir);

            // Propagate consistent direction to child <li> elements
            for (const item of items) {
                const itemText = item.textContent || '';
                if (listDir === 'rtl' && hasArabic(itemText)) {
                    if (item.getAttribute('dir') !== 'rtl') item.setAttribute('dir', 'rtl');
                } else {
                    const itemDir = resolveElementDir(item, itemText) || listDir;
                    if (item.getAttribute('dir') !== itemDir) item.setAttribute('dir', itemDir);
                }
            }
            return;
        }

        // Individual list item (li)
        if (tag === 'li') {
            const parentList = el.parentElement;
            const parentDir = parentList ? parentList.getAttribute('dir') : null;
            if (parentDir === 'rtl' && hasArabic(text)) {
                if (el.getAttribute('dir') !== 'rtl') el.setAttribute('dir', 'rtl');
                return;
            }
            const targetDir = resolveElementDir(el, text) || parentDir || 'auto';
            if (el.getAttribute('dir') !== targetDir) el.setAttribute('dir', targetDir);
            return;
        }

        // General blocks, table cells (th/td), headings, paragraphs, callouts
        if (!text.trim()) {
            if (!el.hasAttribute('dir')) el.setAttribute('dir', 'auto');
            return;
        }
        const targetDir = resolveElementDir(el, text) || 'auto';
        if (el.getAttribute('dir') !== targetDir) el.setAttribute('dir', targetDir);
    }

    function processSubtree(root) {
        if (!root || !root.querySelectorAll) return;
        if (root.matches && root.matches(TARGET_SELECTOR)) applyRtlToElement(root);
        const elements = root.querySelectorAll(TARGET_SELECTOR);
        for (let i = 0; i < elements.length; i++) applyRtlToElement(elements[i]);
    }

    // ------------------------------------------------------------------
    // 2. Sidecar iframe bridge (only for this plugin's own panel)
    // ------------------------------------------------------------------
    const SIDECAR_PREFIX = 'plugin://arabic-rtl-fixer--';
    const BRIDGE_GRACE_MS = 600;

    function hasValidContent(frame) {
        try {
            const doc = frame.contentDocument;
            return !!doc && doc.location.href !== 'about:blank' && doc.body && doc.body.children.length > 0;
        } catch (_) {
            return false;
        }
    }

    function bridgeFrame(frame) {
        if (!frame) return;
        const src = frame.getAttribute('src') || '';
        if (!src.startsWith(SIDECAR_PREFIX)) return;
        if (frame.__agyRtlLastSrc === src && frame.__agyRtlBridged) return;
        frame.__agyRtlLastSrc = src;

        setTimeout(async () => {
            if (!frame.isConnected || hasValidContent(frame)) return;
            try {
                const url = new URL(src);
                const res = await fetch(src, { cache: 'no-store' });
                if (!res.ok) return;
                let html = await res.text();
                const safeSrc = JSON.stringify(src).replace(/</g, '\\u003c');

                // Extract host's active CSS variables so the sidecar matches light/dark & Neo UI tokens immediately
                const hostComputed = window.getComputedStyle(document.documentElement);
                const themeKeys = [
                    '--background', '--foreground', '--card', '--card-border', '--border',
                    '--primary', '--primary-foreground', '--secondary',
                    '--secondary-foreground', '--muted', '--muted-foreground', '--placeholder',
                    '--error', '--success', '--warning', '--code-foreground',
                    '--font-family', '--editor-font-family'
                ];
                const bgVal = hostComputed.getPropertyValue('--background')?.trim() || '';
                const isLightBg = (() => {
                    const rgb = bgVal.match(/\d+/g);
                    if (rgb && rgb.length >= 3) {
                        const lum = (0.2126 * Number(rgb[0]) + 0.7152 * Number(rgb[1]) + 0.0722 * Number(rgb[2])) / 255;
                        return lum > 0.5;
                    }
                    if (/^#[0-9a-f]{6}$/i.test(bgVal)) {
                        const r = parseInt(bgVal.slice(1, 3), 16);
                        const g = parseInt(bgVal.slice(3, 5), 16);
                        const b = parseInt(bgVal.slice(5, 7), 16);
                        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.5;
                    }
                    return false;
                })();
                let themeVars = `:root { color-scheme: ${isLightBg ? 'light' : 'dark'}; `;
                for (let i = 0; i < themeKeys.length; i++) {
                    const val = hostComputed.getPropertyValue(themeKeys[i])?.trim();
                    if (val) themeVars += `${themeKeys[i]}: ${val}; `;
                }
                themeVars += '}';

                const boot = `<base href="${url.protocol}//${url.host}/">` +
                    `<style id="agy-host-theme">${themeVars}</style>` +
                    `<script>document.documentElement.setAttribute('data-theme', '${isLightBg ? 'light' : 'dark'}'); window.__SIDECAR_URL = ${safeSrc};</` + `script>`;
                html = /<head[^>]*>/i.test(html)
                    ? html.replace(/<head[^>]*>/i, (m) => m + boot)
                    : boot + html;
                if (!frame.isConnected || hasValidContent(frame)) return;
                frame.__agyRtlBridged = true;
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

    // ------------------------------------------------------------------
    // 3. Wire up
    // ------------------------------------------------------------------
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
                    const parentList = node.closest && node.closest('ul, ol');
                    if (parentList) applyRtlToElement(parentList);
                } else if (node.nodeType === 3 && node.parentElement) {
                    const codeEl = node.parentElement.closest('code, pre');
                    if (codeEl) applyRtlToElement(codeEl);
                    const block = node.parentElement.closest(TARGET_SELECTOR);
                    if (block) applyRtlToElement(block);
                    const list = node.parentElement.closest('ul, ol');
                    if (list) applyRtlToElement(list);
                    const tbl = node.parentElement.closest('table');
                    if (tbl) applyRtlToElement(tbl);
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
                } else if (m.type === 'attributes' && m.target && m.target.tagName === 'IFRAME') {
                    bridgeFrame(m.target);
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
            attributes: true,
            attributeFilter: ['src'],
        });
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', () => injectIntoDocument(document));
    } else {
        injectIntoDocument(document);
    }
})();
