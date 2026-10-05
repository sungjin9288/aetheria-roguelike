import test from 'node:test';
import assert from 'node:assert/strict';

import { MSG } from '../src/data/messages.ts';
import { RELICS, RELIC_SYNERGIES } from '../src/data/relics.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { getEffectiveMaxHp } from '../src/systems/vitals.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';

/**
 * 부활 순서 계약 (2026-10 Wave 62, 원장 §61.4 C7 — 소유자 결정 "무료 부활 먼저").
 *
 * 치명상에서 부활 수단은 무료 → 유료 순서로 쓰인다:
 *   불사의 의지 → 허공의 심장 → 불사조의 깃털(전투마다) → 에테르 거울(런당 1회) → 에테르 부활석(크리스털로 산 소모품).
 * 부활석 분기가 불사조 · 거울보다 앞에 있던 동안, 공짜 부활이 남아 있어도 산 부활석이 먼저 사라졌다.
 * 같은 경로의 결함 하나를 함께 고정한다: 부활석으로 부활한 뒤 같은 전투의 적 공격마다(치명상이 아니어도) 부활석이
 * 하나씩 더 사라지고 기력이 50%로 다시 찼다(전투 플래그 `reviveTokenUsed`로 차감하던 탓).
 * 부활 보너스(부활 조합 `reviveHeal` · 난공불락 `healOnSave`, Wave 56)는 어느 수단이 발동하든 적용된다.
 *
 * 실제 사망 경로 두 곳으로 확인한다: 적 공격(`CombatEngine.enemyAttack` — 치명상 판정이 부활을 부른다)과
 * 전투 1턴 리듀서 전이(`RESOLVE_COMBAT_ACTION`). 부활 판정은 난수를 쓰지 않으므로 순서 변경은 난수 소비를 바꾸지 않는다.
 */

const relicByEffect = (effect) => {
    const relic = RELICS.find((entry) => entry.effect === effect);
    assert.ok(relic, `유물 ${effect}`);
    return { ...relic };
};
const PHOENIX = relicByEffect('phoenix_revive');
const DEATH_SAVE = relicByEffect('death_save');
const VOID_HEART = relicByEffect('void_heart');

const synergyByEffect = (effect) => {
    const synergy = RELIC_SYNERGIES.find((entry) => entry.bonus.effect === effect);
    assert.ok(synergy, `조합 ${effect}`);
    return synergy;
};

const makePlayer = ({ relics = [], reviveTokens = 0, mirror = false, hp = 50, mp = 0 } = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    hp,
    maxHp: 1000,
    mp,
    maxMp: 100,
    atk: 5,
    def: 0,
    relics,
    reviveTokens,
    meta: { ...structuredClone(INITIAL_STATE.player.meta), mirror: mirror ? { revive: 1 } : {} },
    combatFlags: { comboCount: 0, deathSaveUsed: false, voidHeartUsed: false, voidHeartArmed: false, phoenixUsed: false },
});

const makeEnemy = (atk = 99_999) => ({
    name: '시험용 거인',
    baseName: '시험용 거인',
    level: 1,
    hp: 1e9,
    maxHp: 1e9,
    atk,
    def: 0,
    exp: 1,
    gold: 1,
    pattern: { guardChance: 0, heavyChance: 0 },
});

/** 적 공격 한 번 — 실제 엔진 사망 경로. 어느 수단으로 살아남았는지 돌려준다. */
const strike = (player, enemy, extraStats = {}) => {
    const stats = { ...calculateFullStats(player), ...extraStats };
    const result = CombatEngine.enemyAttack(player, enemy, stats, () => 0.5);
    return { ...result, source: reviveSource(player, result) };
};

const reviveSource = (before, result) => {
    if (result.isDead) return 'dead';
    const texts = result.logs.map((log) => log.text);
    const flagsBefore = before.combatFlags || {};
    const flagsAfter = result.updatedPlayer.combatFlags || {};
    if ((flagsAfter.deathSaveUsedCount || 0) > (flagsBefore.deathSaveUsedCount || 0)) return 'death_save';
    if (flagsAfter.voidHeartUsed && !flagsBefore.voidHeartUsed) return 'void_heart';
    if (flagsAfter.phoenixUsed && !flagsBefore.phoenixUsed) return 'phoenix';
    if (result.updatedPlayer.mirrorReviveUsed && !before.mirrorReviveUsed) return 'mirror';
    if ((result.updatedPlayer.reviveTokens || 0) < (before.reviveTokens || 0)) {
        assert.ok(texts.includes(MSG.RELIC_REVIVE_TOKEN_USED), '부활석 로그');
        return 'stone';
    }
    return 'survived';
};

