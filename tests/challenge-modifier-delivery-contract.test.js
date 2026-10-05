import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { DB } from '../src/data/db.js';
import { BALANCE, CONSTANTS } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { getStructuredFallbackTransaction } from '../src/data/structuredFallbackEvents.js';
import { AT } from '../src/reducers/actionTypes.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { resolveCombatActionTurn } from '../src/systems/combatActionTurn.js';
import { createSeededRandom } from '../src/systems/combatItemTurn.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { getJobSkills } from '../src/utils/gameUtils.js';
import { resolveGraveRecovery } from '../src/utils/graveUtils.js';
import { parseCommand } from '../src/utils/commandParser.js';
import { getAvailableCommands } from '../src/utils/commandSuggestions.js';
import { getAreaBossName } from '../src/utils/bossGauge.js';
import { getLocationVisual } from '../src/utils/locationVisuals.js';
import {
    applyChallengeMaxHp,
    getChallengeRewardPercent,
    getVisibleLocationName,
    getVisibleLocationVisual,
    getVisibleRegionTheme,
} from '../src/utils/challengeRules.js';
import { buildClassVitals } from '../src/hooks/gameActions/_shared.js';
import { createCharacterActions } from '../src/hooks/gameActions/characterActions.js';
import { createMoveActions } from '../src/hooks/gameActions/moveActions.js';
import ChallengeModifierPicker from '../src/components/ChallengeModifierPicker.tsx';
import TerminalView from '../src/components/TerminalView.tsx';
import ControlPanel from '../src/components/ControlPanel.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-10 Wave 62 (원장 §61.2 A9 · A10, §61.4 C1 · C15 · C16, 소유자 결정 "전부 설명대로") — 도전 규칙 설명이 약속한 효과를
 * 엔진이 낸다. 모든 판정은 실제 경로(리듀서 · 액션 팩토리 · 엔진 · 정적 렌더)로 잰다.
 */

const NOW = 1_700_000_000_000;
const NON_GOLD_RULES = ['halfHp', 'randomSkills', 'eliteOnly', 'noPotion', 'blindMap'];

const basePlayer = (extra = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '도전자', job: '전사', loc: '고요한 숲', level: 10, exp: 0, nextExp: 9_999_999,
    hp: 500, maxHp: 500, mp: 200, maxMp: 200, atk: 40, def: 20, gold: 0,
    equip: { weapon: null, armor: null, offhand: null }, relics: [], status: [], quests: [],
    ...extra,
});

const harness = (initial) => {
    let state = initial;
    return { get state() { return state; }, dispatch(action) { state = gameReducer(state, action); } };
};

const idleState = (player) => ({ ...structuredClone(INITIAL_STATE), gameState: GS.IDLE, player, bootStage: 'ready', logs: [] });

// ── C1: 보상 배율 = 선택 화면의 "+N%" ────────────────────────────────────────────

const renderedRewardPercent = (selected) => {
    const html = renderStatic(createElement(ChallengeModifierPicker, {
        testIdPrefix: 'probe', selected, slots: 4, onToggle: () => {},
    }));
    const match = html.match(/data-testid="probe-challenge-reward"[^>]*>([^<]*)</);
    if (!match) return null;
    const percent = match[1].match(/\+(\d+)%/);
    assert.ok(percent, `보상 문구에 +N%가 있다: ${match[1]}`);
    assert.match(match[1], /전투 경험치 · 골드/, '무엇이 오르는지 말한다');
    return Number(percent[1]);
};

test('C1: 규칙 0 ~ 4개의 전투 경험치 · 골드 배율 = 선택 화면이 그린 +N% (×1 · 1.2 · 1.5 · 2.0 · 2.5)', () => {
    const enemy = { name: '슬라임', baseName: '슬라임', exp: 1_000, gold: 1_000, isElite: false, level: 10 };
    const expected = [0, 20, 50, 100, 150];
    for (let count = 0; count <= 4; count += 1) {
        const rules = NON_GOLD_RULES.slice(0, count);
        const shown = count === 0 ? 0 : renderedRewardPercent(rules);
        assert.equal(count === 0 ? renderedRewardPercent(rules) : shown, count === 0 ? null : expected[count], `규칙 ${count}개 화면`);
        assert.equal(getChallengeRewardPercent(count), expected[count]);
        const result = CombatEngine.handleVictory(basePlayer({ challengeModifiers: rules }), enemy, {}, {});
        const mult = 1 + shown / 100;
        assert.equal(result.expGained, Math.floor(1_000 * mult), `규칙 ${count}개 경험치`);
        assert.equal(result.goldGained, Math.floor(1_000 * mult), `규칙 ${count}개 골드`);
    }
});

