'use strict';
/**
 * Shared patch engine for arabic-rtl-fixer.
 *
 * Appends lib/injection.js to dist/preload.js inside Antigravity's
 * resources/app.asar and updates the ASAR integrity hash embedded in
 * Antigravity.exe. Used by both the sidecar (server.cjs) and the CLI
 * (patch_antigravity_rtl.js), so there is exactly one implementation.
 *
 * Backups (app.asar.bak / Antigravity.exe.bak) are always kept in sync with
 * the *currently installed* Antigravity version: whenever app.asar does not
 * contain our marker (fresh install or after an Antigravity auto-update), the
 * backups are refreshed before patching. This prevents an old-version backup
 * from ever being written over a newer Antigravity.
 */

const path = require('node:path');
const crypto = require('node:crypto');
const nodeFs = require('node:fs');

// Electron (agy-node) ships 'original-fs', which bypasses the ASAR virtual FS.
let fs = nodeFs;
try { fs = require('original-fs'); } catch (_) { /* plain Node */ }

const MARKER_PREFIX = '/* === ANTIGRAVITY_RTL_BIDI_FIX_';
const MARKER = '/* === ANTIGRAVITY_RTL_BIDI_FIX_V2 === */';
const INJECTION_CODE = nodeFs.readFileSync(path.join(__dirname, 'injection.js'), 'utf8');

if (!INJECTION_CODE.includes(MARKER)) {
    throw new Error('lib/injection.js does not contain the expected marker ' + MARKER);
}

function withRawAsar(fn) {
    const prev = process.noAsar;
    process.noAsar = true;
    try { return fn(); } finally { process.noAsar = prev; }
}

function sha256(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex');
}

function getAntigravityDir() {
    const localAppData = process.env.LOCALAPPDATA ||
        path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
    const candidates = [
        path.join(localAppData, 'Programs', 'antigravity'),
        path.join(localAppData, 'antigravity'),
    ];
    for (const c of candidates) {
        if (fs.existsSync(path.join(c, 'Antigravity.exe'))) return c;
    }
    return null;
}

function getPaths() {
    const appDir = getAntigravityDir();
    if (!appDir) throw new Error('Antigravity installation not found.');
    return {
        appDir,
        asar: path.join(appDir, 'resources', 'app.asar'),
        asarBak: path.join(appDir, 'resources', 'app.asar.bak'),
        exe: path.join(appDir, 'Antigravity.exe'),
        exeBak: path.join(appDir, 'Antigravity.exe.bak'),
    };
}

/** Parses an ASAR buffer and returns header + preload.js info. */
function readAsar(buf) {
    const p1 = buf.readUInt32LE(4);
    const p3 = buf.readUInt32LE(12);
    const headerBytes = buf.subarray(16, 16 + p3);
    const header = JSON.parse(headerBytes.toString('utf8'));
    const dataOffset = p1 + 8;
    const fileAt = (info) => {
        const off = dataOffset + parseInt(info.offset, 10);
        return buf.subarray(off, off + info.size);
    };
    const preloadInfo = header.files.dist.files['preload.js'];
    const pkgInfo = header.files['package.json'];
    let appVersion = null;
    try { appVersion = JSON.parse(fileAt(pkgInfo).toString('utf8')).version || null; } catch (_) {}
    return {
        header,
        headerBytes,
        headerHash: sha256(headerBytes),
        dataOffset,
        payload: buf.subarray(dataOffset),
        preloadInfo,
        preload: fileAt(preloadInfo).toString('utf8'),
        appVersion,
    };
}

function checkStatus() {
    return withRawAsar(() => {
        try {
            const p = getPaths();
            const asar = readAsar(fs.readFileSync(p.asar));
            const installed = asar.preload.includes(MARKER);
            return {
                installed,
                outdated: !installed && asar.preload.includes(MARKER_PREFIX),
                hasBackup: fs.existsSync(p.asarBak) && fs.existsSync(p.exeBak),
                appVersion: asar.appVersion,
            };
        } catch (e) {
            return { installed: false, outdated: false, hasBackup: false, appVersion: null, error: e.message };
        }
    });
}

/**
 * Makes sure *.bak files are clean copies of the currently installed version.
 * Returns the parsed clean ASAR from the backup.
 */
