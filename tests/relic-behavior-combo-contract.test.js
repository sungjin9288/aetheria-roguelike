import test from 'node:test';
import assert from 'node:assert/strict';

import { MSG } from '../src/data/messages.js';
import { RELICS, RELIC_SYNERGIES, getActiveRelicSynergies } from '../src/data/relics.js';
import { DB } from '../src/data/db.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import {
    BEHAVIOR_COMBO_EFFECTS, BEHAVIOR_COMBO_FLAG_KEYS, applyConsumableBehaviorCombos, endBehaviorComboScope, getBehaviorComboChip,
} from '../src/systems/relicBehaviorCombos.js';
import { resolveCombatItemTurn } from '../src/systems/combatItemTurn.js';
import { getChargeBreakDamage } from '../src/systems/bossMechanics.js';
import { endCombatScope } from '../src/utils/combatScope.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';

/**
 * 2026-11 H4 행동 조합(소유자 결정 Q1 ~ Q4 (a), docs/EXECUTION_SKETCH_H4_2026-11.md §5).
 * 늘 켜진 수치 조합 6개를 "어떤 행동을 어떤 순간에 하면 강해지는" 조합으로 바꿨다. 이 파일은 실제 엔진 호출로
 *   ① 효과마다 조건이 맞을 때만 터진다 ② 난수 소비가 조합 유무와 같다(판정은 난수를 쓰지 않는다)
 *   ③ 전투가 끝나면(`endCombatScope`) 세는 수 · 준비 플래그가 비워진다 를 지킨다.
 * 조합 효과만 보려고 능력치의 `activeSynergies`에 그 조합 하나를 넣는다(유물 자체의 효과와 섞이지 않게). 유물 두 조각이
 * 실제로 그 조합을 켜는지는 첫 테스트가 따로 본다.
 */

const synergyOf = (effect) => {
    const found = RELIC_SYNERGIES.find((syn) => syn.bonus.effect === effect);
    assert.ok(found, effect);
    return found;
};
const relic = (name) => {
    const found = RELICS.find((r) => r.name === name);
    assert.ok(found, name);
    return { ...found };
};
const makePlayer = (extra = {}) => ({
    name: '시험자', job: '모험가', level: 30, hp: 5_000, maxHp: 5_000, mp: 200, maxMp: 200, atk: 300, def: 20, gold: 0,
    inv: [], equip: {}, relics: [], status: [], titles: [], stats: { kills: 0 }, meta: {},
    skillLoadout: { selected: 0, cooldowns: {} }, combatFlags: {}, ...extra,
});
const makeEnemy = (extra = {}) => ({
    name: '시험 적', baseName: '시험 적', level: 30, hp: 100_000, maxHp: 100_000, atk: 300, def: 0, exp: 1, gold: 1,
    pattern: { guardChance: 0, heavyChance: 0 }, ...extra,
});
/** 능력치 — 치명 0(확정 치명타만 보이게), 켜진 조합은 주어진 것만. */
const statsWith = (player, effects = []) => ({
    ...calculateFullStats(player), critChance: 0, activeSynergies: effects.map(synergyOf),
});
/** 고정 굴림으로 소비한 난수 수를 센다. */
const countingRng = (value = 0.5) => {
    const rng = () => { rng.calls += 1; return value; };
    rng.calls = 0;
    return rng;
};
const strike = (player, enemy, effects, rng = countingRng()) => {
    const result = CombatEngine.attack(player, enemy, statsWith(player, effects), rng);
    return { result, calls: rng.calls, dealt: (enemy.hp ?? 0) - (result.updatedEnemy.hp ?? 0) };
};
const SKILL = { name: '시험 일격', mp: 10, mult: 2, cooldown: 2 };
const SUPPORT = { name: '시험 강화', mp: 10, mult: 0, effect: 'atk_up', val: 1.2, turn: 2, cooldown: 2 };
const cast = (player, enemy, effects, skill = SKILL, rng = countingRng()) => {
    const result = CombatEngine.performSkill(player, enemy, statsWith(player, effects), skill, rng);
    return { result, calls: rng.calls, dealt: result.success ? (enemy.hp ?? 0) - (result.updatedEnemy.hp ?? 0) : 0 };
};
const texts = (result) => result.logs.map((log) => log.text);

