import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { BALANCE, CONSTANTS } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';
import { buildClassVitals } from '../src/hooks/gameActions/_shared.ts';
import { createCharacterActions } from '../src/hooks/gameActions/characterActions.ts';
import { getAscensionOutcome } from '../src/utils/ascensionPreview.ts';
import AscensionScreen from '../src/components/AscensionScreen.tsx';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * 2026-09 Wave 40 — 소유자 결정 "게임을 더 하드하게" (영구 스탯 레벨 연동 + 계승 rank 적 레벨 가산).
 *
 * 계승으로 넘어온 영구 스탯이 Lv1부터 전부 적용되던 동안 계승 런은 사망이 원래 나는 초반을 건너뛰었다
 * (16시드 × 계승 4회: 런별 사망 26/0/0/4, 2·3회차는 16시드 모두 0). 곱하는 적 강화(rank당 15%)나
 * 후반 적 공격력 기울기로는 2회차 사망이 0 그대로였다. 원인은 넘어온 **생명**이었다(공격력만 연동하면 28/0/1/1).
 */

const FULL = BALANCE.META_BONUS_FULL_LEVEL;
const RANK_META = { prestigeRank: 1, bonusAtk: 120, bonusHp: 600, bonusMp: 360 };

test('[상수] 영구 스탯은 Lv30에 전부 적용되고, 적 레벨은 rank당 +1 · 상한 +3이다', () => {
    assert.equal(FULL, 30);
    assert.equal(BALANCE.PRESTIGE_ENEMY_LEVEL_PER_RANK, 1);
    assert.equal(BALANCE.PRESTIGE_ENEMY_LEVEL_MAX, 3);
});

test('[전투 공격력] 영구 공격력은 레벨에 비례해 더해지고 Lv30부터 전부다', () => {
    const atkAt = (level, meta) => calculateFullStats(makePlayerFixture({ level, meta, relics: [], equip: {} })).atk;
    const bonusAt = (level) => atkAt(level, RANK_META) - atkAt(level, { ...RANK_META, bonusAtk: 0 });
    const full = bonusAt(FULL);
    assert.ok(full > 100, `전제: Lv30 영구 공격력 몫 ${full}`);
    assert.equal(bonusAt(FULL + 20), full, 'Lv30 뒤로는 그대로');
    assert.ok(Math.abs(bonusAt(FULL / 2) - full / 2) <= 1, `Lv15는 절반: ${bonusAt(FULL / 2)} vs ${full / 2}`);
    assert.ok(bonusAt(1) <= Math.ceil(full / FULL) + 1, `Lv1은 1/30: ${bonusAt(1)}`);
});

test('[재구성] 직업 생명 · 기력은 영구 생명 · 기력 × 연동 비율만 굽고, 전체량 스냅숏을 남긴다', () => {
    const base = buildClassVitals(1, '모험가', { prestigeRank: 0 });
    const lv1 = buildClassVitals(1, '모험가', RANK_META);
    assert.equal(lv1.maxHp - base.maxHp, Math.floor(600 / FULL));
    assert.equal(lv1.maxMp - base.maxMp, Math.floor(360 / FULL));
    assert.deepEqual(lv1.metaVitalsSnapshot, { hp: 600, mp: 360 });
    const lv40 = buildClassVitals(40, '모험가', RANK_META);
    assert.equal(lv40.maxHp - buildClassVitals(40, '모험가', { prestigeRank: 0 }).maxHp, 600, 'Lv30 뒤 전직은 전부');
});

test('[새 게임] start()는 연동된 생명으로 시작하고 스냅숏을 기록한다', () => {
    const dispatches = [];
    createCharacterActions({
        player: { meta: RANK_META, stats: {} },
        gameState: 'idle',
        dispatch: (action) => dispatches.push(action),
        addLog: () => {},
        addStoryLog: () => {},
        getFullStats: (p) => ({ maxHp: p.maxHp, maxMp: p.maxMp }),
    }, { emitUnlockedTitles: () => {} }).start('시험자', 'male', '모험가', []);
    const set = dispatches.find((action) => action.type === 'SET_PLAYER');
    const expected = buildClassVitals(1, '모험가', RANK_META);
    assert.equal(set.payload.maxHp, expected.maxHp);
    assert.deepEqual(set.payload.metaVitalsSnapshot, { hp: 600, mp: 360 });
});

