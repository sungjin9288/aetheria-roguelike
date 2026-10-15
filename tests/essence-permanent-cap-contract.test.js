import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { BALANCE } from '../src/data/constants.js';
import { MIRROR_ENDLESS_NODES, MIRROR_NODES, getMirrorNode } from '../src/data/mirror.js';
import { MSG } from '../src/data/messages.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { carryEssenceLadderOnAscension, getLadderCarryRanks } from '../src/systems/essenceLedger.js';
import {
    getMirrorEndlessAffordance,
    getMirrorEndlessStatGain,
    getMirrorNodeCost,
    getSpentMirrorEssence,
    purchaseMirrorNode,
} from '../src/systems/mirrorUpgrades.js';
import { getAscensionOutcome } from '../src/utils/ascensionPreview.js';
import { getMirrorInvestmentPreview } from '../src/utils/mirrorJourney.js';
import AscensionScreen from '../src/components/AscensionScreen.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * Wave 114 (소유자 결정 "정수로 올릴 수 있는 능력치의 한계가 있어야" · "영구 총상한"): 정수로 산 능력치 중 계승 너머로 남는 것
 * — 넘어가는 정수 사다리와 끝없는 거울 — 에 천장을 건다.
 *
 * - 넘어가는 사다리는 비율(10%)과 고정 상한(100단계) 중 작은 쪽이다. 비율만 있던 동안 1회차 사다리가 800 → 1,370단계로 자라
 *   넘어가는 몫도 80 → 137단계로 따라 커졌고, 2회차 사망이 시드당 0.25(무사망 77%)였다(원장 §120).
 * - 끝없는 거울은 능력치마다 60단계까지다. 상한이 없던 동안 회차마다 6 ~ 7단계씩 직선으로 늘어 rank 12에 90단계였다(원장 §109).
 * - 둘을 합하면 정수로 계승 너머까지 남는 능력치는 능력치마다 160단계(공격력 +160 · 생명 +800 · 기력 +480)를 넘지 않는다.
 *   계승 보상(+PRESTIGE_*_BONUS)과 첫 죽음 보너스는 정수로 산 것이 아니라 이 천장 밖이다.
 */

const CARRY_MAX = BALANCE.ESSENCE_LADDER_ASCEND_CARRY_MAX_RANKS;
const ENDLESS_MAX = BALANCE.MIRROR_ENDLESS_MAX_LEVEL;
const FULL_TREE = Object.fromEntries(MIRROR_NODES.map((node) => [node.id, node.maxLevel]));
const ENDLESS_IDS = MIRROR_ENDLESS_NODES.map((node) => node.id);
const withEndless = (levels) => ({ ...FULL_TREE, ...Object.fromEntries(ENDLESS_IDS.map((id, i) => [id, levels[i]])) });

const ladderMeta = (rank, extra = {}) => ({
    essence: 5_000,
    essenceLifetime: rank * BALANCE.ESSENCE_PER_RANK,
    rank,
    bonusAtk: rank * BALANCE.ESSENCE_RANK_ATK,
    bonusHp: rank * BALANCE.ESSENCE_RANK_HP,
    bonusMp: rank * BALANCE.ESSENCE_RANK_MP,
    prestigeRank: 1,
    mirror: {},
    ...extra,
});
const playerWith = (meta = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '천장지기', level: 50, loc: '마왕성',
    meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 2, bonusAtk: 50, bonusHp: 250, bonusMp: 150, ...meta },
});
const stateWith = (player) => ({ ...structuredClone(INITIAL_STATE), gameState: GS.IDLE, bootStage: 'ready', player });
const buy = (state, nodeId) => gameReducer(state, {
    type: AT.PURCHASE_MIRROR_NODE,
    payload: { nodeId, expectedEssence: state.player.meta.essence, expectedLevel: Math.max(0, Number(state.player.meta.mirror?.[nodeId]) || 0) },
});

// ── 넘어가는 사다리 ─────────────────────────────────────────────────

