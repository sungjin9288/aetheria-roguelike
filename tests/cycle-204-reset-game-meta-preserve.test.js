import test from 'node:test';
import assert from 'node:assert/strict';

import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { AT } from '../src/reducers/actionTypes.js';

/**
 * cycle 204: RESET_GAME이 META 진행도 보존 (cycle 191 follow-up — 사망 후 '다시 시작' 회귀).
 *
 * 발견 (cycle 191 nullification):
 * - cycle 191은 handleDefeat가 META 진행도 6종(titles / activeTitle / premiumCurrency /
 *   reviveTokens / maxInv / seasonPass)을 보존하도록 fix.
 * - 그러나 사망 후 user flow:
 *   1. 사망 → handleDefeat 실행 → SET_PLAYER로 preserved state 적용
 *   2. SET_GAME_STATE GS.DEAD → RunSummaryCard 렌더
 *   3. user clicks '다시 시작' → engine.actions.reset() → AT.RESET_GAME dispatch
 *   4. RESET_GAME 핸들러: ...INITIAL_STATE → 모든 META 진행도 wipe.
 * - 결과: cycle 191 preserve가 단지 RunSummary 모달 표시 동안만 살아있고,
 *   '다시 시작' 클릭 즉시 nullify. cycle 191 fix가 사실상 dead-on-arrival.
 *
 * 추가 nullify 대상:
 * - cycle 119/203: stats 영구 카운터 11종 (kills / bossKills / total_gold / abyssRecord /
 *   escapes / syntheses / maxKillStreak / visitedMaps / discoveryChains / explores /
 *   rests / killRegistry / buildWins / demonKingSlain / bountiesCompleted / crafts /
 *   relicCount / deaths / abyssFloor / codex / codexClaimed) — RESET_GAME으로 0 / [] / {} 리셋.
 * - cycle 188/202: cosmeticTitles / synthProtects / claimedAchievements — 동일.
 *
 * 수정 (src/reducers/handlers/progressionHandlers.ts RESET_GAME):
 * - cycle 191 / 188 / 202 / 203 / 119 보존 시리즈와 동일 패턴으로 META 진행도 명시 보존.
 * - RUN 진행도(gold / inv / equip / relics / hp / mp / quests)는 INITIAL_STATE로 reset 유지.
 *
 * 주의: MSG.INIT_RECORD_APPLIED("초기 기록이 적용되었습니다. 이름을 정하고 다시 시작해 주세요.")는
 * 그대로 — name='' reset은 handleDefeat가 이미 처리하므로 RESET_GAME에서 추가 처리 불필요.
 */

const buildPlayerWithProgress = () => ({
    ...INITIAL_STATE.player,
    name: 'Test',
    job: '전사',
    level: 25,
    meta: {
        essence: 500,
        rank: 3,
        prestigeRank: 2,
        bonusAtk: 15,
        bonusHp: 100,
        bonusMp: 50,
        totalPrestigeAtk: 30,
        totalPrestigeHp: 200,
        totalPrestigeMp: 100,
    },
    titles: ['warrior', 'first_blood', '각성자'],
    activeTitle: '각성자',
    premiumCurrency: 250,
    seasonPass: { xp: 5000, tier: 15, claimed: ['s1_t10'], isPremium: true, seasonId: 'S1' },
    reviveTokens: 3,
    maxInv: 30,
    stats: {
        ...INITIAL_STATE.player.stats,
        kills: 500,
        bossKills: 25,
        deaths: 4,
        total_gold: 50000,
        abyssRecord: 35,
        escapes: 12,
        syntheses: 8,
        maxKillStreak: 50,
        visitedMaps: ['시작의 마을', '고요한 숲', '어둠의 동굴'],
        discoveryChains: ['water_apostle'],
        explores: 250,
        rests: 30,
        killRegistry: { '슬라임': 50, '드래곤': 1 },
        buildWins: { 'warrior': 5 },
        cosmeticTitles: ['별을 보는 자'],
        synthProtects: 2,
        claimedAchievements: ['ach_first_blood', 'ach_kill_100'],
    },
    // RUN-bound (should reset)
    gold: 9999,
    inv: [{ id: 'rare_sword', name: '희귀 검' }],
    equip: { weapon: { id: 'epic_axe' }, armor: null, offhand: null },
    relics: [{ id: 'relic_a' }, { id: 'relic_b' }],
    hp: 50, maxHp: 100, mp: 30, maxMp: 60,
    quests: [{ id: 99, progress: 5 }],
});

const buildState = () => ({
    ...INITIAL_STATE,
    player: buildPlayerWithProgress(),
    grave: { items: [{ id: 'lost_a' }] },
    uid: 'test-uid',
    bootStage: 'ready',
});