test('데이터: 행동 조합 효과 6개는 조합 하나씩이고, 유물 두 조각이 실제로 그 조합을 켠다', () => {
    for (const effect of BEHAVIOR_COMBO_EFFECTS) {
        const matches = RELIC_SYNERGIES.filter((syn) => syn.bonus.effect === effect);
        assert.equal(matches.length, 1, `${effect}는 조합 하나`);
        const [syn] = matches;
        assert.equal(syn.requires.length, 2, `${syn.label}는 두 조각`);
        const active = getActiveRelicSynergies(syn.requires.map(relic));
        assert.ok(active.some((s) => s.bonus.effect === effect), `${syn.requires.join(' + ')} → ${syn.label}`);
        assert.ok(syn.drawback, `${syn.label}에는 대가가 있다(Wave 50)`);
    }
});

test('B1 교차 리듬: 기술 바로 다음 일반 공격만 강해지고, 이번 적 행동의 받는 피해를 줄인다 — 다른 행동이 끼면 풀린다', () => {
    const enemy = makeEnemy();
    const armed = makePlayer({ combatFlags: { afterSkill: true } });
    const proc = strike(armed, enemy, ['cross_rhythm']);
    const plain = strike(armed, enemy, []);
    const syn = synergyOf('cross_rhythm');
    assert.equal(proc.dealt, Math.floor(plain.dealt * syn.bonus.afterSkillAttackMult));
    assert.equal(proc.result.updatedPlayer.combatFlags.crossGuard, syn.bonus.afterSkillGuard);
    assert.equal(proc.result.updatedPlayer.combatFlags.afterSkill, undefined, '일반 공격은 직전 기술을 지운다');
    assert.ok(texts(proc.result).includes(MSG.BEHAVIOR_COMBO_CROSS_RHYTHM_PROC(syn.label, Math.round(syn.bonus.afterSkillGuard * 100))));
    assert.equal(proc.calls, plain.calls, '난수 소비 동일');
    // 직전이 기술이 아니면 그대로.
    const cold = strike(makePlayer(), enemy, ['cross_rhythm']);
    assert.equal(cold.dealt, plain.dealt);
    assert.equal(cold.result.updatedPlayer.combatFlags.crossGuard, undefined);
    // 기술은 조합이 있을 때만 '직전 기술'을 세운다.
    assert.equal(cast(makePlayer(), enemy, ['cross_rhythm']).result.updatedPlayer.combatFlags.afterSkill, true);
    assert.equal(cast(makePlayer(), enemy, []).result.updatedPlayer.combatFlags.afterSkill, undefined);
    // 소모품 차례는 '직전 기술'을 끊는다.
    const potioned = applyConsumableBehaviorCombos(makePlayer({ combatFlags: { afterSkill: true } }));
    assert.equal(potioned.player.combatFlags.afterSkill, undefined);
});

test('B1 교차 리듬: 받는 피해 감소는 다음 적 행동 한 번에만 — 맞고 나면 지워진다', () => {
    const enemy = makeEnemy();
    const guarded = makePlayer({ combatFlags: { crossGuard: 0.4 } });
    const plainPlayer = makePlayer();
    const rngA = countingRng();
    const rngB = countingRng();
    const hit = CombatEngine.enemyAttack(guarded, enemy, calculateFullStats(guarded), rngA);
    const base = CombatEngine.enemyAttack(plainPlayer, enemy, calculateFullStats(plainPlayer), rngB);
    assert.ok(base.damage > 0);
    assert.ok(hit.damage < base.damage, `감소 ${hit.damage} < ${base.damage}`);
    assert.ok(Math.abs(hit.damage - base.damage * 0.6) <= 1, '받는 피해 −40%');
    assert.equal(hit.updatedPlayer.combatFlags.crossGuard, undefined, '한 번 쓰면 지운다');
    assert.equal(rngA.calls, rngB.calls, '난수 소비 동일');
});

