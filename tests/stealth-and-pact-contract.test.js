import test from 'node:test';
import assert from 'node:assert/strict';

import { CLASSES } from '../src/data/classes.js';
import { DB } from '../src/data/db.js';
import { MSG } from '../src/data/messages.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { getJobSkills } from '../src/utils/gameUtils.js';
import { applyBattleStartRelics } from '../src/hooks/gameActions/exploreFlow.js';
import { AT } from '../src/reducers/actionTypes.js';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';

/**
 * 2026-10 Wave 53 — 소유자 결정 "설명대로 동작하게"(은신 계열) · "생명 소모를 넣는다"(어둠의 서약).
 *
 * 은신 기술 넷은 설명(N턴 회피 · 다음 공격 강화 · ATK 증가)과 달리 다음 적 공격 1회 회피만 줬고, 빈 강화가
 * 강화 칸을 차지해 걸려 있던 다른 강화를 지웠다. 이제 은신은 실제 적 공격 `evadeHits`번을 막고(첫 공격 확정,
 * 그 뒤 `evadeChance`), 그림자 이동은 다음 피해 행동 1회를 `nextAttackMult`배로, 그림자 군주는 공격력을
 * `atkBonus`로 올린다. 어둠의 서약은 현재 생명의 `hpCost`를 바친다.
 */

const playerOf = (job, overrides = {}) => ({
    name: 'tester', job, level: 40, hp: 5_000, maxHp: 5_000, mp: 9_999, maxMp: 9_999, atk: 400, def: 50,
    inv: [], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
    relics: [], skillChoices: {}, titles: [], activeTitle: null, killStreak: 0, combatFlags: {}, status: [],
    stats: { kills: 0, codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} } },
    skillLoadout: { selected: 0, cooldowns: {} }, ...overrides,
});
const enemyOf = (overrides = {}) => ({
    name: '슬라임', baseName: '슬라임', hp: 1e7, maxHp: 1e7, atk: 1_000, def: 0, level: 30, exp: 0, gold: 0,
    pattern: { guardChance: 0, heavyChance: 0 }, ...overrides,
});
const skillOf = (job, name) => {
    const skill = CLASSES[job].skills.find((s) => s.name === name);
    assert.ok(skill, `${job} ${name}`);
    return skill;
};
const cast = (job, name, playerOverrides = {}, rng = () => 0.5) => {
    const player = playerOf(job, playerOverrides);
    return CombatEngine.performSkill(player, enemyOf(), calculateFullStats(player), skillOf(job, name), rng);
};
/** 적 공격 `count`번 — 각 공격의 피해(0 = 회피)를 돌려준다. rng는 공격마다 새로 만든다. */
const enemyHits = (player, count, rngFor = () => () => 0.99, enemy = enemyOf()) => {
    let current = player;
    const damages = [];
    for (let i = 0; i < count; i += 1) {
        const result = CombatEngine.enemyAttack(current, enemy, calculateFullStats(current), rngFor(i));
        damages.push(result.damage);
        current = result.updatedPlayer;
    }
    return { damages, player: current };
};

const STEALTH_SKILLS = [
    ['도적', '그림자 발걸음'], ['어쌔신', '은신'], ['어쌔신', '그림자 이동'], ['그림자 주군', '그림자 군주'],
];

test('은신 기술의 설명은 데이터 수치를 그대로 말한다 — 막는 공격 수 · 확률 · 다음 공격 배율 · 공격력 · 지속 턴', () => {
    const stealth = Object.entries(CLASSES).flatMap(([job, def]) => (def.skills || [])
        .filter((s) => s.effect === 'stealth').map((s) => [job, s.name]));
    assert.deepEqual(stealth.sort(), [...STEALTH_SKILLS].sort());
    for (const [job, name] of STEALTH_SKILLS) {
        const skill = skillOf(job, name);
        const hits = skill.evadeHits ?? 1;
        assert.equal(skill.val, undefined, `${name}: 엔진이 읽지 않는 val을 두지 않는다`);
        if (hits > 1) assert.ok(skill.desc.includes(`${hits}번`) || (skill.evadeChance ?? 1) < 1, `${name}: 막는 공격 수`);
        if ((skill.evadeChance ?? 1) < 1) assert.ok(skill.desc.includes(`${Math.round(skill.evadeChance * 100)}%`), `${name}: 회피 확률`);
        if (skill.nextAttackMult) assert.ok(skill.desc.includes(`${skill.nextAttackMult}배`), `${name}: 다음 공격 배율`);
        if (skill.atkBonus) {
            assert.ok(skill.desc.includes(`${Math.round((skill.atkBonus - 1) * 100)}%`), `${name}: 공격력 상승 폭`);
            assert.ok(skill.desc.includes(`${skill.turn}턴`), `${name}: 공격력 상승 턴`);
        }
    }
    const pact = skillOf('흑마법사', '어둠의 서약');
    assert.ok(pact.desc.includes(`${Math.round(pact.hpCost * 100)}%`) && pact.desc.includes('생명'), '어둠의 서약: 생명 소모를 말한다');
    assert.ok(pact.desc.includes(`${pact.turn}턴`), '어둠의 서약: 지속 턴');
});