test('cycle 204: RESET_GAME이 player.meta 보존 (cycle 191 align)', () => {
    const state = buildState();
    const next = gameReducer(state, { type: AT.RESET_GAME });
    assert.equal(next.player.meta.essence, 500);
    assert.equal(next.player.meta.rank, 3);
    assert.equal(next.player.meta.prestigeRank, 2);
    assert.equal(next.player.meta.bonusAtk, 15);
    assert.equal(next.player.meta.bonusHp, 100);
});

test('cycle 204: RESET_GAME이 titles / activeTitle 보존', () => {
    const state = buildState();
    const next = gameReducer(state, { type: AT.RESET_GAME });
    assert.deepEqual(next.player.titles, ['warrior', 'first_blood', '각성자']);
    assert.equal(next.player.activeTitle, '각성자');
});

test('cycle 204: RESET_GAME이 premium 자산 4종 보존 (cycle 188/191 align)', () => {
    const state = buildState();
    const next = gameReducer(state, { type: AT.RESET_GAME });
    assert.equal(next.player.premiumCurrency, 250);
    assert.equal(next.player.reviveTokens, 3);
    assert.equal(next.player.maxInv, 30);
    assert.deepEqual(next.player.seasonPass, { xp: 5000, tier: 15, claimed: ['s1_t10'], isPremium: true, seasonId: 'S1' });
});

test('cycle 204: RESET_GAME이 stats 영구 카운터 보존 (cycle 119/203 align)', () => {
    const state = buildState();
    const next = gameReducer(state, { type: AT.RESET_GAME });
    assert.equal(next.player.stats.kills, 500);
    assert.equal(next.player.stats.bossKills, 25);
    assert.equal(next.player.stats.total_gold, 50000);
    assert.equal(next.player.stats.abyssRecord, 35);
    assert.equal(next.player.stats.escapes, 12);
    assert.equal(next.player.stats.syntheses, 8);
    assert.equal(next.player.stats.maxKillStreak, 50);
    assert.equal(next.player.stats.explores, 250);
    assert.equal(next.player.stats.rests, 30);
    assert.deepEqual(next.player.stats.killRegistry, { '슬라임': 50, '드래곤': 1 });
    assert.deepEqual(next.player.stats.buildWins, { 'warrior': 5 });
    assert.deepEqual(next.player.stats.visitedMaps, ['시작의 마을', '고요한 숲', '어둠의 동굴']);
    assert.deepEqual(next.player.stats.discoveryChains, ['water_apostle']);
});

test('cycle 204: RESET_GAME이 cosmeticTitles / synthProtects / claimedAchievements 보존 (cycle 188/202 align)', () => {
    const state = buildState();
    const next = gameReducer(state, { type: AT.RESET_GAME });
    assert.deepEqual(next.player.stats.cosmeticTitles, ['별을 보는 자']);
    assert.equal(next.player.stats.synthProtects, 2);
    assert.deepEqual(next.player.stats.claimedAchievements, ['ach_first_blood', 'ach_kill_100']);
});

test('cycle 204: RESET_GAME이 RUN-bound 진행도 reset (회귀 가드)', () => {
    const state = buildState();
    const next = gameReducer(state, { type: AT.RESET_GAME });
    // RUN 진행도는 reset
    assert.equal(next.player.gold, INITIAL_STATE.player.gold);
    assert.deepEqual(next.player.equip.weapon.id, INITIAL_STATE.player.equip.weapon.id,
        '장비는 INITIAL로 reset');
    assert.deepEqual(next.player.relics, []);
    assert.deepEqual(next.player.quests, []);
});

test('cycle 204: grave / uid / bootStage 회귀 가드 (기존 동작)', () => {
    const state = buildState();
    const next = gameReducer(state, { type: AT.RESET_GAME });
    assert.deepEqual(next.grave, { items: [{ id: 'lost_a' }] });
    assert.equal(next.uid, 'test-uid');
    assert.equal(next.bootStage, 'ready');
    assert.equal(next.syncStatus, 'syncing');
});

test('cycle 204: 빈 player(첫 booting) — RESET_GAME 안전 (크래시 없음)', () => {
    const state = {
        ...INITIAL_STATE,
        player: { ...INITIAL_STATE.player },
        grave: null,
        uid: null,
    };
    const next = gameReducer(state, { type: AT.RESET_GAME });
    assert.deepEqual(next.player.titles, []);
    assert.deepEqual(next.player.stats.claimedAchievements, []);
    assert.equal(next.player.premiumCurrency, 0);
});
