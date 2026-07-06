import test from 'node:test';
import assert from 'node:assert/strict';

import { CLASSES } from '../src/data/classes.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';

// 2026-07 감사 축1 (빌드 다양성): 성직자/팔라딘/드래곤 나이트/대마법사/그림자 주군/
// 사냥의 군주/모험가 7직업은 skillBranches가 0건이라 해당 직업 런에 스킬 결정이
// 없었다. 이 테스트는 7직업 전부에 skillBranches가 추가되고, 기존 11직업 25개
// 분기의 밸런스 밴드(override 키/수치 범위)를 벗어나지 않음을 계약화한다.

const SEVEN_JOBS = [
    '성직자', '팔라딘', '드래곤 나이트', '대마법사', '그림자 주군', '사냥의 군주', '모험가',
];

// 엔진(CombatEngine.actions.ts performSkill)이 실제로 읽는 override 키 집합.
// 이 집합 밖의 키를 override에 넣으면 dead config(광고만 하고 미적용)가 된다.
const ENGINE_ALLOWED_OVERRIDE_KEYS = new Set([
    'mult', 'effect', 'effectChance', 'val', 'defBonus', 'secondEffect',
    'burnTurn', 'stunTurn', 'crit', 'drainRatio', 'curseTurn', 'mpRestore',
]);

/** 기존 11직업 25개 분기에서 추출한 밸런스 밴드. 새 분기도 이 범위 내여야 한다. */
function collectExistingBranchStats() {
    const multRatios = [];
    const effectChances = [];
    const critValues = [];

    for (const [job, def] of Object.entries(CLASSES)) {
        if (SEVEN_JOBS.includes(job)) continue; // 신규 추가분 제외 — 기존 11직업만으로 밴드 산출
        const branches = def.skillBranches || {};
        for (const [skillName, choices] of Object.entries(branches)) {
            const baseSkill = (def.skills || []).find((s) => s.name === skillName);
            for (const choice of choices) {
                const override = choice.override || {};
                if (typeof override.mult === 'number' && typeof baseSkill?.mult === 'number' && baseSkill.mult > 0) {
                    multRatios.push(override.mult / baseSkill.mult);
                }
                if (typeof override.effectChance === 'number') {
                    effectChances.push(override.effectChance);
                }
                if (typeof override.crit === 'number') {
                    critValues.push(override.crit);
                }
            }
        }
    }
    return { multRatios, effectChances, critValues };
}

test('7개 직업 전부 skillBranches가 최소 1개 이상 존재한다', () => {
    for (const job of SEVEN_JOBS) {
        const def = CLASSES[job];
        assert.ok(def, `직업 정의 존재해야 함: ${job}`);
        const branches = def.skillBranches;
        assert.ok(branches && Object.keys(branches).length >= 1, `${job}에 skillBranches가 있어야 함`);
    }
});

test('모험가(T0)는 분기 1개만 보유한다 (초반 학습용 단순 선택)', () => {
    const branches = CLASSES['모험가'].skillBranches;
    assert.equal(Object.keys(branches).length, 1, '모험가는 스킬 1개에만 분기가 있어야 함');
});

test('분기 대상 스킬명이 해당 직업 skills 배열에 실존한다', () => {
    for (const job of SEVEN_JOBS) {
        const def = CLASSES[job];
        const skillNames = new Set((def.skills || []).map((s) => s.name));
        for (const skillName of Object.keys(def.skillBranches)) {
            assert.ok(skillNames.has(skillName), `${job}의 분기 대상 "${skillName}"이 skills에 실존해야 함`);
        }
    }
});

test('모든 분기 override 키는 엔진이 처리하는 허용 키 집합에 포함된다', () => {
    for (const job of SEVEN_JOBS) {
        const def = CLASSES[job];
        for (const [skillName, choices] of Object.entries(def.skillBranches)) {
            for (const choice of choices) {
                const overrideKeys = Object.keys(choice.override || {});
                for (const key of overrideKeys) {
                    assert.ok(
                        ENGINE_ALLOWED_OVERRIDE_KEYS.has(key),
                        `${job}/${skillName}/${choice.choice} override 키 "${key}"는 엔진 미처리 dead config`
                    );
                }
            }
        }
    }
});

test('전 직업 분기 스키마 정합성 — choice/label/desc/override 필수 키', () => {
    for (const [job, def] of Object.entries(CLASSES)) {
        const branches = def.skillBranches || {};
        for (const [skillName, choices] of Object.entries(branches)) {
            assert.ok(Array.isArray(choices) && choices.length >= 2, `${job}/${skillName} 분기는 2택 이상이어야 함`);
            for (const choice of choices) {
                assert.equal(typeof choice.choice, 'string', `${job}/${skillName} choice 필드 누락`);
                assert.equal(typeof choice.label, 'string', `${job}/${skillName} label 필드 누락`);
                assert.equal(typeof choice.desc, 'string', `${job}/${skillName} desc 필드 누락`);
                assert.equal(typeof choice.override, 'object', `${job}/${skillName} override 필드 누락`);
                assert.ok(choice.override !== null, `${job}/${skillName} override는 null이 아니어야 함`);
            }
        }
    }
});

