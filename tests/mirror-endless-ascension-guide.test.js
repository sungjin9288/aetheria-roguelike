import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { BALANCE } from '../src/data/constants.js';
import { MIRROR_ENDLESS_NODES, MIRROR_NODES } from '../src/data/mirror.js';
import { MSG } from '../src/data/messages.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { getMirrorEndlessAffordance, getMirrorNodeCost } from '../src/systems/mirrorUpgrades.js';
import { getAscensionOutcome } from '../src/utils/ascensionPreview.js';
import AscensionScreen from '../src/components/AscensionScreen.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * Wave 98 (원장 §102.4 b — 소유자 결정 "b로 진행"): 계승 화면은 끝없는 거울이 열렸으면 계승한 뒤의 정수로 몇 단계를 살 수 있는지 알린다.
 * 회차마다 6 ~ 7단계라는 꾸준한 보상을 플레이어가 직접 보게 하는 표시이고, 밸런스는 그대로다(구매는 거울이 한다).
 */

const FULL_TREE = Object.fromEntries(MIRROR_NODES.map((node) => [node.id, node.maxLevel]));
const ENDLESS_IDS = MIRROR_ENDLESS_NODES.map((node) => node.id);
const withEndless = (levels) => ({ ...FULL_TREE, ...Object.fromEntries(ENDLESS_IDS.map((id, i) => [id, levels[i]])) });

/** 독립 오라클: 노드마다 a · b · c단계를 더 사는 모든 조합 중 정수 안에 드는 가장 큰 a + b + c. */
const bruteForceMaxSteps = (levels, essence) => {
    const prefix = MIRROR_ENDLESS_NODES.map((node, i) => {
        const sums = [0];
        while (sums[sums.length - 1] <= essence) sums.push(sums[sums.length - 1] + getMirrorNodeCost(node, levels[i] + sums.length - 1));
        return sums.slice(0, -1);
    });
    let best = 0;
    for (let a = 0; a < prefix[0].length; a += 1) {
        for (let b = 0; b < prefix[1].length && prefix[0][a] + prefix[1][b] <= essence; b += 1) {
            const left = essence - prefix[0][a] - prefix[1][b];
            let c = 0;
            while (c + 1 < prefix[2].length && prefix[2][c + 1] <= left) c += 1;
            best = Math.max(best, a + b + c);
        }
    }
    return best;
};

const playerWith = (meta = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '거울지기', level: 50, loc: '마왕성',
    meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 2, bonusAtk: 50, bonusHp: 250, bonusMp: 150, ...meta },
});

test('Wave 98: 거울 8노드가 다 차지 않았으면 끝없는 단계 안내는 없다', () => {
    const partial = { ...FULL_TREE, revive: 0 };
    assert.deepEqual(getMirrorEndlessAffordance(partial, 1_000_000), { unlocked: false, steps: 0, nextCost: null, shortfall: 0 });
    assert.deepEqual(getMirrorEndlessAffordance(undefined, 1_000_000).unlocked, false);
    const html = renderStatic(createElement(AscensionScreen, { player: playerWith({ essence: 50_000, mirror: partial }) }));
    assert.ok(!html.includes('ascension-mirror-endless'), '잠긴 거울에는 끝없는 단계 줄이 없다');
    assert.ok(html.includes(MSG.MIRROR_CTA_HINT(50_000)), '기존 거울 안내가 그대로 남는다');
});

test('Wave 98: 살 수 있는 단계 수는 모든 구매 조합 중 최대와 같다(상한 전 · 걸침 · 상한 뒤)', () => {
    const levelSets = [[0, 0, 0], [3, 0, 7], [19, 20, 21], [25, 30, 40], [10, 20, 0]];
    const essences = [0, 1_999, 2_000, 4_499, 7_000, 41_000, 180_000, 300_000];
    for (const levels of levelSets) {
        for (const essence of essences) {
            const got = getMirrorEndlessAffordance(withEndless(levels), essence);
            assert.equal(got.unlocked, true);
            assert.equal(got.steps, bruteForceMaxSteps(levels, essence), `levels ${levels} essence ${essence}`);
            const nextCost = Math.min(...MIRROR_ENDLESS_NODES.map((node, i) => getMirrorNodeCost(node, levels[i])));
            assert.equal(got.nextCost, nextCost, '다음 단계 = 지금 가장 싼 단계');
            assert.equal(got.shortfall, got.steps > 0 ? 0 : nextCost - essence, '한 단계도 못 사면 모자란 정수');
        }
    }
});

test('Wave 98: 정수가 아무리 커도 상한 뒤는 닫힌 식이다 — 반복 수가 정수에 비례하지 않는다', () => {
    const essence = 1e12;
    const started = performance.now();
    const got = getMirrorEndlessAffordance(withEndless([0, 0, 0]), essence);
    assert.ok(performance.now() - started < 50, '큰 정수에서도 즉시 끝난다');
    const rising = Math.ceil((BALANCE.MIRROR_ENDLESS_COST_CAP - BALANCE.MIRROR_ENDLESS_BASE_COST) / BALANCE.MIRROR_ENDLESS_COST_STEP);
    const risingSum = MIRROR_ENDLESS_NODES.length * Array.from({ length: rising }, (_, k) => getMirrorNodeCost(MIRROR_ENDLESS_NODES[0], k)).reduce((a, b) => a + b, 0);
    assert.equal(got.steps, MIRROR_ENDLESS_NODES.length * rising + Math.floor((essence - risingSum) / BALANCE.MIRROR_ENDLESS_COST_CAP));
});

