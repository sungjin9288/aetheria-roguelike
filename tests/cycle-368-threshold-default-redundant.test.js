import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 368: relic prophecy_stone + quest 62 threshold default 2회 redundant 정리
 *   (cycle 222-367 silent dead config 시리즈 134번째 — cleanup lens 연속).
 *
 * 발견 (2 redundant default annotations):
 * - src/data/relics.ts prophecy_stone에 `threshold: 0.25` —
 *   CombatEngine.ts:544 `executeAtkRelic.threshold || 0.25` 기본값과 동일.
 * - src/data/quests.ts 퀘스트 id=62 (생존의 의지)에 `threshold: 0.2` —
 *   questProgress.ts:41 `questData.threshold || 0.2` 기본값과 동일.
 * - 두 케이스 모두 `|| default` fallback이 적용되므로 default와 같은 명시는 redundant.
 *
 * 핵심: blood_moon (low_hp_dmg, threshold: 0.25) — default 0.4와 다름 → 보존.
 *      quest 63 (threshold: 0.1) / 75 (threshold: 0.05) — default와 다름 → 보존.
 *
 * 패턴 (cycle 222-367 silent dead config 시리즈 134번째):
 * - cycle 367: maps boss: false 4 redundant.
 * - cycle 368: relic + quest threshold default 2 redundant.
 *
 * 수정:
 * - src/data/relics.ts: prophecy_stone의 threshold: 0.25 제거.
 * - src/data/quests.ts: quest 62의 threshold: 0.2 제거.
 *
 * 회귀 가드:
 * - prophecy_stone effect/val 보존, default 0.25 fallback으로 동작 동일.
 * - blood_moon threshold: 0.25 보존 (low_hp_dmg default 0.4와 다름).
 * - quest 63 threshold: 0.1 / quest 75 threshold: 0.05 보존.
 * - questProgress / CombatEngine execute 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 368: prophecy_stone threshold default 0건', async () => {
    const source = await readSrc('src/data/relics.ts');
    const propheLine = source.match(/prophecy_stone[^\n]*/)[0];
    assert.ok(!/threshold: 0\.25/.test(propheLine),
        `prophecy_stone에서 threshold: 0.25 0건이어야 함. 라인: ${propheLine}`);
});

test('cycle 368: quest 62 threshold default 0건', async () => {
    const source = await readSrc('src/data/quests.ts');
    const q62Line = source.match(/id: 62[^\n]*/)[0];
    assert.ok(!/threshold: 0\.2[^0-9]/.test(q62Line),
        `quest 62에서 threshold: 0.2 0건이어야 함. 라인: ${q62Line}`);
});

test('cycle 368: blood_moon threshold 0.25 보존 (default와 다름)', async () => {
    const source = await readSrc('src/data/relics.ts');
    const bloodMoonLine = source.match(/blood_moon[^\n]*/)[0];
    assert.ok(/threshold: 0\.25/.test(bloodMoonLine),
        `blood_moon threshold: 0.25 보존 (low_hp_dmg default 0.4와 다름)`);
});

test('cycle 368: quest 63/75 threshold 보존 (default와 다름)', async () => {
    const source = await readSrc('src/data/quests.ts');
    const q63Line = source.match(/id: 63[^\n]*/)[0];
    const q75Line = source.match(/id: 75[^\n]*/)[0];
    assert.ok(/threshold: 0\.1/.test(q63Line), 'quest 63 threshold: 0.1 보존');
    assert.ok(/threshold: 0\.05/.test(q75Line), 'quest 75 threshold: 0.05 보존');
});

test('cycle 367 회귀 가드: maps boss: false 0건 보존', async () => {
    const source = await readSrc('src/data/maps.ts');
    const matches = source.match(/boss: false/g) || [];
    assert.equal(matches.length, 0, 'cycle 367 boss: false 0건 보존');
});
