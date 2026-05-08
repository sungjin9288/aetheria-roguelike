import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 329: useGameTestApi 3 dead methods 제거 (getState / clearPostCombat / injectAscensionPreview)
 *   (cycle 222-328 silent dead config 시리즈 98번째 — cleanup lens 연속).
 *
 * 발견 (3 dead test API methods):
 * - getState: window.__AETHERIA_TEST_API__.getState — scripts/, tests/, docs
 *   어디에서도 호출 0건.
 * - clearPostCombat: 동일 0건.
 * - injectAscensionPreview: 동일 0건. AscensionScreen 렌더 강제 helper지만 사용처 없음.
 *
 * 비교 — 다른 test API methods는 active:
 * - getDomMetrics / getPerfSnapshot / markPerf / resetGame / sendCommand / setSideTab /
 *   seedAvatarScenario / seedEnhanceScenario / injectEvent → smoke / perf 스크립트에서 사용.
 * - injectPostCombatResult / injectRelicChoice / injectRunSummary → docs(progress.md, todo.md)에
 *   언급 (Playwright QA 훅 의도).
 *
 * 패턴 (cycle 222-328 silent dead config 시리즈 98번째):
 * - cycle 328: BossPhase type private downgrade.
 * - cycle 329: useGameTestApi 3 fully dead methods cleanup.
 *
 * 수정 (src/hooks/useGameTestApi.ts):
 * - getState / clearPostCombat / injectAscensionPreview 메서드 제거.
 *
 * 회귀 가드:
 * - 다른 test API methods 보존.
 * - smoke-gameplay.mjs / perf-guard.mjs script chain 영향 없음.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 329: 3 dead methods 제거', async () => {
    const source = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(!/getState:\s*\(\)/.test(source),
        'getState 메서드 제거됨');
    assert.ok(!/clearPostCombat:\s*\(\)/.test(source),
        'clearPostCombat 메서드 제거됨');
    assert.ok(!/injectAscensionPreview:\s*\(\)/.test(source),
        'injectAscensionPreview 메서드 제거됨');
});

test('cycle 329: active test API methods 보존', async () => {
    const source = await readSrc('src/hooks/useGameTestApi.ts');
    const aliveMethods = ['getDomMetrics', 'getPerfSnapshot', 'markPerf', 'resetGame', 'sendCommand', 'setSideTab', 'seedAvatarScenario', 'seedEnhanceScenario', 'injectEvent'];
    aliveMethods.forEach((name) => {
        const re = new RegExp(`${name}:\\s*\\(`);
        assert.ok(re.test(source), `${name} 보존`);
    });
});

test('cycle 329: smoke-gameplay.mjs script 호출 보존 (회귀 가드)', async () => {
    const source = await readSrc('scripts/smoke-gameplay.mjs');
    assert.ok(/__AETHERIA_TEST_API__\?\.sendCommand/.test(source),
        'smoke-gameplay sendCommand 호출 보존');
    assert.ok(/__AETHERIA_TEST_API__\?\.resetGame/.test(source),
        'smoke-gameplay resetGame 호출 보존');
});

test('cycle 328 회귀 가드: BossPhase private 유지', async () => {
    const source = await readSrc('src/types/monster.ts');
    assert.ok(!/export interface BossPhase\b/.test(source),
        'cycle 328 BossPhase private 유지');
});
