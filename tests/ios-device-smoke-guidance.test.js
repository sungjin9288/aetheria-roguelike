import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
    assert.match(guidanceBlock, /Unlock the iPhone or iPad, keep the screen awake, then run %s and leave Aetheria in the foreground after it opens/);
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

test('iOS launch smoke reuses an installed app without running install again', async () => {
    const fixtureDir = await mkdtemp(join(tmpdir(), 'aetheria-ios-launch-smoke-'));
    const xcrunPath = join(fixtureDir, 'xcrun');
    const commandLog = join(fixtureDir, 'commands.log');
    const smokePath = new URL('../scripts/ios-device-smoke.sh', import.meta.url);
    const xcrunFixture = `#!/bin/sh
printf '%s\\n' "$*" >> "$XCRUN_LOG"
if [ "$1" = "xcdevice" ]; then
  printf 'fixture iPhone available\\n'
elif [ "$1 $2 $3 $4" = "devicectl device info apps" ]; then
  printf 'Aetheria Roguelike   com.aetheria.roguelike   1.1.0   2\\n'
elif [ "$1 $2 $3 $4" = "devicectl device process launch" ]; then
  printf 'Launched application with com.aetheria.roguelike bundle identifier.\\n'
elif [ "$1 $2 $3 $4" = "devicectl device info processes" ]; then
  printf '4242   /private/var/containers/Bundle/Application/fixture/App.app/App\\n'
fi
`;

    try {
        await writeFile(xcrunPath, xcrunFixture);
        await chmod(xcrunPath, 0o755);

        const result = spawnSync('bash', [smokePath.pathname], {
            encoding: 'utf8',
            env: {
                ...process.env,
                PATH: `${fixtureDir}:${process.env.PATH}`,
                XCRUN_LOG: commandLog,
                AETHERIA_IOS_REUSE_INSTALLED_APP: '1',
                AETHERIA_IOS_PROCESS_HOLD_SECONDS: '0',
            },
        });
        const commands = await readFile(commandLog, 'utf8');

        assert.equal(result.status, 0, result.stderr || result.stdout);
        assert.match(result.stdout, /delivery mode: reuse installed app/);
        assert.match(result.stdout, /\[ios-device-smoke\] reuse installed app/);
        assert.match(result.stdout, /\[ios-device-smoke\] done/);
        assert.doesNotMatch(commands, /device install app/);
        assert.equal((commands.match(/device info processes/g) || []).length, 2);
    } finally {
        await rm(fixtureDir, { recursive: true, force: true });
    }
});

test('iOS launch smoke refuses to continue when the installed bundle is absent', async () => {
    const script = await readFile(new URL('../scripts/ios-device-smoke.sh', import.meta.url), 'utf8');
    const guardStart = script.indexOf('if [[ "$REUSE_INSTALLED_APP" == "1" ]] && ! grep');
    const reuseGuard = script.slice(
        guardStart,
        script.indexOf('remove_temp_file "$diagnostic_log"', guardStart),
    );

    assert.match(reuseGuard, /Installed app %s was not found/);
    assert.match(reuseGuard, /npm run ios:device:smoke first/);
    assert.match(reuseGuard, /exit 1/);
});