test('B2 끊는 일격: 충전한 보스에게 준 피해를 두 배로 세고, 끊으면 다음 행동도 기절 — 난수는 한 번', () => {
    const player = makePlayer({ hp: 40_000, maxHp: 40_000 });
    const boss = makeEnemy({
        name: '시험 보스', baseName: '시험 보스', hp: 10_000, maxHp: 10_000, isBoss: true,
        mechanics: { charge: { name: '대지 분쇄' } }, actionCount: 1, chargeArmed: true, chargeHpMark: 10_000,
    });
    const need = getChargeBreakDamage(boss);
    const half = { ...boss, hp: boss.hp - Math.ceil(need / 2) };
    const rngWith = countingRng();
    const rngWithout = countingRng();
    const broken = CombatEngine.enemyAttack(player, half, statsWith(player, ['break_strike']), rngWith);
    const released = CombatEngine.enemyAttack(player, half, statsWith(player, []), rngWithout);
    assert.equal(broken.damage, 0, '절반만 깎아도 끊긴다');
    assert.equal(broken.updatedEnemy.chargeArmed, undefined);
    assert.equal(broken.updatedEnemy.stunnedTurns, synergyOf('break_strike').bonus.breakStun);
    assert.ok(texts(broken).includes(MSG.BOSS_CHARGE_BROKEN('시험 보스', '대지 분쇄')));
    assert.ok(released.damage > 0, '조합이 없으면 강타가 나간다');
    assert.equal(rngWith.calls, 1, '끊긴 행동도 행동 판정 난수 한 번');
    // 반도 못 깎으면 조합이 있어도 강타.
    const short = { ...boss, hp: boss.hp - Math.floor(need / 2) + 1 };
    assert.ok(CombatEngine.enemyAttack(player, short, statsWith(player, ['break_strike']), countingRng()).damage > 0);
});

test('B3 공허의 용(추격): 기절한 적에게 하는 피해 행동은 확정 치명타 — 치명 판정 난수는 그대로 한 번', () => {
    const stunned = makeEnemy({ stunnedTurns: 1 });
    const awake = makeEnemy();
    const player = makePlayer();
    const syn = synergyOf('void_pursuit');
    const proc = strike(player, stunned, ['void_pursuit'], countingRng(0.99));
    const plain = strike(player, stunned, [], countingRng(0.99));
    assert.equal(proc.result.isCrit, true);
    assert.equal(plain.result.isCrit, false);
    assert.ok(texts(proc.result).includes(MSG.BEHAVIOR_COMBO_PURSUIT_PROC(syn.label, stunned.name)));
    assert.equal(proc.calls, plain.calls, '난수 소비 동일');
    assert.equal(strike(player, awake, ['void_pursuit'], countingRng(0.99)).result.isCrit, false, '깨어 있으면 그대로');
    // 위력 기술도 같다 · 보조 기술은 피해가 없어 대상이 아니다.
    const skillProc = cast(player, stunned, ['void_pursuit'], SKILL, countingRng(0.99));
    const skillPlain = cast(player, stunned, [], SKILL, countingRng(0.99));
    assert.equal(skillProc.result.isCrit, true);
    assert.equal(skillPlain.result.isCrit, false);
    assert.equal(skillProc.calls, skillPlain.calls);
});

test('B3 추격의 창: 1턴 기절은 적 차례에 다 쓰이지만, 그 기절로 넘긴 행동 다음의 피해 행동이 추격이다 — 실제로 행동하면 닫힌다', () => {
    const player = makePlayer();
    // 기절 기술을 맞은 적(1턴) → 적 차례가 기절로 넘어간다.
    const stunned = makeEnemy({ stunnedTurns: 1 });
    const skipped = CombatEngine.enemyAttack(player, stunned, statsWith(player, ['void_pursuit']), countingRng());
    assert.equal(skipped.damage, 0);
    assert.equal(skipped.updatedEnemy.stunnedTurns, 0, '1턴 기절은 이미 다 썼다');
    assert.equal(skipped.updatedEnemy.pursuitOpen, true);
    assert.equal(strike(player, skipped.updatedEnemy, ['void_pursuit'], countingRng(0.99)).result.isCrit, true, '넘긴 행동 다음의 일반 공격');
    assert.equal(cast(player, skipped.updatedEnemy, ['void_pursuit'], SKILL, countingRng(0.99)).result.isCrit, true, '위력 기술도');
    // 조합이 없으면 표시를 세우지 않는다(상태가 이전과 같다).
    const plain = CombatEngine.enemyAttack(player, stunned, statsWith(player, []), countingRng());
    assert.equal(plain.updatedEnemy.pursuitOpen, undefined);
    // 다음 적 차례가 실제 행동이면 창이 닫힌다.
    const acted = CombatEngine.enemyAttack(player, skipped.updatedEnemy, statsWith(player, ['void_pursuit']), countingRng());
    assert.equal(acted.updatedEnemy.pursuitOpen, undefined);
    assert.equal(strike(player, acted.updatedEnemy, ['void_pursuit'], countingRng(0.99)).result.isCrit, false);
    // 2턴 기절은 두 번 넘기는 동안 창이 열려 있다.
    const twice = CombatEngine.enemyAttack(player, makeEnemy({ stunnedTurns: 2 }), statsWith(player, ['void_pursuit']), countingRng());
    assert.equal(twice.updatedEnemy.stunnedTurns, 1);
    const again = CombatEngine.enemyAttack(player, twice.updatedEnemy, statsWith(player, ['void_pursuit']), countingRng());
    assert.equal(again.updatedEnemy.pursuitOpen, true);
});

