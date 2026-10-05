import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { EVENT_CHAINS } from '../src/data/eventChains.js';
import { MSG } from '../src/data/messages.js';
import { BALANCE } from '../src/data/constants.js';
import { BOUNDED_ENCOUNTERS } from '../src/data/boundedEncounters.js';
import { RELICS } from '../src/data/relics.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { applyBattleStartRelics } from '../src/hooks/gameActions/exploreFlow.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { resolveConsumableEffect } from '../src/systems/consumableEffect.js';
import {
    formatTempBuffKeptNotice,
    getTempBuffPotency,
    mergeTempBuff,
} from '../src/systems/tempBuffMerge.js';
import { applyBoundedEncounterChoice } from '../src/utils/boundedEncounterSelector.js';
import { buildCampfireEvent } from '../src/utils/campfireEvent.js';
import { applyPostCombatChoice, getPostCombatChoiceOptions } from '../src/utils/postCombatChoice.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';

/**
 * Wave 62 C6 — 강화 칸(`tempBuff`)은 하나의 규칙으로 합친다: 더 센 쪽을 남긴다(소유자 결정 "버프는 더 센 쪽 유지").
 *
 * 세기 = (공격 + 방어 + 반격 확률) × 남은 턴. 같으면 한 턴의 증가량이 큰 쪽, 그것도 같으면 지금 강화(물약은 쓰지 않는다).
 * 이전에는 경로마다 덮어써 더 센 강화가 사라졌다 — +50% · 3턴 기술 강화 위에 수호의 물약 → 공격력 345 → 235, 전쟁의 북이
 * 전투 전 물약(+30% · 5턴)을 +20% · 2턴으로 바꿈, 모닥불 · 밀어붙인다 · 이야기 보너스 · 한정 조우 · 사건 강화도 같은 모양.
 *
 * 이 파일은 **모든 비기술 강화 경로**(물약 · 전투 중 물약 · 전쟁의 북 · 모닥불 단련 · 밀어붙인다 · 이야기 전투 보너스 · 한정 조우 ·
 * 사건 강화)를 같은 두 경우로 돈다: 더 센 강화가 걸려 있으면 그것이 남고(부가 필드 포함) 안내가 나온다, 더 약한 강화가 걸려
 * 있으면 들어온 강화가 칸을 갖는다. 기술 강화(`CombatEngine.actions.ts`, Wave 52 · 53)는 이 규칙 밖이다.
 */

/** 모든 경로보다 센 강화 — 반격 확률 · 이름 같은 부가 필드가 함께 남는지 본다. */
const STRONG = () => ({ atk: 0.5, def: 0, turn: 6, name: '광폭화', counterChance: 0.3 });
/** 모든 경로보다 약한 강화. */
const WEAK = () => ({ atk: 0.05, def: 0, turn: 1, name: '약한 강화' });

const basePlayer = (tempBuff, extra = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '용사', job: '전사', level: 30, hp: 900, maxHp: 1_000, mp: 200, maxMp: 300, gold: 5_000,
    loc: '고요한 숲',
    equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
    relics: [],
    tempBuff,
    ...extra,
});

const consumable = (name) => ({ ...DB.ITEMS.consumables.find((item) => item.name === name), id: `potion:${name}` });

