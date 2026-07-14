import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('iOS device smoke explains the device trust handoff after install', async () => {
    const script = await readFile(new URL('../scripts/ios-device-smoke.sh', import.meta.url), 'utf8');
    const launchBlock = script.slice(script.indexOf('launch_log="$(mktemp)"'));

    assert.match(launchBlock, /not been explicitly trusted\|Untrusted Developer/);
    assert.match(launchBlock, /Settings > General > VPN & Device Management > Developer App/);
    assert.match(launchBlock, /then rerun ios:device:smoke/);
    assert.match(launchBlock, /rm -f "\$launch_log"\n  exit 1/);
});

test('iOS device smoke preserves timeout diagnostics when process cleanup is denied', async () => {
    const script = await readFile(new URL('../scripts/ios-device-smoke.sh', import.meta.url), 'utf8');
    const timeoutBlock = script.slice(script.indexOf('if Time.now > deadline'), script.indexOf('sleep 0.2'));

    assert.equal((timeoutBlock.match(/Errno::ESRCH, Errno::EPERM/g) || []).length, 2);
    assert.match(timeoutBlock, /command timed out after #\{timeout_seconds\}s/);
    assert.match(timeoutBlock, /exit 124/);
});
