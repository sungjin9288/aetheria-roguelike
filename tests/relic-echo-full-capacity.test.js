import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { MSG } from '../src/data/messages.js';
import { RELICS, isRelicReplacementUpgrade } from '../src/data/relics.js';
import { getRelicEchoEssence, rollExplorationEvent, runQuietRollAndCombat } from '../src/hooks/gameActions/exploreFlow.ts';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { getEssenceGainFromExp } from '../src/systems/essenceLedger.js';
import { getEssenceRewardMult } from '../src/systems/essenceRewardMult.js';
import { getPrestigeUnlocks } from '../src/systems/prestigeUnlocks.js';

/**
 * 2026-10 Wave 79 (소유자 결정 원장 §82.4 b "나아진 카드가 없으면 선택 화면 대신 작은 보상") — 유물 칸이 가득 찼고
 * 교체로 나아질 카드(`isRelicReplacementUpgrade`)가 하나도 없으면, 탐험 유물 발견은 선택 화면 대신 '유물의 잔향'이다:
 * 같은 레벨 적 한 마리를 처치한 만큼의 계승 정수(처치 정수와 같은 공식 · 같은 배율).
 *
 * Wave 78 측정에서 칸이 찬 제안의 약 97%가 이 경우였다 — 보유 유물이 조합 2 ~ 4개로 묶여 어떤 교체도 조합을 깼다(원장 §82.3).
 * 예시로 든 유물 파편은 오늘의 임무 범위이고 칸이 남아 있을 때만 유물로 바뀌므로 칸이 찬 보상이 될 수 없다.
 */

const MAP = DB.MAPS['고요한 숲'];
const RANK0 = getPrestigeUnlocks(0);

/** 나아질 카드가 하나도 없는 유물 n개 — 전설 유물 조합을 앞에서부터 훑는다(데이터에서 찾는다). */
const findLockedSet = (n) => {
    const legendaries = RELICS.filter((relic) => relic.rarity === 'legendary');
    const pick = [];
    const walk = (start) => {
        if (pick.length === n) {
            const available = RELICS.filter((relic) => !pick.some((mine) => mine.id === relic.id));
            return available.every((relic) => !isRelicReplacementUpgrade(relic, pick));
        }
        for (let i = start; i < legendaries.length; i += 1) {
            pick.push(legendaries[i]);
            if (walk(i + 1)) return true;
            pick.pop();
        }
        return false;
    };
    assert.ok(walk(0), `전제: 나아질 카드가 없는 전설 유물 ${n}개`);
    return structuredClone(pick);
};

const LOCKED = findLockedSet(RANK0.maxRelics);
/** 나아질 카드가 있는 칸이 찬 조합 — 흔한 유물 다섯. */
const UPGRADABLE = structuredClone(RELICS.filter((relic) => relic.rarity === 'common').slice(0, RANK0.maxRelics));

const basePlayer = (relics, overrides = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '탐험가', job: '전사', level: 30, hp: 300, maxHp: 300, mp: 50, maxMp: 50,
    loc: '고요한 숲', inv: [], relics: structuredClone(relics),
    meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 0 },
    stats: { ...structuredClone(INITIAL_STATE.player.stats), exploreState: { sinceRelic: 0, quietStreak: 0 } },
    ...overrides,
});

const recorder = () => {
    const actions = [];
    const logs = [];
    const commits = [];
    return {
        actions, logs, commits,
        dispatch: (action) => actions.push(action),
        addLog: (type, text) => logs.push({ type, text }),
        addStoryLog: () => {},
        commitExploreOutcome: (outcome) => commits.push(outcome),
        getFullStats: () => ({ maxHp: 300, maxMp: 50, atk: 40, def: 20 }),
    };
};

const counting = (values) => {
    let calls = 0;
    const rng = () => { const value = calls < values.length ? values[calls] : 0.5; calls += 1; return value; };
    return { rng, calls: () => calls };
};

/** dispatch된 SET_PLAYER 함수형 payload를 플레이어에 적용한다. */
const applyPlayerUpdates = (player, actions) => actions
    .filter((action) => action.type === AT.SET_PLAYER)
    .reduce((p, action) => (typeof action.payload === 'function' ? action.payload(p) : action.payload), player);

test('전제: 잠긴 조합에는 나아질 카드가 없고, 흔한 유물 다섯에는 있다', () => {
    const available = (owned) => RELICS.filter((relic) => !owned.some((mine) => mine.id === relic.id));
    assert.equal(available(LOCKED).some((relic) => isRelicReplacementUpgrade(relic, LOCKED)), false);
    assert.equal(available(UPGRADABLE).some((relic) => isRelicReplacementUpgrade(relic, UPGRADABLE)), true);
});

