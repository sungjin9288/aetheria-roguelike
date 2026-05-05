import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 155: 시너지 time_dominator / arcane_singularity 핸들러 추가
 * (cycle 148 baseline 11 → 9).
 *
 * 1. time_dominator (cdReduction 2 / extraAction 0.3):
 *    - 기존 'cooldown_reduce' 유물 dispatch와 합산.
 *    - 기존 'time_master' extraTurnChance 분기에 extraAction 추가.
 * 2. arcane_singularity (freeSkillChance 0.35 / skillMult 0.3):
 *    - 기존 'free_skill' 유물 분기에 freeSkillChance 합산.
 *    - calculateDamage mult 인자에 skillMult 가산.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

test("CombatEngine.ts: time_dominator / arcane_singularity effect-name 명시", async () => {
    const src = await readFile(path.join(ROOT, 'src/systems/CombatEngine.ts'), 'utf8');
    assert.match(src, /'time_dominator'/);
    assert.match(src, /'arcane_singularity'/);
});

test("performSkill: arcane_singularity freeSkillChance — actualMpCost 0 (강제 100% 시)", () => {
    // freeSkillChance=1로 강제하면 actualMpCost는 항상 0.
    // performSkill은 mp 부족하면 거부 → mp는 충분히 두고 검증.
    const player = {
        name: 'tester', job: '모험가', level: 10,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        atk: 100, def: 50,
        inv: [], equip: { weapon: null, armor: null, offhand: null },
        relics: [], skillChoices: {}, titles: [], activeTitle: null,
        killStreak: 0, combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '슬라임', hp: 10000, maxHp: 10000, atk: 10, def: 5 };
    const skill = { name: 'fireball', mpCost: 30, mult: 1.5, cooldown: 3 };
    const stats = {
        atk: 100, def: 50, elem: 'physical',
        relics: [], activeSynergies: [
            { bonus: { effect: 'arcane_singularity', freeSkillChance: 1, skillMult: 0 } },
        ],
        critChance: 0,
    };

    const result = CombatEngine.performSkill(player, enemy, stats, skill);
    if (result.success === false) {
        // mpCost too high — assert.fail
        assert.fail('performSkill should succeed when mp is sufficient');
    }
    // freeSkillChance=1 → actualMpCost=0 → updatedPlayer.mp 그대로 100
    assert.equal(result.updatedPlayer.mp, 100,
        `expected mp 100 (free skill); got ${result.updatedPlayer.mp}`);
});

test("performSkill: time_dominator cdReduction — 스킬 cooldown -2 적용", () => {
    const player = {
        name: 'tester', job: '모험가', level: 10,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        atk: 100, def: 50,
        inv: [], equip: { weapon: null, armor: null, offhand: null },
        relics: [], skillChoices: {}, titles: [], activeTitle: null,
        killStreak: 0, combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '슬라임', hp: 10000, maxHp: 10000, atk: 10, def: 5 };
    const skill = { name: 'fireball', mpCost: 30, mult: 1.5, cooldown: 5 };
    const stats = {
        atk: 100, def: 50, elem: 'physical',
        relics: [], activeSynergies: [
            { bonus: { effect: 'time_dominator', cdReduction: 2, extraAction: 0 } },
        ],
        critChance: 0,
    };

    const result = CombatEngine.performSkill(player, enemy, stats, skill);
    // baseCd=5, cdReduction=2 → 3턴 cooldown.
    assert.equal(result.updatedPlayer.skillLoadout.cooldowns['fireball'], 3,
        `expected fireball cooldown 3 after time_dominator -2; got ${result.updatedPlayer.skillLoadout.cooldowns['fireball']}`);
});
