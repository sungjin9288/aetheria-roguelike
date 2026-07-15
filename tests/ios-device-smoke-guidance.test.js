import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('iOS device smoke explains the device trust handoff after install', async () => {
    const script = await readFile(new URL('../scripts/ios-device-smoke.sh', import.meta.url), 'utf8');
    const guidanceBlock = script.slice(script.indexOf('explain_launch_failure()'));

    assert.match(guidanceBlock, /not been explicitly trusted\|Untrusted Developer/);
    assert.match(guidanceBlock, /Settings > General > VPN & Device Management > Developer App/);
    assert.match(guidanceBlock, /then rerun ios:device:smoke/);
    assert.match(guidanceBlock, /explain_launch_failure "\$launch_log"\n  exit 1/);
});

test('iOS device smoke explains the locked-device handoff after install', async () => {
    const script = await readFile(new URL('../scripts/ios-device-smoke.sh', import.meta.url), 'utf8');
    const guidanceBlock = script.slice(script.indexOf('explain_launch_failure()'));

    assert.match(guidanceBlock, /Locked\|device was not, or could not be, unlocked/);
    assert.match(guidanceBlock, /iOS blocked launch because the iPhone is locked/);
    assert.match(guidanceBlock, /Unlock the iPhone, keep the screen awake, leave the app in the foreground/);
});

test('iOS device smoke removes temporary diagnostics on every exit path', async () => {
    const script = await readFile(new URL('../scripts/ios-device-smoke.sh', import.meta.url), 'utf8');

    assert.match(script, /cleanup_temp_files\(\)/);
    assert.match(script, /remove_temp_file "\$launch_log"/);
    assert.match(script, /remove_temp_file "\$process_snapshot"/);
    assert.match(script, /trap cleanup_temp_files EXIT/);
});

test('iOS device smoke preserves timeout diagnostics when process cleanup is denied', async () => {
    const script = await readFile(new URL('../scripts/ios-device-smoke.sh', import.meta.url), 'utf8');
    const timeoutBlock = script.slice(script.indexOf('if Time.now > deadline'), script.indexOf('sleep 0.2'));

    assert.equal((timeoutBlock.match(/Errno::ESRCH, Errno::EPERM/g) || []).length, 2);
    assert.match(timeoutBlock, /command timed out after #\{timeout_seconds\}s/);
    assert.match(timeoutBlock, /exit 124/);
});