test('C1: 선택 화면과 엔진은 같은 표(BALANCE.CHALLENGE_REWARD_MULT_BY_COUNT)를 읽는다 — 표가 바뀌면 둘 다 따라간다', () => {
    const table = BALANCE.CHALLENGE_REWARD_MULT_BY_COUNT;
    const original = [...table];
    const enemy = { name: '슬라임', baseName: '슬라임', exp: 1_000, gold: 1_000, isElite: false, level: 10 };
    try {
        // 표 자체를 바꿔 본다(값 배열은 얼어 있지 않다) — 화면이 자기 숫자를 따로 들면 여기서 갈라진다.
        table[1] = 1.7;
        table[3] = 3.3;
        for (const [count, percent] of [[1, 70], [3, 230]]) {
            const rules = NON_GOLD_RULES.slice(0, count);
            assert.equal(renderedRewardPercent(rules), percent, `규칙 ${count}개 화면`);
            assert.equal(CombatEngine.handleVictory(basePlayer({ challengeModifiers: rules }), enemy, {}, {}).expGained,
                Math.floor(1_000 * (1 + percent / 100)), `규칙 ${count}개 엔진`);
        }
    } finally {
        original.forEach((value, index) => { table[index] = value; });
    }
    assert.deepEqual([...table], [1, 1.2, 1.5, 2.0, 2.5]);
});

// ── C16: 빈손의 시작 — 모든 골드 수입이 정확히 한 번 절반 ─────────────────────────

const CONTROL_RULE = ['eliteOnly'];
const goldDelta = (before, after) => (after.player.gold || 0) - (before.player.gold || 0);

const claimQuest = (mods) => {
    const quest = DB.QUESTS.find((entry) => entry.id === 1);
    const state = idleState(basePlayer({ challengeModifiers: mods, quests: [{ id: 1, progress: quest.goal }] }));
    return goldDelta(state, gameReducer(state, { type: AT.CLAIM_QUEST_REWARD, payload: { questId: 1 } }));
};
const claimAchievement = (mods) => {
    const state = idleState(basePlayer({ challengeModifiers: mods, stats: { ...structuredClone(INITIAL_STATE.player.stats), kills: 10 } }));
    return goldDelta(state, gameReducer(state, { type: AT.CLAIM_ACHIEVEMENT_REWARD, payload: { achievementId: 'ach_kill_10' } }));
};
const sellItem = (mods) => {
    const item = { ...structuredClone(DB.ITEMS.consumables[0]), id: 'sell-probe' };
    const state = { ...idleState(basePlayer({ challengeModifiers: mods, inv: [item] })), gameState: GS.SHOP };
    return goldDelta(state, gameReducer(state, { type: AT.SELL_INVENTORY_ITEM, payload: { itemId: 'sell-probe' } }));
};
const firstVisit = (mods) => {
    const h = harness(idleState(basePlayer({ challengeModifiers: mods, loc: CONSTANTS.START_LOCATION, level: 60 })));
    const before = h.state;
    createMoveActions({ player: h.state.player, gameState: GS.IDLE, grave: [], isAiThinking: false, liveConfig: {},
        dispatch: h.dispatch, addLog: () => {} }).move('고요한 숲');
    return goldDelta(before, h.state);
};
const fallbackTransaction = (mods) => {
    const id = 'fallback:wounded-merchant:v1';
    const transaction = getStructuredFallbackTransaction(id);
    const potion = { ...structuredClone(DB.ITEMS.consumables.find((item) => item.type === 'hp')), id: 'potion-probe' };
    const state = { ...idleState(basePlayer({ challengeModifiers: mods, history: [], inv: [potion] })), gameState: GS.EVENT,
        currentEvent: { ...structuredClone(transaction.event), source: 'fallback', fallbackTransactionId: id } };
    const after = gameReducer(state, { type: AT.RESOLVE_FALLBACK_EVENT_TRANSACTION, payload: { transactionId: id, choiceIndex: 0 } });
    assert.equal(after.gameState, GS.IDLE, '거래가 성립했다');
    return goldDelta(state, after);
};
const graveRecovery = (mods) => {
    const player = basePlayer({ challengeModifiers: mods, gold: 0 });
    return resolveGraveRecovery(player, [{ loc: '고요한 숲', gold: 777, items: [] }]).updatedPlayer.gold;
};
const levelMilestone = (mods) => {
    const player = basePlayer({ challengeModifiers: mods, level: 4, exp: 0, nextExp: 1, gold: 0 });
    return CombatEngine.applyExpGain(player, 1).updatedPlayer.gold;
};

