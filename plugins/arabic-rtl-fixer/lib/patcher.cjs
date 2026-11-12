'use strict';
/**
 * Shared patch engine for arabic-rtl-fixer (Windows & Linux / Arch / Omarchy).
 *
 * Appends lib/injection.js to dist/preload.js inside Antigravity's app.asar.
 * On Windows, also updates the ASAR integrity hash embedded in Antigravity.exe.
 * Used by both the sidecar (server.cjs) and the CLI (patch_antigravity_rtl.js).
 *
 * Backups (app.asar.bak / Antigravity.exe.bak) are always kept in sync with
 * the *currently installed* Antigravity version: whenever app.asar does not
 * contain our marker (fresh install or after an Antigravity auto-update), the
 * backups are refreshed before patching. This prevents an old-version backup
 * from ever being written over a newer Antigravity.
 */

const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const nodeFs = require('node:fs');

// Electron (agy-node) ships 'original-fs', which bypasses the ASAR virtual FS.
let fs = nodeFs;
try { fs = require('original-fs'); } catch (_) { /* plain Node */ }

const MARKER_PREFIX = '/* === ANTIGRAVITY_RTL_BIDI_FIX_';
const MARKER = '/* === ANTIGRAVITY_RTL_BIDI_FIX_V6 === */';
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

function findAsarInDir(dir) {
    if (!dir) return null;
    const nested = path.join(dir, 'resources', 'app.asar');
    if (fs.existsSync(nested)) return { appDir: dir, asar: nested };
    const flat = path.join(dir, 'app.asar');
    if (fs.existsSync(flat)) return { appDir: dir, asar: flat };
    return null;
}

function findExeInDir(dir) {
    if (!dir) return null;
    const names = process.platform === 'win32'
        ? ['Antigravity.exe']
        : ['antigravity', 'Antigravity', 'antigravity-bin'];
    for (const name of names) {
        const candidate = path.join(dir, name);
        try {
            const st = fs.statSync(candidate);
            if (st.isFile() && st.size > 1024 * 1024) return candidate; // skip tiny shell wrappers
        } catch (_) {}
    }
    return null;
}

function resolveFromLinuxPath() {
    const pathEntries = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
    const binNames = ['antigravity', 'google-antigravity'];
    const discoveredDirs = [];

    for (const dir of pathEntries) {
        for (const name of binNames) {
            const full = path.join(dir, name);
            if (!fs.existsSync(full)) continue;
            try {
                const real = fs.realpathSync(full);
                discoveredDirs.push(path.dirname(real), path.dirname(path.dirname(real)));
                const st = fs.statSync(real);
                if (st.isFile() && st.size < 16384) {
                    const text = fs.readFileSync(real, 'utf8');
                    const matches = text.match(/\/[^\s"'`$]+(?:antigravity|Antigravity)[^\s"'`$;]*/g) || [];
                    for (const m of matches) {
                        const cleaned = m.replace(/\/app\.asar$/, '').replace(/\/resources$/, '');
                        discoveredDirs.push(cleaned, path.dirname(cleaned));
                    }
                }
            } catch (_) {}
        }
    }
    return discoveredDirs;
}

function findInstallation() {
    if (process.env.ANTIGRAVITY_ASAR && fs.existsSync(process.env.ANTIGRAVITY_ASAR)) {
        const asar = path.resolve(process.env.ANTIGRAVITY_ASAR);
        const parent = path.dirname(asar);
        const appDir = path.basename(parent) === 'resources' ? path.dirname(parent) : parent;
        return { appDir, asar, exe: findExeInDir(appDir) };
    }

    const candidates = [];
    if (process.env.ANTIGRAVITY_DIR) candidates.push(process.env.ANTIGRAVITY_DIR);

    if (process.platform === 'win32') {
        const localAppData = process.env.LOCALAPPDATA ||
            path.join(process.env.USERPROFILE || os.homedir(), 'AppData', 'Local');
        const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
        candidates.push(
            path.join(localAppData, 'Programs', 'antigravity'),
            path.join(localAppData, 'antigravity'),
            path.join(programFiles, 'antigravity'),
            path.join(programFiles, 'Antigravity'),
        );
    } else {
        const home = os.homedir();
        candidates.push(
            '/opt/antigravity',
            '/opt/Antigravity',
            '/opt/google/antigravity',
            '/usr/lib/antigravity',
            '/usr/lib/Antigravity',
            '/usr/share/antigravity',
            path.join(home, '.local', 'share', 'antigravity'),
            path.join(home, '.local', 'opt', 'antigravity'),
            ...resolveFromLinuxPath(),
        );
    }

    const seen = new Set();
    for (const dir of candidates) {
        if (!dir || seen.has(dir)) continue;
        seen.add(dir);
        const found = findAsarInDir(dir);
        if (found) {
            return { ...found, exe: findExeInDir(found.appDir) };
        }
    }
    return null;
}

function getAntigravityDir() {
    const inst = findInstallation();
    return inst ? inst.appDir : null;
}

function getPaths() {
    const inst = findInstallation();
    if (!inst) throw new Error('Antigravity installation not found.');
    const requireExeIntegrity = process.platform === 'win32';
    return {
        appDir: inst.appDir,
        asar: inst.asar,
        asarBak: `${inst.asar}.bak`,
        exe: inst.exe,
        exeBak: inst.exe ? `${inst.exe}.bak` : null,
        requireExeIntegrity,
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
            const hasBackup = fs.existsSync(p.asarBak) && (!p.requireExeIntegrity || (p.exeBak && fs.existsSync(p.exeBak)));
            return {
                installed,
                outdated: !installed && asar.preload.includes(MARKER_PREFIX),
                hasBackup,
                appVersion: asar.appVersion,
                platform: process.platform,
                appDir: p.appDir,
            };
        } catch (e) {
            return {
                installed: false,
                outdated: false,
                hasBackup: false,
                appVersion: null,
                platform: process.platform,
                error: e.message,
            };
        }
    });
}

