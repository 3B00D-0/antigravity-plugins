/* === ANTIGRAVITY_RTL_BIDI_FIX_V3 === */
(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // ------------------------------------------------------------------
    // 1. RTL / BiDi formatting
    // ------------------------------------------------------------------
    const RTL_CSS = `
        /* Block elements BiDi & text alignment */
        p, h1, h2, h3, h4, h5, h6, li, blockquote, dd, dt,
        caption, figcaption, details, summary,
        [data-quotable="true"],
        [data-testid="comment-card-text"],
        [data-lexical-editor="true"] p {
            unicode-bidi: plaintext !important;
            text-align: start !important;
        }

        /* Lists */
        ul[dir="rtl"], ol[dir="rtl"] {
            direction: rtl !important;
            text-align: right !important;
            padding-right: 1.75rem !important;
            padding-left: 0 !important;
        }
        ul[dir="ltr"], ol[dir="ltr"] {
            direction: ltr !important;
            text-align: left !important;
            padding-left: 1.75rem !important;
            padding-right: 0 !important;
        }
        li[dir="rtl"] {
            direction: rtl !important;
            text-align: right !important;
        }
        li[dir="ltr"] {
            direction: ltr !important;
            text-align: left !important;
        }

        /* Blockquotes */
        blockquote[dir="rtl"], blockquote:has(> p[dir="rtl"]) {
            direction: rtl !important;
            text-align: right !important;
            border-left: none !important;
            border-right: 4px solid var(--border, #555) !important;
        }

        /* Tables & Table Cells (full BiDi isolation & alignment) */
        table[dir="rtl"] {
            direction: rtl !important;
        }
        table[dir="ltr"] {
            direction: ltr !important;
        }
        th, td, caption, figcaption {
            unicode-bidi: plaintext !important;
        }
        th[dir="rtl"]:not([style*="text-align: center"]):not([style*="text-align:center"]),
        td[dir="rtl"]:not([style*="text-align: center"]):not([style*="text-align:center"]) {
            direction: rtl !important;
            text-align: right !important;
            unicode-bidi: plaintext !important;
        }
        th[dir="rtl"][style*="text-align: center"],
        th[dir="rtl"][style*="text-align:center"],
        td[dir="rtl"][style*="text-align: center"],
        td[dir="rtl"][style*="text-align:center"] {
            direction: rtl !important;
            text-align: center !important;
            unicode-bidi: plaintext !important;
        }
        th[dir="ltr"]:not([style*="text-align: center"]):not([style*="text-align:center"]),
        td[dir="ltr"]:not([style*="text-align: center"]):not([style*="text-align:center"]) {
            direction: ltr !important;
            text-align: left !important;
            unicode-bidi: plaintext !important;
        }

        /* Code & Math preservation */
        pre, pre code, .katex, .katex-display {
            direction: ltr !important;
            unicode-bidi: isolate !important;
            text-align: left !important;
        }
        :not(pre) > code {
            unicode-bidi: plaintext !important;
        }
    `;

    const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const ARABIC_GLOBAL_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
    const STRONG_CHAR_REGEX = /[A-Za-z\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const TARGET_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, ul, ol, blockquote, table, th, td, caption, figcaption, dd, dt, details, summary, [data-quotable="true"]';

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

        // Table container
        if (tag === 'table') {
            if (hasArabic(text)) {
                const arCount = (text.match(ARABIC_GLOBAL_REGEX) || []).length;
                const enCount = (text.match(/[A-Za-z]/g) || []).length;
                // Only flip entire table layout if Arabic is the primary language of the table
                if (arCount > enCount * 1.2 || (detectDir(text) === 'rtl' && arCount >= enCount * 0.8)) {
                    if (el.getAttribute('dir') !== 'rtl') el.setAttribute('dir', 'rtl');
                } else if (el.getAttribute('dir') !== 'ltr') {
                    el.setAttribute('dir', 'ltr');
                }
            }
            return;
        }

        // Lists (ul / ol)
        if (tag === 'ul' || tag === 'ol') {
            if (hasArabic(text)) {
                const arCount = (text.match(ARABIC_GLOBAL_REGEX) || []).length;
                const enCount = (text.match(/[A-Za-z]/g) || []).length;
                // Only flip list container if the majority of the list content is Arabic
                if (arCount > enCount * 1.2 || (detectDir(text) === 'rtl' && arCount >= enCount * 0.8)) {
                    if (el.getAttribute('dir') !== 'rtl') el.setAttribute('dir', 'rtl');
                } else if (el.getAttribute('dir') !== 'ltr') {
                    el.setAttribute('dir', 'ltr');
                }
            }
            return;
        }

        // Table cells & captions
        if (tag === 'th' || tag === 'td' || tag === 'caption' || tag === 'figcaption') {
            if (hasArabic(text)) {
                const dir = detectDir(text);
                const arCount = (text.match(ARABIC_GLOBAL_REGEX) || []).length;
                const enCount = (text.match(/[A-Za-z]/g) || []).length;
                // If it starts with Arabic, it's RTL. If it starts with Latin, only flip if Arabic is dominant.
                const targetDir = (dir === 'rtl' || arCount > enCount * 1.2) ? 'rtl' : 'ltr';
                if (el.getAttribute('dir') !== targetDir) el.setAttribute('dir', targetDir);
            } else if (/[A-Za-z]/.test(text)) {
                if (el.getAttribute('dir') !== 'ltr') el.setAttribute('dir', 'ltr');
            } else if (!el.hasAttribute('dir')) {
                el.setAttribute('dir', 'auto');
            }
            return;
        }

        // General blocks (p, h1-h6, li, blockquote, etc.)
        if (!text.trim()) {
            if (!el.hasAttribute('dir')) el.setAttribute('dir', 'auto');
            return;
        }
        const dir = detectDir(text);
        if (dir === 'rtl') {
            if (el.getAttribute('dir') !== 'rtl') el.setAttribute('dir', 'rtl');
        } else if (hasArabic(text)) {
            const arCount = (text.match(ARABIC_GLOBAL_REGEX) || []).length;
            const enCount = (text.match(/[A-Za-z]/g) || []).length;
            // Only mark RTL if Arabic is the primary language; English sentences quoting Arabic stay LTR!
            const targetDir = arCount > enCount * 1.2 ? 'rtl' : 'ltr';
            if (el.getAttribute('dir') !== targetDir) el.setAttribute('dir', targetDir);
        } else if (dir === 'ltr') {
            if (el.getAttribute('dir') !== 'ltr') el.setAttribute('dir', 'ltr');
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

                // Extract host's active CSS variables so the sidecar matches instantly with no white flash
                const hostComputed = window.getComputedStyle(document.documentElement);
                const themeKeys = [
                    '--background', '--foreground', '--card', '--border',
                    '--primary', '--primary-foreground', '--secondary',
                    '--secondary-foreground', '--muted', '--muted-foreground',
                    '--error', '--success', '--warning'
                ];
                let themeVars = ':root { color-scheme: dark; ';
                for (let i = 0; i < themeKeys.length; i++) {
                    const val = hostComputed.getPropertyValue(themeKeys[i])?.trim();
                    if (val) themeVars += `${themeKeys[i]}: ${val}; `;
                }
                themeVars += '}';

                const boot = `<base href="${url.protocol}//${url.host}/">` +
                    `<style id="agy-host-theme">${themeVars}</style>` +
                    `<script>window.__SIDECAR_URL = ${safeSrc};</` + `script>`;
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
                } else if (node.nodeType === 3 && node.parentElement) {
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
