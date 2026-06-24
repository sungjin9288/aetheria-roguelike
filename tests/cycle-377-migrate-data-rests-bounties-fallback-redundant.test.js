import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 377: migrateData stats.rests / stats.bountiesCompleted fallback 2회 redundant 정리
 *   (cycle 222-376 silent dead config 시리즈 142번째 — cleanup lens 연속).
 *
 * 발견 (2 redundant defensive fallbacks):
 * - src/utils/dataMigration.ts migrateData에 2 stats sub-field fallback lines:
 *   · target.stats.rests = target.stats.rests || 0;
 *   · target.stats.bountiesCompleted = target.stats.bountiesCompleted || 0;
 * - 모든 consumer가 이미 `|| 0` fallback 처리:
 *   · stats.rests: 4곳 모두 fallback (runProfile / gameUtils:561 / StatsPanel /
 *     characterActions / progressionHandlers).
 *   · stats.bountiesCompleted: 5곳 모두 fallback (questProgress / questOperations /
 *     gameUtils:597 / StatsPanel / progressionHandlers ASCEND fallback).
 *   · ascensionActions:45 reads `player.stats.bountiesCompleted` 직접 — 그러나 결과는
 *     projectedPlayer로 checkTitles에 전달, 거기서 `|| 0` fallback 처리.
 * - cycle 119/120/131 회귀 가드 테스트는 inject 값 기반 assertion이라 미영향.
 *
 * 패턴 (cycle 222-376 silent dead config 시리즈 142번째):
 * - cycle 376: migrateData bounty 2 redundant normalizations.
 * - cycle 377: migrateData stats.rests / bountiesCompleted 2 redundant (동일 lens).
 *
 * 수정 (src/utils/dataMigration.ts):
 * - 2 redundant fallback lines 제거.
 *
 * 회귀 가드:
 * - 모든 consumer `|| 0` fallback 동작 그대로.
 * - cycle 119/120/131 inject-based assertion 통과 (`bountiesCompleted: 8` 등 보존).
 * - 다른 stats counter (escapes/syntheses/maxKillStreak) fallback 보존 (cycle 120
 *   regression 가드).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 377: migrateData target.stats.rests fallback (unconditional 블록) 0건', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    // v3.1 conditional 블록 (line 347)의 rests fallback은 보존, unconditional 블록 (line 390)만 제거.
    const matches = block.match(/^\s+target\.stats\.rests = target\.stats\.rests \|\| 0/gm) || [];
    assert.equal(matches.length, 1,
        `unconditional rests fallback 0건 (legacy v3.1 conditional만 1건 유지), 발견: ${matches.length}`);
});

test('cycle 377: migrateData target.stats.bountiesCompleted fallback 0건', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const matches = block.match(/^\s+target\.stats\.bountiesCompleted = target\.stats\.bountiesCompleted/gm) || [];
    assert.equal(matches.length, 0,
        `target.stats.bountiesCompleted fallback 0건이어야 함, ${matches.length}건 발견`);
});

test('cycle 377: migrateData 동작 보존 (정의된 stats 값 보존)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({
        player: {
            name: 'test', job: '모험가',
            stats: { kills: 10, total_gold: 500, deaths: 0, rests: 5, bountiesCompleted: 8 }
        }
    });
    assert.equal(result.player.stats.rests, 5, 'rests inject 값 보존');
    assert.equal(result.player.stats.bountiesCompleted, 8, 'bountiesCompleted inject 값 보존');
});

test('cycle 376 회귀 가드: bountyDate / Boolean(bountyIssued) fallback 0건 보존', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const dateMatches = block.match(/^\s+target\.stats\.bountyDate = target\.stats\.bountyDate/gm) || [];
    const issuedMatches = block.match(/^\s+target\.stats\.bountyIssued = Boolean/gm) || [];
    assert.equal(dateMatches.length, 0, 'cycle 376 bountyDate 0건 보존');
    assert.equal(issuedMatches.length, 0, 'cycle 376 bountyIssued Boolean 0건 보존');
});
