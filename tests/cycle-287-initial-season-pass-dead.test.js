import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 287: INITIAL_SEASON_PASS dead export 제거
 *   (cycle 222-286 silent dead config 시리즈 57번째 — cleanup lens 연속).
 *
 * 발견 (단일 dead export):
 * - src/data/seasonPass.ts: INITIAL_SEASON_PASS (line 63) — src/ + tests/ 어디에서도 consumer 0건.
 * - INITIAL_STATE.player.seasonPass는 gameReducer.ts:52에 inline {xp:0, tier:0, claimed:[],
 *   isPremium:false, seasonId:'S1'}로 정의 — INITIAL_SEASON_PASS는 dead duplicate.
 *
 * 패턴 (cycle 222-286 silent dead config 시리즈 57번째):
 * - cycle 285: PREMIUM_FREE_SOURCES dead export 제거.
 * - cycle 286: CODEX_MILESTONES export downgrade.
 * - cycle 287: INITIAL_SEASON_PASS dead export 제거 (cleanup lens 연속).
 *
 * 수정 (src/data/seasonPass.ts):
 * - INITIAL_SEASON_PASS export 제거 (~6 lines + JSDoc).
 *
 * 회귀 가드:
 * - SEASON_XP / SEASON_TIER_XP / SEASON_REWARDS active exports 유지.
 * - INITIAL_STATE.player.seasonPass inline 정의 유지 (gameReducer).
 * - SeasonPassPanel / claimSeasonReward (cycle 261) 동작 변화 없음.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 287: INITIAL_SEASON_PASS export 제거', async () => {
    const source = await readSrc('src/data/seasonPass.ts');
    assert.ok(!/export const INITIAL_SEASON_PASS/.test(source),
        'INITIAL_SEASON_PASS export 제거됨');
});

test('cycle 287: SEASON_XP / SEASON_TIER_XP / SEASON_REWARDS active exports 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/data/seasonPass.ts');
    const activeExports = ['SEASON_XP', 'SEASON_TIER_XP', 'SEASON_REWARDS'];
    activeExports.forEach((name) => {
        const re = new RegExp(`export const ${name}\\b`);
        assert.ok(re.test(source), `${name} export 유지`);
    });
});

test('cycle 287: INITIAL_STATE.player.seasonPass inline 정의 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/reducers/gameReducer.ts');
    assert.ok(/seasonPass:\s*\{\s*xp:\s*0,\s*tier:\s*0/.test(source),
        'INITIAL_STATE seasonPass inline 정의 유지');
});

test('cycle 287: SEASON_XP 키 변화 없음 (회귀 가드)', async () => {
    const { SEASON_XP } = await import('../src/data/seasonPass.js');
    assert.ok(SEASON_XP, 'SEASON_XP 정의 유지');
    assert.ok(typeof SEASON_XP.explore === 'number', 'explore key 유지');
    assert.ok(typeof SEASON_XP.kill === 'number', 'kill key 유지');
    assert.ok(typeof SEASON_XP.bossKill === 'number', 'bossKill key 유지');
});

test('cycle 285-286 회귀 가드: 이전 cleanup 동작 유지', async () => {
    const premiumSrc = await readSrc('src/data/premiumShop.ts');
    const codexSrc = await readSrc('src/data/codexRewards.ts');
    assert.ok(!/export const PREMIUM_FREE_SOURCES/.test(premiumSrc),
        'cycle 285 PREMIUM_FREE_SOURCES 제거 유지');
    assert.ok(!/export const CODEX_MILESTONES/.test(codexSrc),
        'cycle 286 CODEX_MILESTONES export 제거 유지');
});
