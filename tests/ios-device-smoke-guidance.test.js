import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('iOS launch smoke is exposed in package scripts and release checklists', async () => {
    const [packageJson, releaseGuide, playtestChecklist] = await Promise.all([
        readFile(new URL('../package.json', import.meta.url), 'utf8'),
        readFile(new URL('../docs/MOBILE_RELEASE.md', import.meta.url), 'utf8'),
        readFile(new URL('../docs/PLAYTEST_CHECKLIST.md', import.meta.url), 'utf8'),
    ]);

    assert.match(packageJson, /"ios:device:launch-smoke": "AETHERIA_IOS_REUSE_INSTALLED_APP=1 bash scripts\/ios-device-smoke\.sh"/);
    assert.match(releaseGuide, /npm run ios:device:launch-smoke/);
    assert.match(playtestChecklist, /npm run ios:device:launch-smoke/);
});

test('iOS device smoke allows enough time for the current native app install', async () => {
    const script = await readFile(new URL('../scripts/ios-device-smoke.sh', import.meta.url), 'utf8');

    assert.match(script, /AETHERIA_DEVICECTL_TIMEOUT_SECONDS:-120/);
});

test('iOS device smoke explains the device trust handoff after install', async () => {
    const script = await readFile(new URL('../scripts/ios-device-smoke.sh', import.meta.url), 'utf8');
    const guidanceBlock = script.slice(script.indexOf('explain_device_failure()'));

    assert.match(guidanceBlock, /not been explicitly trusted\|Untrusted Developer/);
    assert.match(guidanceBlock, /Settings > General > VPN & Device Management > Developer App/);
    assert.match(guidanceBlock, /then run %s/);
    assert.match(guidanceBlock, /RERUN_COMMAND/);
    assert.match(guidanceBlock, /run_required_device_step "launch app"/);
});

test('iOS device smoke explains a locked device at every required step', async () => {
    const script = await readFile(new URL('../scripts/ios-device-smoke.sh', import.meta.url), 'utf8');
    const guidanceBlock = script.slice(script.indexOf('device_is_locked()'));

    assert.match(guidanceBlock, /Locked\|device was not, or could not be, unlocked/);
    assert.match(guidanceBlock, /iOS blocked %s because the device is locked/);
    assert.match(guidanceBlock, /Unlock the iPhone or iPad, keep the screen awake, then run %s/);
    assert.match(guidanceBlock, /Confirm foreground visibility separately/);
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
    assert.match(script, /remove_temp_file "\$metadata_receipt"/);
    assert.match(script, /remove_temp_file "\$launch_receipt"/);
    assert.match(script, /trap cleanup_temp_files EXIT/);
});

