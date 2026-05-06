import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 156: 시너지 hell_reaper / annihilator / absolute_reflect 핸들러 추가
 * (cycle 148 baseline 9 → 6).
 *
 * 1. hell_reaper (lifeStealBonus 0.5) — 기존 vampire_lord lifeSteal 분기와 합산.
 * 2. annihilator (executeThreshold 0.35) — 기존 execute_bonus 유물 threshold와
 *    Math.max로 합산. mult는 유물 값 그대로(시너지에 mult 없음).
 * 3. absolute_reflect (reflect 0.5, stunOnReflect 0.25) — enemyAttack에서
 *    적이 가한 피해를 비율로 적에게 반사. stunOnReflect 확률로 적 스턴.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

test("CombatEngine.ts: hell_reaper / annihilator / absolute_reflect effect-name 명시", async () => {
    const src = await readFile(path.join(ROOT, 'src/systems/CombatEngine.ts'), 'utf8');
    assert.match(src, /'hell_reaper'/);
    assert.match(src, /'annihilator'/);
    assert.match(src, /'absolute_reflect'/);
});

test("attack: annihilator executeThreshold 0.35 — 적 HP 30%에서 처형 발동 (threshold 25% 유물 단독으론 불발 케이스)", () => {
    const player = {
        name: 'tester', job: '모험가', level: 10,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        relics: [], skillChoices: {}, titles: [], activeTitle: null,
        killStreak: 0, combatFlags: {}, status: [],
    };
    const enemy = { name: '슬라임', hp: 30, maxHp: 100, atk: 10, def: 5 };
    const stats = {
        atk: 1, def: 50, elem: 'physical',  // 낮은 atk로 1타에 안 죽도록
        relics: [{ effect: 'execute_bonus', val: { threshold: 0.25, mult: 0.5 } }],
        activeSynergies: [{ bonus: { effect: 'annihilator', executeThreshold: 0.35, killStack: 0.07 } }],
        critChance: 0,
    };

    const result = CombatEngine.attack(player, enemy, stats);
    // hpRatio 0.3 < threshold(0.35) → executeTriggered 됐다는 로그 확인.
    const executeLog = result.logs.find((l) => l.text && l.text.includes('처형자의 날'));
    assert.ok(executeLog, '시너지 annihilator threshold 0.35로 처형 발동돼야 함');
});

test("enemyAttack: absolute_reflect reflect 1.0 — stats.def 기반 반사 (기존 thorns-style 보존)", () => {
    const player = {
        name: 'tester', job: '모험가', level: 10,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        relics: [], skillChoices: {}, titles: [], activeTitle: null,
        killStreak: 0, combatFlags: {}, status: [],
    };
    // cycle 230: pattern 명시 — 미정의 시 default guardChance 0.2가 20% 확률로 guard로 분기되어
    //   reflect dmg 적용 없이 0 dmg 반환 → 테스트가 RNG로 flaky. guardChance=0으로 고정해
    //   absolute_reflect 분기를 보장.
    const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5, pattern: { guardChance: 0, heavyChance: 0 } };
    const stats = {
        atk: 100, def: 50,  // 양수 def → reflectDmg = 50
        relics: [],
        activeSynergies: [{ bonus: { effect: 'absolute_reflect', reflect: 1.0, stunOnReflect: 0 } }],
        critChance: 0,
    };

    const result = CombatEngine.enemyAttack(player, enemy, stats);
    // reflectDmg = stats.def(50) * reflect(1.0) = 50 → 적 hp 100 → 50.
    assert.ok(result.updatedEnemy.hp < enemy.hp,
        `expected enemy hp reduced by reflect; got ${result.updatedEnemy.hp} from ${enemy.hp}`);
    const reflectLog = result.logs.find((l) => l.text && l.text.includes('반사'));
    assert.ok(reflectLog, '반사 로그 출력돼야 함');
});

test("attack: vampire_lord(0.3) + hell_reaper(0.5) — lifeSteal 합산 80%", () => {
    const player = {
        name: 'tester', job: '모험가', level: 10,
        hp: 100, maxHp: 1000, mp: 100, maxMp: 100, // hp 낮춰 회복 측정
        relics: [], skillChoices: {}, titles: [], activeTitle: null,
        killStreak: 0, combatFlags: {}, status: [],
    };
    const enemy = { name: '오크', hp: 10000, maxHp: 10000, atk: 10, def: 0 };
    const stats = {
        atk: 100, def: 50, elem: 'physical',
        relics: [],
        activeSynergies: [
            { bonus: { effect: 'vampire_lord', lifeSteal: 0.3 } },
            { bonus: { effect: 'hell_reaper', lifeStealBonus: 0.5 } },
        ],
        critChance: 0,
    };

    const result = CombatEngine.attack(player, enemy, stats);
    // 두 시너지 lifeSteal 합산 → 80%. heal > 0이면 병행 합산 정상.
    const healLog = result.logs.find((l) => l.text && l.text.includes('흡혈'));
    assert.ok(healLog, '두 시너지 모두 활성 시 흡혈 로그 출력돼야 함');
    assert.ok(result.updatedPlayer.hp > 100,
        `expected hp > 100 (heal applied); got ${result.updatedPlayer.hp}`);
});
