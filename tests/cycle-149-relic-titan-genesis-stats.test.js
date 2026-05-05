import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { RELICS } from '../src/data/relics.js';
import { DB } from '../src/data/db.js';

/**
 * cycle 149: 'titan' / 'genesis' 유물 핸들러 추가 (cycle 148 baseline 좁히기).
 *
 * cycle 148이 34종 dead relic effect를 baseline lock 한 후 점진 정리.
 * 핸들러가 가장 단순한 passive multiplier 두 개부터 적용:
 *
 * 1. titan (titan_belt) — 최대 HP +30%. (받는 치명타 피해 -50%는 별도 사이클.)
 * 2. genesis (genesis_core) — 전 스탯(ATK/DEF/HP) +15%. (매 턴 HP 회복은 별도 사이클.)
 *
 * 둘 다 statsCalculator.computeRelicBonuses의 atkFlat / defFlat / hpMult
 * 리듀서에 1-line 추가로 반영된다.
 */

// 큰 base 스탯으로 floor 라운딩 오차 영향 최소화.
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

test("titan (titan_belt): 최대 HP +30% multiplicative 적용", () => {
    const base = makeBasePlayer();
    const baseStats = calculateFullStats(base);

    const withTitan = { ...base, relics: [findRelic('titan_belt')] };
    const titanStats = calculateFullStats(withTitan);

    // titan_belt val.hp = 0.3 → maxHp는 baseline 대비 +30% 이상이어야 함
    assert.ok(titanStats.maxHp > baseStats.maxHp,
        `expected titan_belt to increase maxHp; base=${baseStats.maxHp} titan=${titanStats.maxHp}`);
    const ratio = titanStats.maxHp / baseStats.maxHp;
    assert.ok(ratio >= 1.29 && ratio <= 1.31,
        `expected titan_belt maxHp ratio ~1.30; got ${ratio.toFixed(3)}`);
});

test("genesis (genesis_core): 전 스탯 +15% (ATK / DEF / HP)", () => {
    const base = makeBasePlayer();
    const baseStats = calculateFullStats(base);

    const withGenesis = { ...base, relics: [findRelic('genesis_core')] };
    const gStats = calculateFullStats(withGenesis);

    const atkRatio = gStats.atk / baseStats.atk;
    const defRatio = gStats.def / baseStats.def;
    const hpRatio = gStats.maxHp / baseStats.maxHp;

    for (const [label, ratio] of [['atk', atkRatio], ['def', defRatio], ['maxHp', hpRatio]]) {
        // floor 라운딩 영향 흡수 허용. 핵심: 15% 부스트가 실제로 반영됨.
        assert.ok(ratio >= 1.13 && ratio <= 1.17,
            `expected genesis_core ${label} ratio ~1.15; got ${ratio.toFixed(3)}`);
    }
});

test("cycle 148 baseline 회귀: titan / genesis effect string이 src/에서 참조됨", async () => {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const HERE = path.dirname(fileURLToPath(import.meta.url));
    const ROOT = path.join(HERE, '..');
    const calcSrc = await readFile(path.join(ROOT, 'src/utils/statsCalculator.ts'), 'utf8');
    assert.match(calcSrc, /'titan'/);
    assert.match(calcSrc, /'genesis'/);
});
