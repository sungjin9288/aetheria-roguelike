import test from 'node:test';
import assert from 'node:assert/strict';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { RELICS, RELIC_SYNERGIES } from '../src/data/relics.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { applyBattleStartRelics } from '../src/hooks/gameActions/exploreFlow.js';
import { clearTemporaryAdventureState } from '../src/utils/playerStateUtils.js';
import { migrateData } from '../src/utils/dataMigration.js';
import { DB } from '../src/data/db.js';
import { endDevourBonus } from '../src/utils/adventureRelicBonuses.js';
import { createMoveActions } from '../src/hooks/gameActions/moveActions.js';
import { createCharacterActions } from '../src/hooks/gameActions/characterActions.js';
import { buildClassVitals, makeSharedHelpers } from '../src/hooks/gameActions/_shared.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { buildScoutEvent } from '../src/utils/scoutEvents.js';
import { buildBossChallengeEvent } from '../src/utils/bossGauge.js';
import { runQuietRollAndCombat } from '../src/hooks/gameActions/exploreFlow.js';
import { getJobSkills } from '../src/utils/gameUtils.js';

const combatMap = makeCombatActionMap(INITIAL_STATE.player);
const combatState = (p, foe = enemy(100)) => ({
    ...structuredClone(INITIAL_STATE), player: p, gameState: 'combat', enemy: foe, combatTurn: 0,
});
const combatAction = (kind, seed = 1) => ({ type: 'RESOLVE_COMBAT_ACTION',
    payload: { kind, expectedTurn: 0, seed, now: 1700000000000 } });
const dispatchHarness = (initial) => {
    let state = initial;
    return { get state() { return state; }, dispatch(action) { state = gameReducer(state, action); } };
};

const relic = (id) => structuredClone(RELICS.find((entry) => entry.id === id));
const player = () => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '수명 검증', job: '전사', loc: '고요한 숲',
    hp: 100, maxHp: 100, atk: 1000, def: 100, exp: 0, nextExp: 100000,
    equip: { weapon: null, armor: null, offhand: null },
    relics: [relic('void_monarch'), relic('world_eater')],
});
const enemy = (maxHp) => ({
    name: '훈련용 정령', baseName: '훈련용 정령', level: 1,
    hp: 1, maxHp, atk: 1, def: 0, exp: 0, gold: 0,
    pattern: { guardChance: 0, heavyChance: 0 },
});
const begin = (p) => applyBattleStartRelics(p, p.relics, calculateFullStats(p), {
    addLog() {}, rng: () => 0.99,
});
const victory = (p, maxHp) => CombatEngine.handleVictory(p, enemy(maxHp), {}, {}).updatedPlayer;
const restore = (p, gameState = 'idle', foe = null) => gameReducer(INITIAL_STATE, {
    type: 'LOAD_DATA', payload: migrateData({ version: 5, player: p, gameState, enemy: foe }),
});

test('처치 공격력은 다음 전투에서 적용되고 원정 cap과 안전 귀환을 따른다', () => {
    const first = player();
    let won = victory(begin(first), 200);
    assert.equal(won.adventureRelicBonuses?.killStackAtk, 0.05);
    const second = begin(won);
    const withoutStack = { ...second, adventureRelicBonuses: undefined };
    assert.ok(calculateFullStats(second).atk > calculateFullStats(withoutStack).atk);
    for (let i = 0; i < 15; i++) won = victory(begin(won), 100);
    assert.equal(won.adventureRelicBonuses.killStackAtk, 0.5);
    assert.equal(clearTemporaryAdventureState(won).adventureRelicBonuses, undefined);
});

test('포식은 마지막 처치량을 다음 전투 한 번에만 적용하며 세 전투에 누적되지 않는다', () => {
    const first = victory(begin(player()), 200);
    assert.equal(first.maxHp, 100);
    assert.deepEqual(first.adventureRelicBonuses.devour, { phase: 'ready', amount: 20 });
    const second = begin(first);
    assert.equal(second.maxHp, 120);
    assert.equal(second.hp, 120);
    assert.equal(begin(second).maxHp, 120);
    assert.equal(begin(second).hp, 120);
    const wonAgain = victory(second, 100);
    assert.equal(wonAgain.maxHp, 100);
    assert.equal(begin(wonAgain).maxHp, 110);
    assert.equal(clearTemporaryAdventureState(begin(wonAgain)).maxHp, 100);
});

