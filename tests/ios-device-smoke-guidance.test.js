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
