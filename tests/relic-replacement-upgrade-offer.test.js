import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE, CONSTANTS } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { RELICS, RELIC_SYNERGIES, getActiveRelicSynergies, isRelicReplacementUpgrade, pickWeightedRelics } from '../src/data/relics.js';
import { applyScoutGuaranteedRelic } from '../src/hooks/combatActions/_helpers.ts';
import { applyAbyssFloorAdvance } from '../src/hooks/combatActions/combatBossHandlers.ts';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { rollExplorationEvent, runQuietRollAndCombat } from '../src/hooks/gameActions/exploreFlow.ts';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { getPrestigeUnlocks } from '../src/systems/prestigeUnlocks.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';

/**
 * 2026-10 Wave 78 (소유자 결정 원장 §81.4 b "칸이 찼을 때 후보를 조합 완성 · 높은 등급 우선으로") — 유물 칸이 가득 찬
 * 제안은 "교체하면 나아지는" 카드를 먼저 보인다. 나아진다 = 보유 유물 하나를 이 카드로 바꿨을 때 켜진 조합 수가 늘거나,
 * 조합 수가 그대로이면서 내려놓는 유물보다 등급이 높다.
 *
 * Wave 77 측정에서 칸이 찬 제안은 회차당 약 119번이었고 그중 교체할 만한 카드가 있던 것은 2 ~ 3번이었다(원장 §81.3).
 * 슬롯마다 추첨은 한 번이라 난수 소비 수는 그대로다.
 */

const RANK = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const rankOf = (relic) => RANK.indexOf(relic.rarity ?? 'common');
const byName = (name) => RELICS.find((relic) => relic.name === name);
const ids = (relics) => relics.map((relic) => relic.id);

const mulberry32 = (seed) => {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const RANK0 = getPrestigeUnlocks(0);

/** 조합이 하나도 켜지지 않는 같은 등급 유물 n개(앞에서부터 고른다). */
const comboFreeSet = (rarity, n, exclude = []) => {
    const picked = [];
    for (const relic of RELICS) {
        if (relic.rarity !== rarity || exclude.some((other) => other.id === relic.id)) continue;
        const next = [...picked, relic];
        if (getActiveRelicSynergies([...next, ...exclude]).length === getActiveRelicSynergies(exclude).length) picked.push(relic);
        if (picked.length === n) return structuredClone(picked);
    }
    throw new Error(`전제: 조합 없는 ${rarity} 유물 ${n}개`);
};

const OWNED_COMMONS = comboFreeSet('common', RANK0.maxRelics);
const available = (owned) => RELICS.filter((relic) => !owned.some((mine) => mine.id === relic.id));

test('판정: 조합이 없는 흔한 유물 5개 위에는 더 높은 등급 카드가 나아진 카드다', () => {
    const higher = available(OWNED_COMMONS).filter((relic) => rankOf(relic) > 0);
    const sameRank = available(OWNED_COMMONS).filter((relic) => rankOf(relic) === 0);
    assert.ok(higher.length > 10 && sameRank.length > 0, '전제');
    for (const relic of higher) assert.equal(isRelicReplacementUpgrade(relic, OWNED_COMMONS), true, relic.name);
    for (const relic of sameRank) {
        const completesCombo = getActiveRelicSynergies(OWNED_COMMONS.map((mine, i) => (i === 0 ? relic : mine))).length > 0
            || OWNED_COMMONS.some((_, index) => getActiveRelicSynergies(OWNED_COMMONS.map((mine, i) => (i === index ? relic : mine))).length > 0);
        assert.equal(isRelicReplacementUpgrade(relic, OWNED_COMMONS), completesCombo, relic.name);
    }
    assert.equal(isRelicReplacementUpgrade(OWNED_COMMONS[0], OWNED_COMMONS), false, '이미 가진 유물은 아니다');
    assert.equal(isRelicReplacementUpgrade(higher[0], []), false, '보유 유물이 없으면 교체가 아니다');
});

test('판정: 등급이 낮아도 조합을 완성하면 나아진 카드다', () => {
    let found = null;
    for (const synergy of RELIC_SYNERGIES.filter((entry) => entry.requires.length === 2)) {
        const [kept, card] = synergy.requires.map(byName);
        if (!kept || !card) continue;
        try {
            const others = comboFreeSet('legendary', RANK0.maxRelics - 1, [kept]);
            if (others.some((relic) => relic.id === card.id) || rankOf(card) >= 4) continue;
            found = { owned: [structuredClone(kept), ...others], card };
            break;
        } catch { /* 다음 조합 */ }
    }
    assert.ok(found, '전제: 두 조각 조합 하나 + 조합 없는 전설 4개');
    assert.equal(getActiveRelicSynergies(found.owned).length, 0, '전제: 지금 켜진 조합 없음');
    assert.ok(found.owned.every((relic) => relic.id === found.owned[0].id || rankOf(relic) > rankOf(found.card)), '전제: 카드가 전설보다 낮다');
    assert.equal(isRelicReplacementUpgrade(found.card, found.owned), true);
});

test('판정: 조합을 깨는 교체는 등급이 올라도 나아진 카드가 아니다', () => {
    let found = null;
    for (const synergy of RELIC_SYNERGIES.filter((entry) => entry.requires.length === 2)) {
        const members = synergy.requires.map(byName);
        if (members.some((relic) => !relic || rankOf(relic) >= 3)) continue;
        try {
            const others = comboFreeSet('legendary', RANK0.maxRelics - 2, members);
            const owned = [...structuredClone(members), ...others];
            const card = available(owned).find((relic) => relic.rarity === 'epic'
                && owned.every((_, index) => getActiveRelicSynergies(owned.map((mine, i) => (i === index ? relic : mine))).length <= 1));
            if (!card) continue;
            found = { owned, card };
            break;
        } catch { /* 다음 조합 */ }
    }
    assert.ok(found, '전제: 낮은 등급 두 조각 조합 + 조합 없는 전설 3개 + 조합을 늘리지 않는 영웅 카드');
    assert.equal(getActiveRelicSynergies(found.owned).length, 1, '전제: 조합 하나가 켜져 있다');
    assert.equal(isRelicReplacementUpgrade(found.card, found.owned), false);
});

test('추첨: 교체 대상을 넘기면 모든 칸이 나아진 카드다(여러 시드)', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
        const picks = pickWeightedRelics(available(OWNED_COMMONS), RANK0.relicChoices, {
            owned: OWNED_COMMONS, rng: mulberry32(seed), replacing: OWNED_COMMONS,
        });
        assert.equal(picks.length, RANK0.relicChoices);
        for (const relic of picks) assert.equal(isRelicReplacementUpgrade(relic, OWNED_COMMONS), true, `seed ${seed} · ${relic.name}`);
    }
});