test('B4 전투 물약술: 전투 중 소모품 뒤의 기술 한 번은 기력 · 재사용 대기와 무관하다 — 조합이 없으면 거부', () => {
    const enemy = makeEnemy();
    const ready = applyConsumableBehaviorCombos(makePlayer({ relics: synergyOf('battle_alchemy').requires.map(relic) }));
    assert.equal(ready.player.combatFlags.potionReady, true);
    assert.ok(ready.logs.some((log) => log.text === MSG.BEHAVIOR_COMBO_POTION_READY(synergyOf('battle_alchemy').label)));
    // 조합 없는 플레이어의 소모품은 아무 플래그도 세우지 않는다(같은 참조).
    const bare = makePlayer();
    assert.equal(applyConsumableBehaviorCombos(bare).player, bare);

    const locked = makePlayer({ mp: 0, combatFlags: { potionReady: true }, skillLoadout: { selected: 0, cooldowns: { [SKILL.name]: 2 } } });
    const free = cast(locked, enemy, ['battle_alchemy']);
    assert.equal(free.result.success, true);
    assert.equal(free.result.updatedPlayer.mp, 0, '기력을 쓰지 않는다');
    assert.equal(free.result.updatedPlayer.combatFlags.potionReady, false, '한 번 쓰면 끝');
    assert.equal(cast(locked, enemy, []).result.success, false, '조합이 없으면 재사용 대기에 막힌다');
    assert.equal(cast({ ...locked, combatFlags: {} }, enemy, ['battle_alchemy']).result.success, false, '소모품 전에는 막힌다');
    // 기력이 충분한 같은 기술과 난수 소비가 같다.
    const rich = makePlayer();
    assert.equal(cast({ ...rich, combatFlags: { potionReady: true } }, enemy, ['battle_alchemy']).calls, cast(rich, enemy, ['battle_alchemy']).calls);
});

test('B4 전투 물약술: 실제 소모품 차례가 다음 기술을 준비하고 그 기록을 남긴다', () => {
    const potion = DB.ITEMS.consumables.find((item) => item.name === '하급 체력 물약');
    assert.ok(potion);
    const player = makePlayer({ hp: 1_000, relics: synergyOf('battle_alchemy').requires.map(relic), inv: [{ ...potion, id: 'p1' }] });
    const turn = resolveCombatItemTurn({
        player, enemy: makeEnemy(), item: player.inv[0], initialPlayer: player, seed: 7, now: 0, rng: () => 0.5,
    });
    assert.notEqual(turn.kind, 'rejected');
    assert.equal(turn.player.combatFlags.potionReady, true);
    assert.ok(turn.logs.some((log) => log.text === MSG.BEHAVIOR_COMBO_POTION_READY(synergyOf('battle_alchemy').label)));
});

test('B5 셋째 박자: 위력 기술 셋을 센 뒤의 위력 기술이 두 배이고 다시 0부터 — 보조 기술은 세지 않는다', () => {
    const enemy = makeEnemy();
    const syn = synergyOf('third_beat');
    const every = syn.bonus.beatEvery;
    const first = cast(makePlayer(), enemy, ['third_beat']);
    assert.equal(first.result.updatedPlayer.combatFlags.beatCount, 1);
    const readyPlayer = makePlayer({ combatFlags: { beatCount: every } });
    const big = cast(readyPlayer, enemy, ['third_beat']);
    const normal = cast(readyPlayer, enemy, []);
    assert.ok(Math.abs(big.dealt - normal.dealt * syn.bonus.beatMult) <= syn.bonus.beatMult, `${big.dealt} ≈ ${normal.dealt} × ${syn.bonus.beatMult}`);
    assert.equal(big.result.updatedPlayer.combatFlags.beatCount, 0, '강해진 기술 뒤 0');
    assert.ok(texts(big.result).includes(MSG.BEHAVIOR_COMBO_THIRD_BEAT_PROC(syn.label, syn.bonus.beatMult)));
    assert.equal(big.calls, normal.calls, '난수 소비 동일');
    const mid = cast(makePlayer({ combatFlags: { beatCount: every - 1 } }), enemy, ['third_beat']);
    assert.equal(mid.dealt, cast(makePlayer({ combatFlags: { beatCount: every - 1 } }), enemy, []).dealt, '준비 전에는 그대로');
    const support = cast(makePlayer({ combatFlags: { beatCount: 1 } }), enemy, ['third_beat'], SUPPORT);
    assert.equal(support.result.updatedPlayer.combatFlags.beatCount, 1, '보조 기술은 세지 않는다');
    assert.equal(cast(makePlayer(), enemy, []).result.updatedPlayer.combatFlags.beatCount, undefined, '조합이 없으면 세지 않는다');
});