test('공격 reducer의 승리와 replay는 pending 보상을 정확히 한 번 만든다', () => {
    const state = { ...structuredClone(INITIAL_STATE), player: begin(player()),
        enemy: enemy(200), gameState: 'combat', combatTurn: 0 };
    const map = makeCombatActionMap(INITIAL_STATE.player);
    const action = { type: 'RESOLVE_COMBAT_ACTION',
        payload: { kind: 'attack', expectedTurn: 0, seed: 1, now: 1700000000000 } };
    const won = map.RESOLVE_COMBAT_ACTION(state, action);
    assert.equal(won.combatReceipt.kind, 'victory');
    assert.deepEqual(won.player.adventureRelicBonuses.devour, { phase: 'ready', amount: 20 });
    assert.equal(map.RESOLVE_COMBAT_ACTION(won, action), won);
});

test('pending/active 복원은 HP를 다시 더하지 않고 불완전 전투와 안전 복원은 정리한다', () => {
    const ready = victory(begin(player()), 200);
    assert.equal(restore(ready).player.maxHp, 100);
    assert.deepEqual(restore(ready).player.adventureRelicBonuses, ready.adventureRelicBonuses);
    const active = begin(ready);
    const loaded = restore(active, 'combat', enemy(100));
    assert.equal(loaded.player.maxHp, 120);
    assert.equal(restore(loaded.player, 'combat', enemy(100)).player.hp, 120);
    const incomplete = restore(active, 'combat');
    assert.equal(incomplete.gameState, 'idle');
    assert.equal(incomplete.player.maxHp, 100);
    assert.equal(incomplete.player.adventureRelicBonuses.devour, undefined);
    const safe = restore({ ...active, loc: '시작의 마을' });
    assert.equal(safe.player.adventureRelicBonuses, undefined);
    assert.equal(safe.player.maxHp, 100);
});

test('출처 없는 legacy HP와 무관한 유물은 보존하고 소유 설명도 갱신한다', () => {
    const legacy = { ...player(), maxHp: 1234, hp: 1234 };
    legacy.relics[0].desc = '전투 내 누적';
    legacy.relics[1].desc = '영구 성장';
    const migrated = migrateData({ version: 5, player: legacy });
    assert.equal(migrated.player.maxHp, 1234);
    assert.match(migrated.player.relics[0].desc, /원정/);
    assert.match(migrated.player.relics[1].desc, /다음 전투/);
    assert.match(migrated.player.relics[1].desc, /기본 최대 생명/);
    assert.equal(migrated.player.relics[0].desc, relic('void_monarch').desc);
    assert.equal(migrated.player.relics[1].desc, relic('world_eater').desc);
    assert.deepEqual(migrateData(migrated), migrated);
});

test('관련 시너지 설명은 기존 합산과 회복 수치를 정확하게 안내한다', () => {
    assert.match(RELIC_SYNERGIES.find((s) => s.label === '절멸자').desc, /추가/);
    assert.match(RELIC_SYNERGIES.find((s) => s.label === '공허의 용').desc, /추가/);
    assert.match(RELIC_SYNERGIES.find((s) => s.label === '무한 포식').desc, /15%.*회복/);
});

for (const mode of ['attack', 'skill', 'attack-DOT', 'item-DOT', 'combat-item']) {
    test(`${mode} 승리는 공통 lifetime 정산과 stale replay를 사용한다`, () => {
        const p = begin(victory(begin(player()), 200));
        p.mp = 1000;
        const foe = enemy(100);
        const potion = { ...DB.ITEMS.consumables[0], id: 'lifetime-potion' };
        if (mode.includes('DOT')) { p.atk = 0; p.status = ['freeze']; foe.dots = ['poison']; }
        let action;
        if (mode === 'combat-item') {
            p.inv = [potion];
            p.relics.push(relic('thorns'));
            foe.atk = 100;
            action = { type: 'USE_COMBAT_ITEM', payload: { itemId: potion.id, expectedTurn: 0, seed: 99, now: 1000 } };
        } else if (mode === 'item-DOT') {
            p.inv = [potion];
            action = { type: 'USE_COMBAT_ITEM', payload: { itemId: potion.id, expectedTurn: 0, seed: 99, now: 1000 } };
        } else action = combatAction(mode === 'skill' ? 'skill' : 'attack', 14);
        const state = combatState(p, foe);
        const won = combatMap[action.type](state, action);
        assert.equal(won.combatReceipt?.kind, 'victory');
        assert.equal(won.player.maxHp, 100);
        assert.equal(won.player.adventureRelicBonuses.killStackAtk, 0.1);
        assert.deepEqual(won.player.adventureRelicBonuses.devour, { phase: 'ready', amount: 10 });
        assert.equal(combatMap[action.type](won, action), won);
        assert.deepEqual(combatMap[action.type](structuredClone(state), action), won);
    });
}

