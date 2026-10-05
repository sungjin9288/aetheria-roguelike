import test from 'node:test';
import assert from 'node:assert/strict';

import { EVENT_CHAINS } from '../src/data/eventChains.js';
import { MSG } from '../src/data/messages.js';
import { RELICS } from '../src/data/relics.js';
import { DB } from '../src/data/db.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { getPrestigeUnlocks } from '../src/systems/prestigeUnlocks.js';
import { selectRarityRewardPool } from '../src/utils/relicRewardPool.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';

/**
 * Wave 62 C3 · C4 — 약속한 유물 보상은 약속대로 나온다(소유자 결정: C3 "전설 등급 보장", C4 "유물 교체 제안").
 *
 * C3: 이야기 다섯 곳이 "전설의 유물"을, 용의 유산 2단계 선택 0이 "용의 심장 유물"(그런 유물은 없다 — 재료다)을 약속했지만
 *     엔진은 전 등급에서 뽑아 전설은 약 4.6%였다. 이제 데이터가 `reward.rarity: 'legendary'`를 선언하고 엔진이 그 등급의
 *     미보유 유물만 뽑는다. 전설을 다 가졌으면 남은 가장 높은 등급으로 내려가고 로그로 말한다.
 * C4: 유물 칸이 가득 차면 정찰 "정예의 흔적"(승리 시 유물)과 사건 결과 "유물 선택지가 열림"이 아무 말 없이 사라졌다.
 *     이제 체인 · 보스 보상과 같은 교체 제안(SET_PENDING_RELICS → RelicChoicePanel의 REPLACE_RELIC / DECLINE_RELIC)이다.
 *     유물 수는 상한을 넘지 않는다.
 */

const LEGENDARY_PROMISES = [
    ['abyss_signal', 2, 0],
    ['divine_apostle_trial', 2, 1],
    ['rift_secret', 2, 1],
    ['forgotten_commander', 2, 0],
    ['water_apostle', 2, 1],
    ['dragon_legacy', 2, 0],
];
const RANK0_CAP = getPrestigeUnlocks(0).maxRelics;
const LEGENDARY = RELICS.filter((relic) => relic.rarity === 'legendary');
const NON_LEGENDARY = RELICS.filter((relic) => relic.rarity !== 'legendary');
const ids = (relics) => (relics || []).map((relic) => relic.id);
/** 시드 결정론 난수(mulberry32) — 추첨 구간을 고르게 훑는다. */
const seeded = (seed) => () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const chainStep = (chainId, step) => EVENT_CHAINS.find((entry) => entry.id === chainId).steps.find((entry) => entry.step === step);

const chainState = (chainId, step, player = {}) => {
    const stepData = chainStep(chainId, step);
    return {
        ...structuredClone(INITIAL_STATE),
        bootStage: 'ready',
        logs: [],
        gameState: GS.EVENT,
        currentEvent: { ...structuredClone(stepData.event), _chainId: chainId, _chainStep: step },
        player: {
            ...structuredClone(INITIAL_STATE.player),
            name: '용사', job: '나이트', level: 50, loc: stepData.loc,
            eventChainProgress: { [chainId]: step },
            ...player,
        },
    };
};