test('추첨: 나아진 카드가 칸보다 적으면 그 카드를 모두 넣고 나머지로 채운다', () => {
    const upgrade = available(OWNED_COMMONS).find((relic) => relic.rarity === 'legendary');
    const filler = available(OWNED_COMMONS).filter((relic) => !isRelicReplacementUpgrade(relic, OWNED_COMMONS));
    assert.ok(upgrade && filler.length >= 2, '전제: 나아진 카드 하나와 나아지지 않는 카드 둘 이상');
    for (let seed = 1; seed <= 20; seed += 1) {
        const picks = pickWeightedRelics([...filler, upgrade], 3, { rng: mulberry32(seed), replacing: OWNED_COMMONS });
        assert.equal(picks.length, 3);
        assert.ok(ids(picks).includes(upgrade.id), `seed ${seed}`);
    }
});

test('추첨: 난수 소비 수는 교체 대상과 무관하게 칸 수와 같다', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
        const counts = [undefined, OWNED_COMMONS].map((replacing) => {
            let calls = 0;
            const inner = mulberry32(seed);
            pickWeightedRelics(available(OWNED_COMMONS), RANK0.relicChoices, {
                owned: OWNED_COMMONS, rng: () => { calls += 1; return inner(); }, replacing,
            });
            return calls;
        });
        assert.deepEqual(counts, [RANK0.relicChoices, RANK0.relicChoices], `seed ${seed}`);
    }
});

test('추첨: 교체 대상이 없으면 이전과 같은 카드다', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
        const a = pickWeightedRelics(available(OWNED_COMMONS), 3, { owned: OWNED_COMMONS, rng: mulberry32(seed) });
        const b = pickWeightedRelics(available(OWNED_COMMONS), 3, { owned: OWNED_COMMONS, rng: mulberry32(seed), replacing: [] });
        assert.deepEqual(ids(a), ids(b));
    }
});

// ── 호출부: 칸이 찬 무작위 유물 제안 네 곳 ─────────────────────────────

const basePlayer = (relics, overrides = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '탐험가', job: '전사', level: 20, hp: 200, maxHp: 200, mp: 50, maxMp: 50,
    loc: '고요한 숲', inv: [], relics: structuredClone(relics),
    meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 0 },
    stats: { ...structuredClone(INITIAL_STATE.player.stats), exploreState: { sinceRelic: 0, quietStreak: 0 } },
    ...overrides,
});

