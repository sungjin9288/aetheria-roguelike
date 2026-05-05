import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { RELICS } from '../src/data/relics.js';
import { DB } from '../src/data/db.js';

/**
 * cycle 150: 'hp_drain_atk' / 'first_turn_evade' 유물 핸들러 추가.
 *
 * cycle 148 baseline 32 → 30. cycle 149에 이은 점진 정리 — 가장 단순한
 * passive multiplier 반영.
 *
 * 1. hp_drain_atk (혈맹의 반지 / 심연의 계약) — atkBonus 부분 반영
 *    (val.atkBonus를 atkFlat에 더함). 매 턴 HP cost는 별도 사이클.
 * 2. first_turn_evade (그림자 망토) — DEF 부분 반영 (val을 defFlat에 더함).
 *    전투 첫 턴 회피 보장은 별도 사이클 (combat init flag 필요).
 */

const makeBasePlayer = () => ({
    name: 'tester',
    job: '모험가',
    level: 50,
    hp: 1000, maxHp: 1000, mp: 500, maxMp: 500,
    atk: 1000, def: 500,
    inv: [], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
    stats: { kills: 0, codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} } },
    relics: [],
    skillChoices: {},
    titles: [], activeTitle: null,
    killStreak: 0,
    combatFlags: {},
    status: [],
});

const findRelic = (id) => RELICS.find((r) => r.id === id);

test("hp_drain_atk (blood_oath_ring): ATK +35% 반영", () => {
    const base = makeBasePlayer();
    const baseStats = calculateFullStats(base);

    const withRing = { ...base, relics: [findRelic('blood_oath_ring')] };
    const ringStats = calculateFullStats(withRing);

    const atkRatio = ringStats.atk / baseStats.atk;
    assert.ok(atkRatio >= 1.33 && atkRatio <= 1.37,
        `expected blood_oath_ring atk ratio ~1.35; got ${atkRatio.toFixed(3)}`);
});

test("hp_drain_atk (abyssal_contract): ATK +60% 반영 (legendary tier)", () => {
    const base = makeBasePlayer();
    const baseStats = calculateFullStats(base);

    const withContract = { ...base, relics: [findRelic('abyssal_contract')] };
    const contractStats = calculateFullStats(withContract);

    const atkRatio = contractStats.atk / baseStats.atk;
    assert.ok(atkRatio >= 1.58 && atkRatio <= 1.62,
        `expected abyssal_contract atk ratio ~1.60; got ${atkRatio.toFixed(3)}`);
});

test("first_turn_evade (shadow_cloak): DEF +10% 반영", () => {
    const base = makeBasePlayer();
    const baseStats = calculateFullStats(base);

    const withCloak = { ...base, relics: [findRelic('shadow_cloak')] };
    const cloakStats = calculateFullStats(withCloak);

    const defRatio = cloakStats.def / baseStats.def;
    assert.ok(defRatio >= 1.09 && defRatio <= 1.11,
        `expected shadow_cloak def ratio ~1.10; got ${defRatio.toFixed(3)}`);
});

test("cycle 148 baseline 회귀: hp_drain_atk / first_turn_evade effect string이 src/에서 참조됨", async () => {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const HERE = path.dirname(fileURLToPath(import.meta.url));
    const ROOT = path.join(HERE, '..');
    const calcSrc = await readFile(path.join(ROOT, 'src/utils/statsCalculator.ts'), 'utf8');
    assert.match(calcSrc, /'hp_drain_atk'/);
    assert.match(calcSrc, /'first_turn_evade'/);
});
