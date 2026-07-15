import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('iOS device smoke explains the device trust handoff after install', async () => {
    const script = await readFile(new URL('../scripts/ios-device-smoke.sh', import.meta.url), 'utf8');
    const guidanceBlock = script.slice(script.indexOf('explain_device_failure()'));

    assert.match(guidanceBlock, /not been explicitly trusted\|Untrusted Developer/);
    assert.match(guidanceBlock, /Settings > General > VPN & Device Management > Developer App/);
    assert.match(guidanceBlock, /then rerun ios:device:smoke/);
    assert.match(guidanceBlock, /run_required_device_step "launch app"/);
});

test('iOS device smoke explains a locked device at every required step', async () => {
    const script = await readFile(new URL('../scripts/ios-device-smoke.sh', import.meta.url), 'utf8');
    const guidanceBlock = script.slice(script.indexOf('device_is_locked()'));

    assert.match(guidanceBlock, /Locked\|device was not, or could not be, unlocked/);
    assert.match(guidanceBlock, /iOS blocked %s because the device is locked/);
    assert.match(guidanceBlock, /Unlock the iPhone or iPad, keep the screen awake, leave the app in the foreground/);
    assert.match(guidanceBlock, /run_required_device_step "install app"/);
    assert.match(guidanceBlock, /run_required_device_step "metadata after install"/);
    assert.match(guidanceBlock, /run_required_device_step "launch app"/);
});

test('iOS device smoke stops before install when pre-install metadata finds a locked device', async () => {
    const script = await readFile(new URL('../scripts/ios-device-smoke.sh', import.meta.url), 'utf8');
    const metadataBlock = script.slice(
        script.indexOf('diagnostic_log="$(mktemp)"', script.indexOf('log_step "xcdevice availability"')),
        script.indexOf('run_required_device_step "install app"')
    );

    assert.match(metadataBlock, /device_is_locked "\$diagnostic_log"/);
    assert.match(metadataBlock, /explain_device_failure "\$diagnostic_log" "metadata before install"/);
    assert.match(metadataBlock, /exit 1/);
});

test('iOS device smoke removes temporary diagnostics on every exit path', async () => {
    const script = await readFile(new URL('../scripts/ios-device-smoke.sh', import.meta.url), 'utf8');

    assert.match(script, /cleanup_temp_files\(\)/);
    assert.match(script, /remove_temp_file "\$diagnostic_log"/);
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
