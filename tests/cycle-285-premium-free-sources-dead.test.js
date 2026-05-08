import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 285: PREMIUM_FREE_SOURCES + RELIC_WEIGHTS dead export cleanup
 *   (cycle 222-284 silent dead config 시리즈 55번째 — cleanup lens 연속).
 *
 * 발견 (2 dead/private exports):
 * - src/data/premiumShop.ts: PREMIUM_FREE_SOURCES (6 lines) — 정의만, src/ + tests/ consumer 0건.
 * - src/data/relics.ts: RELIC_WEIGHTS — 정의 + pickWeightedRelics 내부 사용. 외부 consumer 0건.
 *   export 불필요, 내부 const로 downgrade 가능.
 *
 * 패턴 (cycle 222-284 silent dead config 시리즈 55번째):
 * - cycle 271: 4 dead exports cleanup.
 * - cycle 277-284: cleanup 시리즈 8사이클.
 * - cycle 285: PREMIUM_FREE_SOURCES 제거 + RELIC_WEIGHTS export downgrade.
 *
 * 수정:
 * 1) src/data/premiumShop.ts: PREMIUM_FREE_SOURCES export 제거 (~6 lines + JSDoc).
 * 2) src/data/relics.ts: RELIC_WEIGHTS의 export 제거 (private const).
 *
 * 회귀 가드:
 * - PREMIUM_SHOP export 유지 (active dispatch).
 * - RELIC_WEIGHTS는 pickWeightedRelics 내부에서 그대로 사용.
 * - getActiveRelicSynergies / pickWeightedRelics / RELICS / MAX_RELICS_PER_RUN 등 active 유지.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 285: PREMIUM_FREE_SOURCES export 제거', async () => {
    const source = await readSrc('src/data/premiumShop.ts');
    assert.ok(!/export const PREMIUM_FREE_SOURCES/.test(source),
        'PREMIUM_FREE_SOURCES export 제거됨');
});

test('cycle 285: RELIC_WEIGHTS export 제거 (private const로 downgrade)', async () => {
    const source = await readSrc('src/data/relics.ts');
    assert.ok(!/export const RELIC_WEIGHTS/.test(source),
        'RELIC_WEIGHTS export 제거 (private const)');
    assert.ok(/const RELIC_WEIGHTS/.test(source),
        'RELIC_WEIGHTS const 정의 유지 (private)');
});

test('cycle 285: pickWeightedRelics 내부 RELIC_WEIGHTS 사용 유지 (회귀 가드)', async () => {
    const { pickWeightedRelics } = await import('../src/data/relics.js');
    const pool = [
        { id: 'a', name: 'A', rarity: 'common' },
        { id: 'b', name: 'B', rarity: 'rare' },
        { id: 'c', name: 'C', rarity: 'legendary' },
    ];
    const picked = pickWeightedRelics(pool, 2);
    assert.equal(picked.length, 2, 'pickWeightedRelics가 RELIC_WEIGHTS 활용해 정상 동작');
});

test('cycle 285: PREMIUM_SHOP export 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/data/premiumShop.ts');
    assert.ok(/export const PREMIUM_SHOP/.test(source),
        'PREMIUM_SHOP active export 유지');
});

test('cycle 285: relics.ts active exports 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/data/relics.ts');
    const activeExports = ['RELICS', 'MAX_RELICS_PER_RUN', 'RELIC_SYNERGIES', 'getActiveRelicSynergies', 'pickWeightedRelics'];
    activeExports.forEach((name) => {
        const re = new RegExp(`export\\s+(const|function)\\s+${name}\\b`);
        assert.ok(re.test(source), `${name} export 유지`);
    });
});