/** 실제 훅으로 이벤트 선택을 해소하고 (player, logs)를 돌려준다. */
const resolveEvent = (player, currentEvent, choiceIndex) => {
    let state = {
        ...structuredClone(INITIAL_STATE), bootStage: 'ready', logs: [], gameState: GS.EVENT, currentEvent, player,
    };
    const dispatch = (action) => { state = gameReducer(state, action); };
    const addLog = (type, text) => dispatch({ type: AT.ADD_LOG, payload: { type, text } });
    createEventActions({
        player: state.player,
        currentEvent: state.currentEvent,
        dispatch,
        addLog,
        getFullStats: () => calculateFullStats(state.player),
        rng: () => 0.5,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(choiceIndex);
    return { player: state.player, logs: state.logs.map((log) => log.text) };
};

const chainStep = (chainId, step) => EVENT_CHAINS.find((entry) => entry.id === chainId).steps.find((entry) => entry.step === step);
const WAR_DRUM = RELICS.find((relic) => relic.effect === 'battle_start_buff');
const RUNES = BOUNDED_ENCOUNTERS.find((entry) => entry.choices.some((choice) => choice.id === 'read-runes'));
const commanderStep = chainStep('forgotten_commander', 1);
const commanderReward = commanderStep.event.outcomes[0].reward;

/**
 * 모든 비기술 강화 경로. `incoming`은 그 경로가 거는 강화(규칙의 입력), `apply`는 실제 경로를 돌린다.
 * `keptOut(result)`은 더 센 강화가 남았을 때 그 경로가 플레이어에게 말하는 방법을 확인한다.
 */
const SOURCES = [
    {
        id: '분노의 물약(전투 밖)',
        incoming: { atk: 0.3, def: 0, turn: 5, name: '분노의 물약' },
        apply: (tempBuff) => {
            const potion = consumable('분노의 물약');
            const player = basePlayer(tempBuff, { inv: [potion] });
            const result = resolveConsumableEffect({ player, item: potion });
            return { player: result.player, logs: result.ok ? [result.log.text] : [result.message], raw: result };
        },
        keptOut: ({ raw }) => {
            assert.equal(raw.reason, 'BUFF_DOMINATED');
            assert.equal(raw.player.inv.length, 1, '물약은 쓰지 않는다');
            assert.equal(raw.message, MSG.CONSUMABLE_BUFF_DOMINATED);
        },
    },
    {
        id: '영웅의 물약(전투 밖)',
        incoming: { atk: 0.5, def: 0.5, turn: 3, name: '영웅의 물약' },
        apply: (tempBuff) => {
            const potion = consumable('영웅의 물약');
            const result = resolveConsumableEffect({ player: basePlayer(tempBuff, { inv: [potion] }), item: potion });
            return { player: result.player, logs: result.ok ? [result.log.text] : [result.message], raw: result };
        },
        keptOut: ({ raw }) => assert.equal(raw.reason, 'BUFF_DOMINATED'),
    },
    {
        id: '전쟁의 북(전투 시작)',
        incoming: { atk: WAR_DRUM.val.atk, def: 0, turn: WAR_DRUM.val.turns, name: 'battle_start_buff' },
        apply: (tempBuff) => {
            const logs = [];
            const player = basePlayer(tempBuff, { relics: [structuredClone(WAR_DRUM)] });
            const next = applyBattleStartRelics(player, player.relics, calculateFullStats(player), {
                addLog: (type, text) => logs.push(text), rng: () => 0.5,
            });
            return { player: next, logs };
        },
        keptOut: ({ logs }, kept) => assert.ok(logs.includes(formatTempBuffKeptNotice(kept, MSG.WAR_DRUM_BUFF_LABEL))),
    },
    {
        id: '모닥불 단련',
        incoming: { atk: BALANCE.CAMPFIRE_FORGE_ATK, def: 0, turn: BALANCE.CAMPFIRE_FORGE_TURNS, name: MSG.CAMPFIRE_FORGE_BUFF_NAME },
        apply: (tempBuff) => resolveEvent(basePlayer(tempBuff), buildCampfireEvent({ maxHp: 1_000, maxMp: 300 }), 1),
        keptOut: ({ logs }, kept) => assert.ok(logs.includes(formatTempBuffKeptNotice(kept, MSG.CAMPFIRE_FORGE_BUFF_NAME))),
    },
    {
        id: '밀어붙인다',
        incoming: { atk: BALANCE.POST_COMBAT_PUSH_ATK_BONUS, def: 0, turn: BALANCE.POST_COMBAT_PUSH_TURNS, name: MSG.POST_COMBAT_PUSH_BUFF_NAME },
        apply: (tempBuff) => {
            const result = applyPostCombatChoice(basePlayer(tempBuff), 'push', DB.MAPS['고요한 숲'], 1_000);
            return { player: result.player, logs: result.logs.map((log) => log.text) };
        },
        keptOut: ({ logs, player }, kept) => {
            assert.ok(logs.includes(formatTempBuffKeptNotice(kept, MSG.POST_COMBAT_PUSH_BUFF_NAME)));
            assert.equal(player.stats.nextExploreCampfireBlocked, true, '고른 대가(모닥불 차단)는 그대로 치른다');
        },
    },
    {
        id: '이야기 전투 보너스(잊혀진 사령관)',
        incoming: { atk: commanderReward.atkMult - 1, def: 0, turn: commanderReward.duration, name: commanderReward.buffName },
        apply: (tempBuff) => resolveEvent(
            basePlayer(tempBuff, { loc: commanderStep.loc, eventChainProgress: { forgotten_commander: 1 } }),
            { ...structuredClone(commanderStep.event), _chainId: 'forgotten_commander', _chainStep: 1 },
            0,
        ),
        keptOut: ({ logs, player }, kept) => {
            assert.ok(logs.includes(formatTempBuffKeptNotice(kept, commanderReward.buffName)));
            assert.equal(player.eventChainProgress.forgotten_commander, 2, '이야기는 그대로 진행된다');
        },
    },
    {
        id: '한정 조우(돌기둥의 가호)',
        incoming: { ...RUNES.choices.find((choice) => choice.id === 'read-runes').outcome.buff },
        apply: (tempBuff) => {
            const result = applyBoundedEncounterChoice(basePlayer(tempBuff), RUNES, 'read-runes', {
                expeditionId: 'expedition-1', occurrenceSequence: 1,
            });
            assert.equal(result.applied, true, `전제: 조우가 정산됐다 (${result.reason})`);
            return { player: result.player, logs: [result.result] };
        },
        keptOut: ({ logs }, kept) => assert.ok(logs[0].endsWith(formatTempBuffKeptNotice(kept, '돌기둥의 가호'))),
    },
    {
        id: '사건 강화(배율 스키마)',
        incoming: { atk: 0.2, def: 0.1, turn: 3, name: MSG.EVENT_BUFF_NAME },
        apply: (tempBuff) => resolveEvent(basePlayer(tempBuff), {
            desc: '바람이 등을 민다', choices: ['받아들인다', '지나친다'],
            outcomes: [{ choiceIndex: 0, log: '기세가 오른다.', buff: { atkMult: 1.2, defMult: 1.1, turns: 3 } }, { choiceIndex: 1, log: '지나쳤다.' }],
        }, 0),
        keptOut: ({ logs }, kept) => assert.ok(logs.includes(formatTempBuffKeptNotice(kept, MSG.EVENT_BUFF_NAME))),
    },
];

const sameBuff = (actual, expected) => {
    for (const key of ['atk', 'def', 'turn']) {
        assert.ok(Math.abs((actual?.[key] ?? 0) - (expected[key] ?? 0)) < 1e-9, `${key}: ${actual?.[key]} vs ${expected[key]}`);
    }
    assert.equal(actual?.name ?? null, expected.name ?? null);
};

test('전제: 기준 강화는 모든 경로보다 세거나(STRONG) 약하다(WEAK)', () => {
    for (const source of SOURCES) {
        assert.ok(getTempBuffPotency(STRONG()) > getTempBuffPotency(source.incoming), source.id);
        assert.ok(getTempBuffPotency(WEAK()) < getTempBuffPotency(source.incoming), source.id);
    }
});

for (const source of SOURCES) {
    test(`${source.id}: 더 센 강화가 걸려 있으면 그것이 남는다(반격 · 이름 포함) — 밀린 쪽을 알린다`, () => {
        const kept = STRONG();
        const result = source.apply(kept);
        assert.deepEqual(result.player.tempBuff, kept, '지금 강화가 객체째 남는다');
        source.keptOut(result, kept);
    });

    test(`${source.id}: 더 약한 강화가 걸려 있으면 들어온 강화가 칸을 갖는다`, () => {
        const result = source.apply(WEAK());
        sameBuff(result.player.tempBuff, source.incoming);
        assert.equal(result.player.tempBuff.counterChance, undefined);
    });

    test(`${source.id}: 강화가 없으면 그대로 걸린다(이전 동작)`, () => {
        const result = source.apply({ atk: 0, def: 0, turn: 0, name: null });
        sameBuff(result.player.tempBuff, source.incoming);
    });
}

test('규칙 표: 세기 → 한 턴의 증가량 → 같으면 지금 강화(같은 참조)', () => {
    const current = { atk: 0.3, def: 0, turn: 5, name: '기존' };
    // 세기 1.5 vs 1.5 — 증가량이 큰 +50% · 3턴이 이긴다.
    assert.equal(mergeTempBuff(current, { atk: 0.5, def: 0, turn: 3, name: '새' }).kept, 'incoming');
    // 세기 1.5 vs 0.9 — 지금 강화가 남는다.
    assert.equal(mergeTempBuff(current, { atk: 0, def: 0.3, turn: 3, name: '새' }).kept, 'current');
    // 완전히 같으면 지금 강화(같은 참조) — 같은 물약을 두 번 마셔 낭비하지 않는다.
    const same = mergeTempBuff(current, { atk: 0.3, def: 0, turn: 5, name: '새' });
    assert.equal(same.kept, 'current');
    assert.equal(same.tempBuff, current);
    // 끝난 강화(턴 0)는 세기 0 — 무엇이든 들어온다. 세기 0인 들어온 강화는 아무것도 바꾸지 않는다.
    assert.equal(mergeTempBuff({ atk: 0.9, def: 0, turn: 0 }, { atk: 0.1, def: 0, turn: 1 }).kept, 'incoming');
    assert.equal(mergeTempBuff(undefined, { atk: 0, def: 0, turn: 3 }).kept, 'current');
    // 반격 확률도 세기에 든다: 반격 40% · 3턴(1.2) > 공격 +30% · 3턴(0.9).
    assert.equal(mergeTempBuff({ atk: 0, def: 0, turn: 3, counterChance: 0.4 }, { atk: 0.3, def: 0, turn: 3 }).kept, 'current');
});

// ── 전투 중 물약 — 기술 강화가 걸린 동안(감사 재현: 공격력 345 → 235) ─────────────

const combatState = (player) => ({
    ...structuredClone(INITIAL_STATE),
    bootStage: 'ready',
    logs: [],
    gameState: GS.COMBAT,
    combatTurn: 0,
    enemy: { name: '슬라임', baseName: '슬라임', hp: 1e9, maxHp: 1e9, atk: 10, def: 0, level: 30, exp: 0, gold: 0, pattern: { guardChance: 0, heavyChance: 0 } },
    player,
});
const drink = (state, itemId) => gameReducer(state, {
    type: AT.USE_COMBAT_ITEM,
    payload: { itemId, expectedTurn: state.combatTurn, seed: 20261005, now: 1_700_000_000_000 },
});

test('전투 중: +50% · 3턴 기술 강화 위에 수호의 물약은 들어가지 않는다 — 공격력이 떨어지지 않고 턴도 쓰지 않는다', () => {
    const skillBuff = { atk: 0.5, def: 0, turn: 3, name: '광폭화' };
    const guard = consumable('수호의 물약');
    const before = combatState(basePlayer(skillBuff, { inv: [guard] }));
    const after = drink(before, guard.id);
    assert.equal(after, before, '거부는 동일 참조(턴 소비 없음)');
    assert.equal(calculateFullStats(after.player).atk, calculateFullStats(before.player).atk);
});

test('전투 중: 더 센 영웅의 물약은 기술 강화를 대신한다(규칙은 기술 강화 위에 들어오는 물약에도 같다)', () => {
    const skillBuff = { atk: 0.5, def: 0, turn: 3, name: '광폭화' };
    const hero = consumable('영웅의 물약');
    const before = combatState(basePlayer(skillBuff, { inv: [hero] }));
    const after = drink(before, hero.id);
    assert.notEqual(after, before);
    assert.equal(after.player.tempBuff.name, '영웅의 물약');
    assert.equal(after.player.inv.length, 0);
});

test('밀어붙인다 카드 설명은 정산과 같은 판정으로 "강화가 붙지 않음"을 말한다', () => {
    const detail = (tempBuff) => getPostCombatChoiceOptions(basePlayer(tempBuff)).find((option) => option.id === 'push').detail;
    assert.ok(detail(STRONG()).includes(MSG.POST_COMBAT_PUSH_DETAIL_BUFF_KEPT));
    assert.ok(!detail(WEAK()).includes(MSG.POST_COMBAT_PUSH_DETAIL_BUFF_KEPT));
    assert.ok(!detail({ atk: 0, def: 0, turn: 0, name: null }).includes(MSG.POST_COMBAT_PUSH_DETAIL_BUFF_KEPT));
});
