import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { EVENT_CHAINS, getChainEventForLoc } from '../src/data/eventChains.js';
import { MSG } from '../src/data/messages.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';

/**
 * Wave 62 C19 — 잃어버린 마법사 3단계 "전투를 받아들인다 (전설 보상)"는 실제 전투다(소유자 결정 "설명대로").
 *
 * 이전: 선택하면 전투 없이 '환영을 물리쳤습니다'와 함께 천벌의 지팡이를 받았고 설명은 책 → 지팡이 교체(cycle 140)의
 * 흔적인 "이 마법서를 써주세요"를 말했다.
 * 이후: 선택하면 데이터(`outcome.combat`)가 정한 적 — 기존 종 '고대 마법사'를 이 지역(천공 정원) 레벨로 일반 스폰 경로에서
 * 만든 정예, 이름 '사라진 마법사의 환영' — 과 실제 전투(리듀서 전투 권한 `RESOLVE_COMBAT_ACTION`)가 열린다.
 * 지팡이와 체인 진행은 **승리 정산 때만**(`applyChainCombatVictory`). 지거나 물러나면 단계가 그대로 남아 같은 자리에서 다시 마주친다.
 * 새 몬스터를 만들지 않은 이유: 몬스터 종은 아트 카탈로그 · 도감 · 드롭 증빙에 묶여 있고 '고대 마법사'가 이야기에 맞는다.
 */

const CHAIN = 'lost_wizard';
const chain = EVENT_CHAINS.find((entry) => entry.id === CHAIN);
const step2 = chain.steps.find((entry) => entry.step === 2);
const FIGHT = step2.event.outcomes.findIndex((outcome) => outcome.combat);
const fightOutcome = step2.event.outcomes[FIGHT];
const STAFF = fightOutcome.reward.name;
const NOW = 1_700_000_000_000;

const stepState = (player = {}) => ({
    ...structuredClone(INITIAL_STATE),
    bootStage: 'ready',
    logs: [],
    gameState: GS.EVENT,
    currentEvent: { ...structuredClone(step2.event), _chainId: CHAIN, _chainStep: 2 },
    player: {
        ...structuredClone(INITIAL_STATE.player),
        name: '용사', job: '마법사', level: 40, hp: 3_000, maxHp: 3_000, mp: 300, maxMp: 300, atk: 300,
        loc: step2.loc,
        equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
        eventChainProgress: { [CHAIN]: 2 },
        ...player,
    },
});

const accept = (state, rng = () => 0.5) => {
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
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(FIGHT);
    return current;
};

const act = (state, kind, seed) => gameReducer(state, {
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: { kind, expectedTurn: state.combatTurn || 0, seed, now: NOW },
});
const hasStaff = (player) => (player.inv || []).some((item) => item.name === STAFF);

test('데이터: 전투 선택지는 기존 종 · 실재 보상을 선언하고 설명에 책(마법서) 흔적이 없다', () => {
    assert.ok(FIGHT >= 0, '전투 선택지가 있다');
    assert.match(step2.event.choices[FIGHT], /전투/);
    assert.ok(DB.MONSTERS[fightOutcome.combat.monster], `기존 몬스터 종: ${fightOutcome.combat.monster}`);
    assert.equal(fightOutcome.type, 'chain_advance');
    assert.equal(fightOutcome.reward.type, 'legendary_item');
    assert.ok(DB.ITEMS.weapons.some((item) => item.name === STAFF), '보상 지팡이는 실재 장비');
    assert.ok(!/마법서/.test(step2.event.desc), step2.event.desc);
    assert.match(step2.event.desc, /지팡이/);
});

test('선택하면 실제 전투가 열린다 — 보상 · 진행은 아직 없다', () => {
    const before = stepState();
    const after = accept(before);
    assert.equal(after.gameState, GS.COMBAT);
    assert.equal(after.currentEvent, null);
    assert.equal(after.enemy.name, fightOutcome.combat.enemyName);
    assert.equal(after.enemy.baseName, fightOutcome.combat.monster, '정체성은 종(baseName)');
    assert.equal(after.enemy.isElite, true);
    assert.deepEqual(after.enemy.chainCombat, { chainId: CHAIN, step: 2, choiceIndex: FIGHT });
    assert.equal(after.player.eventChainProgress[CHAIN], 2, '진행은 승리 전까지 그대로');
    assert.ok(!hasStaff(after.player), '지팡이는 승리 전까지 없다');
    assert.ok(after.logs.some((log) => log.text === fightOutcome.combat.intro));
    assert.ok(!after.logs.some((log) => log.text === fightOutcome.log), '승리 로그는 아직 없다');
});