test('신규 7직업 mult 분기 비율이 기존 25개 분기의 밴드 내에 있다', () => {
    const { multRatios } = collectExistingBranchStats();
    const minRatio = Math.min(...multRatios);
    const maxRatio = Math.max(...multRatios);
    assert.ok(multRatios.length >= 10, '기존 분기 표본이 충분해야 밴드 계약이 의미 있음');

    for (const job of SEVEN_JOBS) {
        const def = CLASSES[job];
        for (const [skillName, choices] of Object.entries(def.skillBranches)) {
            const baseSkill = (def.skills || []).find((s) => s.name === skillName);
            for (const choice of choices) {
                const overrideMult = choice.override?.mult;
                if (typeof overrideMult !== 'number' || typeof baseSkill?.mult !== 'number') continue;
                const ratio = overrideMult / baseSkill.mult;
                assert.ok(
                    ratio >= minRatio - 1e-9 && ratio <= maxRatio + 1e-9,
                    `${job}/${skillName}/${choice.choice} mult 비율 ${ratio.toFixed(3)}이 기존 밴드 [${minRatio.toFixed(3)}, ${maxRatio.toFixed(3)}] 밖`
                );
            }
        }
    }
});

test('신규 7직업 effectChance 값이 기존 분기 밴드 내에 있다', () => {
    const { effectChances } = collectExistingBranchStats();
    const minChance = Math.min(...effectChances);
    const maxChance = Math.max(...effectChances);

    for (const job of SEVEN_JOBS) {
        const def = CLASSES[job];
        for (const [skillName, choices] of Object.entries(def.skillBranches)) {
            for (const choice of choices) {
                const chance = choice.override?.effectChance;
                if (typeof chance !== 'number') continue;
                assert.ok(
                    chance >= minChance - 1e-9 && chance <= maxChance + 1e-9,
                    `${job}/${skillName}/${choice.choice} effectChance ${chance}이 기존 밴드 [${minChance}, ${maxChance}] 밖`
                );
            }
        }
    }
});

test('신규 7직업 crit 분기 값이 기존 분기 밴드 내에 있거나 확정치(1.0)이다', () => {
    const { critValues } = collectExistingBranchStats();
    const minCrit = Math.min(...critValues);

    for (const job of SEVEN_JOBS) {
        const def = CLASSES[job];
        for (const [skillName, choices] of Object.entries(def.skillBranches)) {
            for (const choice of choices) {
                const crit = choice.override?.crit;
                if (typeof crit !== 'number') continue;
                assert.ok(
                    crit >= minCrit - 1e-9 && crit <= 1.0,
                    `${job}/${skillName}/${choice.choice} crit ${crit}이 기존 밴드 [${minCrit}, 1.0] 밖`
                );
            }
        }
    }
});

test('통합 검증 — 그림자 주군 "신의 일격" B분기(독혈의 일격) 선택 시 performSkill이 secondEffect poison을 실제로 적용한다', () => {
    const job = '그림자 주군';
    const skillName = '신의 일격';
    const baseSkill = CLASSES[job].skills.find((s) => s.name === skillName);
    const branch = CLASSES[job].skillBranches[skillName].find((b) => b.choice === 'B');
    assert.ok(branch, 'B분기가 존재해야 함');

    // performSkill 내부와 동일한 방식으로 분기 override 적용 (player.skillChoices 경유).
    const player = {
        hp: 100, maxHp: 100, mp: 200, maxMp: 200, status: [],
        skillChoices: { [skillName]: 'B' },
        job,
    };
    const enemy = { name: '테스트 몬스터', hp: 500, maxHp: 500, def: 0, guarding: false };
    const stats = { atk: 50, relics: [], activeSynergies: [] };

    const skillChoiceKey = player.skillChoices[skillName];
    const branches = CLASSES[player.job].skillBranches[skillName];
    const chosenBranch = branches.find((b) => b.choice === skillChoiceKey);
    assert.ok(chosenBranch.override.secondEffect, 'override에 secondEffect가 정의되어 있어야 함');

    const effectiveSkill = { ...baseSkill, ...chosenBranch.override };
    assert.equal(effectiveSkill.mult, baseSkill.mult, 'B분기는 base mult를 유지해야 함');
    assert.equal(effectiveSkill.secondEffect, 'poison');

    const result = CombatEngine.performSkill(player, enemy, stats, effectiveSkill);
    assert.equal(result.success, true);
    assert.ok(
        Array.isArray(result.updatedEnemy.dots) && result.updatedEnemy.dots.includes('poison'),
        '분기 적용 결과 적에게 poison DoT가 실제로 부여되어야 함'
    );
});