for (const [label, measure] of [
    ['임무 수령', claimQuest],
    ['업적 수령', claimAchievement],
    ['판매', sellItem],
    ['첫 방문', firstVisit],
    ['폴백 이벤트 거래(받는 골드)', fallbackTransaction],
    ['묘비 회수', graveRecovery],
    ['레벨 성장 골드', levelMilestone],
]) {
    test(`C16: 빈손의 시작 — ${label} 골드가 정확히 한 번 절반`, () => {
        // 대조군도 규칙 하나(골드와 무관한 '강적의 길')를 들어 전투 보상 배율(규칙 수)이 같다.
        const normal = measure(CONTROL_RULE);
        const halved = measure(['noGold']);
        assert.ok(normal > 1, `${label}: 골드를 받는 경로다 (${normal})`);
        assert.equal(halved, Math.floor(normal * BALANCE.NO_GOLD_MODIFIER_MULT), `${label}: ${normal} → ${halved}`);
    });
}

test('C16: 빈손의 시작 — 전투 승리 골드는 실제 전투 전이에서 정확히 한 번 절반이고 결과 카드 · 누적 골드도 같은 값이다', () => {
    const settle = (mods) => {
        const enemy = { name: '슬라임', baseName: '슬라임', level: 10, hp: 1, maxHp: 50, atk: 1, def: 0, exp: 10, gold: 333,
            pattern: { guardChance: 0, heavyChance: 0 } };
        let state = structuredClone(INITIAL_STATE);
        state = gameReducer(state, { type: AT.SET_PLAYER, payload: basePlayer({ challengeModifiers: mods, atk: 5_000 }) });
        state = gameReducer(state, { type: AT.SET_ENEMY, payload: enemy });
        state = gameReducer(state, { type: AT.SET_GAME_STATE, payload: GS.COMBAT });
        const after = gameReducer(state, { type: AT.RESOLVE_COMBAT_ACTION, payload: { kind: 'attack', expectedTurn: 0, seed: 7, now: NOW } });
        assert.equal(after.enemy, null, '처치했다');
        return {
            delta: goldDelta(state, after),
            card: after.postCombatResult?.gold,
            total: (after.player.stats?.total_gold || 0) - (state.player.stats?.total_gold || 0),
        };
    };
    const normal = settle(CONTROL_RULE);
    const halved = settle(['noGold']);
    assert.ok(normal.delta > 100);
    assert.equal(halved.delta, Math.floor(normal.delta * BALANCE.NO_GOLD_MODIFIER_MULT), `${normal.delta} → ${halved.delta}`);
    assert.equal(halved.card, halved.delta);
    assert.equal(halved.total, halved.delta);
});

test('C16: 빈손의 시작 — 보스 초회 보너스는 반감 전 처치 골드로 계산해 한 번만 절반', () => {
    const boss = { name: '숲의 군주', baseName: '숲의 군주', isBoss: true, exp: 10, gold: 4_000, level: 10 };
    const normal = CombatEngine.handleVictory(basePlayer({ challengeModifiers: CONTROL_RULE }), boss, {}, {});
    const halved = CombatEngine.handleVictory(basePlayer({ challengeModifiers: ['noGold'] }), boss, {}, {});
    assert.equal(halved.goldGained, Math.floor(normal.goldGained / 2));
    assert.equal(halved.bossClearBonus.goldBonus, Math.floor(normal.bossClearBonus.goldBonus / 2));
    assert.equal(halved.updatedPlayer.gold, halved.goldGained + halved.bossClearBonus.goldBonus);
});

// ── A9: 약한 생명력 — 레벨업 · 전직 · 계승 · 사망 재시작 뒤에도 절반 ────────────────

