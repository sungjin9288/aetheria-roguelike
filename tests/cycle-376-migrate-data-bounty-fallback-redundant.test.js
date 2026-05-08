import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 376: migrateData target.stats bounty fallback 2회 redundant 정리
 *   (cycle 222-375 silent dead config 시리즈 141번째 — cleanup lens 연속).
 *
 * 발견 (2 redundant defensive normalizations):
 * - src/utils/gameUtils.ts migrateData에 2 bounty 정규화 lines:
 *   · target.stats.bountyDate = target.stats.bountyDate || null;
 *   · target.stats.bountyIssued = Boolean(target.stats.bountyIssued);
 * - 모든 consumer가 이미 truthy 체크 또는 strict equality 처리:
 *   · QuestBoardPanel.tsx:67: `player?.stats?.bountyDate === today &&
 *     player?.stats?.bountyIssued` — strict equality + truthy.
 *   · questActions.ts:40: 동일 패턴.
 *   · progressionHandlers.ts:86: `Boolean(prevStats.bountyIssued)` — Boolean coercion.
 * - undefined === today (false), undefined && X (undefined falsy), Boolean(undefined) (false).
 *   모두 null / undefined / false 동일 처리.
 * - cycle 213 회귀 가드 테스트도 `|| null` / `Boolean(...)` 패턴으로 통과.
 *
 * 패턴 (cycle 222-375 silent dead config 시리즈 141번째):
 * - cycle 375: migrateData activeTitle fallback 1 redundant.
 * - cycle 376: migrateData bounty 2 redundant normalizations (동일 lens).
 *
 * 수정 (src/utils/gameUtils.ts):
 * - 2 bounty fallback lines 제거.
 *
 * 회귀 가드:
 * - QuestBoardPanel / questActions truthy 체크 동작 그대로.
 * - progressionHandlers Boolean coercion 동작 유지.
 * - cycle 213 bounty preserve test 통과.
 * - cycle 119/120/131 stats counter fallback (escapes 등) 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 376: migrateData target.stats.bountyDate fallback 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const matches = block.match(/^\s+target\.stats\.bountyDate = target\.stats\.bountyDate/gm) || [];
    assert.equal(matches.length, 0,
        `target.stats.bountyDate fallback 0건이어야 함, ${matches.length}건 발견`);
});

test('cycle 376: migrateData Boolean(target.stats.bountyIssued) 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const matches = block.match(/^\s+target\.stats\.bountyIssued = Boolean/gm) || [];
    assert.equal(matches.length, 0,
        `target.stats.bountyIssued = Boolean(...) 0건이어야 함, ${matches.length}건 발견`);
});

test('cycle 376: migrateData 동작 보존 (bounty 누락 → undefined, consumer truthy 체크)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({ player: { name: 'test', job: '모험가' } });
    // bountyDate / bountyIssued는 undefined여도 consumer truthy 체크에서 falsy 처리.
    assert.ok(result.player.stats, 'stats 객체 보존');
});

test('cycle 375 회귀 가드: activeTitle fallback 0건 보존', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const matches = block.match(/^\s+target\.activeTitle = target\.activeTitle/gm) || [];
    assert.equal(matches.length, 0, 'cycle 375 activeTitle fallback 0건 보존');
});