test('불사조의 깃털이 남아 있으면 부활석을 쓰지 않는다', () => {
    const player = makePlayer({ relics: [PHOENIX], reviveTokens: 1 });
    const hit = strike(player, makeEnemy());
    assert.equal(hit.source, 'phoenix');
    assert.equal(hit.isDead, false);
    assert.equal(hit.updatedPlayer.reviveTokens, 1, '산 부활석은 그대로');
    assert.ok(!hit.logs.some((log) => log.text === MSG.RELIC_REVIVE_TOKEN_USED));
});

test('에테르 거울(런당 1회 무료)도 부활석보다 먼저 쓰인다', () => {
    const player = makePlayer({ mirror: true, reviveTokens: 1 });
    const hit = strike(player, makeEnemy());
    assert.equal(hit.source, 'mirror');
    assert.equal(hit.updatedPlayer.mirrorReviveUsed, true);
    assert.equal(hit.updatedPlayer.reviveTokens, 1, '산 부활석은 그대로');
    assert.ok(hit.logs.some((log) => log.text === MSG.MIRROR_REVIVE));
});

test('부활 순서: 불사의 의지 → 허공의 심장 → 불사조 → 거울 → 부활석 → 사망 (적 공격 반복)', () => {
    let player = makePlayer({ relics: [DEATH_SAVE, VOID_HEART, PHOENIX], mirror: true, reviveTokens: 1 });
    let enemy = makeEnemy();
    const order = [];
    for (let index = 0; index < 8; index += 1) {
        const hit = strike(player, enemy);
        order.push(hit.source);
        if (hit.isDead) break;
        player = hit.updatedPlayer;
        enemy = hit.updatedEnemy;
    }
    // 불사의 의지 + 불사조의 깃털 = 조합 '절대 불사'(두 번 부활) — 불사의 의지가 두 번 먼저 쓰인다.
    const absoluteImmortal = synergyByEffect('absolute_immortal');
    assert.deepEqual(absoluteImmortal.requires.slice().sort(), [DEATH_SAVE.name, PHOENIX.name].sort());
    const deathSaves = Array(absoluteImmortal.bonus.reviveCount).fill('death_save');
    assert.deepEqual(order, [...deathSaves, 'void_heart', 'phoenix', 'mirror', 'stone', 'dead']);
});

test('부활 순서 (조합 없이): 허공의 심장 → 불사조 → 거울 → 부활석 → 사망', () => {
    let player = makePlayer({ relics: [VOID_HEART, PHOENIX], mirror: true, reviveTokens: 1 });
    let enemy = makeEnemy();
    const order = [];
    for (let index = 0; index < 8; index += 1) {
        const hit = strike(player, enemy);
        order.push(hit.source);
        if (hit.isDead) break;
        player = hit.updatedPlayer;
        enemy = hit.updatedEnemy;
    }
    assert.deepEqual(order, ['void_heart', 'phoenix', 'mirror', 'stone', 'dead']);
});

test('부활석으로 부활한 뒤 같은 전투의 치명상이 아닌 공격은 부활석을 더 쓰지 않고 기력도 채우지 않는다', () => {
    const revived = strike(makePlayer({ reviveTokens: 3 }), makeEnemy());
    assert.equal(revived.source, 'stone');
    assert.equal(revived.updatedPlayer.reviveTokens, 2);
    assert.equal(revived.updatedPlayer.combatFlags.reviveTokenUsed, true, '이번 전투에 썼다는 신호는 남는다');

    // 같은 전투 — 기력을 비우고 약한 공격을 두 번 받는다.
    let player = { ...revived.updatedPlayer, mp: 0 };
    let enemy = { ...revived.updatedEnemy, atk: 10 };
    for (let index = 0; index < 2; index += 1) {
        const hit = strike(player, enemy);
        assert.equal(hit.isDead, false);
        assert.equal(hit.updatedPlayer.reviveTokens, 2, `치명상이 아닌 공격 ${index + 1}회째 — 부활석 그대로`);
        assert.equal(hit.updatedPlayer.mp, 0, '부활석 기력 회복은 부활할 때만');
        assert.ok(!hit.logs.some((log) => log.text === MSG.RELIC_REVIVE_TOKEN_USED));
        player = hit.updatedPlayer;
        enemy = hit.updatedEnemy;
    }

    // 다시 치명상이면 그때 한 개만 더 쓴다.
    const second = strike(player, { ...enemy, atk: 99_999 });
    assert.equal(second.source, 'stone');
    assert.equal(second.updatedPlayer.reviveTokens, 1);
});

