import test from 'node:test';
import assert from 'node:assert/strict';

import { CLASSES } from '../src/data/classes.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * Wave 4 O1 (엔드게임 빌드 선택지).
 *
 * 감사 결과: 분기 agency가 tier와 역상이었다 — T1 전사/마법사/도적은 3개 분기,
 * T3 팔라딘/드래곤 나이트/대마법사/그림자 주군/사냥의 군주는 1개뿐이라
 * 엔드게임 직업이 오히려 빌드 결정을 가장 적게 가졌다.
 *
 * 이 테스트는 "Tier 2 이상 직업은 분기 스킬 2개 이상"을 계약으로 고정하고,
 * 분기 override가 `ClassSkillEffect` 유니온과 엔진 read 경로 안에 머무는지,
 * 그리고 두 선택지가 실제로 서로 다른 결과를 주는지(무의미한 2택 금지) 검증한다.
 */

/** 엔진(CombatEngine.actions.ts performSkill)이 실제로 읽는 override 키. */
const ENGINE_READ_OVERRIDE_KEYS = new Set([
    'mult', 'effect', 'effectChance', 'secondEffect', 'val', 'turn', 'crit',
    'defBonus', 'stunTurn', 'curseTurn', 'drainRatio', 'mpRestore', 'mp', 'cooldown', 'type',
]);

/**
 * 알려진 dead override 키 — 타입(`ClassSkill`)에는 선언돼 있지만 엔진에 read 경로가 없다.
 * `burnTurn`: 마법사 '화염구' B('지속 화염')만 사용. CombatEngine 어디에서도 읽지 않아
 *   광고한 "화상 3턴"이 발현하지 않는다 (stunTurn cycle 241 / curseTurn cycle 244와 달리
 *   burn은 dots 배열만 있고 턴 카운터가 없다). 신규 분기는 이 키를 쓰지 않는다 — 목록은
 *   줄이는 방향으로만 갱신할 것.
 */
const KNOWN_DEAD_OVERRIDE_KEYS = new Map([['burnTurn', ['마법사/화염구/B']]]);

/** types/class.ts `ClassSkillEffect` 30종 — data-shape-types.test.js와 동일 집합. */
const CLASS_SKILL_EFFECTS = new Set([
    'all_up', 'atk_up', 'berserk', 'bleed', 'blind', 'burn', 'counter', 'crit_cooldown',
    'crit_up', 'curse', 'curse_amp', 'def_up', 'drain', 'escape_100', 'exp_up', 'extraTurn',
    'fear', 'freeze', 'gold_up', 'hp_regen', 'hp_up', 'low_hp_atk', 'mp_regen', 'mp_up',
    'poison', 'purify', 'resetCooldowns', 'stealth', 'stun', 'taunt',
]);

const entries = () => Object.entries(CLASSES);
const endgameEntries = () => entries().filter(([, def]) => (def.tier || 0) >= 2);

test('Tier 2 이상 직업은 전부 분기 스킬을 2개 이상 가진다', () => {
    const endgame = endgameEntries();
    assert.ok(endgame.length >= 12, `Tier 2+ 직업 표본이 충분해야 함 (실측 ${endgame.length})`);
    for (const [job, def] of endgame) {
        const branchCount = Object.keys(def.skillBranches || {}).length;
        assert.ok(
            branchCount >= 2,
            `${job}(T${def.tier})는 분기 스킬이 2개 이상이어야 함 — 현재 ${branchCount}개`
        );
    }
});

test('Tier 3 직업의 분기 수가 Tier 2 최소치 아래로 내려가지 않는다', () => {
    const tierMin = (tier) => Math.min(...entries()
        .filter(([, def]) => (def.tier || 0) === tier)
        .map(([, def]) => Object.keys(def.skillBranches || {}).length));
    // T0 모험가는 학습용 단순 선택(1개)이라 비교 대상에서 제외한다.
    assert.ok(tierMin(3) >= 2, `T3 최소 분기 수 ${tierMin(3)} — 엔드게임 직업도 2택 이상을 가져야 함`);
    assert.ok(tierMin(2) >= 2, `T2 최소 분기 수 ${tierMin(2)}`);
    assert.ok(tierMin(3) >= tierMin(2), 'T3 분기 agency가 T2보다 적으면 안 된다');
});