test('성공·강제 도주는 active만 정리하고 실패 도주는 보존한다', () => {
    const active = begin(victory(begin(player()), 200));
    let succeeded, failed;
    for (let seed = 1; seed <= 20; seed++) {
        const result = combatMap.RESOLVE_COMBAT_ACTION(combatState(active), combatAction('escape', seed));
        if (result.combatReceipt.kind === 'escape') succeeded = result;
        if (result.combatReceipt.kind === 'continue') failed = result;
    }
    assert.ok(succeeded && failed, 'deterministic seeds cover both escape outcomes');
    assert.equal(succeeded.player.maxHp, 100);
    assert.equal(succeeded.player.adventureRelicBonuses.devour, undefined);
    assert.equal(succeeded.player.adventureRelicBonuses.killStackAtk, 0.05);
    assert.equal(failed.player.maxHp, 120);
    assert.equal(failed.player.adventureRelicBonuses.devour.phase, 'active');
    const mage = { ...active, job: '시간술사', mp: 1000 };
    const selected = getJobSkills(mage).findIndex((skill) => skill.effect === 'escape_100');
    assert.ok(selected >= 0);
    mage.skillLoadout = { selected, cooldowns: {} };
    const forced = combatMap.RESOLVE_COMBAT_ACTION(combatState(mage), combatAction('skill'));
    assert.equal(forced.combatReceipt.kind, 'escape');
    assert.equal(forced.player.maxHp, 100);
    assert.equal(forced.player.adventureRelicBonuses.devour, undefined);
});

test('사망·아이템 사망·재시작·계승은 다음 런에 보너스를 넘기지 않는다', () => {
    const active = begin(victory(begin(player()), 200));
    const foe = { ...enemy(100), hp: 100, atk: 10000 };
    const potion = { ...DB.ITEMS.consumables[0], id: 'death-potion', val: 1 };
    const dying = combatState({ ...active, hp: 1, inv: [potion] }, foe);
    for (const action of [combatAction('escape', 7), { type: 'USE_COMBAT_ITEM',
        payload: { itemId: potion.id, expectedTurn: 0, seed: 7, now: 1000 } }]) {
        const dead = combatMap[action.type](dying, action);
        assert.equal(dead.gameState, 'dead');
        assert.equal(dead.player.adventureRelicBonuses, undefined);
        assert.ok(dead.grave && dead.runSummary);
    }
    const reset = gameReducer(combatState(active), { type: 'RESET_GAME' });
    assert.equal(reset.player.adventureRelicBonuses, undefined);
    const ascended = gameReducer({ ...combatState(active), gameState: 'ascension' }, {
        type: 'ASCEND', payload: { expectedPrestigeRank: 0, sourceReceiptKey: null },
    });
    assert.equal(ascended.gameState, 'idle');
    assert.equal(ascended.player.adventureRelicBonuses, undefined);
});

test('cleanup은 영구 HP 증가와 장비 HP를 보존하고 재호출은 exact no-op이다', () => {
    const active = begin(victory(begin(player()), 200));
    const gained = { ...active, maxHp: active.maxHp + 17, hp: 999,
        equip: { ...active.equip, armor: { type: 'armor', name: 'HP 검증 갑옷', hpBonus: 230, val: 0 } } };
    const cleaned = endDevourBonus(gained);
    assert.equal(cleaned.maxHp, 117);
    assert.equal(cleaned.hp, calculateFullStats(cleaned).maxHp);
    assert.ok(cleaned.hp > cleaned.maxHp, 'gear HP is not clamped to raw base');
    assert.equal(endDevourBonus(cleaned), cleaned);
    const leveled = CombatEngine.applyExpGain({ ...active, exp: 0, nextExp: 1 }, 1).updatedPlayer;
    assert.equal(endDevourBonus(leveled).maxHp, leveled.maxHp - 20);
});