/** 실제 훅(`createEventActions`) + 실제 리듀서로 선택지를 해소한다. */
const resolveChoice = (state, choiceIndex, rng) => {
    let current = state;
    const dispatch = (action) => { current = gameReducer(current, action); };
    const addLog = (type, text) => dispatch({ type: AT.ADD_LOG, payload: { type, text } });
    createEventActions({
        player: current.player,
        currentEvent: current.currentEvent,
        dispatch,
        addLog,
        getFullStats: () => calculateFullStats(current.player),
        rng,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(choiceIndex);
    return current;
};

// ── C3 데이터 ↔ 문구 ────────────────────────────────────────────────────────

test('C3 "전설" 유물을 말하는 이야기 선택지는 정확히 여섯이고 모두 데이터가 전설 등급을 선언한다', () => {
    const declared = [];
    for (const chain of EVENT_CHAINS) {
        for (const stepData of chain.steps) {
            stepData.event.outcomes.forEach((outcome, choiceIndex) => {
                if (outcome.reward?.type !== 'relic') return;
                const promisesLegendary = /전설/.test(outcome.log || '');
                assert.equal(outcome.reward.rarity === 'legendary', promisesLegendary,
                    `${chain.id}:${stepData.step}:${choiceIndex} 문구(${outcome.log})와 등급 선언이 같아야 한다`);
                if (promisesLegendary) declared.push([chain.id, stepData.step, choiceIndex]);
            });
        }
    }
    assert.deepEqual(declared.sort(), [...LEGENDARY_PROMISES].sort());
});

test('C3 "용의 심장 유물"은 더 이상 약속되지 않는다(그런 유물이 없다 — 용의 심장은 재료다)', () => {
    assert.ok(!RELICS.some((relic) => relic.name === '용의 심장'), '전제: 그런 유물은 없다');
    const logs = EVENT_CHAINS.flatMap((chain) => chain.steps.flatMap((stepData) => stepData.event.outcomes.map((o) => o.log)));
    assert.ok(!logs.some((log) => /용의 심장 유물/.test(log)));
});

// ── C3 엔진 ─────────────────────────────────────────────────────────────────

test('C3 전설을 약속한 여섯 선택지는 상한 미만에서 언제나 미보유 전설 유물을 준다(시드 24개 × 6)', () => {
    const owned = structuredClone(NON_LEGENDARY.slice(0, RANK0_CAP - 1));
    for (const [chainId, step, choiceIndex] of LEGENDARY_PROMISES) {
        for (let seed = 1; seed <= 24; seed += 1) {
            const after = resolveChoice(chainState(chainId, step, { relics: owned }), choiceIndex, seeded(seed));
            assert.equal(after.player.relics.length, owned.length + 1, `${chainId} seed ${seed}: 유물을 받았다`);
            const gained = after.player.relics.at(-1);
            assert.equal(gained.rarity, 'legendary', `${chainId}:${step}:${choiceIndex} seed ${seed} → ${gained.name}(${gained.rarity})`);
            assert.ok(!ids(owned).includes(gained.id));
            assert.equal(after.player.eventChainProgress[chainId], step + 1);
            assert.ok(after.logs.some((log) => log.text === MSG.CHAIN_REWARD_RELIC(gained.name)));
        }
    }
});

test('C3 상한에서는 전설 유물이 교체 제안으로 올라오고 유물 수는 그대로다', () => {
    const owned = structuredClone(NON_LEGENDARY.slice(0, RANK0_CAP));
    for (const [chainId, step, choiceIndex] of LEGENDARY_PROMISES) {
        const after = resolveChoice(chainState(chainId, step, { relics: owned }), choiceIndex, seeded(7));
        assert.deepEqual(ids(after.player.relics), ids(owned), `${chainId}: 상한 유지`);
        assert.equal(after.pendingRelics?.length, 1);
        assert.equal(after.pendingRelics[0].rarity, 'legendary', `${chainId}: 제안도 전설`);
        assert.ok(after.logs.some((log) => log.text === MSG.CHAIN_REWARD_RELIC_REPLACE_OFFER(after.pendingRelics[0].name)));
    }
});

test('C3 전설을 모두 가졌으면 남은 가장 높은 등급(영웅)으로 내려가고 로그로 알린다 — 결정론', () => {
    // 상한을 넘는 구세이브(전설 16종 보유)에서만 닿는 경로다 — 상한에서는 교체 제안이 된다.
    const owned = structuredClone(LEGENDARY);
    const [chainId, step, choiceIndex] = LEGENDARY_PROMISES[0];
    const first = resolveChoice(chainState(chainId, step, { relics: owned }), choiceIndex, seeded(3));
    const second = resolveChoice(chainState(chainId, step, { relics: owned }), choiceIndex, seeded(3));
    assert.equal(first.pendingRelics?.[0]?.rarity, 'epic', '남은 가장 높은 등급');
    assert.equal(first.pendingRelics[0].id, second.pendingRelics[0].id, '같은 시드는 같은 유물');
    assert.ok(first.logs.some((log) => log.text === MSG.CHAIN_REWARD_RELIC_RARITY_FALLBACK(MSG.RARITY_LABEL.legendary, MSG.RARITY_LABEL.epic)));
    assert.equal(first.player.relics.length, owned.length, '유물 수는 늘지 않는다');
});

test('C3 등급 풀 선택은 약속 등급 → 없으면 남은 가장 높은 등급 → 없으면 빈 풀', () => {
    assert.deepEqual(selectRarityRewardPool(RELICS, 'legendary').pool.map((r) => r.rarity), LEGENDARY.map(() => 'legendary'));
    const noLegendaryNoEpic = RELICS.filter((relic) => !['legendary', 'epic'].includes(relic.rarity));
    const fallback = selectRarityRewardPool(noLegendaryNoEpic, 'legendary');
    assert.equal(fallback.rarity, 'rare');
    assert.equal(fallback.fellBack, true);
    assert.ok(fallback.pool.length > 0 && fallback.pool.every((relic) => relic.rarity === 'rare'));
    assert.deepEqual(selectRarityRewardPool([], 'legendary'), { pool: [], rarity: null, fellBack: true });
});

test('C3 등급을 약속하지 않는 체인 유물 보상은 전 등급 추첨 그대로다(범위 확인)', () => {
    // 보유 유물이 없어야 조합 보장(pity) 슬롯이 추첨을 고정하지 않는다.
    const rarities = new Set();
    for (let seed = 1; seed <= 40; seed += 1) {
        const after = resolveChoice(chainState('dragon_legacy', 2, { relics: [] }), 1, seeded(seed));
        rarities.add(after.player.relics.at(-1).rarity);
    }
    assert.ok(rarities.size >= 3, `여러 등급이 나온다: ${[...rarities].join(',')}`);
});

// ── C4 정찰 "정예의 흔적" — 실제 전투 승리 전이 ──────────────────────────────

const victoryState = (player, enemyExtra = {}) => ({
    ...structuredClone(INITIAL_STATE),
    bootStage: 'ready',
    logs: [],
    gameState: GS.COMBAT,
    combatTurn: 0,
    enemy: {
        name: '정예 슬라임', baseName: '슬라임', hp: 1, maxHp: 500, atk: 1, def: 0, level: 5, exp: 10, gold: 10,
        isElite: true, pattern: { guardChance: 0, heavyChance: 0 },
        ...enemyExtra,
    },
    player: {
        ...structuredClone(INITIAL_STATE.player),
        name: '용사', job: '모험가', level: 10, hp: 500, maxHp: 500, atk: 200, loc: '고요한 숲',
        equip: { weapon: DB.ITEMS.weapons[0], armor: null, offhand: null },
        ...player,
    },
});
const attack = (state, seed = 11) => gameReducer(state, {
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: { kind: 'attack', expectedTurn: state.combatTurn || 0, seed, now: 1_700_000_000_000 },
});

test('C4 정예의 흔적 승리: 유물 칸이 가득 차도 교체 제안이 열리고 유물 수는 그대로다', () => {
    const owned = structuredClone(RELICS.filter((relic) => relic.rarity === 'common').slice(0, RANK0_CAP));
    const after = attack(victoryState({ relics: owned }, { scoutGuaranteedRelic: true }));
    assert.equal(after.gameState, GS.IDLE, '전제: 실제로 이겼다');
    assert.ok(Array.isArray(after.pendingRelics) && after.pendingRelics.length > 0, '약속한 유물 선택이 열렸다');
    assert.ok(after.pendingRelics.every((relic) => !ids(owned).includes(relic.id)));
    assert.deepEqual(ids(after.player.relics), ids(owned), '상한 유지');
    assert.ok(after.logs.some((log) => log.text === MSG.SCOUT_RELIC_REPLACE_OFFER), '교체 제안 로그');

    // 패널 흐름: 추가는 상한에서 거부, 교체는 수를 유지, 넘기기는 제안을 닫는다.
    const [offered] = after.pendingRelics;
    const added = gameReducer(after, { type: AT.ADD_RELIC, payload: offered });
    assert.equal(added.player.relics.length, RANK0_CAP, 'ADD_RELIC은 상한을 넘지 않는다');
    const replaced = gameReducer(after, { type: AT.REPLACE_RELIC, payload: { relicId: offered.id, replaceRelicId: owned[0].id } });
    assert.equal(replaced.player.relics.length, RANK0_CAP);
    assert.ok(ids(replaced.player.relics).includes(offered.id));
    assert.equal(gameReducer(after, { type: AT.DECLINE_RELIC }).pendingRelics, null);
});

test('C4 정예의 흔적 승리: 상한 미만의 동작은 그대로다(발견 로그)', () => {
    const after = attack(victoryState({ relics: [] }, { scoutGuaranteedRelic: true }));
    assert.ok(after.pendingRelics?.length > 0);
    assert.ok(after.logs.some((log) => log.text === MSG.EXPLORE_RELIC_FOUND));
});

test('C4 정찰 보장이 없는 승리는 상한에서 유물 선택을 열지 않는다(범위 확인)', () => {
    const owned = structuredClone(RELICS.filter((relic) => relic.rarity === 'common').slice(0, RANK0_CAP));
    const after = attack(victoryState({ relics: owned }));
    assert.equal(after.gameState, GS.IDLE);
    assert.equal(after.pendingRelics ?? null, null);
});

// ── C4 사건 결과 "유물 선택지가 열림" ───────────────────────────────────────

const eventState = (player, outcome) => ({
    ...structuredClone(INITIAL_STATE),
    bootStage: 'ready',
    logs: [],
    gameState: GS.EVENT,
    currentEvent: {
        desc: '봉인함이 떨린다', choices: ['연다', '둔다'],
        outcomes: [{ choiceIndex: 0, log: '봉인이 풀렸습니다.', ...outcome }, { choiceIndex: 1, log: '지나쳤습니다.' }],
    },
    player: {
        ...structuredClone(INITIAL_STATE.player),
        name: '용사', job: '모험가', level: 20, loc: '고요한 숲',
        ...player,
    },
});

test('C4 사건 결과의 유물 선택: 칸이 가득 차도 교체 제안으로 열린다(로그) — 유물 수는 그대로', () => {
    const owned = structuredClone(RELICS.filter((relic) => relic.rarity === 'common').slice(0, RANK0_CAP));
    const after = resolveChoice(eventState({ relics: owned }, { relic: { count: 2 } }), 0, seeded(5));
    assert.equal(after.pendingRelics?.length, 2);
    assert.ok(after.logs.some((log) => log.text === MSG.EVENT_RELIC_REPLACE_OFFER(2)));
    assert.deepEqual(ids(after.player.relics), ids(owned));
    assert.equal(after.gameState, GS.IDLE);
});

test('C4 사건 결과의 유물 선택: 상한 미만의 동작은 그대로다', () => {
    const after = resolveChoice(eventState({ relics: [] }, { relic: { count: 2 } }), 0, seeded(5));
    assert.equal(after.pendingRelics?.length, 2);
    assert.ok(after.logs.some((log) => log.text === MSG.EVENT_RELIC_CHOICE(2)));
});
