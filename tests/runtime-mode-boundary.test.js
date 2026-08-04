import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('URL test flags require an explicit harness build and device QA is allow-listed', async () => {
    const source = await readFile(new URL('../src/utils/runtimeMode.ts', import.meta.url), 'utf8');

    assert.match(source, /VITE_ENABLE_TEST_API === '1'/);
    assert.match(source, /isTestHarnessBuild\(\) && hasFlag\('smoke'\)/);
    assert.match(source, /isTestHarnessBuild\(\) && hasFlag\('e2e'\)/);
    assert.match(source, /DEVICE_QA_SCENARIOS\.has\(scenario\)/);
    assert.match(source, /GRAVE_RECOVERY_DEVICE_QA_SCENARIO/);
    assert.match(source, /ASCENSION_JOURNEY_DEVICE_QA_SCENARIO/);
    assert.match(source, /MIRROR_JOURNEY_DEVICE_QA_SCENARIO/);
    assert.match(source, /CRYSTAL_EXCHANGE_DEVICE_QA_SCENARIO/);
    assert.match(source, /SYSTEM_SETTINGS_DEVICE_QA_SCENARIO/);
    assert.match(source, /PROGRESSION_ACCEPTANCE_DEVICE_QA_SCENARIO/);
    assert.match(source, /isDeviceQaRuntime\(\)/);
});

test('test API registration is closed outside mock or isolated device QA runtimes', async () => {
    const source = await readFile(new URL('../src/hooks/useGameTestApi.ts', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

    assert.match(source, /typeof window === 'undefined' \|\| !isMockRuntime\(\)/);
    assert.match(source, /deviceQaScenario === ITEM_INVESTMENT_DEVICE_QA_SCENARIO/);
    assert.match(source, /deviceQaScenario === GRAVE_RECOVERY_DEVICE_QA_SCENARIO/);
    assert.match(source, /deviceQaScenario === ASCENSION_JOURNEY_DEVICE_QA_SCENARIO/);
    assert.match(source, /deviceQaScenario === MIRROR_JOURNEY_DEVICE_QA_SCENARIO/);
    assert.match(source, /deviceQaScenario === CRYSTAL_EXCHANGE_DEVICE_QA_SCENARIO/);
    assert.match(source, /deviceQaScenario === SYSTEM_SETTINGS_DEVICE_QA_SCENARIO/);
    assert.match(source, /deviceQaScenario === PROGRESSION_ACCEPTANCE_DEVICE_QA_SCENARIO/);
    assert.match(source, /readDeviceQaSnapshot\(undefined, deviceQaScenario\)/);
    assert.match(source, /if \(readDeviceQaSnapshot\(undefined, deviceQaScenario\)\) return;/);
    assert.match(source, /testApi\.seedItemInvestmentScenario\(\)/);
    assert.match(app, /const TEST_API_BUILD = import\.meta\.env\.VITE_ENABLE_TEST_API === '1'/);
    assert.match(app, /VITE_DEVICE_QA_SCENARIO === 'mirror-journey'/);
    assert.match(app, /VITE_DEVICE_QA_SCENARIO === 'crystal-exchange'/);
    assert.match(app, /VITE_DEVICE_QA_SCENARIO === 'system-settings'/);
    assert.match(app, /VITE_DEVICE_QA_SCENARIO === 'progression-acceptance'/);
    assert.match(app, /const useRuntimeGameTestApi = TEST_API_BUILD \? useGameTestApi : \(\) => undefined/);
});

test('material QA archive reuses the provisioned QA bundle and restores production web assets', async () => {
    const source = await readFile(new URL('../scripts/ios-material-qa.sh', import.meta.url), 'utf8');

    assert.match(source, /com\.aetheria\.roguelike\.freshqa/);
    assert.match(source, /VITE_DEVICE_QA_SCENARIO=item-investment npm run build/);
    assert.match(source, /trap restore_production_assets EXIT/);
    assert.match(source, /restoring production web assets/);
});

test('production build guard rejects bundled test and device QA API code', async () => {
    const source = await readFile(new URL('../scripts/build-guard.mjs', import.meta.url), 'utf8');

    assert.match(source, /const isQaBuild = process\.env\.VITE_ENABLE_TEST_API === '1'/);
    assert.match(source, /__AETHERIA_TEST_API__\|seedItemInvestmentScenario\|seedGraveRecoveryScenario\|seedAscensionJourneyScenario\|seedMirrorJourneyScenario\|seedCrystalExchangeScenario\|seedSystemSettingsScenario\|seedProgressionAcceptanceScenario\|investment-synth\|grave-smoke\|ascension-smoke\|system-settings-smoke/);
    assert.doesNotMatch(source, /system-settings-smoke\|progression-acceptance/);
    assert.match(source, /production bundle contains device\/test QA API code/);
});

test('E2E boot waits for app readiness without blocking on every lazy resource', async () => {
    const source = await readFile(new URL('./e2e/testHelpers.ts', import.meta.url), 'utf8');

    assert.match(source, /page\.goto\('\/\?e2e=1', \{ waitUntil: 'domcontentloaded' \}\)/);
    assert.match(source, /statusBar\.waitFor\(\{ state: 'visible'/);
    assert.match(source, /startButton\.waitFor\(\{ state: 'visible'/);
});

test('canonical E2E restarts the browser between two sequential shards', async () => {
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

    assert.equal(
        packageJson.scripts['test:e2e'],
        'npm run test:e2e:shard:1 && npm run test:e2e:shard:2',
    );
    assert.equal(packageJson.scripts['test:e2e:shard:1'], 'playwright test --shard=1/2');
    assert.equal(packageJson.scripts['test:e2e:shard:2'], 'playwright test --shard=2/2');
});