test('적은 이 지역 레벨의 일반 스폰 경로에서 정예 배율로 나온다(무작위 접두어 없음) — 같은 난수면 같은 적', () => {
    const first = accept(stepState(), () => 0.01).enemy;
    const second = accept(stepState(), () => 0.01).enemy;
    const other = accept(stepState(), () => 0.99).enemy;
    assert.deepEqual(first, second);
    assert.equal(first.level, DB.MAPS[step2.loc].level);
    assert.equal(first.name, other.name, '접두어 추첨을 하지 않는다(난수와 무관한 이름)');
    assert.equal(first.maxHp, other.maxHp);
});

test('이기면(실제 전투 전이) 지팡이를 받고 체인이 진행된다 — 승리 로그', () => {
    let state = accept(stepState());
    state = { ...state, enemy: { ...state.enemy, hp: 1 } };
    state = act(state, 'attack', 42);
    assert.equal(state.gameState === GS.COMBAT, false, '전투가 끝났다');
    assert.equal(state.enemy, null);
    assert.ok(hasStaff(state.player), '지팡이를 받았다');
    assert.equal(state.player.eventChainProgress[CHAIN], 3, '체인 완료');
    assert.ok(state.logs.some((log) => log.text === fightOutcome.log));
    assert.ok(state.logs.some((log) => log.text === MSG.LOOT_GET(STAFF)));
    assert.equal(getChainEventForLoc(step2.loc, state.player.eventChainProgress), null, '같은 단계가 다시 뜨지 않는다');
});

test('지면 보상 없이 단계가 남는다 — 같은 자리에서 다시 마주친다', () => {
    let state = accept(stepState({ hp: 1 }));
    state = { ...state, enemy: { ...state.enemy, hp: 1e9, maxHp: 1e9, atk: 1e7 } };
    for (let seed = 1; seed <= 20 && state.gameState === GS.COMBAT; seed += 1) state = act(state, 'attack', seed);
    assert.equal(state.gameState, GS.DEAD, '전제: 실제로 쓰러졌다');
    assert.ok(!hasStaff(state.player));
    assert.equal(state.player.eventChainProgress[CHAIN], 2);
    assert.equal(getChainEventForLoc(step2.loc, state.player.eventChainProgress)?.step.step, 2);
});

test('물러나도(도주 성공) 보상 없이 단계가 남는다', () => {
    let escaped = null;
    for (let seed = 1; seed <= 200 && !escaped; seed += 1) {
        const state = accept(stepState());
        const after = act({ ...state, enemy: { ...state.enemy, atk: 1 } }, 'escape', seed);
        if (after.gameState === GS.IDLE) escaped = after;
    }
    assert.ok(escaped, '전제: 도주에 성공한 시드가 있다');
    assert.equal(escaped.enemy, null);
    assert.ok(!hasStaff(escaped.player));
    assert.equal(escaped.player.eventChainProgress[CHAIN], 2);
    assert.equal(getChainEventForLoc(step2.loc, escaped.player.eventChainProgress)?.step.step, 2);
});

test('전투 중 저장 · 복원을 넘어도 승리 정산이 같다(적 인스턴스가 출처를 든다)', () => {
    const fighting = accept(stepState());
    const restored = gameReducer({ ...structuredClone(INITIAL_STATE), bootStage: 'ready' }, {
        type: AT.LOAD_DATA,
        payload: JSON.parse(JSON.stringify({ player: fighting.player, gameState: GS.COMBAT, enemy: fighting.enemy })),
    });
    assert.equal(restored.gameState, GS.COMBAT);
    assert.deepEqual(restored.enemy.chainCombat, fighting.enemy.chainCombat);
    const won = act({ ...restored, logs: [], enemy: { ...restored.enemy, hp: 1 } }, 'attack', 9);
    assert.ok(hasStaff(won.player));
    assert.equal(won.player.eventChainProgress[CHAIN], 3);
});

test('이미 지난 단계의 승리는 다시 정산하지 않는다(중복 지급 없음)', () => {
    let state = accept(stepState());
    state = { ...state, enemy: { ...state.enemy, hp: 1 }, player: { ...state.player, eventChainProgress: { [CHAIN]: 3 } } };
    state = act(state, 'attack', 5);
    assert.ok(!hasStaff(state.player));
    assert.equal(state.player.eventChainProgress[CHAIN], 3);
});
