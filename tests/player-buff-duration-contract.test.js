import test from 'node:test';
import assert from 'node:assert/strict';

import { CLASSES } from '../src/data/classes.js';
import { DB } from '../src/data/db.js';
import { MSG } from '../src/data/messages.js';
import { getJobSkills } from '../src/utils/gameUtils.js';
import { AT } from '../src/reducers/actionTypes.js';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { tickAfterAction } from '../src/systems/combatTurnTick.js';

/**
 * 2026-10 Wave 52 — 플레이어 강화의 "N턴"은 건 뒤 N번 작동한다(공격 강화 = 내 행동 N번, 방어 강화 = 적 공격 N번).
 *
 * 행동 끝 틱이 적 공격 전에 돌아 건 행동의 틱에서 바로 1이 줄었다 — "3턴" 광폭화는 공격 2번, "2턴" 방패 전술은
 * 적 공격 1번만 작동했다. Wave 52가 보조 기술의 숨은 피해를 없애면서 강화의 값은 지속 턴이 전부가 됐다.
 * 이 파일은 실제 전투 전이(RESOLVE_COMBAT_ACTION · USE_COMBAT_ITEM)로 강화를 건 뒤 같은 시드의 "강화를 지운"
 * 대조 전투와 피해를 비교한다 — 카운터가 아니라 피해로 센다.
 */

const NO_BUFF = { atk: 0, def: 0, turn: 0, name: null };
/** 생명은 최대치보다 한참 낮게 — 지속 회복이 상한에 막혀 받은 피해 비교가 0 대 0이 되지 않게. */
const basePlayer = (job, overrides = {}) => ({
    name: 'tester', job, level: 40, hp: 100_000, maxHp: 1_000_000, mp: 99_999, maxMp: 99_999, atk: 400, def: 500,
    inv: [], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
    relics: [], skillChoices: {}, titles: [], activeTitle: null, killStreak: 0, combatFlags: {}, status: [],
    stats: { kills: 0, codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} } },
    ...overrides,
});
const ENEMY = () => ({
    name: '슬라임', baseName: '슬라임', hp: 1e9, maxHp: 1e9, atk: 3_000, def: 0, level: 30, exp: 0, gold: 0,
    pattern: { guardChance: 0, heavyChance: 0 },
});
const combatState = (player) => {
    const state = structuredClone(INITIAL_STATE);
    state.player = { ...state.player, ...player };
    state.gameState = 'combat';
    state.enemy = ENEMY();
    state.combatTurn = 0;
    state.combatReceipt = null;
    return state;
};
const ACTIONS = makeCombatActionMap(INITIAL_STATE.player);
const SEED = 20261001;
const resolve = (state, kind) => ACTIONS.RESOLVE_COMBAT_ACTION(state, {
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: { kind, expectedTurn: state.combatTurn, seed: SEED + state.combatTurn, now: 1_700_000_000_000 },
});

/** 첫 행동(기술 · 물약) 뒤 공격 `attacks`번 — 각 걸음의 준 피해 · 받은 피해 · 남은 강화 턴. */
const runAfterFirst = (state, first, attacks, { strip = false } = {}) => {
    const steps = [];
    const record = (before, after) => steps.push({
        dealt: before.enemy.hp - after.enemy.hp,
        taken: before.player.hp - after.player.hp,
        turnAfter: after.player.tempBuff?.turn ?? 0,
    });
    let next = first(state);
    record(state, next);
    if (strip) next = { ...next, player: { ...next.player, tempBuff: { ...NO_BUFF } } };
    for (let k = 0; k < attacks; k += 1) {
        const after = resolve(next, 'attack');
        record(next, after);
        next = after;
    }
    return { steps };
};

/** 강화를 거는 직업 기술 × (기본 + 분기). 강화 칸을 쓰는지는 실제로 걸어 본다. */
const buffVariants = () => Object.entries(CLASSES).flatMap(([job, def]) => (def.skills || [])
    .filter((skill) => !skill.passive)
    .flatMap((skill) => [null, ...((def.skillBranches?.[skill.name]) || []).map((b) => b.choice)]
        .map((choice) => ({ job, skill, choice }))));

const castState = ({ job, skill, choice }) => {
    const player = basePlayer(job, choice ? { skillChoices: { [skill.name]: choice } } : {});
    const selected = getJobSkills(player).findIndex((s) => s.name === skill.name);
    assert.ok(selected >= 0, `${job} ${skill.name}`);
    return combatState({ ...player, skillLoadout: { selected, cooldowns: {} } });
};