test('은신은 실제 적 공격 N번을 막는다 — 첫 공격 확정, 그 뒤 확률, 그다음은 맞는다', () => {
    // 은신: 2번 확정
    const hide = cast('어쌔신', '은신');
    assert.equal(hide.updatedEnemy.hp, 1e7, '은신은 피해를 주지 않는다');
    assert.deepEqual(enemyHits(hide.updatedPlayer, 3).damages.map((d) => d > 0), [false, false, true]);
    assert.ok(hide.logs.some((l) => l.text === MSG.SKILL_STEALTH_HITS('은신', 2, null)));

    // 그림자 발걸음: 첫 공격 확정, 두 번째 30%
    const step = cast('도적', '그림자 발걸음');
    assert.deepEqual(enemyHits(step.updatedPlayer, 3, (i) => () => (i === 1 ? 0.1 : 0.99)).damages.map((d) => d > 0), [false, false, true], '두 번째: 0.1 < 30% → 회피');
    assert.deepEqual(enemyHits(step.updatedPlayer, 3, () => () => 0.5).damages.map((d) => d > 0), [false, true, true], '두 번째: 0.5 ≥ 30% → 맞음');
    const missed = enemyHits(step.updatedPlayer, 2, () => () => 0.5);
    assert.equal(missed.player.combatFlags.stealthHits, 0, '확률 실패도 은신 한 번을 쓴다');

    // 그림자 군주: 3번 확정 + 공격력 +200% 3턴
    const lord = cast('그림자 주군', '그림자 군주');
    assert.deepEqual(enemyHits(lord.updatedPlayer, 4).damages.map((d) => d > 0), [false, false, false, true]);
    assert.equal(lord.updatedPlayer.tempBuff.atk, 2);
    assert.equal(lord.updatedPlayer.tempBuff.turn, 3);

    // 그림자 이동: 1번
    const shift = cast('어쌔신', '그림자 이동');
    assert.deepEqual(enemyHits(shift.updatedPlayer, 2).damages.map((d) => d > 0), [false, true]);
});

test('은신은 실제 공격만 센다 — 적이 방어 자세를 잡거나 기절한 턴은 은신을 쓰지 않는다', () => {
    const hide = cast('어쌔신', '은신');
    const guard = CombatEngine.enemyAttack(hide.updatedPlayer, enemyOf({ pattern: { guardChance: 1, heavyChance: 0 } }), calculateFullStats(hide.updatedPlayer), () => 0.5);
    assert.equal(guard.updatedPlayer.combatFlags.stealthHits, 2, '방어 자세');
    const stunned = CombatEngine.enemyAttack(hide.updatedPlayer, enemyOf({ stunnedTurns: 1 }), calculateFullStats(hide.updatedPlayer), () => 0.5);
    assert.equal(stunned.updatedPlayer.combatFlags.stealthHits, 2, '기절');
});

test('그림자 이동: 다음 피해 행동 1회가 1.8배 — 일반 공격 · 위력 있는 기술 모두, 보조 기술은 쓰지 않는다', () => {
    const shift = cast('어쌔신', '그림자 이동');
    assert.equal(shift.updatedPlayer.combatFlags.nextAttackMult, 1.8);
    const armed = shift.updatedPlayer;
    const plain = { ...armed, combatFlags: { ...armed.combatFlags, nextAttackMult: 0 } };
    const stats = calculateFullStats(armed);
    const rng = () => () => 0.5;

    const hit = CombatEngine.attack(armed, enemyOf(), stats, rng());
    const base = CombatEngine.attack(plain, enemyOf(), stats, rng());
    const dealt = (r) => 1e7 - r.updatedEnemy.hp;
    assert.equal(dealt(hit), Math.floor(dealt(base) * 1.8), `일반 공격 ${dealt(hit)} vs ${dealt(base)}`);
    assert.equal(hit.updatedPlayer.combatFlags.nextAttackMult, 0, '한 번 쓰면 사라진다');
    assert.ok(hit.logs.some((l) => l.text === MSG.NEXT_ATTACK_MULT_PROC(1.8)));
    const after = CombatEngine.attack(hit.updatedPlayer, enemyOf(), stats, rng());
    assert.equal(dealt(after), dealt(base), '두 번째 공격은 원래대로');

    const strike = skillOf('어쌔신', '암살');
    const sk = CombatEngine.performSkill(armed, enemyOf(), stats, strike, rng());
    const skBase = CombatEngine.performSkill(plain, enemyOf(), stats, strike, rng());
    assert.ok(dealt(sk) >= Math.floor(dealt(skBase) * 1.8) - 1 && dealt(sk) <= Math.ceil(dealt(skBase) * 1.8) + 1, `기술 ${dealt(sk)} vs ${dealt(skBase)}`);
    assert.equal(sk.updatedPlayer.combatFlags.nextAttackMult, 0);

    const support = CombatEngine.performSkill(armed, enemyOf(), stats, skillOf('어쌔신', '은신'), rng());
    assert.equal(support.updatedPlayer.combatFlags.nextAttackMult, 1.8, '보조 기술은 다음 공격 강화를 쓰지 않는다');
});