test('전직은 새 class base에서 이전 포식량을 다시 차감하지 않는다', () => {
    const active = { ...begin(victory(begin(player()), 200)), level: 5, job: '모험가' };
    const harness = dispatchHarness(combatState(active));
    const targetJob = DB.CLASSES[active.job].next[0];
    const expected = buildClassVitals(active.level, targetJob, active.meta);
    createCharacterActions({ player: active, dispatch: harness.dispatch,
        getFullStats: calculateFullStats, addLog() {} }, { emitUnlockedTitles() {} }).jobChange(targetJob);
    assert.equal(harness.state.gameState, 'idle');
    assert.equal(harness.state.player.maxHp, expected.maxHp);
    assert.equal(harness.state.player.adventureRelicBonuses.devour, undefined);
    assert.equal(harness.state.player.hp, calculateFullStats(harness.state.player).maxHp);
});

test('위험 지역 이동은 pending을 유지하고 실제 안전 귀환은 해제한다', () => {
    const ready = victory(begin(player()), 200);
    ready.level = 75;
    const harness = dispatchHarness({ ...combatState(ready), gameState: 'idle', enemy: null });
    const move = (loc) => createMoveActions({ player: harness.state.player, gameState: 'idle',
        liveConfig: {}, dispatch: harness.dispatch, addLog() {} }).move(loc);
    const danger = DB.MAPS[ready.loc].exits.find((loc) => DB.MAPS[loc].type !== 'safe');
    assert.ok(danger);
    move(danger);
    assert.deepEqual(harness.state.player.adventureRelicBonuses, ready.adventureRelicBonuses);
    move(ready.loc);
    move('시작의 마을');
    assert.equal(harness.state.player.loc, '시작의 마을');
    assert.equal(harness.state.player.adventureRelicBonuses, undefined);
});

for (const entry of ['normal', 'scout', 'boss']) {
    test(`${entry} 실제 전투 진입이 pending을 활성화하고 이후 fullStats로 시작 회복을 계산한다`, () => {
        const ready = victory(begin(player()), 200);
        ready.relics.push({ id: 'start-heal-fixture', effect: 'battle_start_heal', val: 0.1 });
        ready.hp = 50;
        ready.loc = '고요한 숲';
        const harness = dispatchHarness({ ...combatState(ready), gameState: 'idle', enemy: null });
        const deps = { player: ready, dispatch: harness.dispatch, addLog() {}, addStoryLog() {},
            getFullStats: () => calculateFullStats(harness.state.player), rng: () => 0.99 };
        const shared = makeSharedHelpers(deps);
        if (entry === 'normal') runQuietRollAndCombat(ready, DB.MAPS[ready.loc], { ...deps, ...shared });
        else {
            const event = entry === 'scout'
                ? buildScoutEvent(ready, DB.MAPS[ready.loc], () => 0.99)
                : buildBossChallengeEvent('숲의 군주');
            createEventActions({ ...deps, currentEvent: event }, shared).handleEventChoice(0);
        }
        assert.equal(harness.state.gameState, 'combat');
        assert.equal(harness.state.player.maxHp, 120);
        const activatedMaxHp = calculateFullStats({ ...ready, maxHp: 120 }).maxHp;
        assert.equal(harness.state.player.hp, 50 + 20 + Math.floor(activatedMaxHp * 0.1));
        assert.equal(harness.state.player.adventureRelicBonuses.devour.phase, 'active');
    });
}

test('마왕 연속전투는 새 포식 보상을 즉시 활성화하고 오래된 action replay를 거부한다', () => {
    const active = begin(victory(begin(player()), 200));
    active.meta = { ...active.meta, prestigeRank: 3,
        endgame: { version: 1, primalShards: 3, legacyInventoryMigrated: true,
            lastEndgameReceiptKey: null, trueEndingSeen: false } };
    const foe = { ...enemy(300), name: '마왕', baseName: '마왕', isBoss: true };
    const state = combatState(active, foe);
    const action = combatAction('attack', 14);
    const chained = combatMap.RESOLVE_COMBAT_ACTION(state, action);
    assert.equal(chained.gameState, 'combat');
    assert.equal(chained.enemy.baseName, '원시의 신');
    assert.equal(chained.player.maxHp, 130);
    assert.deepEqual(chained.player.adventureRelicBonuses.devour, { phase: 'active', amount: 30 });
    assert.equal(combatMap.RESOLVE_COMBAT_ACTION(chained, action), chained);
});