test('잔향의 양은 같은 레벨 적 한 마리의 처치 정수다(같은 공식 · 같은 배율)', () => {
    for (const level of [1, 10, 30, 50]) {
        const player = basePlayer(LOCKED, { level });
        const expected = getEssenceGainFromExp(10 + level * 10, getEssenceRewardMult(player.meta));
        assert.equal(getRelicEchoEssence(player), expected, `Lv${level}`);
        assert.equal(BALANCE.RELIC_ECHO_EXP_BASE + level * BALANCE.RELIC_ECHO_EXP_PER_LEVEL, 10 + level * 10);
    }
    const rank1 = basePlayer(LOCKED, { meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 1 } });
    assert.ok(getRelicEchoEssence(rank1) > getRelicEchoEssence(basePlayer(LOCKED)), '계승 단계 정수 배율이 붙는다');
});

test('조용한 탐험의 발견: 칸이 찼고 나아질 카드가 없으면 선택 화면 대신 정수를 준다', () => {
    const player = basePlayer(LOCKED);
    const rec = recorder();
    const { rng, calls } = counting([0.999, 0]);
    const result = rollExplorationEvent(player, MAP, player.relics, { ...rec, rng });
    assert.equal(result, 'relic_found');
    assert.ok(!rec.actions.some((action) => action.type === AT.SET_PENDING_RELICS), '선택 화면이 열리지 않는다');
    const essence = getRelicEchoEssence(player);
    const after = applyPlayerUpdates(player, rec.actions);
    assert.equal((after.meta.essenceLifetime ?? 0) - (player.meta.essenceLifetime ?? 0), essence, '누적 정수가 그만큼 는다');
    assert.deepEqual(after.relics.map((relic) => relic.id), player.relics.map((relic) => relic.id), '유물은 그대로다');
    assert.ok(rec.logs.some((log) => log.text === MSG.EXPLORE_RELIC_ECHO(essence)));
    assert.equal(calls(), 2, '후보 추첨 난수를 쓰지 않는다(이상 현상 · 유물 두 번뿐)');
});

test('전투 직전 발견: 칸이 찼고 나아질 카드가 없으면 정수를 주고 전투를 대신한다', () => {
    const player = basePlayer(LOCKED);
    const rec = recorder();
    runQuietRollAndCombat(player, MAP, { ...rec, rng: counting([0.999, 0]).rng });
    assert.deepEqual(rec.commits, ['relic_found']);
    assert.ok(!rec.actions.some((action) => action.type === AT.SET_PENDING_RELICS));
    assert.ok(!rec.actions.some((action) => action.type === AT.SET_ENEMY), '적이 나오지 않는다');
    assert.ok(rec.logs.some((log) => log.text === MSG.EXPLORE_RELIC_ECHO(getRelicEchoEssence(player))));
});

test('나아질 카드가 있으면 이전처럼 교체 제안이다', () => {
    const quiet = recorder();
    rollExplorationEvent(basePlayer(UPGRADABLE), MAP, UPGRADABLE, { ...quiet, rng: counting([0.999, 0]).rng });
    assert.ok(quiet.actions.some((action) => action.type === AT.SET_PENDING_RELICS));
    assert.deepEqual(quiet.logs, [{ type: 'event', text: MSG.EXPLORE_RELIC_REPLACE_OFFER }]);

    const preCombat = recorder();
    runQuietRollAndCombat(basePlayer(UPGRADABLE), MAP, { ...preCombat, rng: counting([0.999, 0]).rng });
    assert.ok(preCombat.actions.some((action) => action.type === AT.SET_PENDING_RELICS));
    assert.deepEqual(preCombat.logs, [{ type: 'event', text: MSG.EXPLORE_RELIC_REPLACE_OFFER }]);
});

test('칸이 남아 있으면 잠긴 조합이어도 이전처럼 발견이다', () => {
    const fewer = LOCKED.slice(0, RANK0.maxRelics - 1);
    const rec = recorder();
    rollExplorationEvent(basePlayer(fewer), MAP, fewer, { ...rec, rng: counting([0.999, 0]).rng });
    assert.ok(rec.actions.some((action) => action.type === AT.SET_PENDING_RELICS));
    assert.deepEqual(rec.logs, [{ type: 'event', text: MSG.EXPLORE_RELIC_DISCOVERED }]);
});
