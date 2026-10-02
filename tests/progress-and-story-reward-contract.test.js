import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE, CONSTANTS } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { EVENT_CHAINS } from '../src/data/eventChains.js';
import { MAPS } from '../src/data/maps.js';
import { createCharacterActions } from '../src/hooks/gameActions/characterActions.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { getBountyTargets } from '../src/reducers/handlers/questHandlers.js';
import { getAdventureGuidance } from '../src/utils/adventureGuide.js';
import { buildEventPackage } from '../src/utils/aiEventUtils.js';
import { getCumulativeQuestProgress } from '../src/utils/cumulativeQuestProgress.js';
import { migrateData } from '../src/utils/dataMigration.js';
import { getRestCost } from '../src/utils/expeditionReturnFlow.js';
import { registerLootToCodex } from '../src/utils/gameUtils.js';
import { applyItemPrefix } from '../src/utils/itemPrefixUtils.js';
import { getMapAccess } from '../src/utils/mapAccess.js';
import { nonWalkingEntryOf } from '../src/utils/mapRouteGate.js';
import { getMapRequiredLevel } from '../src/utils/mapTopology.js';
import { getCurrentDailyProtocol } from '../src/utils/protocolCycle.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';

/**
 * 2026-10 Wave 61 (원장 §61 A3 · A6 · A7 · A8 · A12 ~ A20) — 설명 감사 4회차의 엔진 · 화면 결함.
 * 각 테스트는 고치기 전 코드에서 실제로 틀렸던 값을 다시 만든다(결함 주입으로 확인).
 */

const clone = (value) => structuredClone(value);
const basePlayer = (over = {}) => ({
    ...clone(INITIAL_STATE.player),
    name: '용사',
    ...over,
    stats: { ...clone(INITIAL_STATE.player.stats), ...(over.stats || {}) },
});

// ── A3 ───────────────────────────────────────────────────────────────────
test('A3: 화면의 진입 레벨 잠금은 이동 규칙(getMapAccess)의 레벨 잠금과 같다 — 혼돈의 심연 포함', () => {
    const mismatches = [];
    for (const [name, map] of Object.entries(MAPS)) {
        const from = Object.keys(MAPS).find((candidate) => MAPS[candidate].exits?.includes(name)) || name;
        for (const level of [1, 10, 30, 48, 70, 99]) {
            const uiLocked = level < getMapRequiredLevel(map, level);
            const engineLocked = getMapAccess(MAPS, from, name, level, true).reason === 'level';
            if (uiLocked !== engineLocked) mismatches.push(`${name} @Lv${level}: 화면 ${uiLocked} / 엔진 ${engineLocked}`);
        }
    }
    assert.deepEqual(mismatches, []);
});

// ── A6 ───────────────────────────────────────────────────────────────────
test('A6: 발견 지역 임무는 시작 마을을 세지 않는다 — 새 플레이어는 0', () => {
    const fresh = basePlayer({ stats: { visitedMaps: [CONSTANTS.START_LOCATION] } });
    const discoveryQuests = DB.QUESTS.filter((quest) => quest.type === 'discovery_count');
    assert.ok(discoveryQuests.length >= 2, '72 · 201');
    for (const quest of discoveryQuests) assert.equal(getCumulativeQuestProgress(quest, fresh), 0, `임무 ${quest.id}`);
    const twoMore = basePlayer({ stats: { visitedMaps: [CONSTANTS.START_LOCATION, '고요한 숲', '서쪽 평원'] } });
    assert.equal(getCumulativeQuestProgress(discoveryQuests[0], twoMore), 2);
});