test('빈 강화는 강화 칸을 쓰지 않는다 — 은신 · 마나 가속 · 시간 역행이 걸려 있던 강화를 지우지 않는다', () => {
    const rage = { atk: 0.5, def: 0, turn: 3, name: '광폭화' };
    for (const [job, name] of [...STEALTH_SKILLS.filter(([, n]) => n !== '그림자 군주'), ['마법사', '마나 가속'], ['시간술사', '시간 역행']]) {
        const result = cast(job, name, { tempBuff: rage });
        assert.equal(result.updatedPlayer.tempBuff, rage, `${job} ${name}: 걸려 있던 강화 유지`);
    }
    // 강화를 주는 은신(그림자 군주)은 자기 강화로 바꾼다.
    assert.equal(cast('그림자 주군', '그림자 군주', { tempBuff: rage }).updatedPlayer.tempBuff.name, '그림자 군주');
});

test('어둠의 서약: 현재 생명의 15%를 바치고 공격력 +80% 4턴 — 생명은 1 아래로 내려가지 않는다', () => {
    const pact = skillOf('흑마법사', '어둠의 서약');
    assert.equal(pact.hpCost, 0.15);
    const full = cast('흑마법사', '어둠의 서약', { hp: 1_000, maxHp: 1_000 });
    assert.equal(full.updatedPlayer.hp, 850);
    assert.ok(full.logs.some((l) => l.text === MSG.SKILL_HP_COST('어둠의 서약', 150)));
    assert.ok(Math.abs(full.updatedPlayer.tempBuff.atk - 0.8) < 1e-9);
    assert.equal(full.updatedPlayer.tempBuff.turn, 4);
    assert.equal(cast('흑마법사', '어둠의 서약', { hp: 7 }).updatedPlayer.hp, 6, 'floor(7 × 0.15) = 1');
    assert.equal(cast('흑마법사', '어둠의 서약', { hp: 1 }).updatedPlayer.hp, 1, '생명 1은 그대로');
    // 다른 강화 기술은 생명을 바치지 않는다.
    assert.equal(cast('전사', '광폭화', { hp: 1_000 }).updatedPlayer.hp, 1_000);
});

test('은신 · 다음 공격 강화는 전투 플래그다 — 다음 전투 시작 때 사라진다', () => {
    const shift = cast('어쌔신', '그림자 이동').updatedPlayer;
    assert.equal(shift.combatFlags.stealthHits, 1);
    const next = applyBattleStartRelics(shift, [], calculateFullStats(shift), { addLog: () => {}, rng: () => 0.5 });
    assert.ok(!(next.combatFlags.stealthHits > 0), '은신 초기화');
    assert.ok(!(next.combatFlags.nextAttackMult > 1), '다음 공격 강화 초기화');
});

test('실제 전투 전이(RESOLVE_COMBAT_ACTION): 은신을 쓰면 그 턴과 다음 턴의 적 공격을 피하고 세 번째는 맞는다', () => {
    const state = structuredClone(INITIAL_STATE);
    const base = playerOf('어쌔신');
    const selected = getJobSkills(base).findIndex((s) => s.name === '은신');
    assert.ok(selected >= 0);
    state.player = { ...state.player, ...base, skillLoadout: { selected, cooldowns: {} } };
    state.gameState = 'combat';
    state.enemy = enemyOf();
    state.combatTurn = 0;
    state.combatReceipt = null;
    const actions = makeCombatActionMap(INITIAL_STATE.player);
    const step = (s, kind) => actions.RESOLVE_COMBAT_ACTION(s, {
        type: AT.RESOLVE_COMBAT_ACTION,
        payload: { kind, expectedTurn: s.combatTurn, seed: 20261001 + s.combatTurn, now: 1_700_000_000_000 },
    });
    const s1 = step(state, 'skill');
    assert.equal(s1.player.hp, 5_000, '건 턴의 적 공격 회피');
    const s2 = step(s1, 'attack');
    assert.equal(s2.player.hp, 5_000, '다음 턴 적 공격 회피');
    const s3 = step(s2, 'attack');
    assert.ok(s3.player.hp < 5_000, '세 번째 적 공격은 맞는다');
});
