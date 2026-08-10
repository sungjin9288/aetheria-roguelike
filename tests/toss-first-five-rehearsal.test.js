import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Toss first-five rehearsal is an isolated device QA runtime', async () => {
    const [runtimeMode, snapshots, app, testApi, buildGuard] = await Promise.all([
        read('src/utils/runtimeMode.ts'),
        read('src/utils/localGameSnapshot.ts'),
        read('src/App.tsx'),
        read('src/hooks/useGameTestApi.ts'),
        read('scripts/build-guard.mjs'),
    ]);

    assert.match(runtimeMode, /TOSS_FIRST_FIVE_DEVICE_QA_SCENARIO\s*=\s*\['toss', 'first-five'\]\.join\('-'\)/);
    assert.match(runtimeMode, /DEVICE_QA_SCENARIOS[\s\S]+TOSS_FIRST_FIVE_DEVICE_QA_SCENARIO/);
    assert.match(snapshots, /TOSS_FIRST_FIVE_DEVICE_QA_SNAPSHOT_KEY\s*=\s*deviceQaSnapshotKey/);
    assert.match(snapshots, /DEVICE_QA_NAMESPACE\s*=\s*\['aetheria', 'device-qa'\]\.join\('\.'\)/);
    assert.match(app, /VITE_DEVICE_QA_SCENARIO === 'toss-first-five'/);
    assert.match(testApi, /flushLocalSave:\s*\(\)\s*=>\s*engineRef\.current\.flushLocalSave\(\)/);
    assert.match(buildGuard, /'toss-first-five'/);
});

test('Toss first-five rehearsal uses the production smoke loop and proves return plus restore', async () => {
    const [packageJsonRaw, runner, smoke] = await Promise.all([
        read('package.json'),
        read('scripts/toss-first-five-rehearsal.sh'),
        read('scripts/smoke-gameplay.mjs'),
    ]);
    const packageJson = JSON.parse(packageJsonRaw);

    assert.equal(packageJson.scripts['toss:rehearse:first-five'], 'bash scripts/toss-first-five-rehearsal.sh');
    assert.match(runner, /VITE_PLATFORM_TARGET=toss/);
    assert.match(runner, /VITE_DEVICE_QA_SCENARIO=toss-first-five/);
    assert.match(runner, /VITE_ENABLE_TEST_API=1/);
    assert.match(runner, /AETHERIA_TOSS_BUNDLE_DIR=dist-toss-rehearsal/);
    assert.match(runner, /AETHERIA_TOSS_ALLOW_TEST_HARNESS=1/);
    assert.match(runner, /vite\.toss\.config\.js/);
    assert.match(runner, /kill -0 "\$\{PREVIEW_PID\}"/);
    assert.match(runner, /LOCAL_INDEX_SHA[\s\S]+REMOTE_INDEX_SHA[\s\S]+fingerprint mismatch/);
    assert.match(runner, /smoke-gameplay\.mjs[\s\S]+--first-five[\s\S]+--mobile/);

    assert.match(smoke, /args\.includes\('--first-five'\)/);
    assert.match(smoke, /first screen exceeded 10 seconds/i);
    assert.match(smoke, /first action exceeded 10 seconds/i);
    assert.match(smoke, /sendGameCommand\(page, 'move 시작의 마을'\)/);
    assert.match(smoke, /visibilitychange/);
    assert.doesNotMatch(smoke, /__AETHERIA_TEST_API__\?\.flushLocalSave/);
    assert.match(smoke, /aetheria\.game\.snapshot\.v2\.primary/);
    assert.match(smoke, /aetheria\.game\.snapshot\.v2\.staged/);
    assert.match(smoke, /first-five-production-primary-sentinel/);
    assert.match(smoke, /first-five-production-staged-sentinel/);
    assert.match(smoke, /page\.reload/);
    assert.match(smoke, /restored Toss first-five snapshot/);
    assert.match(smoke, /width:\s*390,\s*height:\s*844/);
    assert.match(smoke, /--aether-safe-area-top[\s\S]+47px/);
    assert.match(smoke, /--aether-safe-area-bottom[\s\S]+34px/);
    assert.match(smoke, /innerWidth === 390[\s\S]+innerHeight === 844/);
    assert.match(smoke, /scrollWidth:\s*document\.documentElement\.scrollWidth/);
    assert.match(smoke, /surface\.scrollWidth <= surface\.clientWidth/);
});