test('모든 분기 선택지는 2택 이상이고 override effect가 ClassSkillEffect 유니온 안에 있다', () => {
    for (const [job, def] of entries()) {
        for (const [skillName, choices] of Object.entries(def.skillBranches || {})) {
            assert.ok(Array.isArray(choices) && choices.length >= 2, `${job}/${skillName} 분기는 2택 이상`);
            for (const choice of choices) {
                const override = choice.override || {};
                for (const key of ['effect', 'secondEffect']) {
                    const value = override[key];
                    if (value === undefined) continue;
                    assert.ok(
                        CLASS_SKILL_EFFECTS.has(value),
                        `${job}/${skillName}/${choice.choice} ${key} "${value}"가 ClassSkillEffect 유니온 밖`
                    );
                }
                for (const key of Object.keys(override)) {
                    if (ENGINE_READ_OVERRIDE_KEYS.has(key)) continue;
                    const known = KNOWN_DEAD_OVERRIDE_KEYS.get(key) || [];
                    assert.ok(
                        known.includes(`${job}/${skillName}/${choice.choice}`),
                        `${job}/${skillName}/${choice.choice} override 키 "${key}"는 엔진 미처리 dead config`
                    );
                }
            }
        }
    }
});

test('분기 2택은 override 키 하나 이상에서 서로 다른 결과를 준다', () => {
    for (const [job, def] of entries()) {
        for (const [skillName, choices] of Object.entries(def.skillBranches || {})) {
            const base = (def.skills || []).find((skill) => skill.name === skillName) || {};
            for (let i = 0; i < choices.length; i += 1) {
                for (let j = i + 1; j < choices.length; j += 1) {
                    const left = { ...base, ...(choices[i].override || {}) };
                    const right = { ...base, ...(choices[j].override || {}) };
                    const keys = new Set([
                        ...Object.keys(choices[i].override || {}),
                        ...Object.keys(choices[j].override || {}),
                    ]);
                    const differing = [...keys].filter((key) => left[key] !== right[key]);
                    assert.ok(
                        differing.length >= 1,
                        `${job}/${skillName} ${choices[i].choice}·${choices[j].choice}가 동일한 스킬로 귀결 — 무의미한 2택`
                    );
                }
            }
        }
    }
});

test('분기 대상 스킬명이 해당 직업 skills 배열에 실존하고 패시브가 아니다', () => {
    for (const [job, def] of entries()) {
        const byName = new Map((def.skills || []).map((skill) => [skill.name, skill]));
        for (const skillName of Object.keys(def.skillBranches || {})) {
            const skill = byName.get(skillName);
            assert.ok(skill, `${job}의 분기 대상 "${skillName}"이 skills에 실존해야 함`);
            assert.ok(!skill.passive, `${job}/${skillName}은 능동 스킬이어야 분기가 발현한다`);
        }
    }
});

test('분기 label / desc는 전부 채워져 있고 같은 스킬 안에서 중복되지 않는다', () => {
    for (const [job, def] of entries()) {
        for (const [skillName, choices] of Object.entries(def.skillBranches || {})) {
            const labels = new Set();
            for (const choice of choices) {
                assert.ok(choice.label && choice.label.trim(), `${job}/${skillName} label 누락`);
                assert.ok(choice.desc && choice.desc.trim(), `${job}/${skillName} desc 누락`);
                assert.ok(!labels.has(choice.label), `${job}/${skillName} label 중복 — ${choice.label}`);
                labels.add(choice.label);
            }
        }
    }
});

/** Wave 4 O1에서 새로 추가된 분기 (직업 · 스킬). */
const NEW_BRANCHES = [
    ['성직자', '기적의 손길'], ['팔라딘', '성스러운 방패'], ['드래곤 나이트', '용왕의 노여움'],
    ['대마법사', '대소멸'], ['그림자 주군', '허무의 각'], ['시간술사', '시간 역행'],
    ['사냥의 군주', '천지의 화살'],
];

test('Wave 4 O1 신규 분기 desc는 플레이어 어휘만 사용하고 dead override 키를 쓰지 않는다 (R17)', () => {
    const englishStat = /\b(ATK|DEF|HP|MP|CRIT)\b/;
    for (const [job, skillName] of NEW_BRANCHES) {
        const choices = CLASSES[job]?.skillBranches?.[skillName];
        assert.ok(choices, `${job}/${skillName} 분기가 존재해야 함`);
        for (const choice of choices) {
            assert.doesNotMatch(choice.desc, englishStat, `${job}/${skillName}/${choice.choice} desc에 영문 약어`);
            assert.doesNotMatch(choice.desc, /데미지|대미지/, `${job}/${skillName}/${choice.choice} desc는 "피해" 어휘 사용`);
            for (const key of Object.keys(choice.override || {})) {
                assert.ok(
                    ENGINE_READ_OVERRIDE_KEYS.has(key),
                    `${job}/${skillName}/${choice.choice} override 키 "${key}"는 엔진 read 경로가 없다`
                );
            }
        }
    }
});

// --- 신규 분기 통합 검증 (엔진이 실제로 override를 읽는지) --------------------