test('malformed optional state는 HP를 추측해서 차감하지 않고 안전하게 무시한다', () => {
    for (const value of [null, [], 'invalid', { devour: { phase: 'other', amount: 20 } },
        { devour: { phase: 'active', amount: -1 } }, { devour: { phase: 'active', amount: 0.5 } },
        { devour: { phase: 'active', amount: 777 } }, { devour: { phase: 'active', amount: 9000 } }]) {
        const saved = migrateData({ version: 5, player: { ...player(), maxHp: 777, adventureRelicBonuses: value } });
        assert.equal(saved.player.adventureRelicBonuses, undefined);
        assert.equal(saved.player.maxHp, 777);
        assert.deepEqual(migrateData(saved), saved);
    }
});

test('battle-start RNG 소비는 포식 activation 유무와 같고 비용은 새 최대 HP를 사용한다', () => {
    const ready = victory(begin(player()), 200);
    ready.relics.push(RELICS.find((entry) => entry.effect === 'chaos_relic'),
        { effect: 'cursed_power', val: { hp_cost: 0.1, atk: 0 } });
    const run = (p) => {
        let calls = 0;
        const result = applyBattleStartRelics(p, p.relics, calculateFullStats(p), {
            addLog() {}, rng: () => { calls++; return 0.5; },
        });
        return { result, calls };
    };
    const active = run(ready);
    const normal = run({ ...ready, adventureRelicBonuses: undefined });
    assert.equal(active.calls, normal.calls);
    assert.equal(active.calls, 1);
    assert.equal(active.result.hp, 120 - Math.floor(calculateFullStats({ ...ready, maxHp: 120 }).maxHp * 0.1));
});

test('boss phase 변화는 같은 전투로 유지하고 포식 HP를 다시 더하지 않는다', () => {
    const p = begin(victory(begin(player()), 200));
    p.atk = 0;
    p.status = ['freeze'];
    const foe = { ...enemy(100), hp: 40, isBoss: true,
        phase2: { name: '두 번째 형상', atkBonus: 0, log: '형상 변화' } };
    const result = combatMap.RESOLVE_COMBAT_ACTION(combatState(p, foe), combatAction('attack', 14));
    assert.equal(result.combatReceipt.kind, 'continue');
    assert.equal(result.enemy.phase2Triggered, true);
    assert.equal(result.player.maxHp, 120);
    assert.deepEqual(result.player.adventureRelicBonuses, p.adventureRelicBonuses);
});

test('반사 승리는 즉시 정산하지만 같은 턴 플레이어 사망을 승리로 덮지 않는다', () => {
    const p = begin(victory(begin(player()), 200));
    p.relics.push(relic('thorns'));
    p.atk = 0;
    p.status = ['freeze'];
    const action = combatAction('attack', 14);
    const won = combatMap.RESOLVE_COMBAT_ACTION(combatState(p), action);
    assert.equal(won.combatReceipt.kind, 'victory');
    assert.equal(combatMap.RESOLVE_COMBAT_ACTION(won, action), won);
    assert.ok(won.logs.some((log) => log.text.includes('[반사·반격]')));
    const dead = combatMap.RESOLVE_COMBAT_ACTION(combatState({ ...p, hp: 1 }, { ...enemy(100), atk: 10000 }), action);
    assert.equal(dead.combatReceipt.kind, 'defeat');
    assert.equal(dead.player.adventureRelicBonuses, undefined);
});

test('유물 없는 순수 반격도 승리와 포식 보상을 한 번만 정산한다', () => {
    const p = begin(victory(begin(player()), 200));
    p.atk = 0;
    p.status = ['freeze'];
    p.tempBuff = { atk: 0, def: 0, counterChance: 1, turn: 3, name: '반격 준비' };
    const action = combatAction('attack', 14);
    const won = combatMap.RESOLVE_COMBAT_ACTION(combatState(p), action);
    assert.equal(won.combatReceipt.kind, 'victory');
    assert.ok(won.logs.some((log) => log.text.includes('반격!')));
    assert.deepEqual(won.player.adventureRelicBonuses.devour, { phase: 'ready', amount: 10 });
    assert.equal(combatMap.RESOLVE_COMBAT_ACTION(won, action), won);
});
