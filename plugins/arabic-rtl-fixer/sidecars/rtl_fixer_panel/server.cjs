'use strict';
/**
 * arabic-rtl-fixer sidecar: serves the Aux Pane control panel, watches Antigravity's
 * app.asar for updates/restarts, and auto-updates from GitHub when enabled.
 *
 *   GET  /api/status    -> patch status, settings, and auto-patch/update notices
 *   POST /api/apply     -> (re)apply the RTL patch
 *   POST /api/restore   -> restore original Antigravity files (pauses auto-reapply until next app update)
 *   GET  /api/settings  -> read automation settings
 *   POST /api/settings  -> update { autoReapply, autoUpdate }
 *   GET  /api/version   -> installed vs. latest plugin version on GitHub
 *   POST /api/update    -> download latest plugin files, re-apply, restart sidecar
 */

const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PLUGIN_DIR = path.resolve(__dirname, '..', '..');
const PATCHER_PATH = path.join(PLUGIN_DIR, 'lib', 'patcher.cjs');
const SETTINGS_PATH = path.join(PLUGIN_DIR, 'settings.json');
const REMOTE_BASE = 'https://raw.githubusercontent.com/3B00D-0/antigravity-plugins/main/plugins/arabic-rtl-fixer/';
const AUTO_UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const AUTO_UPDATE_STARTUP_DELAY_MS = 4000;
const ASAR_WATCH_INTERVAL_MS = 8000;

const DEFAULT_SETTINGS = {
    autoReapply: true,
    autoUpdate: true,
    pausedByRestore: false,
    pausedAppVersion: null,
    lastCheckAt: null,
    lastAutoUpdate: null,
};

// Every runtime file the plugin consists of (paths relative to the plugin folder).
const PLUGIN_FILES = [
    'plugin.json',
    'assets/logo.svg',
    'lib/patcher.cjs',
    'lib/injection.js',
    'patch_antigravity_rtl.js',
    'patch_antigravity_rtl.py',
    'install.sh',
    'install.ps1',
    'Install-RTL-Fix.bat',
    'Restore-Original.bat',
    'sidecars/rtl_fixer_panel/sidecar.json',
    'sidecars/rtl_fixer_panel/server.cjs',
    'sidecars/rtl_fixer_panel/ui.html',
];

const port = parseInt(process.env.ANTIGRAVITY_SIDECAR_WEB_PORT || '8099', 10);
const host = '127.0.0.1';

let lastError = null;
let autoPatchedNotice = null;
let lastFailedSignature = null;
let updateInFlight = null;

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

function readSettings(file = SETTINGS_PATH) {
    try {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        return { ...DEFAULT_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
    } catch (_) {
        return { ...DEFAULT_SETTINGS };
    }
}

function writeSettings(patch, file = SETTINGS_PATH) {
    const next = { ...readSettings(file), ...patch };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, file);
    return next;
}

function getAsarSignature(patcher) {
    try {
        const p = patcher.getPaths();
        const st = fs.statSync(p.asar);
        return `${p.asar}:${st.size}:${st.mtimeMs}`;
    } catch (_) {
        return null;
    }
}

function ensurePatched(reason = 'startup', { patcher = loadPatcher(), settingsFile = SETTINGS_PATH } = {}) {
    let settings = readSettings(settingsFile);
    const status = patcher.checkStatus();
    if (status.error) {
        lastError = status.error;
        return { action: 'error', status, settings };
    }

    // Clear restore pause automatically once Antigravity upgrades to a different version.
    if (settings.pausedByRestore && status.appVersion && settings.pausedAppVersion && status.appVersion !== settings.pausedAppVersion) {
        settings = writeSettings({ pausedByRestore: false, pausedAppVersion: null }, settingsFile);
    }

    if (status.installed) {
        lastError = null;
        lastFailedSignature = null;
        return { action: 'ok', status, settings };
    }

    if (settings.pausedByRestore) {
        return { action: 'paused', status, settings };
    }

    if (!settings.autoReapply) {
        return { action: 'disabled', status, settings };
    }

    const sig = getAsarSignature(patcher);
    if (sig && sig === lastFailedSignature) {
        return { action: 'skipped_failed', status, settings };
    }

    try {
        const updated = patcher.applyPatch();
        lastError = null;
        lastFailedSignature = null;
        const ver = updated.appVersion ? ` v${updated.appVersion}` : '';
        autoPatchedNotice = reason === 'watch'
            ? `Antigravity updated${ver} — RTL fix re-applied automatically. Press Ctrl+Shift+N or restart to refresh open tabs.`
            : `Auto-applied RTL fix to Antigravity${ver}. Press Ctrl+Shift+N if the current window opened before patching.`;
        return { action: 'applied', status: updated, settings, notice: autoPatchedNotice };
    } catch (e) {
        lastError = e.message;
        lastFailedSignature = sig;
        return { action: 'error', status, settings, error: e.message };
    }
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
    writeSettings({ lastCheckAt: new Date().toISOString() });
    return json.version || '0.0.0';
}

async function updatePlugin({ allowDuringPause = true } = {}) {
    if (updateInFlight) return updateInFlight;
    updateInFlight = (async () => {
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
            if (process.platform !== 'win32' && /\.(sh|js|py)$/.test(rel)) {
                try { fs.chmodSync(dest, 0o755); } catch (_) {}
            }
        }

        const settings = readSettings();
        if (allowDuringPause && settings.pausedByRestore) {
            writeSettings({ pausedByRestore: false, pausedAppVersion: null });
        }
        return loadPatcher().applyPatch();
    })();
    try {
        return await updateInFlight;
    } finally {
        updateInFlight = null;
    }
}

