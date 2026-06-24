import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 384: migrateData areaBossDefeated / deathSaveUsedCount fallback 2회 redundant 정리
 *   (cycle 222-383 silent dead config 시리즈 148번째 — cleanup lens 연속).
 *
 * 발견 (2 redundant defensive fallbacks):
 * - src/utils/dataMigration.ts migrateData에 2 fallbacks:
 *   · target.stats.areaBossDefeated = target.stats.areaBossDefeated || {};
 *   · target.combatFlags.deathSaveUsedCount = target.combatFlags.deathSaveUsedCount || 0;
 * - 모든 consumer가 이미 fallback / optional chain 처리:
 *   · stats.areaBossDefeated:
 *     - exploreUtils:148: `player.stats?.areaBossDefeated?.[areaBossName]` — optional chain ✓
 *     - combatVictory:173: `(p.stats.areaBossDefeated || {})` — fallback ✓
 *   · combatFlags.deathSaveUsedCount:
 *     - CombatEngine:92: `flags.deathSaveUsedCount || 0` — fallback ✓
 *     - CombatEngine:105: `reviveUsedCount + 1` — local var (이미 `|| 0` 적용)
 * - 회귀 가드 테스트가 migrate output 명시 검증 0건.
 *
 * 패턴 (cycle 222-383 silent dead config 시리즈 148번째):
 * - cycle 383: codexClaimed normalization 1 redundant.
 * - cycle 384: areaBossDefeated / deathSaveUsedCount 2 redundant (동일 lens 연속).
 *
 * 수정 (src/utils/dataMigration.ts):
 * - 2 redundant fallback lines 제거.
 *
 * 회귀 가드:
 * - 모든 consumer optional chain / `|| {}` / `|| 0` 동작 그대로.
 * - target.combatFlags 객체 자체 init 보존 (line 421-426).
 * - target.eventChainProgress 객체 init 보존 (직후 추가 코드 의존 가능).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 384: target.stats.areaBossDefeated fallback 0건', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.stats\.areaBossDefeated = target\.stats\.areaBossDefeated/m.test(block),
        'target.stats.areaBossDefeated fallback 0건');
});

test('cycle 384: target.combatFlags.deathSaveUsedCount fallback 0건', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.combatFlags\.deathSaveUsedCount = target\.combatFlags\.deathSaveUsedCount/m.test(block),
        'target.combatFlags.deathSaveUsedCount fallback 0건');
});

test('cycle 384: combatFlags 객체 init / eventChainProgress init 보존', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    assert.ok(/target\.combatFlags = \{[\s\S]*comboCount: 0,[\s\S]*deathSaveUsed: false,/.test(source),
        'target.combatFlags 객체 init 보존');
    assert.ok(/target\.eventChainProgress = \{\}/.test(source),
        'target.eventChainProgress 객체 init 보존');
});

test('cycle 384: migrateData 동작 보존 (inject 값 보존)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({
        player: {
            name: 'test', job: '모험가',
            stats: {
                kills: 10, total_gold: 500, deaths: 0,
                areaBossDefeated: { '용의 둥지의 보스': true },
            },
        }
    });
    assert.deepEqual(result.player.stats.areaBossDefeated, { '용의 둥지의 보스': true },
        'areaBossDefeated inject 보존');
});

test('cycle 383 회귀 가드: codexClaimed normalization 0건 보존', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.stats\.codexClaimed = Array\.isArray/m.test(block),
        'cycle 383 codexClaimed normalization 0건 보존');
});
