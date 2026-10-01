import test from 'node:test';
import assert from 'node:assert/strict';

import { CLASSES } from '../src/data/classes.js';
import { TRAIT_DEFINITIONS } from '../src/data/traits.js';
import { DB } from '../src/data/db.js';
import { MSG } from '../src/data/messages.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { isDamagingSkill } from '../src/systems/skillPower.js';
import { formatSkillPower, getSkillMetrics } from '../src/utils/skillPresentation.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { getJobSkills } from '../src/utils/gameUtils.js';
import { AT } from '../src/reducers/actionTypes.js';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';

/**
 * 2026-10 Wave 52 — 소유자 결정 "피해를 없앤다".
 *
 * 보조 기술(위력 `mult`가 없는 버프 · 약화 · 회복 · 템포)은 설명에 없는 공격력 1.5배 피해를 줬다(`mult || 1.5`).
 * 이제 위력이 있는 기술만 피해를 준다. 화면(위력 표시)과 엔진이 같은 판정(`isDamagingSkill`)을 읽는다.
 * 언데드 · 마족에 대한 신성 피해(Wave 51 `smite`)는 회복량에서 따로 계산되므로 그대로다.
 */

/** 방어력이 있는 일반 적 — 방어 경감의 최소 피해 1이 보조 기술에 새지 않는지도 함께 본다. */
const PLAIN = '슬라임';
const enemyOf = (baseName, overrides = {}) => ({
    name: baseName, baseName, hp: 100_000, maxHp: 100_000, atk: 0, def: 50, level: 30,
    pattern: { guardChance: 0, heavyChance: 0 }, ...overrides,
});
const playerOf = (job, overrides = {}) => ({
    name: 'tester', job, level: 40, hp: 1_000, maxHp: 3_000, mp: 9_999, maxMp: 9_999, atk: 400, def: 100,
    inv: [], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
    relics: [], skillChoices: {}, titles: [], activeTitle: null, killStreak: 0, combatFlags: {}, status: [],
    stats: { kills: 0, codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} } },
    skillLoadout: { selected: 0, cooldowns: {} }, ...overrides,
});
/** 분산 · 치명 · 확률 효과를 모두 통과시키는 시퀀스(0.5 고정은 확률 분기를 결정론적으로 떨어뜨린다). */
const seqRng = () => { let i = 0; const seq = [0.05, 0.5, 0.95, 0.3, 0.7]; return () => seq[(i++) % seq.length]; };

/** 직업 기술(기본 + 분기) · 특성 기술 전수. 분기 override는 엔진이 player.skillChoices로 적용한다. */
const allVariants = () => [
    ...Object.entries(CLASSES).flatMap(([job, def]) => (def.skills || [])
        .filter((skill) => !skill.passive)
        .flatMap((skill) => [
            { job, skill, choice: null, resolved: skill },
            ...((def.skillBranches?.[skill.name]) || []).map((branch) => ({
                job, skill, choice: branch.choice, resolved: { ...skill, ...branch.override },
            })),
        ])),
    ...Object.entries(TRAIT_DEFINITIONS)
        .filter(([, trait]) => trait.skill)
        .map(([id, trait]) => ({ job: '모험가', skill: trait.skill, choice: null, resolved: trait.skill, trait: id })),
];

const label = (v) => `${v.trait ? `특성 ${v.trait}` : v.job} ${v.skill.name}${v.choice ? `(${v.choice})` : ''}`;

test('위력이 없는 기술은 피해를 주지 않고, 위력이 있는 기술만 피해를 준다 — 직업 · 분기 · 특성 기술 전수', () => {
    let support = 0;
    let damaging = 0;
    for (const variant of allVariants()) {
        const player = playerOf(variant.job, variant.choice ? { skillChoices: { [variant.skill.name]: variant.choice } } : {});
        // 치명 확률 100% — 보조 기술이 치명 판정(기력 회복 · 치명 태그)을 굴리지 않는지도 본다.
        const stats = { ...calculateFullStats(player), critChance: 1 };
        const result = CombatEngine.performSkill(player, enemyOf(PLAIN), stats, variant.skill, seqRng());
        assert.equal(result.success, true, `${label(variant)}: 사용 가능`);
        const loss = 100_000 - result.updatedEnemy.hp;
        if (isDamagingSkill(variant.resolved)) {
            damaging += 1;
            assert.ok(loss > 0, `${label(variant)}: 위력 ${variant.resolved.mult} → 피해 ${loss}`);
            continue;
        }
        support += 1;
        assert.equal(loss, 0, `${label(variant)}: 보조 기술 피해 ${loss}`);
        assert.equal(result.isCrit, false, `${label(variant)}: 치명 판정 없음`);
        if (result.forceEscape) continue; // 공허의 문 · 순간 이동 — 전투 이탈 줄만 남긴다
        assert.equal(result.logs[0].text, MSG.SKILL_USE_SUPPORT(variant.skill.name), `${label(variant)}: 사용 줄`);
        assert.ok(!result.logs.some((log) => /\d+ 피해!/.test(log.text)), `${label(variant)}: 피해 줄이 없다`);
    }
    // 직업 기술 42개 + 분기 10개 + 특성 기술 4개 = 56. 기술을 더하거나 위력을 붙이면 이 수를 함께 고친다.
    assert.equal(support, 56, `보조 기술 ${support}`);
    assert.equal(damaging, 147, `피해 기술 ${damaging}`);
});

