import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);

test('App Store export stays local while the upload profile remains explicit', async () => {
    const [localExport, uploadExport] = await Promise.all([
        readFile(new URL('ios/ExportOptions/AppStore.plist', root), 'utf8'),
        readFile(new URL('ios/ExportOptions.plist', root), 'utf8')
    ]);

    assert.match(localExport, /<key>destination<\/key>\s*<string>export<\/string>/);
    assert.match(localExport, /<key>method<\/key>\s*<string>app-store-connect<\/string>/);
    assert.match(uploadExport, /<key>destination<\/key>\s*<string>upload<\/string>/);
});

test('iOS archive refuses an App Store Connect upload without explicit approval', () => {
    const result = spawnSync('bash', ['scripts/ios-archive.sh'], {
        cwd: root,
        encoding: 'utf8',
        env: {
            ...process.env,
            AETHERIA_IOS_EXPORT_OPTIONS_PLIST: 'ios/ExportOptions.plist',
            AETHERIA_IOS_ALLOW_UPLOAD: ''
        }
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /request an App Store Connect upload/);
    assert.match(result.stderr, /AETHERIA_IOS_ALLOW_UPLOAD=1/);
    assert.doesNotMatch(result.stdout, /ARCHIVE SUCCEEDED/);
});

test('automatic provisioning is applied to both archive and export commands', async () => {
    const [archiveScript, doctorScript] = await Promise.all([
        readFile(new URL('scripts/ios-archive.sh', root), 'utf8'),
        readFile(new URL('scripts/mobile-doctor.sh', root), 'utf8')
    ]);

    assert.match(archiveScript, /archive_cmd\+=\(-allowProvisioningUpdates\)/);
    assert.match(archiveScript, /export_cmd\+=\(-allowProvisioningUpdates\)/);
    assert.match(archiveScript, /export_destination.*upload/);
    assert.match(doctorScript, /iOS local distribution signing/);
    assert.match(doctorScript, /iOS local App Store export profile/);
});