const levelUp = (player, times) => {
    let p = player;
    for (let i = 0; i < times; i += 1) p = CombatEngine.applyExpGain({ ...p, exp: 0, nextExp: 1 }, 1).updatedPlayer;
    return p;
};

/** 같은 여정을 규칙 없이 · 약한 생명력으로 나란히 레벨업한다 — 매 레벨업의 늘어난 생명이 정확히 절반(내림)이다. */
const assertHalvedLevelUps = (normalStart, halfStart, times, label) => {
    let normal = normalStart;
    let half = halfStart;
    for (let i = 0; i < times; i += 1) {
        const nextNormal = levelUp(normal, 1);
        const nextHalf = levelUp(half, 1);
        const normalGain = nextNormal.maxHp - normal.maxHp;
        assert.ok(normalGain > 0);
        // 늘어나는 양마다 절반(내림)이다 — 레벨업 몫과 10레벨 성장 보너스(MILESTONE_STAT_HP)는 각각 절반이 된다.
        const milestoneGain = nextNormal.level % BALANCE.LEVEL_MAJOR_MILESTONE_EVERY === 0 ? BALANCE.MILESTONE_STAT_HP : 0;
        const halve = (gain) => Math.floor(gain * BALANCE.CHALLENGE_HALF_HP_MULT);
        assert.equal(nextHalf.maxHp - half.maxHp, halve(normalGain - milestoneGain) + halve(milestoneGain),
            `${label}: Lv${nextHalf.level} 레벨업 +${normalGain} → +${nextHalf.maxHp - half.maxHp}`);
        assertVitalsWithinEffectiveMax(nextHalf, `${label} Lv${nextHalf.level}`);
        normal = nextNormal;
        half = nextHalf;
    }
    return { normal, half };
};

const assertVitalsWithinEffectiveMax = (player, label) => {
    const effective = calculateFullStats(player).maxHp;
    assert.ok(player.hp <= effective, `${label}: 현재 생명 ${player.hp} ≤ 실효 최대 ${effective}`);
};

test('A9: 약한 생명력 — Lv1에서 10번 레벨업한 뒤에도 최대 생명이 절반이다', () => {
    const vitals = buildClassVitals(1, '모험가', {});
    const lv1 = { ...basePlayer({ job: '모험가', level: 1, meta: { prestigeRank: 0 } }) };
    const halfStart = applyChallengeMaxHp(vitals.maxHp, ['halfHp']);
    const { normal, half } = assertHalvedLevelUps(
        { ...lv1, maxHp: vitals.maxHp, hp: vitals.maxHp },
        { ...lv1, challengeModifiers: ['halfHp'], maxHp: halfStart, hp: halfStart },
        10, '새 여정',
    );
    assert.equal(half.level, 11);
    // 이 여정의 늘어난 양(20 × 10 + 성장 보너스 25)에서는 내림 손실이 0.5 하나뿐이라 총량도 정확히 절반이다.
    assert.equal(half.maxHp, Math.floor(normal.maxHp / 2), `${normal.maxHp} → ${half.maxHp}`);
});

test('A9: 약한 생명력 — Lv10 전사 전직도 절반이고 현재 생명은 실효 최대를 넘지 않는다', () => {
    const changeJob = (mods) => {
        const player = basePlayer({ job: '모험가', level: 10, challengeModifiers: mods, meta: { prestigeRank: 0 }, maxHp: 100, hp: 100 });
        const h = harness(idleState(player));
        createCharacterActions({ player, gameState: GS.IDLE, dispatch: h.dispatch, addLog: () => {}, addStoryLog: () => {},
            getFullStats: (p = h.state.player) => calculateFullStats(p) }, { emitUnlockedTitles: () => {} }).jobChange('전사');
        return h.state.player;
    };
    const normal = changeJob([]);
    const half = changeJob(['halfHp']);
    assert.equal(normal.job, '전사');
    assert.equal(normal.maxHp, buildClassVitals(10, '전사', { prestigeRank: 0 }).maxHp);
    assert.equal(half.maxHp, Math.floor(normal.maxHp / 2), `${normal.maxHp} → ${half.maxHp}`);
    assertVitalsWithinEffectiveMax(half, '전직');
});

