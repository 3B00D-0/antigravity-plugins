#!/usr/bin/env node
/**
 * Command-line entry point for arabic-rtl-fixer.
 *
 * Run with Antigravity's bundled runtime (no Node/Python install needed):
 *   set ELECTRON_RUN_AS_NODE=1
 *   "%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe" patch_antigravity_rtl.js [--restore | --status]
 */
'use strict';

const patcher = require('./lib/patcher.cjs');

function print(st) {
    if (st.error) {
        console.error('[!] ' + st.error);
        process.exitCode = 1;
        return;
    }
    console.log(`[*] Antigravity ${st.appVersion || '(unknown version)'}`);
    console.log(`[*] RTL fix: ${st.installed ? 'active' : st.outdated ? 'outdated' : 'not applied'}`);
    console.log(`[*] Backups: ${st.hasBackup ? 'present' : 'missing'}`);
}

try {
    if (process.argv.includes('--status')) {
        print(patcher.checkStatus());
    } else if (process.argv.includes('--restore')) {
        print(patcher.restoreOriginal());
        console.log('\n[OK] Original files restored. Restart Antigravity.');
    } else {
        print(patcher.applyPatch());
        console.log('\n[OK] Arabic / RTL fix applied. Restart Antigravity to load it.');
    }
} catch (e) {
    console.error('[!] ' + e.message);
    process.exitCode = 1;
}