test('부활 보너스(부활 조합 reviveHeal · 난공불락 healOnSave)는 어느 수단이 발동하든 적용된다', () => {
    const activeSynergies = [synergyByEffect('immortal_warrior'), synergyByEffect('unbreakable')];
    const reviveHeal = activeSynergies[0].bonus.reviveHeal;
    const healOnSave = activeSynergies[1].bonus.healOnSave;
    assert.ok(reviveHeal > 0 && healOnSave > 0);

    const cases = [
        { name: 'phoenix', player: makePlayer({ relics: [PHOENIX], reviveTokens: 1, mirror: true }) },
        { name: 'mirror', player: makePlayer({ reviveTokens: 1, mirror: true }) },
        { name: 'stone', player: makePlayer({ reviveTokens: 1 }) },
    ];
    for (const { name, player } of cases) {
        const effectiveMax = getEffectiveMaxHp(player);
        const hit = strike(player, makeEnemy(), { activeSynergies });
        assert.equal(hit.source, name);
        const expected = Math.min(effectiveMax, Math.floor(effectiveMax * reviveHeal) + Math.floor(effectiveMax * healOnSave));
        assert.equal(hit.updatedPlayer.hp, expected, `${name}: 부활 조합 회복 + 난공불락 추가 회복`);
        assert.ok(hit.logs.some((log) => log.text === MSG.RELIC_HEAL_ON_SAVE_PROC(Math.floor(effectiveMax * healOnSave))), `${name}: 난공불락 로그`);
    }
});

test('전투 1턴 리듀서 전이에서도 불사조 → 거울 → 부활석 순서이고 부활석은 마지막이다', () => {
    const actionMap = makeCombatActionMap(INITIAL_STATE.player);
    let state = {
        ...structuredClone(INITIAL_STATE),
        player: makePlayer({ relics: [PHOENIX], mirror: true, reviveTokens: 1 }),
        gameState: GS.COMBAT,
        enemy: makeEnemy(),
        combatTurn: 0,
        combatReceipt: null,
    };
    const trail = [];
    for (let turn = 0; turn < 6 && state.gameState === GS.COMBAT; turn += 1) {
        const next = actionMap.RESOLVE_COMBAT_ACTION(state, {
            type: AT.RESOLVE_COMBAT_ACTION,
            payload: { kind: 'attack', expectedTurn: state.combatTurn, seed: 11 + turn, now: 1_700_000_000_000 },
        });
        assert.notEqual(next, state, `턴 ${turn + 1}이 적용된다`);
        trail.push({
            mode: next.gameState,
            tokens: next.player.reviveTokens,
            phoenix: next.player.combatFlags?.phoenixUsed === true,
            mirror: next.player.mirrorReviveUsed === true,
        });
        state = next;
    }
    assert.deepEqual(trail, [
        { mode: GS.COMBAT, tokens: 1, phoenix: true, mirror: false },
        { mode: GS.COMBAT, tokens: 1, phoenix: true, mirror: true },
        { mode: GS.COMBAT, tokens: 0, phoenix: true, mirror: true },
        { mode: GS.DEAD, tokens: 0, phoenix: false, mirror: false },
    ]);
});

// ── Wave 63: 불사조의 공격 강화도 강화 칸 규칙(더 센 쪽이 남는다)을 거친다 ─────────────────────

test('Wave 63: 불사조 부활의 공격 강화는 더 센 강화를 덮지 않는다 — 약하면 붙고, 세면 지금 강화가 남고 안내한다', () => {
    const { atkBuff, duration } = PHOENIX.val;
    // 지금 강화가 더 세다(+100% · 3턴 > 불사조 +50% · 3턴): 남고, 밀린 안내가 로그에 있다.
    const strong = { atk: atkBuff * 2, def: 0, turn: duration, name: '광폭화' };
    const kept = strike({ ...makePlayer({ relics: [PHOENIX] }), tempBuff: strong }, makeEnemy());
    assert.equal(kept.source, 'phoenix');
    assert.deepEqual(kept.updatedPlayer.tempBuff, strong, '더 센 강화가 남는다');
    assert.ok(kept.logs.some((log) => log.text === MSG.TEMP_BUFF_KEPT_STRONGER(PHOENIX.name, {
        atk: Math.round(strong.atk * 100), def: 0, counter: 0, turns: duration,
    })), '밀린 안내');

    // 지금 강화가 더 약하다(+10% · 1턴): 불사조 강화가 붙는다.
    const weak = { atk: 0.1, def: 0, turn: 1, name: '분노의 물약' };
    const applied = strike({ ...makePlayer({ relics: [PHOENIX] }), tempBuff: weak }, makeEnemy());
    assert.equal(applied.source, 'phoenix');
    assert.equal(applied.updatedPlayer.tempBuff.atk, atkBuff);
    assert.equal(applied.updatedPlayer.tempBuff.turn, duration);
    assert.equal(applied.updatedPlayer.tempBuff.name, 'phoenix_revive');
    assert.ok(!applied.logs.some((log) => log.text.includes(`${PHOENIX.name}은(는) 적용되지 않았습니다`)), '붙을 때는 밀린 안내가 없다');
});