test('A9: 약한 생명력 — 계승과 사망 재시작으로 연 여정도 시작 · 레벨업 모두 절반이다', () => {
    const ascend = (mods) => {
        const player = basePlayer({ level: 50, meta: { ...structuredClone(INITIAL_STATE.player.meta), endgame: { lastEndgameReceiptKey: 'rk' } } });
        return gameReducer({ ...idleState(player), gameState: GS.ASCENSION },
            { type: AT.ASCEND, payload: { expectedPrestigeRank: 0, sourceReceiptKey: 'rk', seed: 7, challengeModifiers: mods } }).player;
    };
    const normalAsc = ascend([]);
    const halfAsc = ascend(['halfHp']);
    assert.deepEqual(halfAsc.challengeModifiers, ['halfHp']);
    assert.equal(halfAsc.maxHp, applyChallengeMaxHp(normalAsc.maxHp, ['halfHp']));
    assertHalvedLevelUps(normalAsc, halfAsc, 10, '계승 뒤');

    const restart = (mods) => {
        const dead = CombatEngine.handleDefeat(basePlayer({ level: 30, stats: { ...structuredClone(INITIAL_STATE.player.stats), deaths: 1 } }),
            structuredClone(INITIAL_STATE.player), () => 0.5, () => NOW).updatedPlayer;
        const h = harness(idleState(dead));
        createCharacterActions({ player: dead, gameState: GS.IDLE, dispatch: h.dispatch, addLog: () => {}, addStoryLog: () => {},
            getFullStats: (p = h.state.player) => calculateFullStats(p) }, { emitUnlockedTitles: () => {} })
            .start('다시', 'male', '모험가', mods);
        return h.state.player;
    };
    const normalRe = restart([]);
    const halfRe = restart(['halfHp']);
    assert.equal(halfRe.maxHp, applyChallengeMaxHp(normalRe.maxHp, ['halfHp']));
    assertHalvedLevelUps(normalRe, halfRe, 10, '사망 재시작 뒤');
});

// ── A10: 길 잃은 여행 — 이동 로그 · 터미널 · 그림 · 지역 색이 위치를 드러내지 않는다 ───────────

const BLIND_ROUTES = [
    [CONSTANTS.START_LOCATION, '고요한 숲'],
    ['고요한 숲', '잊혀진 폐허'],
    ['잊혀진 폐허', '어둠의 동굴'],
    [CONSTANTS.START_LOCATION, '서쪽 평원'],
    ['서쪽 평원', '화염의 협곡'],
    ['화염의 협곡', '용의 둥지'],
    ['북부 설원', '사막 오아시스'],
];

const revealingNames = (loc) => [loc, getAreaBossName(DB.MAPS[loc])].filter((name) => typeof name === 'string' && name.length > 0);

test('A10: 길 잃은 여행 — 이동 로그(도착 · 첫 발견 · 첫 방문 보상 · 지역 설명 · 원정 목표)가 지역을 말하지 않는다', () => {
    for (const [from, to] of BLIND_ROUTES) {
        assert.ok(DB.MAPS[from].exits.includes(to), `${from} → ${to}`);
        const logs = [];
        const h = harness(idleState(basePlayer({ challengeModifiers: ['blindMap'], loc: from, level: 99,
            stats: { ...structuredClone(INITIAL_STATE.player.stats), visitedMaps: [from] } })));
        createMoveActions({ player: h.state.player, gameState: GS.IDLE, grave: [], isAiThinking: false, liveConfig: {},
            dispatch: h.dispatch, addLog: (type, text) => logs.push(text) }).move(to);
        assert.equal(h.state.player.loc, to, '이동은 그대로 일어난다');
        assert.ok(logs.includes(MSG.MOVE_ARRIVED(MSG.BLIND_MAP_LOCATION)), `${to}: 도착 로그는 자리표시`);
        for (const name of [...revealingNames(to), ...DB.MAPS[to].exits]) {
            const leaked = logs.filter((text) => String(text).includes(name));
            assert.deepEqual(leaked, [], `${to}: 로그가 '${name}'을(를) 드러낸다`);
        }
        if (DB.MAPS[to].desc) assert.ok(!logs.includes(DB.MAPS[to].desc), `${to}: 지역 설명`);

        // 대조군: 규칙이 없으면 같은 이동이 지역 이름을 말한다(테스트가 공허하지 않다).
        const plainLogs = [];
        const plain = harness(idleState(basePlayer({ loc: from, level: 99, stats: { ...structuredClone(INITIAL_STATE.player.stats), visitedMaps: [from] } })));
        createMoveActions({ player: plain.state.player, gameState: GS.IDLE, grave: [], isAiThinking: false, liveConfig: {},
            dispatch: plain.dispatch, addLog: (type, text) => plainLogs.push(text) }).move(to);
        assert.ok(plainLogs.some((text) => String(text).includes(to)), `${to}: 대조군은 이름을 말한다`);
    }

    // 인자 없는 이동(출구 목록)도 출구 이름을 말하지 않는다.
    const logs = [];
    const player = basePlayer({ challengeModifiers: ['blindMap'], loc: '고요한 숲' });
    createMoveActions({ player, gameState: GS.IDLE, grave: [], isAiThinking: false, liveConfig: {}, dispatch: () => {},
        addLog: (type, text) => logs.push(text) }).move('');
    assert.deepEqual(logs, [MSG.MOVE_EXITS_BLIND(DB.MAPS['고요한 숲'].exits.length)]);
});