async function checkAndAutoUpdate({ scheduleExit = () => setTimeout(() => process.exit(0), 500) } = {}) {
    const settings = readSettings();
    if (!settings.autoUpdate) return { checked: false, reason: 'disabled' };
    try {
        const installed = localVersion();
        const latest = await remoteVersion();
        if (compareVersions(latest, installed) <= 0) {
            return { checked: true, updated: false, installed, latest };
        }
        await updatePlugin({ allowDuringPause: false });
        writeSettings({
            lastAutoUpdate: { from: installed, to: latest, at: new Date().toISOString() },
        });
        console.log(`[arabic-rtl-fixer] auto-updated v${installed} -> v${latest}; respawning sidecar.`);
        scheduleExit();
        return { checked: true, updated: true, installed, latest };
    } catch (e) {
        // Background checks must stay quiet when offline or rate-limited.
        return { checked: false, error: e.message };
    }
}

function startAsarWatcher() {
    let asarPath = null;
    try {
        asarPath = loadPatcher().getPaths().asar;
    } catch (_) {
        return;
    }
    let debounceTimer = null;
    fs.watchFile(asarPath, { persistent: false, interval: ASAR_WATCH_INTERVAL_MS }, (curr, prev) => {
        if (curr.mtimeMs === prev.mtimeMs && curr.size === prev.size) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            try { ensurePatched('watch'); } catch (_) {}
        }, 1500);
        if (debounceTimer.unref) debounceTimer.unref();
    });
}

/** The official sidecar SDK bridge (theme-change -> CSS variables, window.sidecar). */
function readPreloadBridge() {
    const appData = process.env.ANTIGRAVITY_APP_DATA_DIR || path.join(os.homedir(), '.gemini', 'antigravity');
    const candidate = path.join(appData, 'lib', 'node_modules', 'sidecar_sdk', 'preload.js');
    try {
        const code = fs.readFileSync(candidate, 'utf8');
        // Prevent jarring light flash if dark-theme host event is delayed
        return code
            .replace(/#fafafa/g, '#101114')
            .replace(/#333/g, '#e6e8ec');
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

function readJsonBody(req) {
    return new Promise((resolve) => {
        let raw = '';
        req.on('data', (chunk) => { if (raw.length < 16384) raw += chunk; });
        req.on('end', () => {
            try { resolve(raw ? JSON.parse(raw) : {}); } catch (_) { resolve({}); }
        });
        req.on('error', () => resolve({}));
    });
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

function createServer() {
    return http.createServer(async (req, res) => {
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
                const status = loadPatcher().checkStatus();
                return sendJson(res, 200, {
                    ...status,
                    lastError,
                    autoPatchedNotice,
                    pluginVersion: localVersion(),
                    settings: readSettings(),
                });
            }
            if (pathname === '/api/settings' && req.method === 'GET') {
                return sendJson(res, 200, { ok: true, settings: readSettings() });
            }
            if (pathname === '/api/settings' && req.method === 'POST') {
                const body = await readJsonBody(req);
                const patch = {};
                if (typeof body.autoReapply === 'boolean') patch.autoReapply = body.autoReapply;
                if (typeof body.autoUpdate === 'boolean') patch.autoUpdate = body.autoUpdate;
                const settings = writeSettings(patch);
                if (patch.autoReapply === true) ensurePatched('toggle');
                if (patch.autoUpdate === true) {
                    setTimeout(() => { checkAndAutoUpdate().catch(() => {}); }, 200);
                }
                return sendJson(res, 200, { ok: true, settings, ...loadPatcher().checkStatus(), lastError, autoPatchedNotice });
            }
            if (pathname === '/api/apply' && req.method === 'POST') {
                lastError = null;
                autoPatchedNotice = null;
                lastFailedSignature = null;
                writeSettings({ pausedByRestore: false, pausedAppVersion: null });
                const status = loadPatcher().applyPatch();
                return sendJson(res, 200, { ok: true, ...status, pluginVersion: localVersion(), settings: readSettings() });
            }
            if (pathname === '/api/restore' && req.method === 'POST') {
                lastError = null;
                autoPatchedNotice = null;
                const before = loadPatcher().checkStatus();
                writeSettings({ pausedByRestore: true, pausedAppVersion: before.appVersion || null });
                const status = loadPatcher().restoreOriginal();
                return sendJson(res, 200, { ok: true, ...status, pluginVersion: localVersion(), settings: readSettings() });
            }
            if (pathname === '/api/version') {
                const installed = localVersion();
                const latest = await remoteVersion();
                return sendJson(res, 200, {
                    installed,
                    latest,
                    updateAvailable: compareVersions(latest, installed) > 0,
                    settings: readSettings(),
                });
            }
            if (pathname === '/api/update' && req.method === 'POST') {
                const status = await updatePlugin();
                const version = localVersion();
                writeSettings({ lastAutoUpdate: null });
                sendJson(res, 200, { ok: true, version, ...status });
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
}

function initRuntime() {
    ensurePatched('startup');
    startAsarWatcher();

    const startupTimer = setTimeout(() => {
        checkAndAutoUpdate().catch(() => {});
    }, AUTO_UPDATE_STARTUP_DELAY_MS);
    if (startupTimer.unref) startupTimer.unref();

    const intervalTimer = setInterval(() => {
        checkAndAutoUpdate().catch(() => {});
    }, AUTO_UPDATE_INTERVAL_MS);
    if (intervalTimer.unref) intervalTimer.unref();

    const server = createServer();
    server.listen(port, host, () => {
        console.log(`[arabic-rtl-fixer] panel listening on http://${host}:${port}`);
    });
    return server;
}

if (require.main === module) {
    initRuntime();
}

module.exports = {
    PLUGIN_FILES,
    DEFAULT_SETTINGS,
    compareVersions,
    readSettings,
    writeSettings,
    ensurePatched,
};