test('B6 절멸자(마무리): 생명이 문턱 이하인 적에게 일반 공격은 처치, 보스는 피해 배율 — 문턱 위 · 기술은 그대로', () => {
    const syn = synergyOf('finisher');
    const player = makePlayer({ atk: 30 });
    const low = makeEnemy({ hp: Math.floor(100_000 * syn.bonus.finisherThreshold), def: 0 });
    const kill = strike(player, low, ['finisher']);
    assert.equal(kill.result.updatedEnemy.hp, 0, '처치');
    assert.equal(kill.result.isVictory, true);
    assert.ok(texts(kill.result).includes(MSG.BEHAVIOR_COMBO_FINISHER_KILL(syn.label, low.name)));
    const plain = strike(player, low, []);
    assert.ok(plain.result.updatedEnemy.hp > 0, '조합이 없으면 살아남는다');
    assert.equal(kill.calls, plain.calls, '난수 소비 동일');
    const high = makeEnemy({ hp: Math.floor(100_000 * syn.bonus.finisherThreshold) + 1_000 });
    assert.equal(strike(player, high, ['finisher']).dealt, strike(player, high, []).dealt, '문턱 위는 그대로');
    const boss = { ...low, isBoss: true };
    const bossHit = strike(player, boss, ['finisher']);
    const bossPlain = strike(player, boss, []);
    assert.equal(bossHit.dealt, Math.floor(bossPlain.dealt * syn.bonus.finisherBossMult));
    assert.ok(bossHit.result.updatedEnemy.hp > 0, '보스는 처치하지 않는다');
    assert.equal(cast(player, low, ['finisher']).dealt, cast(player, low, []).dealt, '기술에는 붙지 않는다');
});

test('범위: endCombatScope가 행동 조합 플래그 넷을 모두 비우고, 없으면 같은 참조다', () => {
    const flags = { afterSkill: true, crossGuard: 0.4, potionReady: true, beatCount: 2, turnCount: 3 };
    const ended = endCombatScope(makePlayer({ combatFlags: flags }));
    for (const key of BEHAVIOR_COMBO_FLAG_KEYS) assert.equal(ended.combatFlags[key], undefined, key);
    assert.equal(ended.combatFlags.turnCount, 3, '다른 플래그는 그대로');
    const clean = makePlayer({ combatFlags: { turnCount: 1 } });
    assert.equal(endBehaviorComboScope(clean), clean);
});

test('전투 칩: 지금 걸린 조건 하나를 엔진 판정 그대로 보이고, 행동을 권하지 않는다', () => {
    const withRelics = (effect, extra = {}) => makePlayer({ relics: synergyOf(effect).requires.map(relic), ...extra });
    assert.equal(getBehaviorComboChip(makePlayer(), makeEnemy()), null, '행동 조합이 없으면 칩 없음');
    const finisher = getBehaviorComboChip(withRelics('finisher'), makeEnemy({ hp: 10 }));
    assert.equal(finisher.effect, 'finisher');
    assert.equal(getBehaviorComboChip(withRelics('finisher'), makeEnemy()), null, '문턱 위는 칩 없음');
    assert.equal(getBehaviorComboChip(withRelics('void_pursuit'), makeEnemy({ stunnedTurns: 1 })).effect, 'void_pursuit');
    assert.equal(getBehaviorComboChip(withRelics('cross_rhythm', { combatFlags: { afterSkill: true } }), makeEnemy()).effect, 'cross_rhythm');
    const beat = getBehaviorComboChip(withRelics('third_beat', { combatFlags: { beatCount: 1 } }), makeEnemy());
    assert.equal(beat.ready, false);
    assert.equal(beat.text, MSG.BEHAVIOR_CHIP_THIRD_BEAT(synergyOf('third_beat').label, 1, synergyOf('third_beat').bonus.beatEvery));
    const chips = [finisher, beat];
    for (const chip of chips) assert.doesNotMatch(chip.text, /추천|하세요|권장/, chip.text);
});