test('A10: 길 잃은 여행 — 터미널 상태 · 지도 · 자동완성이 위치와 출구를 말하지 않는다', () => {
    const actions = {
        getFullStats: () => ({ maxHp: 500 }), setSideTab: () => {}, move: () => {}, explore: () => {}, rest: () => {},
        combat: () => {}, cycleSkill: () => {}, openShop: () => {}, handleEventChoice: () => {},
    };
    for (const [, loc] of BLIND_ROUTES) {
        const blind = basePlayer({ challengeModifiers: ['blindMap'], loc });
        for (const command of ['상태', 'status', '지도', 'map']) {
            const out = parseCommand(command, GS.IDLE, blind, actions);
            assert.equal(typeof out, 'string');
            assert.ok(!out.includes(loc), `${loc}: '${command}' → ${out}`);
            const plain = parseCommand(command, GS.IDLE, basePlayer({ loc }), actions);
            assert.ok(plain.includes(loc), `${loc}: 대조군 '${command}'은 위치를 말한다`);
        }
        const suggestions = getAvailableCommands(GS.IDLE, blind).map((entry) => `${entry.cmd} ${entry.desc}`).join('\n');
        for (const exit of DB.MAPS[loc].exits) assert.ok(!suggestions.includes(exit), `${loc}: 자동완성이 출구 ${exit}을(를) 드러낸다`);
    }
});

test('A10: 길 잃은 여행 — 터미널 · 이벤트 화면의 지역 그림과 지역 색이 사라진다', () => {
    for (const [, loc] of BLIND_ROUTES) {
        const blind = basePlayer({ challengeModifiers: ['blindMap'], loc });
        const plain = basePlayer({ loc });
        assert.ok(getLocationVisual(loc), `${loc}: 그림이 있는 지역이다`);
        assert.equal(getVisibleLocationVisual(blind), null);
        assert.deepEqual(getVisibleLocationVisual(plain), getLocationVisual(loc));
        assert.equal(getVisibleRegionTheme(blind, DB.MAPS[loc]), null);
        assert.ok(getVisibleRegionTheme(plain, DB.MAPS[loc]));
        assert.equal(getVisibleLocationName(blind, loc), MSG.BLIND_MAP_LOCATION);

        const terminal = (player) => renderStatic(createElement(TerminalView, { logs: [], gameState: GS.IDLE, player }));
        assert.doesNotMatch(terminal(blind), /data-location-visual/, `${loc}: 터미널 그림`);
        assert.match(terminal(plain), /data-location-visual/, `${loc}: 대조군 터미널 그림`);

        const event = { title: '시험', desc: '시험', choices: ['가', '나'], outcomes: [] };
        // 실제 조작판이 이벤트 화면에 넘기는 위치로 그린다.
        const eventPanel = (player) => renderStatic(createElement(ControlPanel, {
            gameState: GS.EVENT, player, enemy: null, actions: new Proxy({}, { get: () => () => {} }), setGameState: () => {},
            shopItems: [], grave: null, isAiThinking: false, currentEvent: event, stats: null, onOpenArchiveConsole: () => {},
        }));
        assert.doesNotMatch(eventPanel(blind), /data-location-visual/, `${loc}: 이벤트 그림`);
        assert.match(eventPanel(plain), /data-location-visual/, `${loc}: 대조군 이벤트 그림`);
    }
});