test('Wave 114: 넘어가는 사다리는 비율과 고정 상한 중 작은 쪽이다', () => {
    assert.equal(CARRY_MAX, 100);
    assert.equal(BALANCE.ESSENCE_LADDER_ASCEND_CARRY, 0.1, '비율은 그대로 — 상한 아래에서는 이전과 같다');
    for (const [rank, kept] of [[0, 0], [9, 0], [500, 50], [812, 81], [999, 99], [1000, 100], [1366, 100], [5000, 100]]) {
        assert.equal(Math.floor(getLadderCarryRanks(rank)), kept, `${rank}단계`);
        assert.equal(carryEssenceLadderOnAscension(ladderMeta(rank)).rankKept, kept, `${rank}단계 이월`);
    }
});

test('Wave 114: 내려놓은 단계만큼 영구 능력치가 빠지고, 사다리 원장 · 정수는 남긴 단계에 맞는다', () => {
    const { meta, rankKept } = carryEssenceLadderOnAscension(ladderMeta(1366));
    assert.equal(rankKept, CARRY_MAX);
    assert.equal(meta.rank, CARRY_MAX);
    assert.equal(meta.bonusAtk, CARRY_MAX * BALANCE.ESSENCE_RANK_ATK);
    assert.equal(meta.bonusHp, CARRY_MAX * BALANCE.ESSENCE_RANK_HP);
    assert.equal(meta.bonusMp, CARRY_MAX * BALANCE.ESSENCE_RANK_MP);
    assert.equal(meta.essenceLadder, CARRY_MAX * BALANCE.ESSENCE_PER_RANK);
    assert.equal(meta.essence, 5_000, '쓸 수 있는 정수는 그대로');
    assert.equal(meta.essenceLifetime, 1366 * BALANCE.ESSENCE_PER_RANK, '누적 정수는 그대로');
});

test('Wave 114: 회차 규칙 다시 뽑기의 대가는 상한이 걸린 몫에서 덜어낸다(Wave 95 대가가 상한 뒤에도 실제로 든다)', () => {
    assert.equal(carryEssenceLadderOnAscension(ladderMeta(1366), 0.5).rankKept, Math.floor(CARRY_MAX * 0.5));
    assert.equal(carryEssenceLadderOnAscension(ladderMeta(1366), 0.25).rankKept, Math.floor(CARRY_MAX * 0.25));
    assert.equal(carryEssenceLadderOnAscension(ladderMeta(400), 0.5).rankKept, 20, '상한 아래는 Wave 95 그대로');
});

test('Wave 114: 계승 화면 — 넘어가는 몫 줄이 상한을 말하고, 영구 성장 칸은 상한이 걸린 값이다', () => {
    const player = playerWith({ ...ladderMeta(1366), prestigeRank: 2 });
    const outcome = getAscensionOutcome(player.meta);
    assert.equal(outcome.ladder.rankKept, CARRY_MAX);
    assert.equal(outcome.meta.bonusAtk, CARRY_MAX * BALANCE.ESSENCE_RANK_ATK + BALANCE.PRESTIGE_ATK_BONUS);
    const html = renderStatic(createElement(AscensionScreen, { player }));
    assert.ok(html.includes(MSG.ASCEND_LADDER_CARRY(1366, CARRY_MAX, 10, CARRY_MAX)), '줄에 상한이 보인다');
});

// ── 끝없는 거울 ─────────────────────────────────────────────────────

