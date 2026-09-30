import test from 'node:test';
import assert from 'node:assert/strict';

import { CLASSES } from '../src/data/classes.js';
import { DB } from '../src/data/db.js';
import { MSG } from '../src/data/messages.js';
import { MONSTERS, getMonsterFamily } from '../src/data/monsters.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { getJobSkills } from '../src/utils/gameUtils.js';
import { AT } from '../src/reducers/actionTypes.js';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';

/**
 * 2026-09 Wave 51 — 소유자 결정 "성직자의 컨셉에 잘 맞게. 마족 계열이나 언데드 계열에 힐로 공격 가능".
 *
 * 몬스터 계열(언데드 · 마족)은 이름이 아니라 데이터(`family`)가 선언한다. 성직자 계열 회복 기술(`smite`)은
 * 그 적에게 회복량 × smite를 방어 무시 신성 피해로 더한다. 다른 적 · 다른 회복 기술은 이전과 같다.
 */

const UNDEAD = ['해골 병사', '유령 기사', '폐허 구울', '미라', '데스나이트', '리치', '뱀파이어', '한 맺힌 망자', '익사한 기사',
    '흡혼 해골', '저주받은 어부', '망령 기사단장', '망자의 사제', '묘지 구울', '유령 군단', '해골 마법사', '저주받은 기사',
    '혈월의 뱀파이어 로드', '망령 기사', '언데드 마법사', '뼈 수집가', '묘지기 네크론'];
const DEMON = ['마왕', '마왕의 사도', '지옥의 문지기', '타락한 천사', '사슬 마왕', '미궁의 마왕', '차원 마왕'];

const RNG = () => 0.5;
const enemyOf = (baseName, overrides = {}) => ({
    name: baseName, baseName, hp: 100_000, maxHp: 100_000, atk: 0, def: 0, level: 30,
    pattern: { guardChance: 0, heavyChance: 0 }, ...overrides,
});
const playerOf = (job, overrides = {}) => ({
    name: 'tester', job, level: 40, hp: 1_000, maxHp: 3_000, mp: 999, maxMp: 999, atk: 400, def: 100,
    inv: [], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
    relics: [], skillChoices: {}, titles: [], activeTitle: null, killStreak: 0, combatFlags: {}, status: [],
    stats: { kills: 0, codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} } },
    skillLoadout: { selected: 0, cooldowns: {} }, ...overrides,
});
/** 계열 없는 대조군 — 같은 능력치 · 같은 약점/저항(없음)의 일반 적. */
const PLAIN = '슬라임';

test('몬스터 계열은 데이터가 선언한다 — 언데드 22 · 마족 7, 값은 두 종류뿐', () => {
    const tagged = Object.entries(MONSTERS).filter(([, m]) => m.family);
    assert.deepEqual(tagged.filter(([, m]) => m.family === 'undead').map(([n]) => n).sort(), [...UNDEAD].sort());
    assert.deepEqual(tagged.filter(([, m]) => m.family === 'demon').map(([n]) => n).sort(), [...DEMON].sort());
    assert.equal(tagged.length, UNDEAD.length + DEMON.length);
    assert.equal(MONSTERS[PLAIN].family, undefined);
});

test('계열 판정은 종(baseName) 기준 — 접두어 · 층 태그가 붙은 표시 이름에도 같다', () => {
    assert.equal(getMonsterFamily({ baseName: '해골 병사', name: '재앙의 해골 병사 [12층]' }), 'undead');
    assert.equal(getMonsterFamily({ baseName: '마왕', name: '정예 마왕' }), 'demon');
    assert.equal(getMonsterFamily({ name: '리치' }), 'undead', 'baseName이 없으면 이름으로 조회');
    assert.equal(getMonsterFamily({ baseName: PLAIN, name: '해골 병사' }), null, '표시 이름이 아니라 종이 정한다');
    assert.equal(getMonsterFamily(null), null);
});

/** smite가 있는 기술 × (기본 + 각 분기) — 분기 override는 smite를 지우지 않는다. */
const smiteVariants = () => Object.entries(CLASSES).flatMap(([job, def]) => (def.skills || [])
    .filter((skill) => (skill.smite ?? 0) > 0)
    .flatMap((skill) => [
        { job, skill, choice: null },
        ...((def.skillBranches?.[skill.name]) || []).map((branch) => ({ job, skill, choice: branch.choice })),
    ]));

test('성직자 계열 회복 기술은 언데드 · 마족에게 회복량 × smite의 방어 무시 신성 피해를 더한다 (기술 × 분기 × 계열)', () => {
    const variants = smiteVariants();
    assert.deepEqual([...new Set(variants.map((v) => `${v.job}:${v.skill.name}`))].sort(), ['성직자:기적의 손길', '팔라딘:기적의 부활']);
    let checked = 0;
    for (const { job, skill, choice } of variants) {
        const player = playerOf(job, choice ? { skillChoices: { [skill.name]: choice } } : {});
        const stats = calculateFullStats(player);
        const override = choice ? CLASSES[job].skillBranches[skill.name].find((b) => b.choice === choice).override : {};
        const val = override.val ?? skill.val;
        const expectedSmite = Math.floor(Math.floor(player.maxHp * val) * skill.smite);
        const plain = CombatEngine.performSkill(player, enemyOf(PLAIN), stats, skill, RNG);
        for (const family of [UNDEAD[0], DEMON[0], UNDEAD[UNDEAD.length - 1]]) {
            // 방어력이 있어도 신성 피해는 줄지 않는다(방어 무시) — 기본 피해는 같은 방어로 비교한다.
            const def = 50;
            const plainDef = CombatEngine.performSkill(player, enemyOf(PLAIN, { def }), stats, skill, RNG);
            const holy = CombatEngine.performSkill(player, enemyOf(family, { def }), stats, skill, RNG);
            const plainLoss = 100_000 - plainDef.updatedEnemy.hp;
            const holyLoss = 100_000 - holy.updatedEnemy.hp;
            assert.equal(holyLoss - plainLoss, expectedSmite, `${job} ${skill.name}${choice ? `(${choice})` : ''} vs ${family}`);
            assert.equal(holy.updatedPlayer.hp, plain.updatedPlayer.hp, '회복량은 대상과 무관하다');
            assert.ok(holy.logs.some((l) => l.text === MSG.SKILL_HOLY_SMITE(skill.name, family, expectedSmite)), `${family}: 신성 피해 로그`);
            assert.ok(!plainDef.logs.some((l) => l.text.includes('신성한 빛')), '일반 적에게는 신성 피해 로그가 없다');
            checked += 1;
        }
    }
    assert.ok(checked >= 9, `검사 ${checked}건`);
});

