'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    compareVersions,
    readSettings,
    writeSettings,
    ensurePatched,
} = require('../sidecars/rtl_fixer_panel/server.cjs');

test('compareVersions handles multi-digit semver segments cleanly', () => {
    assert.equal(compareVersions('1.5.0', '1.4.5'), 1);
    assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
    assert.equal(compareVersions('1.5.0', '1.5.0'), 0);
    assert.equal(compareVersions('1.4.5', '1.5.0'), -1);
});

test('readSettings returns defaults and writeSettings persists atomically', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtl-settings-'));
    try {
        const file = path.join(dir, 'settings.json');
        assert.deepEqual(readSettings(file).autoReapply, true);
        assert.deepEqual(readSettings(file).autoUpdate, true);

        writeSettings({ autoUpdate: false, pausedByRestore: true, pausedAppVersion: '2.31.2' }, file);
        const loaded = readSettings(file);
        assert.equal(loaded.autoReapply, true);
        assert.equal(loaded.autoUpdate, false);
        assert.equal(loaded.pausedByRestore, true);
        assert.equal(loaded.pausedAppVersion, '2.31.2');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('ensurePatched auto-reapplies when unpatched unless user explicitly restored current version', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtl-autopatch-'));
    try {
        const file = path.join(dir, 'settings.json');
        let applyCalls = 0;
        let currentVersion = '2.31.2';
        let installed = false;

        const fakePatcher = {
            getPaths: () => ({ asar: path.join(dir, 'missing.asar') }),
            checkStatus: () => ({ installed, outdated: false, appVersion: currentVersion, hasBackup: true }),
            applyPatch: () => {
                applyCalls++;
                installed = true;
                return { installed: true, outdated: false, appVersion: currentVersion, hasBackup: true };
            },
        };

        // Case 1: Fresh unpatched startup -> auto-applies immediately.
        const res1 = ensurePatched('startup', { patcher: fakePatcher, settingsFile: file });
        assert.equal(res1.action, 'applied');
        assert.equal(applyCalls, 1);

        // Case 2: User clicks Restore on 2.31.2 -> watcher/startup must NOT override restore on 2.31.2.
        installed = false;
        writeSettings({ pausedByRestore: true, pausedAppVersion: '2.31.2' }, file);
        const res2 = ensurePatched('watch', { patcher: fakePatcher, settingsFile: file });
        assert.equal(res2.action, 'paused');
        assert.equal(applyCalls, 1);

        // Case 3: Antigravity updates to 2.32.0 -> pause clears and patch auto-reapplies!
        currentVersion = '2.32.0';
        const res3 = ensurePatched('watch', { patcher: fakePatcher, settingsFile: file });
        assert.equal(res3.action, 'applied');
        assert.equal(applyCalls, 2);
        assert.equal(readSettings(file).pausedByRestore, false);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