function wrapPermissionError(err, targetPath) {
    if (err && (err.code === 'EACCES' || err.code === 'EPERM') && process.platform !== 'win32') {
        const cli = path.resolve(__dirname, '..', 'patch_antigravity_rtl.js');
        return new Error(`Permission denied writing ${targetPath}. Run once with sudo:\n  sudo node "${cli}"`);
    }
    return err;
}

/**
 * Makes sure *.bak files are clean copies of the currently installed version.
 * Returns the parsed clean ASAR from the backup.
 */
function syncBackups(p) {
    const current = readAsar(fs.readFileSync(p.asar));
    if (!current.preload.includes(MARKER_PREFIX)) {
        // Unpatched (fresh install or Antigravity just auto-updated): refresh backups.
        try {
            fs.copyFileSync(p.asar, p.asarBak);
            if (p.exe && p.exeBak) fs.copyFileSync(p.exe, p.exeBak);
        } catch (err) {
            throw wrapPermissionError(err, p.asarBak);
        }
    } else if (!fs.existsSync(p.asarBak) || (p.requireExeIntegrity && (!p.exeBak || !fs.existsSync(p.exeBak)))) {
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
    try {
        const fd = fs.openSync(target, 'r+');
        try {
            fs.writeSync(fd, data, 0, data.length, 0);
            fs.ftruncateSync(fd, data.length);
        } finally {
            fs.closeSync(fd);
        }
    } catch (err) {
        throw wrapPermissionError(err, target);
    }
}

function replaceExe(exePath, bytes) {
    if (!exePath || !bytes) return;
    if (fs.existsSync(exePath)) {
        try {
            const current = fs.readFileSync(exePath);
            if (current.equals(bytes)) return;
        } catch (_) {}
    }
    try {
        fs.writeFileSync(exePath, bytes);
        return;
    } catch (err) {
        if (process.platform !== 'win32' && (err.code === 'EACCES' || err.code === 'EPERM')) {
            throw wrapPermissionError(err, exePath);
        }
    }

    const dir = path.dirname(exePath);
    const base = path.basename(exePath);
    try {
        for (const f of fs.readdirSync(dir)) {
            if (f.startsWith(`${base}.old_`) || f === `${base}.running_old`) {
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

        // Update ASAR integrity hash in binary when required (Windows) or present (optional on Linux).
        let patchedExeBytes = null;
        if (p.exeBak && fs.existsSync(p.exeBak)) {
            const exeBytes = fs.readFileSync(p.exeBak);
            const idx = exeBytes.indexOf(Buffer.from(clean.headerHash, 'ascii'));
            if (idx !== -1) {
                Buffer.from(sha256(headerJson), 'ascii').copy(exeBytes, idx);
                patchedExeBytes = exeBytes;
            } else if (p.requireExeIntegrity) {
                throw new Error('ASAR integrity hash not found in Antigravity.exe.bak. This Antigravity build is not supported yet.');
            }
        } else if (p.requireExeIntegrity) {
            throw new Error('Antigravity.exe.bak is missing. Reinstall Antigravity, then apply again.');
        }

        if (patchedExeBytes && p.exe) {
            replaceExe(p.exe, patchedExeBytes);
        }
        try {
            writeFileInPlace(p.asar, newAsar);
        } catch (e) {
            if (patchedExeBytes && p.exe && p.exeBak && fs.existsSync(p.exeBak)) {
                replaceExe(p.exe, fs.readFileSync(p.exeBak)); // roll back to a consistent pair
            }
            throw e;
        }
        return checkStatus();
    });
}

function restoreOriginal() {
    return withRawAsar(() => {
        const p = getPaths();
        if (!fs.existsSync(p.asarBak)) {
            throw new Error('No backups found; nothing to restore.');
        }
        const current = readAsar(fs.readFileSync(p.asar));
        if (!current.preload.includes(MARKER_PREFIX)) {
            return checkStatus(); // already original (maybe a newer version): never downgrade
        }
        if (p.exe && p.exeBak && fs.existsSync(p.exeBak)) {
            replaceExe(p.exe, fs.readFileSync(p.exeBak));
        }
        writeFileInPlace(p.asar, fs.readFileSync(p.asarBak));
        return checkStatus();
    });
}

module.exports = { MARKER, checkStatus, applyPatch, restoreOriginal, getAntigravityDir, getPaths };