const recorder = () => {
    const actions = [];
    return {
        actions,
        dispatch: (action) => actions.push(action),
        addLog: () => {},
        addStoryLog: () => {},
        commitExploreOutcome: () => {},
        getFullStats: () => ({ maxHp: 200, maxMp: 50, atk: 40, def: 20 }),
        pending: () => actions.find((action) => action.type === AT.SET_PENDING_RELICS)?.payload ?? null,
    };
};

/** 앞 값은 분기를 고정하고 뒤는 시드 스트림 — 후보 추첨이 시드마다 달라진다. */
const scripted = (values, seed) => {
    const tail = mulberry32(seed);
    let index = 0;
    return () => (index < values.length ? values[index++] : tail());
};

const assertAllUpgrades = (offer, owned, label) => {
    assert.ok(Array.isArray(offer) && offer.length > 0, `${label}: 제안이 열린다`);
    for (const relic of offer) assert.equal(isRelicReplacementUpgrade(relic, owned), true, `${label} · ${relic.name}`);
};

test('탐험 발견 두 곳: 칸이 찬 제안은 나아진 카드만 보인다', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
        const quiet = recorder();
        rollExplorationEvent(basePlayer(OWNED_COMMONS), DB.MAPS['고요한 숲'], OWNED_COMMONS, { ...quiet, rng: scripted([0.999, 0], seed) });
        assertAllUpgrades(quiet.pending(), OWNED_COMMONS, `조용한 발견 seed ${seed}`);

        const preCombat = recorder();
        runQuietRollAndCombat(basePlayer(OWNED_COMMONS), DB.MAPS['고요한 숲'], { ...preCombat, rng: scripted([0.999, 0], seed) });
        assertAllUpgrades(preCombat.pending(), OWNED_COMMONS, `전투 직전 발견 seed ${seed}`);
    }
});

test('정찰 "정예의 흔적" 보장 유물: 칸이 찬 제안은 나아진 카드만 보인다', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
        const rec = recorder();
        applyScoutGuaranteedRelic({ scoutGuaranteedRelic: true }, basePlayer(OWNED_COMMONS), { ...rec, rng: mulberry32(seed) });
        assertAllUpgrades(rec.pending(), OWNED_COMMONS, `정찰 seed ${seed}`);
    }
});

test('혼돈의 심연 유물 마일스톤: 칸이 찬 제안은 나아진 카드만 보인다', () => {
    const floor = Number(Object.entries(BALANCE.ABYSS_MILESTONE_REWARDS)
        .find(([, reward]) => reward.type === 'relic_choice')?.[0] ?? 10);
    for (let seed = 1; seed <= 10; seed += 1) {
        const rec = recorder();
        const player = basePlayer(OWNED_COMMONS, {
            loc: CONSTANTS.ABYSS_MAP_NAME,
            stats: { ...structuredClone(INITIAL_STATE.player.stats), abyssFloor: floor - 1, abyssRecord: floor - 1 },
        });
        applyAbyssFloorAdvance(player, rec.dispatch, () => {}, mulberry32(seed), () => 0);
        assertAllUpgrades(rec.pending(), OWNED_COMMONS, `심연 ${floor}층 seed ${seed}`);
    }
});

test('사건 결과가 여는 유물 선택: 칸이 찬 제안은 나아진 카드만 보인다', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
        let state = {
            ...structuredClone(INITIAL_STATE),
            bootStage: 'ready',
            logs: [],
            gameState: GS.EVENT,
            player: basePlayer(OWNED_COMMONS),
            currentEvent: {
                desc: '봉인된 상자',
                choices: ['연다', '지나친다'],
                outcomes: [{ choiceIndex: 0, relic: { count: 2 }, log: '상자가 열린다.' }, { choiceIndex: 1, log: '지나친다.' }],
            },
        };
        const dispatch = (action) => { state = gameReducer(state, action); };
        createEventActions({
            player: state.player,
            currentEvent: state.currentEvent,
            dispatch,
            addLog: (type, text) => dispatch({ type: AT.ADD_LOG, payload: { type, text } }),
            getFullStats: () => calculateFullStats(state.player),
            rng: mulberry32(seed),
        }, { emitUnlockedTitles: () => {} }).handleEventChoice(0);
        assertAllUpgrades(state.pendingRelics, OWNED_COMMONS, `사건 seed ${seed}`);
    }
});
