import test from 'node:test';
import assert from 'node:assert/strict';

import { CLASSES } from '../src/data/classes.js';
import { MSG } from '../src/data/messages.js';

/**
 * 2026-09 Wave 42 (소유자 결정 "직업별로 차별화된 강점 및 단점을 강조") — 직업의 강점 · 약점은
 * 데이터(`CLASSES[*].traits`)가 선언하고, 이 테스트가 그 선언이 직업의 실제 수치 · 기술로
 * 뒷받침되는지 검증한다. 선언만 있고 근거가 없으면 전직 화면이 거짓 약속을 한다 — 원장 §41이
 * 성직자의 "회복"이 실제로는 즉시 15%뿐이었음을 찾은 것과 같은 종류의 결함이다.
 */

const ROOT_JOB = '모험가';
const CC = new Set(['stun', 'freeze']);
const DOT = new Set(['poison', 'burn', 'bleed', 'curse']);
const active = (def) => (def.skills ?? []).filter((skill) => !skill.passive);
const passive = (def) => (def.skills ?? []).filter((skill) => skill.passive);
const damaging = (def) => active(def).filter((skill) => (skill.mult ?? 0) > 0);
const elementOf = (skill) => (skill.type && !['buff', 'debuff', 'escape'].includes(skill.type) ? skill.type : '물리');
const damageElements = (def) => new Set(damaging(def).map(elementOf));
const hasEffect = (def, ...effects) => active(def).some((skill) => effects.includes(skill.effect));
/** 같은 tier 안에서의 화력 기준 — tier마다 공격 배율의 폭이 다르다. */
const FIREPOWER_HIGH = { 1: 1.5, 2: 2.0, 3: 2.3 };
const FIREPOWER_LOW = { 1: 1.3, 2: 1.7, 3: 1.9 };

/** 특성 → 데이터 근거. 강점과 약점이 같은 어휘를 쓰되, 둘은 서로 반대 방향이다. */
const TRAIT_EVIDENCE = {
    toughness: (def) => (def.hpMod ?? 1) >= 1.4,
    mana: (def) => (def.mpMod ?? 1) >= 1.8,
    firepower: (def) => (def.atkMod ?? 1) >= FIREPOWER_HIGH[def.tier],
    control: (def) => active(def).some((skill) => CC.has(skill.effect)),
    sustain: (def) => hasEffect(def, 'hp_regen', 'drain'),
    crit: (def) => active(def).filter((skill) => skill.crit).length >= 2,
    evasion: (def) => hasEffect(def, 'stealth'),
    affliction: (def) => active(def).filter((skill) => DOT.has(skill.effect)).length >= 2,
    elements: (def) => [...damageElements(def)].filter((element) => element !== '물리').length >= 3,
    guard: (def) => active(def).filter((skill) => ['def_up', 'counter'].includes(skill.effect)).length >= 2,
    weaken: (def) => hasEffect(def, 'fear', 'blind', 'taunt'),
    escape: (def) => hasEffect(def, 'escape_100'),
    tempo: (def) => hasEffect(def, 'extraTurn', 'resetCooldowns'),
    purify: (def) => hasEffect(def, 'purify'),
    growth: (def) => passive(def).some((skill) => skill.effect === 'exp_up'),
    fortune: (def) => passive(def).some((skill) => skill.effect === 'gold_up'),
    frail: (def) => (def.hpMod ?? 1) <= 0.9,
    low_mana: (def) => (def.mpMod ?? 1) <= 0.8,
    low_firepower: (def) => (def.atkMod ?? 1) <= FIREPOWER_LOW[def.tier],
    no_sustain: (def) => !hasEffect(def, 'hp_regen', 'drain'),
    mono_element: (def) => damageElements(def).size === 1 && !damageElements(def).has('물리'),
    physical_only: (def) => damageElements(def).size === 1 && damageElements(def).has('물리'),
};
const STRENGTHS = new Set(['toughness', 'mana', 'firepower', 'control', 'sustain', 'crit', 'evasion', 'affliction', 'elements', 'guard', 'weaken', 'escape', 'tempo', 'purify', 'growth', 'fortune']);
const WEAKNESSES = new Set(['frail', 'low_mana', 'low_firepower', 'no_sustain', 'mono_element', 'physical_only']);
/** 서로 같은 축의 반대편 — 한 직업이 둘 다 가질 수 없다. */
const OPPOSITES = [['toughness', 'frail'], ['mana', 'low_mana'], ['firepower', 'low_firepower'], ['sustain', 'no_sustain'], ['elements', 'mono_element'], ['elements', 'physical_only']];

const jobs = Object.entries(CLASSES).filter(([job]) => job !== ROOT_JOB);

test('전직 가능한 모든 직업은 강점 2개 이상 · 약점 1개 이상을 선언한다', () => {
    assert.equal(jobs.length, 17);
    for (const [job, def] of jobs) {
        assert.ok(def.traits, `${job}에 traits가 있어야 한다`);
        assert.ok(def.traits.strengths.length >= 2 && def.traits.strengths.length <= 3, `${job} 강점 2~3개`);
        assert.ok(def.traits.weaknesses.length >= 1 && def.traits.weaknesses.length <= 2, `${job} 약점 1~2개`);
        assert.equal(new Set(def.traits.strengths).size, def.traits.strengths.length, `${job} 강점 중복 없음`);
    }
});

test('강점은 강점 어휘, 약점은 약점 어휘만 쓴다', () => {
    for (const [job, def] of jobs) {
        for (const trait of def.traits.strengths) assert.ok(STRENGTHS.has(trait), `${job} 강점 "${trait}"`);
        for (const trait of def.traits.weaknesses) assert.ok(WEAKNESSES.has(trait), `${job} 약점 "${trait}"`);
    }
});

test('선언한 강점 · 약점은 직업의 실제 수치 · 기술로 뒷받침된다', () => {
    for (const [job, def] of jobs) {
        for (const trait of [...def.traits.strengths, ...def.traits.weaknesses]) {
            assert.equal(TRAIT_EVIDENCE[trait](def), true, `${job}의 "${trait}"에 데이터 근거가 없다`);
        }
    }
});

test('한 직업이 같은 축의 강점과 약점을 함께 갖지 않는다', () => {
    for (const [job, def] of jobs) {
        const all = new Set([...def.traits.strengths, ...def.traits.weaknesses]);
        for (const [a, b] of OPPOSITES) assert.ok(!(all.has(a) && all.has(b)), `${job}: ${a} · ${b}`);
    }
});

test('모든 특성에 한국어 라벨이 있다 (MSG 소유)', () => {
    for (const trait of [...STRENGTHS, ...WEAKNESSES]) {
        assert.equal(typeof MSG.CLASS_TRAIT_LABELS[trait], 'string', `${trait} 라벨`);
        assert.ok(MSG.CLASS_TRAIT_LABELS[trait].length > 0);
    }
});

test('같은 뿌리의 Lv12 두 갈래(성직자 · 무당)는 서로 다른 강점을 가진다 — 선택이 정보가 된다', () => {
    const cleric = new Set(CLASSES['성직자'].traits.strengths);
    const shaman = new Set(CLASSES['무당'].traits.strengths);
    assert.notDeepEqual([...cleric].sort(), [...shaman].sort());
    for (const root of CLASSES[ROOT_JOB].next) {
        const kids = CLASSES[root].next.map((job) => CLASSES[job].traits.strengths.join('|'));
        assert.equal(new Set(kids).size, kids.length, `${root}의 후속 직업들은 강점 구성이 서로 다르다`);
    }
});
