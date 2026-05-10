import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 593: window.advanceTime dead method 제거 + cleanup unmount 잔존
 *   (cycle 222-592 silent dead config 시리즈 330번째 — dead exposure pattern,
 *   cycle 329 lens 회귀).
 *
 * 발견 (1 dead method):
 * - src/hooks/useGameTestApi.ts:
 *     · line 221: window.advanceTime = (ms: any = 0) => new Promise(...);
 *     · line 396: delete window.advanceTime; (unmount cleanup)
 * - 호출 사이트 (production + scripts + tests):
 *     · src/ 0건 (자기 정의 + cleanup 외).
 *     · scripts/ 0건 (smoke / build-guard / mobile 모두 미사용).
 *     · tests/ 0건.
 *     · Playwright QA 훅 추정이었으나 실제 caller 없음.
 * - 결과: window.advanceTime은 정의만 있고 read 0건. cycle 329에서 정리한
 *   getState/clearPostCombat/injectAscensionPreview 3 dead methods와 동일
 *   lens.
 *
 * 패턴 (cycle 222-592 시리즈 330번째):
 * - cycle 502-592: default 청소 메가 시리즈 91사이클 (대부분 default lens).
 * - cycle 593: dead exposure pattern 회귀 — cycle 329 동일 lens 재적용.
 *   default cleanup 외 다른 lens로 pivot.
 *
 * 수정 (src/hooks/useGameTestApi.ts):
 * - line 221: window.advanceTime 정의 제거.
 * - line 396: delete window.advanceTime cleanup도 paired removal.
 *
 * 회귀 가드:
 * - cycle 329 정리된 3 methods (getState/clearPostCombat/
 *   injectAscensionPreview) 회귀 0건 보존.
 * - 다른 method (resetGame/sendCommand/setSideTab/seedAvatarScenario/
 *   seedEnhanceScenario/injectEvent/getDomMetrics/getPerfSnapshot/markPerf)
 *   active 보존 (smoke/perf 스크립트에서 사용).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 593: window.advanceTime 정의 제거', async () => {
    const source = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(!/window\.advanceTime\s*=/.test(source),
        'window.advanceTime 정의 제거');
});

test('cycle 593: delete window.advanceTime cleanup도 paired removal', async () => {
    const source = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(!/delete window\.advanceTime/.test(source),
        'delete window.advanceTime cleanup 제거');
});

test('cycle 593: cycle 329 dead methods 회귀 가드', async () => {
    const source = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(!/window\.__AETHERIA_TEST_API__\s*=\s*\{[\s\S]*?getState:/.test(source),
        'cycle 329 getState 0건 보존');
    assert.ok(!/clearPostCombat:/.test(source),
        'cycle 329 clearPostCombat 0건 보존');
    assert.ok(!/injectAscensionPreview:/.test(source),
        'cycle 329 injectAscensionPreview 0건 보존');
});

test('cycle 593: active methods 보존 (smoke/perf 스크립트 사용)', async () => {
    const source = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(/resetGame:/.test(source), 'resetGame active 보존');
    assert.ok(/sendCommand:/.test(source), 'sendCommand active 보존');
    assert.ok(/seedAvatarScenario:/.test(source), 'seedAvatarScenario active 보존');
    assert.ok(/seedEnhanceScenario:/.test(source), 'seedEnhanceScenario active 보존');
});

test('cycle 593: cycle 502-592 회귀 가드 — default 청소 시리즈 보존', async () => {
    const cv = await readSrc('src/hooks/combatActions/combatVictory.ts');
    assert.ok(!/extendedChecks\s*=\s*false/.test(cv),
        'cycle 592 handleVictoryOutcome extendedChecks default 0건');

    const helpers = await readSrc('src/hooks/combatActions/_helpers.ts');
    assert.ok(!/droppedItems\s*=\s*\[\]/.test(helpers),
        'cycle 591 addCombatDigestLogs droppedItems default 0건');
});