test('iOS device smoke preserves timeout diagnostics when process cleanup is denied', async () => {
    const script = await readFile(new URL('../scripts/ios-device-smoke.sh', import.meta.url), 'utf8');
    const timeoutBlock = script.slice(script.indexOf('if Time.now > deadline'), script.indexOf('sleep 0.2'));

    assert.equal((timeoutBlock.match(/Errno::ESRCH, Errno::EPERM/g) || []).length, 2);
    assert.match(timeoutBlock, /command timed out after #\{timeout_seconds\}s/);
    assert.match(timeoutBlock, /exit 124/);
});

const bundleId = 'com.aetheria.roguelike';
const appUrl = 'file:///private/var/containers/Bundle/Application/fixture/App.app/';
const executable = `${appUrl}App`;
const deviceIdentifier = 'fixture-device';
const receipt = (command, result) => ({
    info: { commandType: `devicectl.device.${command}`, outcome: 'success', jsonVersion: 3 },
    result: { deviceIdentifier, ...result },
});
const metadata = () => receipt('info.apps', { apps: [{ bundleIdentifier: bundleId, url: appUrl }] });
const launch = () => receipt('process.launch', { process: { processIdentifier: 4242, executable } });
const processes = (entries = [{ processIdentifier: 4242, executable }]) => receipt('info.processes', { runningProcesses: entries });

async function runSmokeFixture(overrides = {}, reuseInstalled = true) {
    const fixtureDir = await mkdtemp(join(tmpdir(), 'aetheria-ios-launch-smoke-'));
    const xcrunPath = join(fixtureDir, 'xcrun');
    const commandLog = join(fixtureDir, 'commands.log');
    const scratchDir = join(fixtureDir, 'scratch');
    const smokePath = new URL('../scripts/ios-device-smoke.sh', import.meta.url);
    const xcrunFixture = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const previous = fs.existsSync(process.env.XCRUN_LOG) ? fs.readFileSync(process.env.XCRUN_LOG, 'utf8') : '';
fs.appendFileSync(process.env.XCRUN_LOG, args.join(' ') + '\\n');
const plan = JSON.parse(process.env.XCRUN_PLAN);
const command = args.slice(0, 4).join(' ');
let result;
if (command === 'devicectl device info apps') result = previous.includes('device info apps') && Object.hasOwn(plan, 'afterMetadata') ? plan.afterMetadata : plan.metadata;
if (command === 'devicectl device process launch') result = plan.launch;
if (command === 'devicectl device info processes') result = plan.probes[(previous.match(/device info processes/g) || []).length];
const index = args.indexOf('--json-output');
if (index !== -1 && result !== null && result !== undefined) fs.writeFileSync(args[index + 1], typeof result === 'string' ? result : JSON.stringify(result));
// Human-readable output intentionally looks valid even when structured evidence is bad.
console.log('Aetheria Roguelike com.aetheria.roguelike 4242 /private/var/containers/Bundle/Application/unrelated/App.app/App');
`;

    try {
        await mkdir(scratchDir);
        await writeFile(xcrunPath, xcrunFixture);
        await chmod(xcrunPath, 0o755);

        const result = spawnSync('bash', [smokePath.pathname], {
            encoding: 'utf8',
            env: {
                ...process.env,
                PATH: `${fixtureDir}:${process.env.PATH}`,
                TMPDIR: scratchDir,
                XCRUN_LOG: commandLog,
                XCRUN_PLAN: JSON.stringify({ metadata: metadata(), launch: launch(), probes: [processes(), processes()], ...overrides }),
                AETHERIA_IOS_REUSE_INSTALLED_APP: reuseInstalled ? '1' : '0',
                AETHERIA_IOS_APP_PATH: fixtureDir,
                AETHERIA_IOS_BUNDLE_ID: bundleId,
                AETHERIA_IOS_PROCESS_HOLD_SECONDS: '0',
            },
        });
        const commands = await readFile(commandLog, 'utf8');
        assert.deepEqual(await readdir(scratchDir), [], 'temporary receipts must be removed on every exit');
        return { result, commands };
    } finally {
        await rm(fixtureDir, { recursive: true, force: true });
    }
}

test('iOS launch smoke reuses an installed app and verifies the same PID and executable twice', async () => {
    const { result, commands } = await runSmokeFixture();
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /delivery mode: reuse installed app/);
    assert.match(result.stdout, /\[ios-device-smoke\] reuse installed app/);
    assert.match(result.stdout, /\[ios-device-smoke\] process hold 0s/);
    assert.match(result.stdout, /\[ios-device-smoke\] process hold passed/);
    assert.match(result.stdout, /devicectl cannot prove foreground visibility/);
    assert.match(result.stdout, /\[ios-device-smoke\] done/);
    assert.doesNotMatch(commands, /device install app/);
    assert.equal((commands.match(/device info processes/g) || []).length, 2);
    assert.equal((commands.match(/--json-output/g) || []).length, 4);
    assert.equal((result.stdout.match(/verified process 4242/g) || []).length, 2);
});

test('iOS launch smoke refuses to continue when the installed bundle is absent', async () => {
    const { result, commands } = await runSmokeFixture({ metadata: receipt('info.apps', { apps: [] }) });
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(commands, /device install app|device process launch/);
});

test('iOS install smoke binds the post-install bundle metadata to the launched process', async () => {
    const { result, commands } = await runSmokeFixture({}, false);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal((commands.match(/device install app/g) || []).length, 1);
    assert.equal((commands.match(/device info apps/g) || []).length, 2);
});

test('iOS install smoke refuses stale pre-install metadata when post-install JSON is missing', async () => {
    const { result, commands } = await runSmokeFixture({ afterMetadata: null }, false);
    assert.notEqual(result.status, 0);
    assert.equal((commands.match(/device install app/g) || []).length, 1);
    assert.doesNotMatch(commands, /device process launch/);
});

for (const [label, badReceipt] of [
    ['missing', null],
    ['malformed', '{'],
    ['failed outcome', { ...launch(), info: { commandType: 'devicectl.device.process.launch', outcome: 'failed' } }],
    ['wrong command', { ...launch(), info: { commandType: 'devicectl.device.info.apps', outcome: 'success' } }],
    ['invalid PID', receipt('process.launch', { process: { processIdentifier: '4242', executable } })],
    ['missing executable', receipt('process.launch', { process: { processIdentifier: 4242 } })],
    ['other installed app', receipt('process.launch', { process: { processIdentifier: 4242, executable: 'file:///private/var/containers/Bundle/Application/other/App.app/App' } })],
    ['path traversal', receipt('process.launch', { process: { processIdentifier: 4242, executable: `${appUrl}../other/App` } })],
]) {
    test(`iOS launch smoke rejects ${label} launch evidence before probing`, async () => {
        const { result, commands } = await runSmokeFixture({ launch: badReceipt });
        assert.notEqual(result.status, 0);
        assert.doesNotMatch(commands, /device info processes|device install app/);
    });
}

for (const [label, entries] of [
    ['different PID', [{ processIdentifier: 9999, executable }]],
    ['different App.app path', [{ processIdentifier: 4242, executable: 'file:///other/App.app/App' }]],
    ['duplicate PID', [{ processIdentifier: 4242, executable }, { processIdentifier: 4242, executable }]],
    ['missing PID', [{ executable }]],
    ['missing executable', [{ processIdentifier: 4242 }]],
    ['no processes', []],
]) {
    for (const probe of ['first', 'hold']) {
        test(`iOS launch smoke rejects ${label} in the ${probe} probe`, async () => {
            const bad = processes(entries);
            const { result, commands } = await runSmokeFixture({ probes: probe === 'first' ? [bad, processes()] : [processes(), bad] });
            assert.notEqual(result.status, 0);
            assert.doesNotMatch(result.stdout, /process hold passed/);
            assert.doesNotMatch(commands, /device install app/);
            assert.match(result.stderr, /cause is unknown/);
        });
    }
}

for (const bad of [null, '{', receipt('info.processes', {}), { ...processes(), result: { ...processes().result, deviceIdentifier: 'other-device' } }]) {
    test(`iOS launch smoke rejects invalid process receipt ${JSON.stringify(bad)}`, async () => {
        const { result } = await runSmokeFixture({ probes: [processes(), bad] });
        assert.notEqual(result.status, 0);
        assert.doesNotMatch(result.stdout, /process hold passed/);
    });
}