test('신성 피해는 생명이 가득해도 광고한 회복량으로 계산되고, 적을 쓰러뜨리면 승리다', () => {
    const skill = CLASSES['성직자'].skills.find((s) => s.name === '기적의 손길');
    const full = playerOf('성직자', { hp: 3_000 });
    const stats = calculateFullStats(full);
    const expectedSmite = Math.floor(Math.floor(3_000 * skill.val) * skill.smite);
    const plain = CombatEngine.performSkill(full, enemyOf(PLAIN), stats, skill, RNG);
    const holy = CombatEngine.performSkill(full, enemyOf('리치'), stats, skill, RNG);
    assert.equal((100_000 - holy.updatedEnemy.hp) - (100_000 - plain.updatedEnemy.hp), expectedSmite);

    const baseDamage = 100_000 - plain.updatedEnemy.hp;
    const finishing = CombatEngine.performSkill(full, enemyOf('리치', { hp: baseDamage + 1, maxHp: baseDamage + 1 }), stats, skill, RNG);
    assert.equal(finishing.isVictory, true, '회복의 빛이 마지막 일격이 될 수 있다');
    const plainSurvives = CombatEngine.performSkill(full, enemyOf(PLAIN, { hp: baseDamage + 1, maxHp: baseDamage + 1 }), stats, skill, RNG);
    assert.equal(plainSurvives.isVictory, false);
});

test('smite가 없는 회복 기술(다른 직업)은 언데드에게도 이전과 같다', () => {
    const others = Object.entries(CLASSES).flatMap(([job, def]) => (def.skills || [])
        .filter((skill) => skill.effect === 'hp_regen' && !(skill.smite > 0))
        .map((skill) => ({ job, skill })));
    assert.ok(others.length >= 1, '비교할 다른 회복 기술이 있다');
    for (const { job, skill } of others) {
        const player = playerOf(job);
        const stats = calculateFullStats(player);
        const plain = CombatEngine.performSkill(player, enemyOf(PLAIN), stats, skill, RNG);
        const undead = CombatEngine.performSkill(player, enemyOf('해골 병사'), stats, skill, RNG);
        assert.equal(undead.updatedEnemy.hp, plain.updatedEnemy.hp, `${job} ${skill.name}`);
    }
});

test('광고 = 동작: smite 기술만 설명에 "언데드 · 마족 … 신성 피해"를 말한다, 퇴마 강점은 성직자 · 팔라딘', () => {
    for (const [job, def] of Object.entries(CLASSES)) {
        for (const skill of def.skills || []) {
            const says = /언데드/.test(skill.desc || '') && /마족/.test(skill.desc || '') && /신성 피해/.test(skill.desc || '');
            assert.equal(says, (skill.smite ?? 0) > 0, `${job} ${skill.name}: 설명과 smite`);
        }
        const hasExorcism = (def.traits?.strengths || []).includes('exorcism');
        const hasSmite = (def.skills || []).some((skill) => (skill.smite ?? 0) > 0);
        assert.equal(hasExorcism, hasSmite, `${job}: 퇴마 강점 ⇔ smite 기술`);
    }
    assert.equal(MSG.CLASS_TRAIT_LABELS.exorcism, '퇴마');
});

test('실제 전투 전이(RESOLVE_COMBAT_ACTION): 성직자가 기적의 손길로 해골 병사를 치면 신성 피해가 정산된다', () => {
    const run = (baseName) => {
        const state = structuredClone(INITIAL_STATE);
        const skills = getJobSkills(playerOf('성직자'));
        const selected = skills.findIndex((s) => s.name === '기적의 손길');
        assert.ok(selected >= 0);
        state.player = { ...state.player, ...playerOf('성직자'), skillLoadout: { selected, cooldowns: {} } };
        state.gameState = 'combat';
        state.enemy = enemyOf(baseName, { exp: 0, gold: 0 });
        state.combatTurn = 0;
        state.combatReceipt = null;
        const actionMap = makeCombatActionMap(INITIAL_STATE.player);
        return actionMap.RESOLVE_COMBAT_ACTION(state, {
            type: AT.RESOLVE_COMBAT_ACTION,
            payload: { kind: 'skill', expectedTurn: 0, seed: 20260930, now: 1_700_000_000_000 },
        });
    };
    const holy = run('해골 병사');
    const plain = run(PLAIN);
    const skill = CLASSES['성직자'].skills.find((s) => s.name === '기적의 손길');
    const expectedSmite = Math.floor(Math.floor(3_000 * skill.val) * skill.smite);
    assert.equal(holy.combatTurn, 1);
    assert.equal((100_000 - holy.enemy.hp) - (100_000 - plain.enemy.hp), expectedSmite);
    assert.ok(holy.logs.some((log) => log.text === MSG.SKILL_HOLY_SMITE('기적의 손길', '해골 병사', expectedSmite)));
});
