import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { BALANCE } from '../src/data/constants.js';
import { MIRROR_ENDLESS_NODES, MIRROR_NODES, MIRROR_TREE_TOTAL_COST, getMirrorNode } from '../src/data/mirror.js';
import { MSG } from '../src/data/messages.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { carryEssenceLadderOnAscension } from '../src/systems/essenceLedger.js';
import { getRampedMetaAtk, snapshotMetaVitals } from '../src/systems/metaBonusRamp.js';
import {
    getMirrorEffects,
    getMirrorEndlessStatGain,
    getMirrorNodeCost,
    getSpentMirrorEssence,
    isMirrorTreeComplete,
    purchaseMirrorNode,
} from '../src/systems/mirrorUpgrades.js';
import { getAscensionOutcome } from '../src/utils/ascensionPreview.js';
import { migrateData } from '../src/utils/dataMigration.js';
import { getMirrorCompletion, getMirrorEffectLabel, getMirrorInvestmentPreview, MIRROR_PATHS } from '../src/utils/mirrorJourney.js';
import MirrorPanel from '../src/components/MirrorPanel.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * Wave 96 (소유자 결정 "거울 확장 — 적은 능력치를 많은 정수로 구매하는 구조로 하면 강해지는 속도가 줄어서 할만할 것"):
 * 거울 8노드를 모두 채우면 끝없는 단계 셋(영구 공격력 · 생명 · 기력)이 열린다. 단계마다 비용이 오르고(2,000 + 500 × 단계),
 * 한 단계는 정수 사다리 한 단계와 같은 양이다. 정수는 회차마다 18만 ~ 30만씩 쌓였고 거울 8노드는 1회차 약 15시간에 다 차서
 * 7회차 끝에 쓸 곳 없는 정수가 중앙값 167만이었다(원장 §101).
 */

const FULL_TREE = Object.fromEntries(MIRROR_NODES.map((node) => [node.id, node.maxLevel]));
const STATS = { endless_atk: 'atk', endless_hp: 'hp', endless_mp: 'mp' };
const BONUS_KEY = { atk: 'bonusAtk', hp: 'bonusHp', mp: 'bonusMp' };

const playerWith = (meta = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '거울지기', level: 40,
    meta: { ...structuredClone(INITIAL_STATE.player.meta), essence: 100_000, bonusAtk: 50, bonusHp: 250, bonusMp: 150, ...meta },
});
const stateWith = (player) => ({ ...structuredClone(INITIAL_STATE), gameState: GS.IDLE, bootStage: 'ready', player });
const buy = (state, nodeId) => gameReducer(state, {
    type: AT.PURCHASE_MIRROR_NODE,
    payload: { nodeId, expectedEssence: state.player.meta.essence, expectedLevel: Math.max(0, Number(state.player.meta.mirror?.[nodeId]) || 0) },
});

test('Wave 96: 끝없는 단계는 셋(공격 · 생명 · 기력)이고 상수 · 노드 조회가 맞다 — 8노드 총액은 그대로다', () => {
    assert.deepEqual(MIRROR_ENDLESS_NODES.map((node) => [node.id, node.endless.stat]), Object.entries(STATS));
    for (const node of MIRROR_ENDLESS_NODES) assert.equal(getMirrorNode(node.id), node);
    assert.equal(BALANCE.MIRROR_ENDLESS_BASE_COST, 2000);
    assert.equal(BALANCE.MIRROR_ENDLESS_COST_STEP, 500);
    assert.equal(BALANCE.MIRROR_ENDLESS_COST_CAP, 12000);
    assert.deepEqual(['atk', 'hp', 'mp'].map(getMirrorEndlessStatGain), [BALANCE.ESSENCE_RANK_ATK, BALANCE.ESSENCE_RANK_HP, BALANCE.ESSENCE_RANK_MP],
        '한 단계 = 정수 사다리 한 단계와 같은 양');
    assert.equal(MIRROR_TREE_TOTAL_COST, MIRROR_NODES.reduce((t, n) => t + n.costs.reduce((a, b) => a + b, 0), 0));
    assert.equal(getMirrorCompletion(FULL_TREE).completed, getMirrorCompletion(FULL_TREE).total, '완성 표시는 8노드만 센다');
    assert.deepEqual(getMirrorEffects({ mirror: { ...FULL_TREE, endless_atk: 9 } }), getMirrorEffects({ mirror: FULL_TREE }), '끝없는 단계는 거울 효과를 바꾸지 않는다');
});

