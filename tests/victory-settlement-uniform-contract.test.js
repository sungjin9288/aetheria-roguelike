import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { BALANCE } from '../src/data/constants.js';
import { SEASON_XP } from '../src/data/seasonPass.js';
import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { createSeededRandom } from '../src/systems/combatItemTurn.js';
import { getLowHpWinTotal, pushBattleRecord } from '../src/systems/DifficultyManager.js';
import { getCumulativeQuestProgress } from '../src/utils/cumulativeQuestProgress.js';
import { spawnEnemy } from '../src/utils/exploreUtils.js';
import { makeItem } from '../src/utils/gameUtils.js';

/**
 * 2026-10 Wave 61 (원장 §61 A4 · A5 · A11) — 승리 후처리는 처치 방법과 무관하다.
 *
 * `handleVictoryOutcome`의 `extendedChecks`(공격 · 기술로 직접 끝낸 승리에만 true)가 있던 동안, 적 턴의 지속 피해 · 반격으로
 * 끝난 승리와 전투 소모품 턴의 승리는 구역 보스 처치 기록 · 시즌 XP(처치 +5 · 보스 +50) · 처치 수 마일스톤(정확히 N에서만 판정 —
 * 영구 누락) · 전투 기록(낮은 생명 승리 임무) · 공허의 신 보상을 건너뛰었다. Wave 60으로 보스전이 길어져 지속 피해 처치가 늘었다.
 * 이 파일은 실제 리듀서 전이(`USE_COMBAT_ITEM` → 적 턴 지속 피해 처치)를 직접 공격 처치와 같은 기준으로 대조한다.
 */

const NOW = 1_700_000_000_000;
const BOSS_MAP = '몰락한 전초기지';
const FIELD_MAP = '얼음 성채';
const potion = makeItem(DB.ITEMS.consumables[0], () => 0.5, () => NOW);

const makePlayer = (over = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '리베이아',
    job: '전사',
    level: 20,
    hp: 6_000,
    maxHp: 6_000,
    mp: 120,
    maxMp: 120,
    atk: 40,
    def: 60,
    inv: [potion],
    ...over,
});

const buildCombatState = (player, enemy) => {
    let state = structuredClone(INITIAL_STATE);
    state = gameReducer(state, { type: AT.SET_PLAYER, payload: player });
    state = gameReducer(state, { type: AT.SET_ENEMY, payload: enemy });
    state = gameReducer(state, { type: AT.SET_GAME_STATE, payload: GS.COMBAT });
    return state;
};

const spawn = (map, player, options = {}) => spawnEnemy(
    DB.MAPS[map], player, [], { addLog: () => {} }, { rng: createSeededRandom(11), ...options },
).mStats;

// 소모품 턴 → 적 행동 전 지속 피해 틱으로 적이 쓰러진다(생명 1 + 화상).
const killByItemDot = (state) => gameReducer(state, {
    type: AT.USE_COMBAT_ITEM,
    payload: { itemId: potion.id, expectedTurn: 0, seed: 7, now: NOW },
});
const killByAttack = (state) => gameReducer(state, {
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: { kind: 'attack', expectedTurn: 0, seed: 7, now: NOW },
});

const seasonXp = (state) => state.player.seasonPass?.xp ?? 0;

test('Wave 61 A4: 소모품 턴의 지속 피해로 끝난 구역 보스전도 처치 기록 · 시즌 XP · 전투 기록을 남긴다', () => {
    const player = makePlayer({ loc: BOSS_MAP });
    const boss = spawn(BOSS_MAP, player, { forceAreaBoss: true });
    assert.equal(boss.baseName, DB.MAPS[BOSS_MAP].boss);

    const byDot = killByItemDot(buildCombatState(player, { ...boss, hp: 1, dots: ['burn'] }));
    const byAttack = killByAttack(buildCombatState(player, { ...boss, hp: 1 }));

    for (const [label, settled] of [['지속 피해', byDot], ['직접 공격', byAttack]]) {
        assert.equal(settled.gameState, GS.IDLE, `${label}: 승리로 끝난다`);
        assert.equal(settled.player.stats.areaBossDefeated?.[boss.baseName], true, `${label}: 구역 보스 처치 기록`);
        assert.equal(settled.player.stats.recentBattles?.length, 1, `${label}: 전투 기록 1건`);
        assert.ok(seasonXp(settled) >= SEASON_XP.bossKill, `${label}: 보스 처치 시즌 XP(+${SEASON_XP.bossKill}) — ${seasonXp(settled)}`);
    }
});

