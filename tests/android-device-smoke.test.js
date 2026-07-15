import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const readSmokeScript = () => readFile(
    new URL('../scripts/android-device-smoke.sh', import.meta.url),
    'utf8'
);

test('Android device smoke is exposed through package scripts with overridable delivery inputs', async () => {
    const [script, packageJson] = await Promise.all([
        readSmokeScript(),
        readFile(new URL('../package.json', import.meta.url), 'utf8')
    ]);

    assert.match(packageJson, /"android:device:smoke": "bash scripts\/android-device-smoke\.sh"/);
    assert.match(script, /AETHERIA_ANDROID_APK_PATH/);
    assert.match(script, /AETHERIA_ANDROID_DEVICE_SERIAL/);
    assert.match(script, /AETHERIA_ANDROID_PROCESS_HOLD_SECONDS/);
    assert.match(script, /AETHERIA_ANDROID_PACKAGE_ID/);
});

test('Android device smoke defaults to one ready physical device and requires emulator opt-in', async () => {
    const script = await readSmokeScript();

    assert.match(script, /device_is_emulator\(\)/);
    assert.match(script, /AETHERIA_ANDROID_ALLOW_EMULATOR/);
    assert.match(script, /No ready physical Android device was found/);
    assert.match(script, /Multiple Android devices are ready/);
    assert.match(script, /Android device authorization is pending/);
});

test('Android device smoke preserves saves while proving install launch and foreground hold', async () => {
    const script = await readSmokeScript();

    assert.match(script, /install -r "\$APK_PATH"/);
    assert.match(script, /shell am start -W -n "\$PACKAGE_ID\/\$ACTIVITY"/);
    assert.match(script, /shell pidof "\$PACKAGE_ID"/);
    assert.match(script, /mResumedActivity\|topResumedActivity\|ResumedActivity/);
    assert.match(script, /hold \$\{PROCESS_HOLD_SECONDS\}s/);
    assert.match(script, /INSTALL_FAILED_INSUFFICIENT_STORAGE\|not enough space/);
    assert.match(script, /INSTALL_FAILED_UPDATE_INCOMPATIBLE\|signatures do not match\|different signature/);
    assert.match(script, /trap cleanup_temp_files EXIT/);
    assert.doesNotMatch(script, /pm clear| uninstall /);
});

test('Android release and playtest docs use the repository device smoke entrypoint', async () => {
    const [releaseGuide, checklist] = await Promise.all([
        readFile(new URL('../docs/MOBILE_RELEASE.md', import.meta.url), 'utf8'),
        readFile(new URL('../docs/PLAYTEST_CHECKLIST.md', import.meta.url), 'utf8')
    ]);

    assert.match(releaseGuide, /npm run android:device:smoke/);
    assert.match(checklist, /npm run android:device:smoke/);
});

test('Android device smoke completes install launch and hold against one ready physical device', async () => {
    const fixtureDir = await mkdtemp(join(tmpdir(), 'aetheria-android-smoke-'));
    const adbPath = join(fixtureDir, 'adb');
    const apkPath = join(fixtureDir, 'app-debug.apk');
    const smokePath = new URL('../scripts/android-device-smoke.sh', import.meta.url);
    const adbFixture = `#!/bin/sh
if [ "$1" = "devices" ]; then
  printf 'List of devices attached\\nPHYSICAL123\\tdevice\\n'
  exit 0
fi

if [ "$1" = "-s" ]; then
  shift 2
fi

if [ "$1" = "get-state" ]; then
  printf 'device\\n'
elif [ "$1" = "install" ]; then
  printf 'Success\\n'
elif [ "$1" = "shell" ] && [ "$2" = "getprop" ] && [ "$3" = "ro.kernel.qemu" ]; then
  printf '0\\n'
elif [ "$1" = "shell" ] && [ "$2" = "getprop" ] && [ "$3" = "ro.product.model" ]; then
  printf 'Pixel Test\\n'
elif [ "$1" = "shell" ] && [ "$2" = "getprop" ] && [ "$3" = "ro.build.version.release" ]; then
  printf '16\\n'
elif [ "$1" = "shell" ] && [ "$2" = "am" ] && [ "$3" = "start" ]; then
  printf 'Status: ok\\nActivity: com.aetheria.roguelike/.MainActivity\\n'
elif [ "$1" = "shell" ] && [ "$2" = "pidof" ]; then
  printf '4242\\n'
elif [ "$1" = "shell" ] && [ "$2" = "dumpsys" ]; then
  printf 'mResumedActivity: ActivityRecord{test com.aetheria.roguelike/.MainActivity}\\n'
fi
`;

    try {
        await writeFile(adbPath, adbFixture);
        await writeFile(apkPath, 'fixture');
        await chmod(adbPath, 0o755);

        const result = spawnSync('bash', [smokePath.pathname], {
            encoding: 'utf8',
            env: {
                ...process.env,
                AETHERIA_ADB_PATH: adbPath,
                AETHERIA_ANDROID_APK_PATH: apkPath,
                AETHERIA_ANDROID_PROCESS_HOLD_SECONDS: '0'
            }
        });

        assert.equal(result.status, 0, result.stderr || result.stdout);
        assert.match(result.stdout, /device serial: PHYSICAL123/);
        assert.match(result.stdout, /foreground pid: 4242/);
        assert.match(result.stdout, /foreground pid after hold: 4242/);
        assert.match(result.stdout, /\[android-device-smoke\] done/);
    } finally {
        await rm(fixtureDir, { recursive: true, force: true });
    }
});