test('강화 기술의 "N턴" = 건 뒤 N번: 공격 강화는 내 공격 N번, 방어 강화는 적 공격 N번 (직업 기술 × 분기 전수, 같은 시드 대조)', () => {
    let atkChecked = 0;
    let defChecked = 0;
    const stunnedOnCast = [];
    for (const variant of buffVariants()) {
        const state = castState(variant);
        const cast = resolve(state, 'skill');
        const buff = cast.player.tempBuff;
        if (!buff || buff.name !== variant.skill.name || !(buff.turn > 0)) continue; // 강화 칸을 쓰지 않는 기술
        const tag = `${variant.job} ${variant.skill.name}${variant.choice ? `(${variant.choice})` : ''}`;
        const n = buff.turn;
        const resolved = { ...variant.skill, ...(variant.choice ? CLASSES[variant.job].skillBranches[variant.skill.name].find((b) => b.choice === variant.choice).override : {}) };
        const advertised = resolved.effect === 'extraTurn' ? 1 : (resolved.turn || (resolved.type === 'buff' ? 3 : 1));
        assert.equal(n, advertised, `${tag}: 건 직후 남은 턴 = 광고한 턴`);

        const withBuff = runAfterFirst(state, (s) => resolve(s, 'skill'), n + 1).steps;
        const control = runAfterFirst(state, (s) => resolve(s, 'skill'), n + 1, { strip: true }).steps;
        assert.deepEqual(withBuff.map((s) => s.turnAfter), [n, ...Array.from({ length: n }, (_, i) => n - 1 - i), 0], `${tag}: 턴 수열`);
        if (buff.atk > 0) {
            for (let k = 1; k <= n; k += 1) assert.ok(withBuff[k].dealt > control[k].dealt, `${tag}: 공격 ${k}/${n} 강화됨 (${withBuff[k].dealt} vs ${control[k].dealt})`);
            assert.equal(withBuff[n + 1].dealt, control[n + 1].dealt, `${tag}: 공격 ${n + 1}은 강화 없음`);
            atkChecked += 1;
        }
        // 방어 강화: 적 공격 N번 = 건 턴의 적 공격(대조도 강화를 지우기 전이라 같다 — 위 턴 수열의 첫 값 N이
        //   그 공격이 강화 아래였음을 말한다) + 그 뒤 N − 1번. 그다음 적 공격은 대조와 같다.
        if (buff.def > 0) {
            // 받은 피해는 생명 차이라 지속 회복이 섞인다 — 두 전투의 회복은 같으므로 대조와의 차이만 본다.
            //   건 턴에 생명이 그대로면(피해도 회복도 없음) 적이 행동하지 못한 것이다.
            if (withBuff[0].taken === 0) { stunnedOnCast.push(tag); continue; }
            for (let k = 1; k < n; k += 1) assert.ok(withBuff[k].taken < control[k].taken, `${tag}: 적 공격(걸음 ${k}) 막음 (${withBuff[k].taken} vs ${control[k].taken})`);
            assert.equal(withBuff[n].taken, control[n].taken, `${tag}: ${n + 1}번째 적 공격은 막지 않음`);
            defChecked += 1;
        }
    }
    // 알려진 예외(원장 §52.4): 철벽 배시는 같은 기술의 기절이 건 턴의 적 행동을 막아, "1턴" 방어 보너스가
    //   적 공격을 한 번도 만나지 못한다(이번 수정 전에도 같았다). 고치려면 공격 · 방어 강화가 따로 세어야 한다.
    assert.deepEqual(stunnedOnCast, ['나이트 실드배시(B)']);
    // 강화를 거는 기술이 늘거나 줄면 이 수를 함께 고친다(공격 강화 18 · 방어 강화 16, 둘 다 거는 기술은 양쪽에 센다).
    //   Wave 53: 그림자 군주가 공격력 강화(+200% 3턴)를 건다 — 17 → 18.
    assert.equal(atkChecked, 18, `공격 강화 ${atkChecked}`);
    assert.equal(defChecked, 16, `방어 강화 ${defChecked}`);
});

test('전투 중 마신 강화 물약도 N번 — 전투 밖에서 마신 물약과 같다', () => {
    const potion = { ...DB.ITEMS.consumables.find((item) => item.name === '분노의 물약'), id: 'rage-potion' };
    assert.equal(potion.turn, 5);
    const state = combatState({ ...basePlayer('전사'), inv: [potion] });
    const drink = (s) => ACTIONS.USE_COMBAT_ITEM(s, {
        type: AT.USE_COMBAT_ITEM,
        payload: { itemId: 'rage-potion', expectedTurn: s.combatTurn, seed: SEED + s.combatTurn, now: 1_700_000_000_000 },
    });
    const withBuff = runAfterFirst(state, drink, 6).steps;
    const control = runAfterFirst(state, drink, 6, { strip: true }).steps;
    assert.equal(withBuff[0].turnAfter, 5);
    for (let k = 1; k <= 5; k += 1) assert.ok(withBuff[k].dealt > control[k].dealt, `물약 공격 ${k}/5`);
    assert.equal(withBuff[6].dealt, control[6].dealt, '여섯 번째 공격은 강화 없음');
});

test('행동 끝 틱은 이번 행동이 건 강화만 붙잡는다 — 이전 강화 · 쿨타임 · 만료 줄', () => {
    const fresh = { atk: 0.5, def: 0, turn: 1, name: '광폭화' };
    const before = basePlayer('전사', { tempBuff: { ...NO_BUFF }, skillLoadout: { selected: 0, cooldowns: { 광폭화: 3 } } });
    const held = tickAfterAction(before, { ...before, tempBuff: fresh });
    assert.equal(held.updatedPlayer.tempBuff, fresh, '1턴짜리 새 강화도 적 공격 전에 사라지지 않는다');
    assert.ok(!held.logs.some((log) => log.text === MSG.BUFF_EXPIRED));
    assert.equal(held.updatedPlayer.skillLoadout.cooldowns['광폭화'], 2, '쿨타임은 그대로 준다');

    const old = { atk: 0.5, def: 0, turn: 1, name: '광폭화' };
    const carried = basePlayer('전사', { tempBuff: old });
    const ticked = tickAfterAction(carried, { ...carried });
    assert.equal(ticked.updatedPlayer.tempBuff.turn, 0, '전 행동에서 건 강화는 줄어든다');
    assert.ok(ticked.logs.some((log) => log.text === MSG.BUFF_EXPIRED));
});