// ── A7 ───────────────────────────────────────────────────────────────────
test('A7: 현상수배 대상은 걸어서 들어갈 수 있는 지역에서 나오는 몬스터뿐이다 (열쇠 보물고 · 시즌 지역 제외)', () => {
    const walkable = new Set();
    for (const [name, map] of Object.entries(MAPS)) {
        if (nonWalkingEntryOf(name, map)) continue;
        for (const monster of map.monsters || []) walkable.add(monster);
    }
    const bad = new Set();
    for (let level = 1; level <= 99; level += 1) {
        for (const target of getBountyTargets(level)) if (!walkable.has(target)) bad.add(`Lv${level}: ${target}`);
    }
    assert.deepEqual([...bad], []);
    // 고치기 전 Lv35 대상 16종 중 3종이 보물고 전용이었다.
    for (const vaultOnly of ['황금 골렘', '보물사냥꾼', '미믹']) {
        assert.equal(getBountyTargets(35).includes(vaultOnly), false, vaultOnly);
    }
});

// ── A8 ───────────────────────────────────────────────────────────────────
const steelSword = () => DB.ITEMS.weapons.find((item) => item.name === '강철 롱소드');

test('A8: 접두어 장비는 도감에 바탕 이름으로 한 번 등록된다', () => {
    const base = steelSword();
    assert.ok(base, '강철 롱소드');
    // 실제 접두어 부여 경로로 서로 다른 접두어 사본 셋을 만든다(첫 난수 0 = 접두어 확정, 둘째 = 후보 선택).
    const prefixed = [0, 0.15, 0.3].map((pick, index) => {
        const rolls = [0, pick];
        return { ...applyItemPrefix({ ...base, id: `p${index}` }, () => rolls.shift() ?? 0), id: `p${index}` };
    });
    assert.equal(new Set(prefixed.map((item) => item.name)).size, 3, `전제: 접두어 사본 3종 — ${prefixed.map((item) => item.name).join(', ')}`);
    const player = registerLootToCodex(basePlayer(), prefixed);
    const weapons = player.stats.codex?.weapons || {};
    assert.ok(weapons[base.name], `바탕 이름 미등록: ${Object.keys(weapons).join(', ')}`);
    assert.equal(Object.keys(weapons).filter((key) => key.endsWith(base.name)).length, 1, '접두어 사본이 따로 세어지지 않는다');
});

test('A8: 구세이브의 접두어 도감 키는 마이그레이션이 바탕 이름으로 합친다', () => {
    const base = steelSword();
    const raw = {
        player: {
            ...basePlayer(),
            stats: {
                ...basePlayer().stats,
                codex: { weapons: { [`날카로운 ${base.name}`]: { firstSeen: 1 }, [`묵직한 ${base.name}`]: { firstSeen: 2 } }, armors: {}, shields: {} },
            },
        },
        gameState: 'idle',
    };
    const migrated = migrateData(raw, { now: () => 1_700_000_000_000 });
    const weapons = migrated.player.stats.codex.weapons;
    assert.ok(weapons[base.name], `키: ${Object.keys(weapons).join(', ')}`);
    assert.equal(Object.keys(weapons).some((key) => key !== base.name && key.endsWith(base.name)), false);
});

// ── A12 · A13 · A14 ──────────────────────────────────────────────────────
const chainStep = (chainId, step) => EVENT_CHAINS.find((chain) => chain.id === chainId).steps.find((entry) => entry.step === step);

const chainState = (chainId, step, player) => ({
    ...clone(INITIAL_STATE),
    bootStage: 'ready',
    logs: [],
    gameState: GS.EVENT,
    currentEvent: { ...clone(chainStep(chainId, step).event), _chainId: chainId, _chainStep: step },
    player: { ...player, loc: chainStep(chainId, step).loc, eventChainProgress: { [chainId]: step } },
});

