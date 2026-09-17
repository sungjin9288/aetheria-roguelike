import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
    isSmokeRuntime,
    isMockRuntime,
    isDeviceQaRuntime,
    getDeviceQaScenario,
    ITEM_INVESTMENT_DEVICE_QA_SCENARIO,
    GRAVE_RECOVERY_DEVICE_QA_SCENARIO,
    ASCENSION_JOURNEY_DEVICE_QA_SCENARIO,
    MIRROR_JOURNEY_DEVICE_QA_SCENARIO,
    CRYSTAL_EXCHANGE_DEVICE_QA_SCENARIO,
    SYSTEM_SETTINGS_DEVICE_QA_SCENARIO,
    PROGRESSION_ACCEPTANCE_DEVICE_QA_SCENARIO,
    TRUE_ENDING_JOURNEY_DEVICE_QA_SCENARIO,
} from '../src/utils/runtimeMode.ts';

/**
 * Wave 5 W3-B — runtime-mode-boundary.test.js 원본 계약(소스 텍스트 grep, 6블록):
 *
 *   1. `runtimeMode.ts`: URL 플래그(`?smoke=1`/`?e2e=1`)는 test harness 빌드
 *      (`VITE_ENABLE_TEST_API === '1'`)에서만 동작하고, `deviceQa` 시나리오는
 *      allow-list(`DEVICE_QA_SCENARIOS`)에 있는 값만 인정한다.
 *   2. `useGameTestApi.ts`/`App.tsx`: test API 등록은 mock/isolated device QA
 *      런타임 밖에서는 닫혀 있고, 각 device QA 시나리오 문자열이 seed 함수와
 *      1:1로 연결된다.
 *   3. `scripts/ios-material-qa.sh`: 기기 QA용 번들이 프로덕션 웹 자산을 되돌린다.
 *   4. `scripts/build-guard.mjs`: 프로덕션 빌드는 QA 전용 API 코드를 거부한다.
 *   5. `tests/e2e/testHelpers.ts`: e2e 부팅 대기가 모든 lazy 리소스를 막지 않는다.
 *   6. `package.json`: 표준 e2e는 브라우저를 재시작하는 2-shard 순차 실행이다.
 *
 * 1은 순수 함수(`window.location`/`import.meta.env` 경계 판정)라 실제로 window를
 * 스텁해 호출·검증한다(행동 테스트). 2-5는 각각 React effect(DOM 필요, jsdom
 * 없음)/셸 스크립트/빌드 스크립트/Playwright 헬퍼로, 이 테스트 러너로 실행하거나
 * 관찰할 수 있는 실행 경로가 없어 구조 불변식으로 유지한다. 6은 실제 JSON을
 * 파싱해 필드를 비교하므로 이미 grep보다 행동에 가깝다(그대로 유지).
 */

const withWindowSearch = (search, fn) => {
    const previous = globalThis.window;
    globalThis.window = { location: { search } };
    try {
        return fn();
    } finally {
        if (previous === undefined) delete globalThis.window;
        else globalThis.window = previous;
    }
};

test('isSmokeRuntime/isMockRuntime: window가 없으면 항상 false다', () => {
    const previous = globalThis.window;
    delete globalThis.window;
    try {
        assert.equal(isSmokeRuntime(), false);
        assert.equal(isMockRuntime(), false);
        assert.equal(getDeviceQaScenario(), null);
        assert.equal(isDeviceQaRuntime(), false);
    } finally {
        if (previous !== undefined) globalThis.window = previous;
    }
});

test('isSmokeRuntime/isMockRuntime: URL에 ?smoke=1이 있을 때만 smoke 런타임이다', () => {
    withWindowSearch('?smoke=1', () => {
        assert.equal(isSmokeRuntime(), true);
        assert.equal(isMockRuntime(), true, 'smoke도 mock 런타임에 포함된다');
    });
    withWindowSearch('?smoke=0', () => {
        assert.equal(isSmokeRuntime(), false, 'smoke=0은 활성화하지 않는다');
    });
    withWindowSearch('?foo=1', () => {
        assert.equal(isSmokeRuntime(), false, '관련 없는 쿼리 파라미터는 활성화하지 않는다');
        assert.equal(isMockRuntime(), false);
    });
});

test('isMockRuntime: ?e2e=1도 mock 런타임을 연다 (smoke와는 별개 플래그)', () => {
    withWindowSearch('?e2e=1', () => {
        assert.equal(isMockRuntime(), true);
        assert.equal(isSmokeRuntime(), false, 'e2e=1은 smoke 플래그를 켜지 않는다');
    });
});

