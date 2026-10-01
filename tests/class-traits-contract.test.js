import test from 'node:test';
import assert from 'node:assert/strict';

import { createElement } from 'react';

import JobChangePanel from '../src/components/tabs/JobChangePanel.tsx';
import { CLASSES } from '../src/data/classes.js';
import { MSG } from '../src/data/messages.js';
import { getClassTraitLabels } from '../src/utils/classPresentation.ts';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

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

/**
 * Wave 43 (소유자 결정 "B+C — 강점 · 약점을 수치로도 강조"): 자가 회복은 크기까지 요구한다(회복 기술 10% 이상 또는
 * 흡수 40% 이상), 낮은 생명은 0.8 이하 · 적은 기력은 0.7 이하다. 경계를 되돌리면 선언이 다시 이름뿐이 된다.
 */
const SUSTAIN_MIN_HEAL = 0.1;
const SUSTAIN_MIN_DRAIN = 0.4;
const hasSubstantialSustain = (def) => active(def).some((skill) => (
    (skill.effect === 'hp_regen' && (skill.val ?? 0) >= SUSTAIN_MIN_HEAL)
    || (skill.effect === 'drain' && (skill.drainRatio ?? 0.25) >= SUSTAIN_MIN_DRAIN)
));

/** 특성 → 데이터 근거. 강점과 약점이 같은 어휘를 쓰되, 둘은 서로 반대 방향이다. */
const TRAIT_EVIDENCE = {
    toughness: (def) => (def.hpMod ?? 1) >= 1.4,
    mana: (def) => (def.mpMod ?? 1) >= 1.8,
    firepower: (def) => (def.atkMod ?? 1) >= FIREPOWER_HIGH[def.tier],
    control: (def) => active(def).some((skill) => CC.has(skill.effect)),
    sustain: hasSubstantialSustain,
    // Wave 54: 은신 중 치명(`stealthCrit`, 등 찌르기)도 전용 치명 확률이다.
    crit: (def) => active(def).filter((skill) => skill.crit || skill.stealthCrit).length >= 2,
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
    // Wave 51(소유자 결정 "성직자의 컨셉"): 퇴마 = 언데드 · 마족에게 신성 피해를 주는 회복 기술(smite)이 있다.
    exorcism: (def) => active(def).some((skill) => skill.effect === 'hp_regen' && (skill.smite ?? 0) > 0),
    frail: (def) => (def.hpMod ?? 1) <= 0.8,
    low_mana: (def) => (def.mpMod ?? 1) <= 0.7,
    low_firepower: (def) => (def.atkMod ?? 1) <= FIREPOWER_LOW[def.tier],
    no_sustain: (def) => !hasEffect(def, 'hp_regen', 'drain'),
    mono_element: (def) => damageElements(def).size === 1 && !damageElements(def).has('물리'),
    physical_only: (def) => damageElements(def).size === 1 && damageElements(def).has('물리'),
};
const STRENGTHS = new Set(['toughness', 'mana', 'firepower', 'control', 'sustain', 'crit', 'evasion', 'affliction', 'elements', 'guard', 'weaken', 'escape', 'tempo', 'purify', 'growth', 'fortune', 'exorcism']);
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

test('전직 화면은 고른 직업의 강점 · 약점을 라벨로 그린다', () => {
    // 모험가 Lv5의 첫 선택지는 전사다(CLASSES['모험가'].next[0]).
    const html = renderStatic(createElement(JobChangePanel, { player: makePlayerFixture({ job: '모험가', level: 5 }) }));
    const first = CLASSES['모험가'].next[0];
    const labels = getClassTraitLabels(CLASSES[first]);
    assert.match(html, /data-testid="job-change-traits"/);
    const strengths = html.split('data-testid="job-change-strengths"')[1].split('data-testid="job-change-weaknesses"')[0];
    const weaknesses = html.split('data-testid="job-change-weaknesses"')[1];
    for (const label of labels.strengths) assert.ok(strengths.includes(`>${label}<`), `강점 "${label}"`);
    for (const label of labels.weaknesses) assert.ok(weaknesses.includes(`>${label}<`), `약점 "${label}"`);
    assert.ok(strengths.includes(`>${MSG.CLASS_TRAIT_STRENGTHS}<`));
    assert.ok(weaknesses.includes(`>${MSG.CLASS_TRAIT_WEAKNESSES}<`));
});

test('강점 · 약점 선언이 없는 직업은 그 줄을 그리지 않는다', () => {
    assert.deepEqual(getClassTraitLabels(CLASSES['모험가']), { strengths: [], weaknesses: [] });
    assert.deepEqual(getClassTraitLabels(undefined), { strengths: [], weaknesses: [] });
});

test('Wave 43 강조 폭: 자가 회복형의 회복 · 흡수량과 약점 직업의 생명 · 기력 배율을 고정한다', () => {
    const skill = (job, name) => CLASSES[job].skills.find((entry) => entry.name === name);
    assert.deepEqual(
        [skill('성직자', '기적의 손길').val, skill('팔라딘', '기적의 부활').val, skill('버서커', '역경의 힘').val],
        [0.25, 0.4, 0.1],
    );
    assert.deepEqual([skill('흑마법사', '생명흡수').drainRatio, skill('무당', '혼의 흡수').drainRatio], [0.4, 0.45]);
    const hp = Object.fromEntries(['마법사', '아크메이지', '흑마법사', '대마법사', '무당'].map((job) => [job, CLASSES[job].hpMod]));
    assert.deepEqual(hp, { 마법사: 0.6, 아크메이지: 0.7, 흑마법사: 0.8, 대마법사: 0.75, 무당: 0.8 });
    const mp = Object.fromEntries(['전사', '나이트', '버서커', '드래곤 나이트'].map((job) => [job, CLASSES[job].mpMod]));
    assert.deepEqual(mp, { 전사: 0.5, 나이트: 0.7, 버서커: 0.4, '드래곤 나이트': 0.6 });
});

test('회복 · 흡수 기술 설명의 백분율은 데이터 값과 같다 (광고 = 동작)', () => {
    for (const def of Object.values(CLASSES)) {
        const choices = Object.entries(def.skillBranches ?? {}).flatMap(([name, list]) => list.map((choice) => ({
            ...(def.skills ?? []).find((entry) => entry.name === name), ...choice.override, desc: choice.desc, name: `${name}/${choice.label}`,
        })));
        for (const skill of [...(def.skills ?? []), ...choices]) {
            const ratio = skill.effect === 'hp_regen' ? skill.val : skill.effect === 'drain' ? skill.drainRatio : undefined;
            if (ratio === undefined || !/%/.test(String(skill.desc)) || /\+\d+%/.test(String(skill.desc))) continue;
            const pct = Math.round(ratio * 100);
            assert.ok(String(skill.desc).includes(`${pct}%`), `${skill.name}: 설명 "${skill.desc}"에 ${pct}%가 없다`);
        }
    }
});
