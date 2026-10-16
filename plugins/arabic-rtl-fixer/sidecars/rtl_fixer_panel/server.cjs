'use strict';
/**
 * arabic-rtl-fixer sidecar: serves the Aux Pane control panel and a tiny JSON API.
 *
 *   GET  /api/status   -> patch status
 *   POST /api/apply    -> (re)apply the RTL patch
 *   POST /api/restore  -> restore original Antigravity files
 *   GET  /api/version  -> installed vs. latest plugin version on GitHub
 *   POST /api/update   -> download latest plugin files, re-apply, restart sidecar
 */

const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PLUGIN_DIR = path.resolve(__dirname, '..', '..');
const PATCHER_PATH = path.join(PLUGIN_DIR, 'lib', 'patcher.cjs');
const REMOTE_BASE = 'https://raw.githubusercontent.com/3B00D-0/antigravity-plugins/main/plugins/arabic-rtl-fixer/';

// Every file the plugin consists of (paths relative to the plugin folder).
const PLUGIN_FILES = [
    'plugin.json',
    'assets/logo.svg',
    'lib/patcher.cjs',
    'lib/injection.js',
    'patch_antigravity_rtl.js',
    'Install-RTL-Fix.bat',
    'Restore-Original.bat',
    'sidecars/rtl_fixer_panel/sidecar.json',
    'sidecars/rtl_fixer_panel/server.cjs',
    'sidecars/rtl_fixer_panel/ui.html',
];

const port = parseInt(process.env.ANTIGRAVITY_SIDECAR_WEB_PORT || '8099', 10);
const host = '127.0.0.1';

let lastError = null;

function loadPatcher() {
    delete require.cache[require.resolve(PATCHER_PATH)];
    return require(PATCHER_PATH);
}

function localVersion() {
    try {
        return JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, 'plugin.json'), 'utf8')).version || '0.0.0';
    } catch (_) {
        return '0.0.0';
    }
}

function compareVersions(a, b) {
    const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d) return d > 0 ? 1 : -1;
    }
    return 0;
}

async function fetchRemote(rel) {
    const res = await fetch(REMOTE_BASE + rel + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`Download failed for ${rel} (HTTP ${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) throw new Error(`Downloaded ${rel} is empty`);
    return buf;
}

async function remoteVersion() {
    const json = JSON.parse((await fetchRemote('plugin.json')).toString('utf8'));
    return json.version || '0.0.0';
}

async function updatePlugin() {
    // Download everything first; only write once all files arrived intact.
    const files = [];
    for (const rel of PLUGIN_FILES) files.push([rel, await fetchRemote(rel)]);
    JSON.parse(files[0][1].toString('utf8')); // plugin.json must be valid JSON

    for (const [rel, buf] of files) {
        const dest = path.join(PLUGIN_DIR, ...rel.split('/'));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        const tmp = dest + '.download';
        fs.writeFileSync(tmp, buf);
        fs.renameSync(tmp, dest);
    }
    return loadPatcher().applyPatch();
}

/** The official sidecar SDK bridge (theme-change -> CSS variables, window.sidecar). */
function readPreloadBridge() {
    const appData = process.env.ANTIGRAVITY_APP_DATA_DIR || path.join(os.homedir(), '.gemini', 'antigravity');
    const candidate = path.join(appData, 'lib', 'node_modules', 'sidecar_sdk', 'preload.js');
    try {
        let code = fs.readFileSync(candidate, 'utf8');
        // Prevent jarring white flash if host theme event is delayed:
        // Antigravity's default theme is dark (#101010), not #fafafa.
        return code
            .replace(/#fafafa/g, '#101010')
            .replace(/#333/g, '#cccccc');
    } catch (_) {
        // Minimal fallback: keep the panel in sync with the host theme.
        return `window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'theme-change') {
    for (const [k, v] of Object.entries(e.data.payload.cssVariables || {})) {
      document.documentElement.style.setProperty(k, v);
    }
  }
});`;
    }
}

function sendJson(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
}

function sendFile(res, file, type) {
    try {
        const body = fs.readFileSync(file);
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
        res.end(body);
    } catch (e) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
}

// Auto-apply on startup (first install, plugin update, or after an Antigravity update).
try {
    const patcher = loadPatcher();
    if (!patcher.checkStatus().installed) patcher.applyPatch();
} catch (e) {
    lastError = e.message;
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sidecar-Token');
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const { pathname } = new URL(req.url || '/', `http://${host}:${port}`);

    try {
        if (pathname === '/' || pathname === '/ui.html') {
            return sendFile(res, path.join(__dirname, 'ui.html'), 'text/html; charset=utf-8');
        }
        if (pathname === '/logo.svg') {
            return sendFile(res, path.join(PLUGIN_DIR, 'assets', 'logo.svg'), 'image/svg+xml');
        }
        if (pathname === '/preload.js') {
            res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
            res.end(readPreloadBridge());
            return;
        }
        if (pathname === '/api/status') {
            return sendJson(res, 200, { ...loadPatcher().checkStatus(), lastError, pluginVersion: localVersion() });
        }
        if (pathname === '/api/apply' && req.method === 'POST') {
            lastError = null;
            return sendJson(res, 200, { ok: true, ...loadPatcher().applyPatch() });
        }
        if (pathname === '/api/restore' && req.method === 'POST') {
            lastError = null;
            return sendJson(res, 200, { ok: true, ...loadPatcher().restoreOriginal() });
        }
        if (pathname === '/api/version') {
            const installed = localVersion();
            const latest = await remoteVersion();
            return sendJson(res, 200, { installed, latest, updateAvailable: compareVersions(latest, installed) > 0 });
        }
        if (pathname === '/api/update' && req.method === 'POST') {
            const status = await updatePlugin();
            sendJson(res, 200, { ok: true, version: localVersion(), ...status });
            // Exit so Antigravity respawns the sidecar (restart_policy: always) with the new code.
            setTimeout(() => process.exit(0), 500);
            return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    } catch (e) {
        lastError = e.message;
        sendJson(res, 500, { ok: false, error: e.message });
    }
});

server.listen(port, host, () => {
    console.log(`[arabic-rtl-fixer] panel listening on http://${host}:${port}`);
});
