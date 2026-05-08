import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 286: CODEX_MILESTONES export downgrade (private const)
 *   (cycle 222-285 silent dead config 시리즈 56번째 — cleanup lens 연속).
 *
 * 발견:
 * - src/data/codexRewards.ts: CODEX_MILESTONES export 정의 + getCodexProgress 내부에서만 사용.
 * - 외부 consumer 0건 — 외부는 getCodexProgress 함수만 호출.
 * - cycle 285 RELIC_WEIGHTS 패턴 동일.
 *
 * 수정 (src/data/codexRewards.ts):
 * - CODEX_MILESTONES export 제거 (private const로 downgrade).
 *
 * 회귀 가드:
 * - getCodexProgress 함수 export 유지.
 * - 내부에서 CODEX_MILESTONES 사용 그대로.
 * - codex 보상 계산 동작 유지.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 286: CODEX_MILESTONES export 제거 (private const)', async () => {
    const source = await readSrc('src/data/codexRewards.ts');
    assert.ok(!/export const CODEX_MILESTONES/.test(source),
        'CODEX_MILESTONES export 제거됨');
    assert.ok(/const CODEX_MILESTONES/.test(source),
        'CODEX_MILESTONES const 정의 유지 (private)');
});

test('cycle 286: getCodexProgress export 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/data/codexRewards.ts');
    assert.ok(/export const getCodexProgress/.test(source),
        'getCodexProgress active export 유지');
});

test('cycle 286: getCodexProgress 동작 유지 (회귀 가드)', async () => {
    const { getCodexProgress } = await import('../src/data/codexRewards.js');
    const codex = { weapons: { sword1: true, sword2: true, sword3: true, sword4: true, sword5: true } };
    const result = getCodexProgress(codex, []);
    assert.ok(Array.isArray(result.milestones), 'milestones 배열 반환');
    assert.ok(Array.isArray(result.unclaimed), 'unclaimed 배열 반환');
    // weapons 5개 → 5-count milestone unclaimed.
    assert.ok(result.unclaimed.some((m) => m.category === 'weapons' && m.count === 5),
        'weapons 5-count milestone unclaimed 정상 detect');
});

test('cycle 285 회귀 가드: PREMIUM_FREE_SOURCES / RELIC_WEIGHTS cleanup 유지', async () => {
    const premiumSrc = await readSrc('src/data/premiumShop.ts');
    const relicsSrc = await readSrc('src/data/relics.ts');
    assert.ok(!/export const PREMIUM_FREE_SOURCES/.test(premiumSrc),
        'cycle 285 PREMIUM_FREE_SOURCES 제거 유지');
    assert.ok(!/export const RELIC_WEIGHTS/.test(relicsSrc),
        'cycle 285 RELIC_WEIGHTS export 제거 유지');
});
