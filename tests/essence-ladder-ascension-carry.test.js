import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { BALANCE } from '../src/data/constants.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { applyEssenceGain, getEssenceLifetime } from '../src/systems/essenceLedger.ts';
import { getAscensionOutcome } from '../src/utils/ascensionPreview.ts';
import AscensionScreen from '../src/components/AscensionScreen.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-09 Wave 32 (소유자 결정 "계승 시 정수 사다리 10% 이월").
 *
 * 정수 사다리(처치당 exp/8 정수 → 150마다 공격력 +1 · 생명 +5 · 기력 +3)는 한 런에 800단계 안팎을 쌓았고, 그것이
 * 통째로 다음 런에 넘어가 계승 런 48판 사망이 0이었다(원장 §31.4 · §32). 사다리는 1회차 후반 성장의 큰 몫이기도 해서
 * (획득량을 줄이면 1회차가 23% 길어졌다) 획득은 그대로 두고, 계승할 때만 단계의 10%를 남긴다. 사망 재시작은 건드리지 않는다.
 * 누적 정수(`essenceLifetime`)와 쓸 수 있는 정수(`essence`)는 줄지 않는다 — 줄어드는 것은 사다리 원장(`essenceLadder`)이다.
 */

const ladderMeta = (rank, extra = {}) => ({
    essence: 5_000,
    essenceLifetime: rank * BALANCE.ESSENCE_PER_RANK + 90,
    rank,
    // 첫 죽음 보너스(2/20)와 지난 계승 1회의 프레스티지 보너스가 사다리 몫 위에 얹혀 있다.
    bonusAtk: rank * BALANCE.ESSENCE_RANK_ATK + BALANCE.FIRST_DEATH_BONUS_ATK + BALANCE.PRESTIGE_ATK_BONUS,
    bonusHp: rank * BALANCE.ESSENCE_RANK_HP + BALANCE.FIRST_DEATH_BONUS_HP + BALANCE.PRESTIGE_HP_BONUS,
    bonusMp: rank * BALANCE.ESSENCE_RANK_MP + BALANCE.PRESTIGE_MP_BONUS,
    prestigeRank: 1,
    mirror: {},
    ...extra,
});

test('[이월] 계승하면 사다리 단계의 10%만 남고, 사다리 몫이 아닌 영구 보너스는 그대로다', () => {
    assert.equal(BALANCE.ESSENCE_LADDER_ASCEND_CARRY, 0.1);
    const outcome = getAscensionOutcome(ladderMeta(812));
    assert.equal(outcome.meta.rank, 81);
    assert.equal(outcome.ladder.rankBefore, 812);
    assert.equal(outcome.ladder.rankKept, 81);
    const dropped = 812 - 81;
    assert.equal(outcome.meta.bonusAtk, ladderMeta(812).bonusAtk - dropped * BALANCE.ESSENCE_RANK_ATK + BALANCE.PRESTIGE_ATK_BONUS);
    assert.equal(outcome.meta.bonusHp, ladderMeta(812).bonusHp - dropped * BALANCE.ESSENCE_RANK_HP + BALANCE.PRESTIGE_HP_BONUS);
    assert.equal(outcome.meta.bonusMp, ladderMeta(812).bonusMp - dropped * BALANCE.ESSENCE_RANK_MP + BALANCE.PRESTIGE_MP_BONUS);
});

test('[원장] 누적 정수와 쓸 수 있는 정수는 줄지 않고, 이후 획득은 남은 단계에서 이어 오른다', () => {
    const before = ladderMeta(812);
    const outcome = getAscensionOutcome(before);
    assert.equal(outcome.meta.essence, before.essence + BALANCE.PRESTIGE_ESSENCE_REWARD);
    assert.equal(getEssenceLifetime(outcome.meta), before.essenceLifetime + BALANCE.PRESTIGE_ESSENCE_REWARD);
    // 계승 보상 정수(200)는 예전처럼 사다리에도 들어간다 — 다음 획득에서 +1단계.
    const next = applyEssenceGain(outcome.meta, 1);
    assert.equal(next.meta.rank, 81 + Math.floor(BALANCE.PRESTIGE_ESSENCE_REWARD / BALANCE.ESSENCE_PER_RANK));
    const more = applyEssenceGain(next.meta, BALANCE.ESSENCE_PER_RANK);
    assert.equal(more.meta.rank, next.meta.rank + 1, '누적 정수가 크다고 옛 단계로 되튀지 않는다');
    assert.equal(more.rankGain, 1);
});

test('[구세이브] 사다리 원장이 없는 세이브는 누적 정수를 사다리로 읽는다(기존 획득 동작 불변)', () => {
    const legacy = { essence: 40, essenceLifetime: 40, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 };
    const granted = applyEssenceGain(legacy, 120);
    assert.equal(granted.meta.rank, 1);
    assert.equal(granted.rankGain, 1);
    assert.equal(granted.meta.essenceLifetime, 160);
});

test('[계승 전이] ASCEND가 이월된 meta로 새 런을 연다', () => {
    const state = {
        ...structuredClone(INITIAL_STATE),
        bootStage: 'ready',
        gameState: GS.ASCENSION,
        player: {
            ...structuredClone(INITIAL_STATE.player),
            name: '계승자',
            level: 49,
            quests: [],
            meta: { ...structuredClone(INITIAL_STATE.player.meta), ...ladderMeta(812) },
        },
    };
    const next = gameReducer(state, { type: AT.ASCEND, payload: { expectedPrestigeRank: 1, sourceReceiptKey: null } });
    assert.equal(next.player.meta.prestigeRank, 2, '비공허: 계승이 적용됐다');
    assert.equal(next.player.meta.rank, 81);
    assert.equal(next.player.meta.bonusAtk, getAscensionOutcome(state.player.meta).meta.bonusAtk);
});

test('[표시] 계승 화면이 사다리 이월을 설명한다', () => {
    const player = {
        ...structuredClone(INITIAL_STATE.player),
        name: '계승자',
        level: 49,
        quests: [],
        meta: { ...structuredClone(INITIAL_STATE.player.meta), ...ladderMeta(812) },
    };
    const html = renderStatic(createElement(AscensionScreen, { player, actions: new Proxy({}, { get: () => () => {} }) }));
    assert.ok(html.includes('data-testid="ascension-ladder-carry"'));
    assert.ok(html.includes('812'), '이전 단계');
    assert.ok(html.includes('81'), '남는 단계');
});

test('[사망] 사망 재시작은 사다리를 줄이지 않는다(이월은 계승 전용)', async () => {
    const { CombatEngine } = await import('../src/systems/CombatEngine.ts');
    const player = { ...structuredClone(INITIAL_STATE.player), name: 'x', level: 30, meta: { ...structuredClone(INITIAL_STATE.player.meta), ...ladderMeta(812) }, stats: { ...structuredClone(INITIAL_STATE.player.stats), deaths: 2 } };
    const restarted = CombatEngine.handleDefeat(player, INITIAL_STATE.player, () => 0.5, () => 0).updatedPlayer;
    assert.equal(restarted.meta.rank, 812);
    assert.equal(restarted.meta.bonusAtk, player.meta.bonusAtk);
});