test('Wave 114: 끝없는 거울은 능력치마다 60단계까지다 — 순수 함수 · 리듀서 모두 거부한다', () => {
    assert.equal(ENDLESS_MAX, 60);
    for (const nodeId of ENDLESS_IDS) {
        assert.equal(getMirrorNode(nodeId).maxLevel, ENDLESS_MAX);
        const almost = withEndless(ENDLESS_IDS.map((id) => (id === nodeId ? ENDLESS_MAX - 1 : 0)));
        assert.equal(purchaseMirrorNode(almost, nodeId, 1e9).success, true, '59 → 60은 산다');
        const full = withEndless(ENDLESS_IDS.map((id) => (id === nodeId ? ENDLESS_MAX : 0)));
        assert.equal(purchaseMirrorNode(full, nodeId, 1e9).success, false, '60에서 멈춘다');
        const state = stateWith(playerWith({ mirror: full, essence: 1e9 }));
        assert.equal(buy(state, nodeId), state, '리듀서도 같은 참조');
        const preview = getMirrorInvestmentPreview(nodeId, full, 1e9);
        assert.equal(preview.maxed, true);
        assert.equal(preview.canAfford, false);
        assert.equal(preview.nextCost, null);
    }
});

test('Wave 114: 리듀서로 60단계까지 사면 그 능력치는 정확히 60단계 몫만 오른다', () => {
    let state = stateWith(playerWith({ mirror: FULL_TREE, essence: 10_000_000, bonusAtk: 0 }));
    for (let i = 0; i < ENDLESS_MAX + 5; i += 1) state = buy(state, 'endless_atk');
    assert.equal(state.player.meta.mirror.endless_atk, ENDLESS_MAX);
    assert.equal(state.player.meta.bonusAtk, ENDLESS_MAX * getMirrorEndlessStatGain('atk'));
});

test('Wave 114: 계승 화면의 "살 수 있는 단계"는 한계를 넘지 않고, 셋 다 닿으면 한계 문구다', () => {
    assert.equal(getMirrorEndlessAffordance(withEndless([58, ENDLESS_MAX, ENDLESS_MAX]), 1e9).steps, 2);
    assert.equal(getMirrorEndlessAffordance(withEndless([20, 20, 20]), 1e12).steps, 3 * (ENDLESS_MAX - 20), '상한 비용 뒤 닫힌 식도 남은 단계까지');
    assert.equal(getMirrorEndlessAffordance(withEndless([0, 0, 0]), 1e12).steps, 3 * ENDLESS_MAX);
    const done = getMirrorEndlessAffordance(withEndless([ENDLESS_MAX, ENDLESS_MAX, ENDLESS_MAX]), 1e9);
    assert.deepEqual(done, { unlocked: true, steps: 0, nextCost: null, shortfall: 0, maxed: true });
    // 한 능력치만 남았으면 그 능력치의 비용으로 센다.
    const one = getMirrorEndlessAffordance(withEndless([ENDLESS_MAX, ENDLESS_MAX, 10]), 1e9);
    assert.equal(one.nextCost, getMirrorNodeCost(getMirrorNode('endless_mp'), 10));
    assert.equal(one.steps, ENDLESS_MAX - 10);

    const player = playerWith({ ...ladderMeta(300), prestigeRank: 3, essence: 1e6, mirror: withEndless([ENDLESS_MAX, ENDLESS_MAX, ENDLESS_MAX]) });
    const html = renderStatic(createElement(AscensionScreen, { player }));
    assert.ok(html.includes(MSG.ASCEND_MIRROR_ENDLESS_MAXED(ENDLESS_MAX)));
    assert.ok(!html.includes(MSG.ASCEND_MIRROR_ENDLESS_SHORT(getAscensionOutcome(player.meta).meta.essence, 0)));
});

test('Wave 114: 거울 화면 문구 — 끝없는 단계는 지금 / 한계로 읽고, 노드 설명 · 경로 요약이 한계를 말한다', () => {
    // 끝없는 경로는 탭을 눌러야 그려진다 — 렌더 확인은 e2e `mirror-journey-design.spec.ts`(0/60 → 1/60단계)가 한다.
    assert.equal(MSG.MIRROR_ENDLESS_LEVEL(7, ENDLESS_MAX), `7/${ENDLESS_MAX}단계`);
    for (const node of MIRROR_ENDLESS_NODES) assert.ok(node.desc.includes(`${ENDLESS_MAX}단계`), `${node.id} 설명이 한계를 말한다`);
    assert.ok(MSG.MIRROR_ENDLESS_PATH_SUMMARY.includes('한계'));
});