const runSkill = (job, skillName, choice, { enemyHp = 4000 } = {}) => {
    const def = CLASSES[job];
    const base = def.skills.find((skill) => skill.name === skillName);
    const branch = def.skillBranches[skillName].find((entry) => entry.choice === choice);
    assert.ok(branch, `${job}/${skillName}/${choice} 분기 존재`);
    const player = {
        hp: 400, maxHp: 1000, mp: 400, maxMp: 400, status: ['poison'], job,
        skillChoices: { [skillName]: choice },
        skillLoadout: { selected: 0, cooldowns: { [skillName]: 0, '보조 기술': 3 } },
    };
    const enemy = { name: '검증용 몬스터', hp: enemyHp, maxHp: enemyHp, def: 0, guarding: false };
    const stats = { atk: 60, relics: [], activeSynergies: [], maxMp: 400 };
    return CombatEngine.performSkill(player, enemy, stats, { ...base, ...branch.override });
};

test('팔라딘 "성스러운 방패" — A는 더 두꺼운 보호, B는 같은 보호 + 상태이상 정화', () => {
    const a = runSkill('팔라딘', '성스러운 방패', 'A');
    const b = runSkill('팔라딘', '성스러운 방패', 'B');
    assert.equal(a.success, true);
    assert.equal(b.success, true);
    assert.ok(a.updatedPlayer.tempBuff.def > b.updatedPlayer.tempBuff.def, 'A 방어 배율이 더 높아야 함');
    assert.ok(Math.abs(b.updatedPlayer.tempBuff.def - 1.5) < 1e-9, 'B는 방어력 150% 상승 유지');
    assert.deepEqual(b.updatedPlayer.status, [], 'B는 상태이상을 정화한다');
    assert.deepEqual(a.updatedPlayer.status, ['poison'], 'A는 정화하지 않는다');
});

test('성직자 "기적의 손길" — A는 회복량, B는 회복 + 방어 버프', () => {
    const a = runSkill('성직자', '기적의 손길', 'A');
    const b = runSkill('성직자', '기적의 손길', 'B');
    assert.ok(a.updatedPlayer.hp > b.updatedPlayer.hp, 'A 회복량이 더 커야 함');
    assert.ok(Math.abs(b.updatedPlayer.tempBuff.def - 0.4) < 1e-9, 'B는 방어력 40% 상승');
    assert.equal(a.updatedPlayer.tempBuff.def, 0, 'A는 방어 버프 없음');
});

test('그림자 주군 "허무의 각" — A는 처형 화력, B는 회피 획득', () => {
    const a = runSkill('그림자 주군', '허무의 각', 'A');
    const b = runSkill('그림자 주군', '허무의 각', 'B');
    const aDamage = 4000 - a.updatedEnemy.hp;
    const bDamage = 4000 - b.updatedEnemy.hp;
    assert.ok(aDamage > bDamage, `A 피해(${aDamage})가 B(${bDamage})보다 커야 함`);
    assert.equal(b.updatedPlayer.nextHitEvaded, true, 'B는 다음 적 공격 1회를 회피한다');
    assert.notEqual(a.updatedPlayer.nextHitEvaded, true, 'A는 회피를 얻지 않는다');
});

test('시간술사 "시간 역행" — A는 쿨타임 초기화 + 보호, B는 추가 행동', () => {
    const a = runSkill('시간술사', '시간 역행', 'A');
    const b = runSkill('시간술사', '시간 역행', 'B');
    assert.deepEqual(a.updatedPlayer.skillLoadout.cooldowns, {}, 'A는 모든 쿨타임을 초기화한다');
    assert.ok(a.updatedPlayer.tempBuff.def > 0, 'A는 방어 버프를 얻는다');
    assert.equal(b.updatedPlayer.extraTurnGranted, true, 'B는 추가 행동을 얻는다');
    assert.ok(
        Object.keys(b.updatedPlayer.skillLoadout.cooldowns).length > 0,
        'B는 쿨타임 초기화를 포기한다 (기존 쿨타임이 남는다)'
    );
});

test('사냥의 군주 "천지의 화살" B — 출혈과 독을 함께 새긴다', () => {
    const b = runSkill('사냥의 군주', '천지의 화살', 'B');
    assert.ok(Array.isArray(b.updatedEnemy.dots), '적 DoT 배열 존재');
    assert.ok(b.updatedEnemy.dots.includes('bleed'), '출혈 부여');
    assert.ok(b.updatedEnemy.dots.includes('poison'), '독 부여');
});

test('드래곤 나이트 "용왕의 노여움" B / 대마법사 "대소멸" B — 2차 상태이상이 실제로 부여된다', () => {
    const dragon = runSkill('드래곤 나이트', '용왕의 노여움', 'B');
    assert.ok(dragon.updatedEnemy.dots.includes('burn'), '화상 유지');
    assert.ok(dragon.updatedEnemy.dots.includes('bleed'), '출혈 추가');

    const mage = runSkill('대마법사', '대소멸', 'B');
    assert.ok((mage.updatedEnemy.stunnedTurns || 0) >= 2, '빙결 2턴');
    assert.ok((mage.updatedEnemy.cursedTurns || 0) >= 1, '저주 부여');
});