test('Wave 98: 안내한 단계 수만큼 실제 거울 구매가 성공하고 그다음은 실패한다', () => {
    for (const [levels, essence] of [[[0, 0, 0], 30_000], [[18, 22, 5], 61_234], [[40, 40, 40], 99_999]]) {
        const promised = getMirrorEndlessAffordance(withEndless(levels), essence).steps;
        let state = { ...structuredClone(INITIAL_STATE), gameState: GS.IDLE, bootStage: 'ready', player: playerWith({ essence, mirror: withEndless(levels) }) };
        const cheapestId = () => ENDLESS_IDS.reduce((best, id) => {
            const cost = (nodeId) => getMirrorNodeCost(MIRROR_ENDLESS_NODES.find((n) => n.id === nodeId), state.player.meta.mirror[nodeId]);
            return cost(id) < cost(best) ? id : best;
        });
        const buy = () => {
            const nodeId = cheapestId();
            const before = state.player.meta.essence;
            state = gameReducer(state, {
                type: AT.PURCHASE_MIRROR_NODE,
                payload: { nodeId, expectedEssence: before, expectedLevel: state.player.meta.mirror[nodeId] },
            });
            return state.player.meta.essence < before;
        };
        for (let k = 0; k < promised; k += 1) assert.ok(buy(), `${k + 1}번째 구매는 성공해야 한다`);
        assert.equal(buy(), false, '안내한 수를 넘는 구매는 정수가 모자라다');
    }
});

test('Wave 98: 계승 미리보기는 계승한 뒤의 정수(보상 포함)로 센다', () => {
    // 네 단계(2,000 × 3 + 2,500 = 8,500)에 100 모자란 정수 — 계승 보상이 경계를 넘긴다.
    const meta = { ...playerWith().meta, essence: 8_400, mirror: FULL_TREE };
    const outcome = getAscensionOutcome(meta);
    assert.ok(outcome.meta.essence >= 8_500, '계승 보상이 정수에 더해진다');
    assert.deepEqual(outcome.mirrorEndless, getMirrorEndlessAffordance(FULL_TREE, outcome.meta.essence));
    assert.equal(getMirrorEndlessAffordance(FULL_TREE, meta.essence).steps, 3);
    assert.equal(outcome.mirrorEndless.steps, 4, '지금 정수(3단계)가 아니라 계승한 뒤의 정수(4단계)로 센다');
});

test('Wave 98: 계승 화면은 살 수 있는 단계 수 · 단계당 능력치 · 다음 비용을, 모자라면 모자란 정수를 그린다', () => {
    const rich = playerWith({ essence: 9_000, mirror: FULL_TREE });
    const richOutcome = getAscensionOutcome(rich.meta);
    const richHtml = renderStatic(createElement(AscensionScreen, { player: rich }));
    assert.ok(richOutcome.mirrorEndless.steps > 0);
    assert.ok(richHtml.includes('data-testid="ascension-mirror-endless"'));
    assert.ok(richHtml.includes(MSG.ASCEND_MIRROR_ENDLESS_STEPS(
        richOutcome.meta.essence, richOutcome.mirrorEndless.steps, richOutcome.mirrorEndless.nextCost,
        BALANCE.MIRROR_ENDLESS_ATK_PER_LEVEL, BALANCE.MIRROR_ENDLESS_HP_PER_LEVEL, BALANCE.MIRROR_ENDLESS_MP_PER_LEVEL,
    )));
    assert.ok(!richHtml.includes(MSG.MIRROR_CTA_HINT(9_000)), '열린 거울에서는 구체적인 안내가 일반 안내를 대신한다');

    const poor = playerWith({ essence: 0, mirror: withEndless([30, 30, 30]) });
    const poorOutcome = getAscensionOutcome(poor.meta);
    assert.equal(poorOutcome.mirrorEndless.steps, 0, '계승 보상만으로는 상한 비용 단계를 못 산다');
    const poorHtml = renderStatic(createElement(AscensionScreen, { player: poor }));
    assert.ok(poorHtml.includes(MSG.ASCEND_MIRROR_ENDLESS_SHORT(poorOutcome.meta.essence, poorOutcome.mirrorEndless.shortfall)));
});

test('Wave 98: 끝없는 단계 설명은 비용 상한(Wave 97)을 말한다', () => {
    for (const node of MIRROR_ENDLESS_NODES) assert.match(node.desc, /상한에서 멈춥니다/, node.id);
    assert.match(MSG.MIRROR_ENDLESS_PATH_SUMMARY, /상한에서 멈춥니다/);
});