test('getDeviceQaScenario: DEVICE_QA_SCENARIOS allow-list에 있는 시나리오만 통과시킨다', () => {
    const allowListedScenarios = [
        ITEM_INVESTMENT_DEVICE_QA_SCENARIO,
        GRAVE_RECOVERY_DEVICE_QA_SCENARIO,
        ASCENSION_JOURNEY_DEVICE_QA_SCENARIO,
        MIRROR_JOURNEY_DEVICE_QA_SCENARIO,
        CRYSTAL_EXCHANGE_DEVICE_QA_SCENARIO,
        SYSTEM_SETTINGS_DEVICE_QA_SCENARIO,
        PROGRESSION_ACCEPTANCE_DEVICE_QA_SCENARIO,
        TRUE_ENDING_JOURNEY_DEVICE_QA_SCENARIO,
    ];

    for (const scenario of allowListedScenarios) {
        withWindowSearch(`?deviceQa=${scenario}`, () => {
            assert.equal(getDeviceQaScenario(), scenario, `"${scenario}"는 allow-list에 있어 그대로 통과한다`);
            assert.equal(isDeviceQaRuntime(), true);
            assert.equal(isMockRuntime(), true, 'device QA 런타임도 mock 런타임에 포함된다');
        });
    }

    withWindowSearch('?deviceQa=not-a-real-scenario', () => {
        assert.equal(getDeviceQaScenario(), null, 'allow-list에 없는 값은 거부된다');
        assert.equal(isDeviceQaRuntime(), false);
    });
});

// ─── 구조 불변식(소스 텍스트) ───
//
// 아래 4개는 React effect(DOM 필요)·셸 스크립트·번들 빌드 스크립트·Playwright
// 헬퍼로, 이 테스트 러너(plain Node + react-dom/server)로는 실행하거나 관찰할
// 방법이 없다. 위에서 실제로 검증한 runtimeMode.ts의 순수 판정 로직과 짝을
// 이루는 "그 판정 결과를 실제로 어디서 쓰는가"에 대한 배선 계약이다.

test('구조 불변식: test API 등록은 mock/device QA 런타임 밖에서 닫혀 있고, 각 시나리오가 seed 함수와 연결된다', async () => {
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
    assert.match(source, /deviceQaScenario === TRUE_ENDING_JOURNEY_DEVICE_QA_SCENARIO/);
    assert.match(source, /readDeviceQaSnapshot\(undefined, deviceQaScenario\)/);
    assert.match(source, /if \(readDeviceQaSnapshot\(undefined, deviceQaScenario\)\) return;/);
    assert.match(source, /testApi\.seedItemInvestmentScenario\(\)/);
    assert.match(app, /const TEST_API_BUILD = import\.meta\.env\.VITE_ENABLE_TEST_API === '1'/);
    assert.match(app, /VITE_DEVICE_QA_SCENARIO === 'mirror-journey'/);
    assert.match(app, /VITE_DEVICE_QA_SCENARIO === 'crystal-exchange'/);
    assert.match(app, /VITE_DEVICE_QA_SCENARIO === 'system-settings'/);
    assert.match(app, /VITE_DEVICE_QA_SCENARIO === 'progression-acceptance'/);
    assert.match(app, /VITE_DEVICE_QA_SCENARIO === 'true-ending-journey'/);
    assert.match(app, /const useRuntimeGameTestApi = TEST_API_BUILD \? useGameTestApi : \(\) => undefined/);
});

test('구조 불변식: 기기 QA 번들 스크립트는 프로비저닝된 QA 번들을 재사용하고 프로덕션 웹 자산을 복구한다', async () => {
    const source = await readFile(new URL('../scripts/ios-material-qa.sh', import.meta.url), 'utf8');

    assert.match(source, /com\.aetheria\.roguelike\.freshqa/);
    assert.match(source, /VITE_DEVICE_QA_SCENARIO=item-investment npm run build/);
    assert.match(source, /trap restore_production_assets EXIT/);
    assert.match(source, /restoring production web assets/);
});

test('구조 불변식: 프로덕션 빌드 가드는 번들에 섞인 test/device QA API 코드를 거부한다', async () => {
    const source = await readFile(new URL('../scripts/build-guard.mjs', import.meta.url), 'utf8');

    assert.match(source, /const isQaBuild = process\.env\.VITE_ENABLE_TEST_API === '1'/);
    assert.match(source, /__AETHERIA_TEST_API__\|seedItemInvestmentScenario\|seedGraveRecoveryScenario\|seedAscensionJourneyScenario\|seedMirrorJourneyScenario\|seedCrystalExchangeScenario\|seedSystemSettingsScenario\|seedProgressionAcceptanceScenario\|seedTrueEndingJourneyScenario\|armNextCombatSeed\|armNextExploreSeed\|investment-synth\|grave-smoke\|ascension-smoke\|system-settings-smoke/);
    assert.doesNotMatch(source, /system-settings-smoke\|progression-acceptance/);
    assert.match(source, /production bundle contains device\/test QA API code/);
});

test('구조 불변식: E2E 부팅 대기는 모든 lazy 리소스를 막지 않고 앱 준비 신호만 기다린다', async () => {
    const source = await readFile(new URL('./e2e/testHelpers.ts', import.meta.url), 'utf8');

    assert.match(source, /page\.goto\('\/\?e2e=1', \{ waitUntil: 'domcontentloaded' \}\)/);
    assert.match(source, /statusBar\.waitFor\(\{ state: 'visible'/);
    assert.match(source, /startButton\.waitFor\(\{ state: 'visible'/);
});

test('표준 E2E는 두 샤드 사이에 브라우저를 재시작한다 (package.json 실제 값)', async () => {
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

    assert.equal(
        packageJson.scripts['test:e2e'],
        'npm run test:e2e:shard:1 && npm run test:e2e:shard:2',
    );
    assert.equal(packageJson.scripts['test:e2e:shard:1'], 'playwright test --shard=1/2');
    assert.equal(packageJson.scripts['test:e2e:shard:2'], 'playwright test --shard=2/2');
});
