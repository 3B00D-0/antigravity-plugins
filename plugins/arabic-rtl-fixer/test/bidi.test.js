'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const INJECTION_SRC = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'injection.js'),
    'utf8'
);

/** Minimal DOM harness for running injection.js without external npm packages. */
function createDom() {
    class TextNode {
        constructor(value) {
            this.nodeType = 3;
            this.nodeValue = value;
            this.parentElement = null;
            this.nextSibling = null;
        }
        get textContent() { return this.nodeValue; }
    }

    class Element {
        constructor(tagName, attrs = {}, children = []) {
            this.nodeType = 1;
            this.tagName = tagName.toUpperCase();
            this.attrs = { ...attrs };
            this.children = [];
            this.childNodes = [];
            this.parentElement = null;
            this.firstChild = null;
            this.nextSibling = null;
            this.isConnected = true;
            this.classList = {
                contains: (c) => String(this.attrs.class || '').split(/\s+/).includes(c),
            };
            for (const c of children) this.appendChild(c);
        }
        get id() { return this.attrs.id || ''; }
        set id(v) { this.attrs.id = v; }
        get className() { return this.attrs.class || ''; }
        set className(v) { this.attrs.class = v; }
        appendChild(child) {
            const node = typeof child === 'string' ? new TextNode(child) : child;
            node.parentElement = this;
            const prev = this.childNodes[this.childNodes.length - 1];
            if (prev) prev.nextSibling = node;
            else this.firstChild = node;
            this.childNodes.push(node);
            if (node.nodeType === 1) this.children.push(node);
            return node;
        }
        get textContent() {
            return this.childNodes.map((c) => c.textContent).join('');
        }
        set textContent(val) {
            this.childNodes = [];
            this.children = [];
            this.firstChild = null;
            if (val !== '' && val != null) this.appendChild(String(val));
        }
        getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
        setAttribute(k, v) { this.attrs[k] = String(v); }
        hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); }
        matches(sel) {
            const parts = sel.split(',').map((s) => s.trim());
            const t = this.tagName.toLowerCase();
            for (const p of parts) {
                if (p === t) return true;
                if (p === '[data-quotable="true"]' && this.getAttribute('data-quotable') === 'true') return true;
                if (p === '[data-testid="comment-card-text"]' && this.getAttribute('data-testid') === 'comment-card-text') return true;
                if (p === '.markdown-alert' && this.classList.contains('markdown-alert')) return true;
                if (p === '.katex' && this.classList.contains('katex')) return true;
                if (p === '.katex-display' && this.classList.contains('katex-display')) return true;
                if (p === 'div[class*="border-l"]' && t === 'div' && this.className.includes('border-l')) return true;
            }
            return false;
        }
        closest(sel) {
            let cur = this;
            while (cur) {
                if (cur.matches && cur.matches(sel)) return cur;
                cur = cur.parentElement;
            }
            return null;
        }
        querySelector(sel) {
            return this.querySelectorAll(sel)[0] || null;
        }
        querySelectorAll(sel) {
            const out = [];
            const walk = (n) => {
                for (const c of n.children) {
                    if (c.matches(sel)) out.push(c);
                    walk(c);
                }
            };
            walk(this);
            return out;
        }
    }

    const head = new Element('head');
    const body = new Element('body');
    const root = new Element('html', {}, [head, body]);
    let observerCb = null;

    class MockMutationObserver {
        constructor(cb) { observerCb = cb; }
        observe() {}
    }

    const doc = {
        readyState: 'complete',
        documentElement: root,
        head,
        body,
        createElement: (tag) => new Element(tag),
        querySelectorAll: (sel) => root.querySelectorAll(sel),
    };

    const win = {
        document: doc,
        MutationObserver: MockMutationObserver,
        requestAnimationFrame: (fn) => fn(),
        getComputedStyle: () => ({ getPropertyValue: () => '' }),
        addEventListener: () => {},
    };
    win.window = win;

    const el = (tag, attrsOrChildren, maybeChildren) => {
        if (Array.isArray(attrsOrChildren)) return new Element(tag, {}, attrsOrChildren);
        return new Element(tag, attrsOrChildren || {}, maybeChildren || []);
    };

    return {
        doc,
        body,
        el,
        mountAndRun() {
            vm.runInNewContext(INJECTION_SRC, {
                window: win,
                document: doc,
                MutationObserver: MockMutationObserver,
                requestAnimationFrame: (fn) => fn(),
                setTimeout,
                URL,
                Blob,
                Set,
                Array,
                console,
            });
        },
        triggerChildList(target, addedNodes) {
            if (observerCb) observerCb([{ type: 'childList', target, addedNodes }]);
        },
    };
}

test('injects BiDi CSS rules for tables, lists, task lists, callouts, and plaintext pre', () => {
    const dom = createDom();
    dom.mountAndRun();
    const style = dom.doc.head.children.find((c) => c.id === 'antigravity-rtl-bidi-style');
    assert.ok(style, 'style element should be injected');
    assert.match(style.textContent, /html body table\[dir="rtl"\]/);
    assert.match(style.textContent, /html body ul\.contains-task-list\[dir="rtl"\]/);
    assert.match(style.textContent, /border-right-width: 3px !important/);
    assert.match(style.textContent, /html body pre\[dir="rtl"\]/);
});