function syncBackups(p) {
    const current = readAsar(fs.readFileSync(p.asar));
    if (!current.preload.includes(MARKER_PREFIX)) {
        // Unpatched (fresh install or Antigravity just auto-updated): refresh backups.
        fs.copyFileSync(p.asar, p.asarBak);
        fs.copyFileSync(p.exe, p.exeBak);
    } else if (!fs.existsSync(p.asarBak) || !fs.existsSync(p.exeBak)) {
        throw new Error('Antigravity is patched but the backups are missing. Reinstall Antigravity, then apply again.');
    }

    const clean = readAsar(fs.readFileSync(p.asarBak));
    if (clean.preload.includes(MARKER_PREFIX)) {
        throw new Error('app.asar.bak is not a clean copy. Reinstall Antigravity, then apply again.');
    }
    if (current.appVersion && clean.appVersion && current.appVersion !== clean.appVersion) {
        throw new Error(`Backup is from Antigravity ${clean.appVersion} but ${current.appVersion} is installed. Reinstall Antigravity, then apply again.`);
    }
    return clean;
}

function writeFileInPlace(target, data) {
    const fd = fs.openSync(target, 'r+');
    try {
        fs.writeSync(fd, data, 0, data.length, 0);
        fs.ftruncateSync(fd, data.length);
    } finally {
        fs.closeSync(fd);
    }
}

function replaceExe(exePath, bytes) {
    if (fs.existsSync(exePath)) {
        try {
            const current = fs.readFileSync(exePath);
            if (current.equals(bytes)) return;
        } catch (_) {}
    }
    try {
        fs.writeFileSync(exePath, bytes);
        return;
    } catch (_) {}

    const dir = path.dirname(exePath);
    try {
        for (const f of fs.readdirSync(dir)) {
            if (f.startsWith('Antigravity.exe.old_') || f === 'Antigravity.exe.running_old') {
                try { fs.unlinkSync(path.join(dir, f)); } catch (_) {}
            }
        }
    } catch (_) {}

    const aside = `${exePath}.old_${Date.now()}`;
    fs.renameSync(exePath, aside);
    fs.writeFileSync(exePath, bytes);
}

function applyPatch() {
    return withRawAsar(() => {
        const p = getPaths();
        const clean = syncBackups(p);

        const newPreload = Buffer.from(clean.preload + '\n' + INJECTION_CODE, 'utf8');
        const newPreloadHash = sha256(newPreload);
        const header = clean.header;
        Object.assign(header.files.dist.files['preload.js'], {
            offset: String(clean.payload.length), // appended at the end: no other offsets move
            size: newPreload.length,
            integrity: { algorithm: 'SHA256', hash: newPreloadHash, blockSize: 4194304, blocks: [newPreloadHash] },
        });

        const headerJson = Buffer.from(JSON.stringify(header), 'utf8');
        const padding = (4 - (headerJson.length % 4)) % 4;
        const prefix = Buffer.alloc(16);
        prefix.writeUInt32LE(4, 0);
        prefix.writeUInt32LE(headerJson.length + padding + 8, 4);
        prefix.writeUInt32LE(headerJson.length + padding + 4, 8);
        prefix.writeUInt32LE(headerJson.length, 12);
        const newAsar = Buffer.concat([prefix, headerJson, Buffer.alloc(padding, 0), clean.payload, newPreload]);

        // Verify the exe can be updated BEFORE touching anything, otherwise the
        // ASAR integrity check would stop Antigravity from launching.
        const exeBytes = fs.readFileSync(p.exeBak);
        const idx = exeBytes.indexOf(Buffer.from(clean.headerHash, 'ascii'));
        if (idx === -1) {
            throw new Error('ASAR integrity hash not found in Antigravity.exe.bak. This Antigravity build is not supported yet.');
        }
        Buffer.from(sha256(headerJson), 'ascii').copy(exeBytes, idx);

        replaceExe(p.exe, exeBytes);
        try {
            writeFileInPlace(p.asar, newAsar);
        } catch (e) {
            replaceExe(p.exe, fs.readFileSync(p.exeBak)); // roll back to a consistent pair
            throw e;
        }
        return checkStatus();
    });
}

function restoreOriginal() {
    return withRawAsar(() => {
        const p = getPaths();
        if (!fs.existsSync(p.asarBak) || !fs.existsSync(p.exeBak)) {
            throw new Error('No backups found; nothing to restore.');
        }
        const current = readAsar(fs.readFileSync(p.asar));
        if (!current.preload.includes(MARKER_PREFIX)) {
            return checkStatus(); // already original (maybe a newer version): never downgrade
        }
        replaceExe(p.exe, fs.readFileSync(p.exeBak));
        writeFileInPlace(p.asar, fs.readFileSync(p.asarBak));
        return checkStatus();
    });
}

module.exports = { MARKER, checkStatus, applyPatch, restoreOriginal, getAntigravityDir };