test('Wave 61 A4: 지속 피해 처치도 처치 수 마일스톤을 판정한다 (정확히 10번째 처치)', () => {
    const player = makePlayer({ loc: FIELD_MAP });
    const enemy = spawn(FIELD_MAP, player);
    const seeded = makePlayer({
        loc: FIELD_MAP,
        stats: { ...structuredClone(INITIAL_STATE.player.stats), killRegistry: { [enemy.baseName]: 9 } },
    });
    const settled = killByItemDot(buildCombatState(seeded, { ...enemy, hp: 1, dots: ['burn'] }));
    assert.equal(settled.player.stats.killRegistry[enemy.baseName], 10);
    const texts = settled.logs.map((entry) => entry.text).join('\n');
    assert.ok(texts.includes(`[${enemy.baseName}] 사냥꾼`), `10마리 마일스톤 로그가 없다:\n${texts.slice(-600)}`);
});

test('Wave 61 A4 · A11: 지속 피해로 쓰러진 공허의 신도 보상을 주고, 칭호는 실제 id(void_conqueror) 하나다', () => {
    const player = makePlayer({ loc: '금지된 도서관', level: 80 });
    const base = spawn(FIELD_MAP, player);
    const voidGod = { ...base, name: '공허의 신', baseName: '공허의 신', isBoss: true, hp: 1, dots: ['burn'] };
    const settled = killByItemDot(buildCombatState(player, voidGod));
    const titles = settled.player.titles || [];
    assert.ok(titles.includes('void_conqueror'), `titles: ${titles.join(', ')}`);
    assert.equal(titles.includes('허무의 정복자'), false, '효과 없는 표시 문자열을 칭호로 넣지 않는다');
    assert.equal(titles.filter((id) => id === 'void_conqueror').length, 1);
});

test('Wave 61 A5: 낮은 생명 승리는 50전 창이 아니라 누적으로 센다 — 3승 · 일반 50승 · 2승 = 5', () => {
    const threshold = BALANCE.LOW_HP_WIN_THRESHOLDS[0];
    let stats = {};
    const win = (hpRatio) => { stats = pushBattleRecord(stats, { result: 'win', hpRatio, ts: 0 }); };
    for (let i = 0; i < 3; i += 1) win(threshold / 2);
    for (let i = 0; i < 50; i += 1) win(1);
    for (let i = 0; i < 2; i += 1) win(threshold / 2);
    assert.equal(stats.recentBattles.length, 50, '창 자체는 50전으로 남는다(동적 난이도 입력)');
    assert.equal(getLowHpWinTotal(stats, threshold), 5);

    // 임무 62(20% 이하 5승)가 같은 누적을 읽는다 — 창만 읽던 동안 3/5였다.
    const quest = DB.QUESTS.find((entry) => entry.id === 62);
    assert.equal(quest.type, 'survive_low_hp');
    assert.equal(getCumulativeQuestProgress(quest, makePlayer({ stats })), 5);
});

test('Wave 61 A5: 누적이 처음 생길 때 기존 50전 창을 시드로 쓴다 (구세이브 진행도 보존)', () => {
    const threshold = BALANCE.LOW_HP_WIN_THRESHOLDS[0];
    const legacy = { recentBattles: Array.from({ length: 4 }, () => ({ result: 'win', hpRatio: threshold / 2, ts: 0 })) };
    assert.equal(getLowHpWinTotal(legacy, threshold), 4, '누적이 없으면 창을 그대로 읽는다');
    const next = pushBattleRecord(legacy, { result: 'win', hpRatio: threshold / 2, ts: 0 });
    assert.equal(getLowHpWinTotal(next, threshold), 5);
});