// ── C15: 뒤섞인 기술 — 다른 기술이 뽑히고, 쓸 수 없는 기술도 차례를 쓴다 ─────────────

const trainingEnemy = (extra = {}) => ({
    name: '훈련용 정령', baseName: '훈련용 정령', level: 1, hp: 1_000_000, maxHp: 1_000_000, atk: 80, def: 0, exp: 1, gold: 1,
    pattern: { guardChance: 0, heavyChance: 0 }, ...extra,
});

test('C15: 뒤섞인 기술 — 고른 기술은 뽑히지 않는다(기술 2개 이상, 고른 칸 · 씨앗 전수)', () => {
    const player = basePlayer({ job: '전사', level: 40, mp: 10_000, maxMp: 10_000, challengeModifiers: ['randomSkills'] });
    const skills = getJobSkills(player);
    assert.ok(skills.length >= 2);
    const seen = new Set();
    for (let selected = 0; selected < skills.length; selected += 1) {
        for (let seed = 1; seed <= 60; seed += 1) {
            const result = resolveCombatActionTurn({
                player: { ...player, skillLoadout: { selected, cooldowns: {} } },
                enemy: trainingEnemy(), kind: 'skill', initialPlayer: INITIAL_STATE.player, seed, now: NOW,
            });
            const picked = skills.find((skill) => result.logs.some((log) => log.text === MSG.COMBAT_CHAOS_SKILL(skill.name)));
            assert.ok(picked, `seed ${seed}: 뒤섞인 기술 로그`);
            assert.notEqual(picked.name, skills[selected].name, `고른 칸 ${selected} · seed ${seed}`);
            seen.add(picked.name);
        }
    }
    assert.equal(seen.size, skills.length, '모든 기술이 언젠가는 "다른 기술"로 뽑힌다');
});

test('C15: 뒤섞인 기술 — 뽑힌 기술을 쓸 수 없어도 차례가 지나간다(적이 행동 · 턴 증가 · 기력 그대로)', () => {
    const player = basePlayer({ job: '전사', level: 40, mp: 0, maxMp: 200, hp: 5_000, maxHp: 5_000, def: 0,
        challengeModifiers: ['randomSkills'], skillLoadout: { selected: 0, cooldowns: {} } });
    let state = structuredClone(INITIAL_STATE);
    state = gameReducer(state, { type: AT.SET_PLAYER, payload: player });
    state = gameReducer(state, { type: AT.SET_ENEMY, payload: trainingEnemy() });
    state = gameReducer(state, { type: AT.SET_GAME_STATE, payload: GS.COMBAT });
    const after = gameReducer(state, { type: AT.RESOLVE_COMBAT_ACTION, payload: { kind: 'skill', expectedTurn: 0, seed: 11, now: NOW } });
    assert.equal(after.combatTurn, 1, '턴이 지나갔다');
    assert.equal(after.combatReceipt.kind, 'continue', '거부가 아니다');
    assert.equal(after.player.mp, 0, '기력을 쓰지 않았다');
    assert.ok(after.player.hp < state.player.hp, `적이 행동했다 (${state.player.hp} → ${after.player.hp})`);
    assert.ok(after.logs.some((log) => String(log.text).startsWith(MSG.COMBAT_CHAOS_SKILL_FIZZLE('').split('[')[0])), '놓친 차례를 말한다');

    // 같은 씨앗 = 같은 결과(리듀서 결정론), 다음 입력이 공짜로 다시 굴리지 못한다.
    const replay = gameReducer(state, { type: AT.RESOLVE_COMBAT_ACTION, payload: { kind: 'skill', expectedTurn: 0, seed: 11, now: NOW } });
    assert.deepEqual(replay.player, after.player);

    // 규칙이 없으면 기력 부족 기술은 예전처럼 거부된다(적 행동 없음).
    const plain = resolveCombatActionTurn({ player: { ...player, challengeModifiers: [] }, enemy: trainingEnemy(), kind: 'skill',
        initialPlayer: INITIAL_STATE.player, seed: 11, now: NOW, rng: createSeededRandom(11) });
    assert.equal(plain.kind, 'rejected');
    assert.equal(plain.player.hp, player.hp);
});