test('광고 = 동작: 기술 카드의 위력 표시는 엔진이 피해를 주는 기술에만 붙는다', () => {
    for (const variant of allVariants()) {
        const shown = formatSkillPower(variant.resolved.mult) !== null;
        assert.equal(shown, isDamagingSkill(variant.resolved), `${label(variant)}: 위력 표시`);
        const metrics = getSkillMetrics(variant.resolved);
        assert.equal(metrics.some((m) => m.startsWith('위력')), shown, `${label(variant)}: 카드 수치`);
    }
    assert.equal(isDamagingSkill({}), false);
    assert.equal(isDamagingSkill({ mult: 0 }), false);
    assert.equal(isDamagingSkill(null), false);
    assert.equal(isDamagingSkill({ mult: 1.8 }), true);
    assert.equal(formatSkillPower(0), null);
    assert.equal(formatSkillPower(undefined), null);
});

test('보조 기술의 효과는 그대로다 — 강화 · 약화 · 회복 · 기력 · 기절', () => {
    const cast = (job, name, enemy = enemyOf(PLAIN), overrides = {}) => {
        const player = playerOf(job, overrides);
        const skill = CLASSES[job].skills.find((s) => s.name === name);
        assert.ok(skill, `${job} ${name}`);
        return CombatEngine.performSkill(player, enemy, calculateFullStats(player), skill, () => 0.01);
    };
    const rage = cast('전사', '광폭화');
    assert.equal(rage.updatedPlayer.tempBuff.atk, 0.5);
    assert.equal(rage.updatedPlayer.tempBuff.turn, 3);
    assert.ok(rage.logs.some((l) => l.text === MSG.SKILL_BUFF_ACTIVE('광폭화', 3)));

    const fear = cast('성직자', '공포 유발');
    assert.equal(fear.updatedEnemy.fearTurns, 2);
    assert.equal(fear.updatedEnemy.hp, 100_000);

    const touch = cast('성직자', '기적의 손길');
    assert.ok(touch.updatedPlayer.hp > 1_000);
    assert.equal(touch.updatedEnemy.hp, 100_000, '일반 적에게 회복 기술은 피해 0');

    const mana = cast('마법사', '마나 가속', enemyOf(PLAIN), { mp: 10, maxMp: 500 });
    assert.equal(mana.updatedPlayer.mp, 30);

    const warp = cast('아크메이지', '시간 왜곡');
    assert.ok((warp.updatedEnemy.stunnedTurns ?? 0) >= 1, '시간 왜곡은 피해 없이 적을 멈춘다');
    assert.equal(warp.updatedEnemy.hp, 100_000);
});

test('신성 피해만 남는다 — 기적의 손길이 언데드에게 주는 피해는 정확히 회복량 × smite (방어 무시)', () => {
    const skill = CLASSES['성직자'].skills.find((s) => s.name === '기적의 손길');
    const player = playerOf('성직자');
    const result = CombatEngine.performSkill(player, enemyOf('해골 병사', { def: 500 }), calculateFullStats(player), skill, () => 0.5);
    const heal = Math.floor(3_000 * skill.val);
    assert.equal(100_000 - result.updatedEnemy.hp, Math.floor(heal * skill.smite));
    assert.equal(result.logs[0].text, MSG.SKILL_USE_SUPPORT('기적의 손길'));
    assert.ok(result.logs.some((l) => l.text === MSG.SKILL_HOLY_SMITE('기적의 손길', '해골 병사', heal)));
});

test('실제 전투 전이(RESOLVE_COMBAT_ACTION): 광폭화를 쓰는 턴에는 적 생명이 줄지 않고 적은 반격한다', () => {
    const state = structuredClone(INITIAL_STATE);
    const base = playerOf('전사', { hp: 3_000 });
    const skills = getJobSkills(base);
    const selected = skills.findIndex((s) => s.name === '광폭화');
    assert.ok(selected >= 0);
    state.player = { ...state.player, ...base, skillLoadout: { selected, cooldowns: {} } };
    state.gameState = 'combat';
    state.enemy = enemyOf(PLAIN, { atk: 300, exp: 0, gold: 0 });
    state.combatTurn = 0;
    state.combatReceipt = null;
    const next = makeCombatActionMap(INITIAL_STATE.player).RESOLVE_COMBAT_ACTION(state, {
        type: AT.RESOLVE_COMBAT_ACTION,
        payload: { kind: 'skill', expectedTurn: 0, seed: 20261001, now: 1_700_000_000_000 },
    });
    assert.equal(next.combatTurn, 1);
    assert.equal(next.enemy.hp, 100_000, '보조 기술 턴의 적 생명');
    assert.ok(next.player.hp < 3_000, '적이 반격했다');
    assert.ok(next.logs.some((log) => log.text === MSG.SKILL_USE_SUPPORT('광폭화')));
    assert.ok((next.player.tempBuff?.atk ?? 0) > 0, '강화는 걸려 있다');
});