test('Wave 96: 거울 8노드를 다 채우기 전에는 잠겨 있다 — 하나라도 모자라면 사지 못한다', () => {
    assert.equal(isMirrorTreeComplete(FULL_TREE), true);
    for (const node of MIRROR_NODES) {
        const missing = { ...FULL_TREE, [node.id]: node.maxLevel - 1 };
        assert.equal(isMirrorTreeComplete(missing), false, node.id);
        assert.equal(purchaseMirrorNode(missing, 'endless_atk', 1e9).success, false);
        const state = stateWith(playerWith({ mirror: missing }));
        assert.equal(buy(state, 'endless_atk'), state, `${node.id}가 모자라면 리듀서도 거부`);
        const preview = getMirrorInvestmentPreview('endless_atk', missing, 1e9);
        assert.equal(preview.locked, true);
        assert.equal(preview.canAfford, false);
    }
});

test('Wave 96: 비용은 단계마다 오르고, 한 단계마다 그 영구 능력치가 오르며 정수가 그만큼 준다', () => {
    for (const [nodeId, stat] of Object.entries(STATS)) {
        let state = stateWith(playerWith({ mirror: FULL_TREE, essence: 1_000_000 }));
        const key = BONUS_KEY[stat];
        for (let k = 0; k < 6; k += 1) {
            const cost = getMirrorNodeCost(getMirrorNode(nodeId), k);
            assert.equal(cost, 2000 + 500 * k);
            const before = state.player.meta;
            state = buy(state, nodeId);
            assert.equal(state.player.meta.mirror[nodeId], k + 1);
            assert.equal(state.player.meta.essence, before.essence - cost);
            assert.equal(state.player.meta[key], before[key] + getMirrorEndlessStatGain(stat));
            for (const other of Object.values(BONUS_KEY).filter((x) => x !== key)) assert.equal(state.player.meta[other], before[other], '다른 능력치는 그대로');
            assert.ok(state.logs.at(-1).text.includes(MSG.MIRROR_ENDLESS_STAT_LABELS[stat]));
        }
    }
});

test('Wave 96: 정수가 모자라거나 화면이 본 정수 · 단계가 다르면(연타 · 늦은 요청) 사지 않는다', () => {
    const poor = stateWith(playerWith({ mirror: FULL_TREE, essence: 1999 }));
    assert.equal(buy(poor, 'endless_hp'), poor);
    const state = stateWith(playerWith({ mirror: FULL_TREE, essence: 50_000 }));
    const action = { type: AT.PURCHASE_MIRROR_NODE, payload: { nodeId: 'endless_hp', expectedEssence: 50_000, expectedLevel: 0 } };
    const once = gameReducer(state, action);
    assert.equal(gameReducer(once, action), once, '같은 화면 스냅숏으로 두 번 사지 못한다');
});

test('Wave 97: 비용은 20단계까지 오르다가 상한(12,000)에서 멈춘다 — 회차마다 사는 단계가 줄어들지 않는다', () => {
    // 원장 §102: 계속 오르던 동안(Wave 96) 회차마다 능력치당 사는 단계가 13 → 7 → 6 → 5 → 4 → 5 → 3으로 줄었다
    //   (회차 수입은 거의 일정하다) — 소유자 결정 "비용이 너무 가파르게 증가하면 반복되는 플레이에 질린다".
    const node = getMirrorNode('endless_atk');
    const costs = Array.from({ length: 60 }, (_, k) => getMirrorNodeCost(node, k));
    assert.equal(costs[0], 2000);
    assert.equal(costs[19], 11500);
    for (let k = 20; k < 60; k += 1) assert.equal(costs[k], 12000, `${k}단계`);
    for (let k = 1; k < 60; k += 1) assert.ok(costs[k] >= costs[k - 1], '내려가지 않는다');
    // 상한 뒤에는 같은 정수로 언제나 같은 단계 수를 산다.
    const stepsWith = (from, budget) => { let k = from; let left = budget; while (left >= getMirrorNodeCost(node, k)) { left -= getMirrorNodeCost(node, k); k += 1; } return k - from; };
    assert.equal(stepsWith(25, 60_000), stepsWith(80, 60_000));
    assert.equal(stepsWith(80, 60_000), 5);
    // 여전히 적은 능력치를 많은 정수로 — 첫 단계도 정수 사다리 한 단계(150)의 13배 이상, 상한은 80배다.
    assert.ok(getMirrorNodeCost(node, 0) >= 13 * BALANCE.ESSENCE_PER_RANK);
    assert.equal(BALANCE.MIRROR_ENDLESS_COST_CAP / BALANCE.ESSENCE_PER_RANK, 80);
});

