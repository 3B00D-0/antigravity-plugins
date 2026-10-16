/* === ANTIGRAVITY_RTL_BIDI_FIX_V2 === */
(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // ------------------------------------------------------------------
    // 1. RTL / BiDi formatting
    // ------------------------------------------------------------------
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

    // ------------------------------------------------------------------
    // 2. Sidecar iframe bridge (only for this plugin's own panel)
    //
    // Antigravity 2.24 aborts top-level iframe navigations to plugin://
    // (net::ERR_ABORTED), leaving the Aux Pane spinner forever, while
    // fetch() to the same URL works cleanly. If the panel has not loaded
    // real content after 600ms, fetch its HTML and load it from a Blob
    // URL with <base href="plugin://..."> so relative assets/APIs still
    // resolve through the plugin:// protocol handler.
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