const resolveChainChoice = (state, choiceIndex) => {
    let current = state;
    const dispatch = (action) => { current = gameReducer(current, action); };
    const addLog = (type, text) => dispatch({ type: AT.ADD_LOG, payload: { type, text } });
    createEventActions({
        player: current.player,
        currentEvent: current.currentEvent,
        dispatch,
        addLog,
        getFullStats: () => calculateFullStats(current.player),
        rng: () => 0.5,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(choiceIndex);
    return current;
};

const knight = (over = {}) => basePlayer({ job: '나이트', level: 40, maxHp: 900, hp: 900, maxMp: 200, mp: 200, atk: 60, def: 40, ...over });

test('A12: 이야기 "생명 +N"은 현재 생명을 줄이지 않는다 — 실효 최대치가 저장 최대치보다 커도', () => {
    // abyss_signal 1단계 선택 1 = 공격력 +10 · 생명 +100. 장비로 실효 최대치가 저장 최대치(900)보다 크다.
    const outcome = chainStep('abyss_signal', 1).event.outcomes[1];
    assert.deepEqual(outcome.reward, { type: 'stat_bonus', atk: 10, hp: 100 });
    const armor = DB.ITEMS.armors.find((item) => item.name === '용비늘 갑주');
    assert.ok(armor, '생명을 올리는 방어구');
    const player = knight({ equip: { ...clone(INITIAL_STATE.player.equip), armor: { ...armor, id: 'arm' } } });
    const effectiveMax = calculateFullStats(player).maxHp;
    assert.ok(effectiveMax > player.maxHp + 100, `전제: 실효 ${effectiveMax} > 저장 ${player.maxHp} + 100`);
    const before = { ...player, hp: effectiveMax };
    const after = resolveChainChoice(chainState('abyss_signal', 1, before), 1).player;
    assert.ok(after.hp >= before.hp, `생명이 줄었다: ${before.hp} → ${after.hp}`);
});

test('A13 · A14: 이야기 능력치는 배율 뒤에 더해지고 전직 뒤에도 남는다', () => {
    const before = knight();
    const statsBefore = calculateFullStats(before);
    const after = resolveChainChoice(chainState('abyss_signal', 1, before), 1).player;
    const statsAfter = calculateFullStats(after);
    // A14: "+10 공격력"은 정확히 +10이다(배율 안에 굽던 동안 직업 배율만큼 커졌다).
    assert.equal(statsAfter.atk - statsBefore.atk, 10);
    assert.equal(after.maxHp - before.maxHp, 100);

    // A13: 전직이 저장 최대치를 다시 만들어도 이야기 생명 +100은 남는다.
    let jobbed = after;
    const dispatch = (action) => {
        if (action.type === AT.SET_PLAYER) jobbed = typeof action.payload === 'function' ? action.payload(jobbed) : action.payload;
    };
    const next = DB.CLASSES?.[after.job]?.next?.[0] || Object.entries(DB.CLASSES || {}).find(([, cls]) => cls.next?.length)?.[1]?.next?.[0];
    assert.ok(next, '다음 직업');
    const from = Object.entries(DB.CLASSES).find(([, cls]) => cls.next?.includes(next))[0];
    const withFrom = { ...after, job: from, level: Math.max(after.level, DB.CLASSES[next].reqLv || 1) };
    jobbed = withFrom;
    const control = { ...knight({ job: from, level: withFrom.level }) };
    let controlJobbed = control;
    createCharacterActions({ player: withFrom, gameState: 'idle', dispatch, addLog: () => {}, addStoryLog: () => {}, getFullStats: () => calculateFullStats(withFrom) }, { emitUnlockedTitles: () => {} }).jobChange(next);
    createCharacterActions({
        player: control,
        gameState: 'idle',
        dispatch: (action) => { if (action.type === AT.SET_PLAYER) controlJobbed = typeof action.payload === 'function' ? action.payload(controlJobbed) : action.payload; },
        addLog: () => {},
        addStoryLog: () => {},
        getFullStats: () => calculateFullStats(control),
    }, { emitUnlockedTitles: () => {} }).jobChange(next);
    assert.equal(jobbed.job, next);
    assert.equal(jobbed.maxHp - controlJobbed.maxHp, 100, `전직 뒤 이야기 생명: ${jobbed.maxHp} vs ${controlJobbed.maxHp}`);
    assert.equal(calculateFullStats(jobbed).atk - calculateFullStats(controlJobbed).atk, 10);
});

// ── A15 · A16 ────────────────────────────────────────────────────────────
test('A15: 용의 유산 1단계 선택 2는 말한 대로 용의 비늘을 준다', () => {
    const outcome = chainStep('dragon_legacy', 1).event.outcomes[1];
    assert.ok(/용의 비늘/.test(outcome.log || outcome.text || ''), '전제: 문구가 용의 비늘을 말한다');
    assert.deepEqual(outcome.reward, { type: 'item', name: '용의 비늘' });
    assert.ok(DB.ITEMS.materials.some((item) => item.name === '용의 비늘'));
});

test('A16: 선택지 번호만 지우고 숫자 답 · 소수는 남긴다', () => {
    const choicesOf = (choices) => buildEventPackage({
        desc: '수수께끼를 낸다.',
        choices,
        outcomes: choices.map((_, choiceIndex) => ({ choiceIndex, log: '결과', gold: 1 })),
    }, { location: '잊혀진 폐허', playerSnapshot: { level: 9, maxHp: 180, maxMp: 90 }, mapSnapshot: { level: 5 } }).choices;
    // "1+2+…+10 = ?" 퍼즐 — 답이 숫자 제거로 "선택지 1/2/3"이 되던 결함.
    assert.deepEqual(choicesOf(['45', '50', '55']), ['45', '50', '55']);
    assert.deepEqual(choicesOf(['1. 싸운다', '2) 도망친다', '3- 기다린다']), ['싸운다', '도망친다', '기다린다']);
    assert.deepEqual(choicesOf(['1.5배 피해를 감수한다', '물러선다', '기다린다']), ['1.5배 피해를 감수한다', '물러선다', '기다린다']);
});

// ── A17 ──────────────────────────────────────────────────────────────────
test('A17: 이야기 골드 지불(최후의 영웅 300 · 그림자 길드 2,000)도 일일 골드 소비를 채운다', () => {
    for (const { chainId, step, choiceIndex, cost } of [
        { chainId: 'last_hero', step: 0, choiceIndex: 0, cost: 300 },
        { chainId: 'shadow_guild', step: 1, choiceIndex: 0, cost: 2000 },
    ]) {
        const player = basePlayer({ gold: 10_000, level: 10, stats: { dailyProtocol: getCurrentDailyProtocol(INITIAL_STATE.player, new Date()) } });
        const state = chainState(chainId, step, player);
        const after = gameReducer(state, { type: AT.RESOLVE_CHAIN_GOLD_CHOICE, payload: { chainId, step, choiceIndex, relicRoll: 0.99 } });
        assert.equal(after.player.gold, 10_000 - cost, `${chainId}: 지불`);
        const mission = after.player.stats.dailyProtocol.missions.find((entry) => entry.type === 'goldSpend');
        assert.equal(mission.progress, Math.min(mission.goal, cost), `${chainId}: 일일 골드 소비 ${mission.progress}/${mission.goal}`);
    }
});

// ── A18 ──────────────────────────────────────────────────────────────────
test('A18: 성공률 100% 합성은 보호를 요청해도 보호권 · 크리스털을 쓰지 않는다', () => {
    const template = DB.ITEMS.weapons.find((entry) => entry.tier === 1);
    const inputs = ['s-a', 's-b', 's-c'].map((id) => ({ ...template, id }));
    assert.equal(BALANCE.SYNTHESIS_SUCCESS_RATES[1], 1, '전제: 1단계 성공률 100%');
    const state = {
        ...clone(INITIAL_STATE),
        gameState: GS.CRAFTING,
        player: basePlayer({ gold: 100_000, inv: inputs, premiumCurrency: 50, stats: { synthProtects: 2 } }),
    };
    const after = gameReducer(state, {
        type: AT.SYNTHESIZE_ITEMS,
        payload: { itemIds: inputs.map((item) => item.id), useProtect: true, successRoll: 0, outputRoll: 0 },
    });
    assert.equal(after.player.stats.syntheses, 1, '합성은 진행됐다');
    assert.equal(after.player.premiumCurrency, 50, '크리스털 그대로');
    assert.equal(after.player.stats.synthProtects, 2, '보호권 그대로');

    // 실패할 수 있는 합성에서는 여전히 보호권을 쓴다(보호 자체가 사라지지 않았다).
    const tier3 = DB.ITEMS.weapons.find((entry) => entry.tier === 3);
    const risky = ['r-a', 'r-b', 'r-c'].map((id) => ({ ...tier3, id }));
    const riskyState = { ...state, player: { ...state.player, inv: risky } };
    const protectedRun = gameReducer(riskyState, {
        type: AT.SYNTHESIZE_ITEMS,
        payload: { itemIds: risky.map((item) => item.id), useProtect: true, successRoll: 0.99, outputRoll: 0 },
    });
    assert.equal(protectedRun.player.stats.synthProtects, 1, '보호권 1장 사용');
});

// ── A19 ──────────────────────────────────────────────────────────────────
test('A19: 휴식 안내는 실제 휴식 비용으로 판단한다 — Lv40 · 골드 100이면 추천하지 않는다', () => {
    const town = MAPS[CONSTANTS.START_LOCATION];
    const poor = basePlayer({ level: 40, hp: 100, maxHp: 1_000, gold: 100, loc: CONSTANTS.START_LOCATION, job: '나이트' });
    assert.ok(getRestCost(poor) > 100, `전제: 휴식 비용 ${getRestCost(poor)}`);
    const guidance = getAdventureGuidance(poor, calculateFullStats(poor), town, 'idle');
    assert.notEqual(guidance?.primaryAction?.kind, 'rest', `추천: ${guidance?.title}`);

    const rich = { ...poor, gold: getRestCost(poor) };
    assert.equal(getAdventureGuidance(rich, calculateFullStats(rich), town, 'idle')?.primaryAction?.kind, 'rest');

    // 정화 안내도 같은 비용을 본다.
    const cursed = { ...poor, hp: 1_000, status: ['poison'] };
    assert.notEqual(getAdventureGuidance(cursed, calculateFullStats(cursed), town, 'idle')?.primaryAction?.kind, 'rest');
});

// ── A20 ──────────────────────────────────────────────────────────────────
test('A20: 제작 임무 진행도는 제작 직후 갱신된다', () => {
    const recipe = DB.ITEMS.recipes.find((entry) => entry.id === 'r5');
    const material = DB.ITEMS.materials.find((entry) => entry.name === recipe.inputs[0].name);
    const inputs = Array.from({ length: recipe.inputs[0].qty }, (_, index) => ({ ...material, id: `m-${index}` }));
    const craftQuest = DB.QUESTS.find((quest) => quest.type === 'craft' && quest.goal > 1);
    const state = {
        ...clone(INITIAL_STATE),
        gameState: GS.CRAFTING,
        player: basePlayer({
            gold: 5_000,
            level: craftQuest.minLv || 1,
            inv: inputs,
            quests: [{ id: craftQuest.id, progress: 0 }],
            stats: { crafts: craftQuest.goal - 1 },
        }),
    };
    const after = gameReducer(state, { type: AT.CRAFT_RECIPE, payload: { recipeId: recipe.id, inputIds: inputs.map((item) => item.id), relicRoll: 0 } });
    assert.equal(after.player.stats.crafts, craftQuest.goal);
    const entry = after.player.quests.find((quest) => quest.id === craftQuest.id);
    assert.equal(entry?.progress, craftQuest.goal, `임무 ${craftQuest.id}: ${entry?.progress}/${craftQuest.goal}`);
});