test('Wave 97: 지출 역산은 상한 뒤 단계도 그 비용 그대로 센다(낱낱이 더한 값과 같다)', () => {
    const node = getMirrorNode('endless_hp');
    let brute = 0;
    for (let levels = 0; levels <= 80; levels += 1) {
        assert.equal(getSpentMirrorEssence({ endless_hp: levels }), brute, `${levels}단계`);
        brute += getMirrorNodeCost(node, levels);
    }
    assert.equal(getSpentMirrorEssence({ endless_hp: 30 }), 135_000 + 10 * 12_000);
});

test('Wave 96: 지출 역산(누적 정수 백필)은 끝없는 단계를 포함한다', () => {
    const mirror = { ...FULL_TREE, endless_atk: 4, endless_hp: 2 };
    const expected = MIRROR_TREE_TOTAL_COST + [0, 1, 2, 3].reduce((t, k) => t + 2000 + 500 * k, 0) + 2000 + 2500;
    assert.equal(getSpentMirrorEssence(mirror), expected);
    const migrated = migrateData({ player: { ...playerWith({ mirror, essence: 7 }), meta: { ...playerWith({ mirror, essence: 7 }).meta, essenceLifetime: undefined } } }, { now: 1_700_000_000_000 });
    assert.equal(migrated.player.meta.essenceLifetime, 7 + expected);
});

test('Wave 96: 산 능력치는 영구다 — 계승의 사다리 이월이 지우지 않고, 공격력은 레벨 비례로 바로, 생명 · 기력은 재구성 스냅숏에 실린다', () => {
    const base = playerWith({ mirror: FULL_TREE, essence: 100_000, rank: 400, bonusAtk: 400, bonusHp: 2000, bonusMp: 1200 });
    let state = stateWith(base);
    for (let i = 0; i < 3; i += 1) state = buy(state, 'endless_atk');
    for (let i = 0; i < 2; i += 1) state = buy(state, 'endless_hp');
    const meta = state.player.meta;
    assert.equal(meta.bonusAtk, 403);
    assert.equal(meta.bonusHp, 2010);
    const carried = carryEssenceLadderOnAscension(meta);
    assert.equal(carried.meta.bonusAtk, 403 - (400 - 40), '사다리에서 내려놓은 단계만 빠진다 — 거울로 산 3은 남는다');
    assert.equal(getAscensionOutcome(meta).meta.bonusAtk - getAscensionOutcome(base.meta).meta.bonusAtk, 3);
    assert.equal(getRampedMetaAtk(meta, 30) - getRampedMetaAtk(base.meta, 30), 3);
    assert.equal(getRampedMetaAtk(meta, 15) - getRampedMetaAtk(base.meta, 15), 1.5, 'Lv30 전에는 레벨 비례(Wave 40)');
    assert.equal(snapshotMetaVitals(meta).hp - snapshotMetaVitals(base.meta).hp, 10);
});

test('Wave 96: 화면 — 다섯째 경로 · 단계 표시 · 잠금 문구 · 효과 문구는 실제 값이다', () => {
    assert.equal(getMirrorEffectLabel('endless_mp', 0), MSG.MIRROR_ENDLESS_EFFECT(MSG.MIRROR_ENDLESS_STAT_LABELS.mp, 0));
    assert.equal(getMirrorEffectLabel('endless_mp', 4), MSG.MIRROR_ENDLESS_EFFECT(MSG.MIRROR_ENDLESS_STAT_LABELS.mp, 12));
    const open = getMirrorInvestmentPreview('endless_atk', { ...FULL_TREE, endless_atk: 2 }, 10_000);
    assert.equal(open.endless, true);
    assert.equal(open.locked, false);
    assert.equal(open.maxed, false);
    assert.equal(open.nextCost, 3000);
    assert.equal(open.canAfford, true);
    assert.equal(open.nextEffect, MSG.MIRROR_ENDLESS_EFFECT(MSG.MIRROR_ENDLESS_STAT_LABELS.atk, 3));
    assert.deepEqual(MIRROR_PATHS.at(-1).nodeIds, MIRROR_ENDLESS_NODES.map((node) => node.id));

    const html = renderStatic(createElement(MirrorPanel, { player: playerWith({ mirror: FULL_TREE }), onClose: () => {}, onPurchase: () => {} }));
    assert.match(html, /data-testid="mirror-path-endless"/);
    assert.ok(html.includes(MSG.MIRROR_ENDLESS_PATH_LABEL));
});