test('Arabic table gets dir="rtl" and keeps English inline code badges isolated', () => {
    const dom = createDom();
    const { el } = dom;
    const th1 = el('th', ['المكون']);
    const th2 = el('th', ['الوصف']);
    const td1 = el('td', [el('code', ['ESP32-WROOM'])]);
    const td2 = el('td', ['المتحكم الرئيسي متصل بحساس ', el('code', ['DHT22']), ' لقراءة الحرارة']);
    const table = el('table', [
        el('thead', [el('tr', [th1, th2])]),
        el('tbody', [el('tr', [td1, td2])]),
    ]);
    dom.body.appendChild(table);
    dom.mountAndRun();

    assert.equal(table.getAttribute('dir'), 'rtl');
    assert.equal(th1.getAttribute('dir'), 'rtl');
    assert.equal(th2.getAttribute('dir'), 'rtl');
    assert.equal(td1.getAttribute('dir'), 'ltr');
    assert.equal(td2.getAttribute('dir'), 'rtl');
});

test('English-majority table with 1 Arabic notes column stays dir="ltr" while Arabic cells are dir="rtl"', () => {
    const dom = createDom();
    const { el } = dom;
    const th1 = el('th', ['Component']);
    const th2 = el('th', ['Pin']);
    const th3 = el('th', ['Voltage']);
    const th4 = el('th', ['الملاحظات']);
    const td1 = el('td', ['DHT22 Sensor']);
    const td2 = el('td', [el('code', ['GPIO 4'])]);
    const td3 = el('td', [el('code', ['3.3V'])]);
    const td4 = el('td', ['حساس قياس الحرارة والرطوبة']);
    const table = el('table', [
        el('thead', [el('tr', [th1, th2, th3, th4])]),
        el('tbody', [el('tr', [td1, td2, td3, td4])]),
    ]);
    dom.body.appendChild(table);
    dom.mountAndRun();

    assert.equal(table.getAttribute('dir'), 'ltr');
    assert.equal(td1.getAttribute('dir'), 'ltr');
    assert.equal(td4.getAttribute('dir'), 'rtl');
    assert.equal(th4.getAttribute('dir'), 'rtl');
});

test('Bilingual Arabic list starting with English code badges & .md links aligns RTL while English quoting Arabic stays LTR', () => {
    const dom = createDom();
    const { el } = dom;
    const liAr = el('li', [
        el('code', ['1. Solar Panel (Basmala)']),
        ' → ',
        el('a', ['solar_test_protocols.md']),
        ' (دليل توصيل اللوح الشمسي ',
        el('code', ['18V 10W']),
        ' وجداول القياس).',
    ]);
    const listAr = el('ul', [liAr]);

    const liEn = el('li', [
        'In that screenshot, it quoted short Arabic phrases (',
        el('code', ['إضاءة طريق ذكية']),
        ' and ',
        el('code', ['ENLIL لأ - نقلتها من مشروع']),
        ') inside an English sentence.',
    ]);
    const listEn = el('ul', [liEn]);

    dom.body.appendChild(listAr);
    dom.body.appendChild(listEn);
    dom.mountAndRun();

    assert.equal(listAr.getAttribute('dir'), 'rtl');
    assert.equal(liAr.getAttribute('dir'), 'rtl');
    assert.equal(listEn.getAttribute('dir'), 'ltr');
    assert.equal(liEn.getAttribute('dir'), 'ltr');
});

test('Streaming table rows dynamically update table direction from initial empty/LTR state to RTL', () => {
    const dom = createDom();
    const { el } = dom;
    const tbody = el('tbody', []);
    const table = el('table', [tbody]);
    dom.body.appendChild(table);
    dom.mountAndRun();

    assert.equal(table.getAttribute('dir'), 'ltr');

    const row = el('tr', [el('td', ['المرحلة الأولى']), el('td', ['تصميم الدائرة الكهربائية'])]);
    tbody.appendChild(row);
    dom.triggerChildList(tbody, [row]);

    assert.equal(table.getAttribute('dir'), 'rtl');
});

test('Code blocks stay LTR while Arabic plaintext copy-paste <pre> blocks get RTL', () => {
    const dom = createDom();
    const { el } = dom;
    const codePre = el('pre', [el('code', ['const x = 1; // تعليق بالعربي'])]);
    const labeledCodePre = el('pre', [el('code', { class: 'language-javascript' }, ['// شرح الدالة بالكامل باللغة العربية\nconst total = 42;'])]);
    const arPre = el('pre', [el('code', { class: 'language-text' }, ['لو سمحت اطبع الـ 5 ملفات بالإعدادات دي: الخامة PLA'])]);

    dom.body.appendChild(codePre);
    dom.body.appendChild(labeledCodePre);
    dom.body.appendChild(arPre);
    dom.mountAndRun();

    assert.equal(codePre.getAttribute('dir'), 'ltr');
    assert.equal(labeledCodePre.getAttribute('dir'), 'ltr');
    assert.equal(arPre.getAttribute('dir'), 'rtl');
});