test('Wave 114: 한계 전에 더 산 이전 세이브 — 단계는 한계로 읽고 더 사지 못하며, 이미 쓴 정수는 그대로 센다', () => {
    const old = withEndless([90, 0, 0]);
    assert.equal(getMirrorInvestmentPreview('endless_atk', old, 1e9).currentLevel, ENDLESS_MAX);
    assert.equal(purchaseMirrorNode(old, 'endless_atk', 1e9).success, false);
    let brute = 0;
    for (let k = 0; k < 90; k += 1) brute += getMirrorNodeCost(getMirrorNode('endless_atk'), k);
    assert.equal(getSpentMirrorEssence(withEndless([90, 0, 0])) - getSpentMirrorEssence(withEndless([0, 0, 0])), brute);
});

// ── 합: 정수로 계승 너머까지 남는 능력치의 천장 ─────────────────────────

test('Wave 114: 계승을 몇 번 거듭해도 정수로 남는 영구 능력치는 능력치마다 이월 상한 + 거울 한계를 넘지 않는다', () => {
    // 매 회차 사다리를 크게(2,000단계) 쌓고 끝없는 거울을 살 수 있는 만큼 산 뒤 계승한다 — 가장 빨리 강해지는 플레이어.
    let state = stateWith(playerWith({ ...ladderMeta(0), prestigeRank: 0, essence: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0, mirror: FULL_TREE }));
    for (let cycle = 0; cycle < 15; cycle += 1) {
        const meta = state.player.meta;
        const climbed = 2000;
        state = { ...state, player: { ...state.player, meta: {
            ...meta,
            rank: (meta.rank || 0) + climbed,
            essenceLadder: ((meta.rank || 0) + climbed) * BALANCE.ESSENCE_PER_RANK,
            essenceLifetime: (meta.essenceLifetime || 0) + climbed * BALANCE.ESSENCE_PER_RANK,
            essence: (meta.essence || 0) + 200_000,
            bonusAtk: (meta.bonusAtk || 0) + climbed * BALANCE.ESSENCE_RANK_ATK,
            bonusHp: (meta.bonusHp || 0) + climbed * BALANCE.ESSENCE_RANK_HP,
            bonusMp: (meta.bonusMp || 0) + climbed * BALANCE.ESSENCE_RANK_MP,
        } } };
        for (let i = 0; i < 40; i += 1) for (const id of ENDLESS_IDS) state = buy(state, id);
        const next = getAscensionOutcome(state.player.meta).meta;
        state = { ...state, player: { ...state.player, meta: next } };
        const prestige = next.prestigeRank;
        const essenceBought = {
            atk: next.bonusAtk - prestige * BALANCE.PRESTIGE_ATK_BONUS,
            hp: next.bonusHp - prestige * BALANCE.PRESTIGE_HP_BONUS,
            mp: next.bonusMp - prestige * BALANCE.PRESTIGE_MP_BONUS,
        };
        assert.ok(essenceBought.atk <= (CARRY_MAX + ENDLESS_MAX) * BALANCE.ESSENCE_RANK_ATK, `회차 ${cycle + 1} 공격력 ${essenceBought.atk}`);
        assert.ok(essenceBought.hp <= (CARRY_MAX + ENDLESS_MAX) * BALANCE.ESSENCE_RANK_HP, `회차 ${cycle + 1} 생명 ${essenceBought.hp}`);
        assert.ok(essenceBought.mp <= (CARRY_MAX + ENDLESS_MAX) * BALANCE.ESSENCE_RANK_MP, `회차 ${cycle + 1} 기력 ${essenceBought.mp}`);
    }
    // 천장에 실제로 닿는다(빈 단언이 아니다).
    const final = state.player.meta;
    assert.equal(final.bonusAtk - final.prestigeRank * BALANCE.PRESTIGE_ATK_BONUS, (CARRY_MAX + ENDLESS_MAX) * BALANCE.ESSENCE_RANK_ATK);
});