test('[레벨업] 연동 비율이 오른 만큼만 더 굽는다 — 어느 레벨에서든 차이 = ⌊스냅숏 × 비율⌋', () => {
    const start = { ...structuredClone(INITIAL_STATE.player), level: 1, exp: 0, nextExp: 10, relics: [] };
    const baked = buildClassVitals(1, '모험가', RANK_META);
    const withRamp = { ...start, maxHp: baked.maxHp, hp: baked.maxHp, maxMp: baked.maxMp, mp: baked.maxMp, meta: RANK_META, metaVitalsSnapshot: baked.metaVitalsSnapshot };
    const plain = { ...start, ...buildClassVitals(1, '모험가', { prestigeRank: 0 }), meta: { prestigeRank: 0 } };
    delete plain.metaVitalsSnapshot;
    let a = withRamp;
    let b = plain;
    for (let level = 2; level <= 40; level += 1) {
        a = CombatEngine.applyExpGain(a, a.nextExp).updatedPlayer;
        b = CombatEngine.applyExpGain(b, b.nextExp).updatedPlayer;
        assert.equal(a.level, level);
        assert.equal(a.maxHp - b.maxHp, Math.floor(600 * Math.min(1, level / FULL)), `Lv${level} 생명`);
        assert.equal(a.maxMp - b.maxMp, Math.floor(360 * Math.min(1, level / FULL)), `Lv${level} 기력`);
    }
});

test('[기존 세이브] 스냅숏이 없으면 레벨업은 예전 그대로(직업 생명만) 오른다', () => {
    const legacy = { ...structuredClone(INITIAL_STATE.player), level: 5, exp: 0, nextExp: 10, maxHp: 900, hp: 900, meta: RANK_META, relics: [] };
    delete legacy.metaVitalsSnapshot;
    const next = CombatEngine.applyExpGain(legacy, legacy.nextExp).updatedPlayer;
    assert.equal(next.maxHp - legacy.maxHp, BALANCE.HP_PER_LEVEL);
});

test('[사망 재시작] 새 런은 Lv1 비율의 영구 생명으로 시작하고 스냅숏을 남긴다', () => {
    const dying = { ...structuredClone(INITIAL_STATE.player), level: 33, hp: 0, meta: RANK_META, stats: { deaths: 3 } };
    const { updatedPlayer } = CombatEngine.handleDefeat(dying, INITIAL_STATE.player, () => 0.5, () => 1);
    assert.equal(updatedPlayer.maxHp, INITIAL_STATE.player.maxHp + Math.floor(600 / FULL));
    assert.deepEqual(updatedPlayer.metaVitalsSnapshot, { hp: 600, mp: 360 });
    assert.equal(updatedPlayer.hp, updatedPlayer.maxHp);
});

test('[적 레벨 가산] 계승 rank만큼 적의 생명 · 공격력 · 방어력 레벨이 오르고, 보상 · 표시 레벨은 그대로다', () => {
    const map = DB.MAPS['용의 둥지'];
    const spawnAt = (rank, level = map.level) => spawnEnemy(
        { ...map, level, monsters: ['화염 와이번'], boss: false, bossMonsters: [] },
        { level: 40, loc: '용의 둥지', relics: [], meta: { prestigeRank: rank }, stats: {} },
        [],
        { addLog: () => {} },
        { rng: () => 0.99 },
    ).mStats;
    const statMult = (rank) => 1 + rank * BALANCE.PRESTIGE_ENEMY_STAT_PER_RANK;
    const rewardMult = (rank) => 1 + rank * BALANCE.PRESTIGE_ENEMY_REWARD_PER_RANK;
    const base = spawnAt(0);
    for (const [rank, bonus] of [[1, 1], [2, 2], [3, 3], [7, 3]]) {
        const enemy = spawnAt(rank);
        const shifted = spawnAt(0, map.level + bonus);
        assert.equal(enemy.level, map.level, `rank ${rank}: 표시 레벨`);
        assert.equal(enemy.maxHp, Math.floor(shifted.maxHp * statMult(rank)), `rank ${rank}: 생명`);
        assert.equal(enemy.atk, Math.floor(shifted.atk * statMult(rank)), `rank ${rank}: 공격력`);
        assert.equal(enemy.def, Math.floor(shifted.def * statMult(rank)), `rank ${rank}: 방어력`);
        assert.equal(enemy.exp, Math.floor(base.exp * rewardMult(rank)), `rank ${rank}: 경험치는 원래 레벨 기준`);
        assert.equal(enemy.gold, Math.floor(base.gold * rewardMult(rank)), `rank ${rank}: 골드는 원래 레벨 기준`);
    }
});

test('[계승 화면] 다음 세계의 적 레벨 가산과 영구 스탯 연동을 알린다', () => {
    const outcome = getAscensionOutcome({ prestigeRank: 1 });
    assert.equal(outcome.currentEnemyLevelBonus, 1);
    assert.equal(outcome.nextEnemyLevelBonus, 2);
    assert.equal(outcome.metaBonusFullLevel, FULL);
    const html = renderStatic(createElement(AscensionScreen, { player: makePlayerFixture({ meta: { prestigeRank: 1 }, quests: [] }) }));
    assert.ok(html.includes('data-testid="ascension-enemy-level"'));
    assert.ok(html.includes('data-testid="ascension-meta-ramp"'));
    assert.ok(html.includes(`Lv${FULL}`));
    assert.ok(CONSTANTS.MAX_LEVEL >= FULL);
});
