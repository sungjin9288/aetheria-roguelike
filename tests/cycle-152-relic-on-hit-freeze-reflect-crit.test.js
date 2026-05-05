import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { RELICS } from '../src/data/relics.js';
import { DB } from '../src/data/db.js';

/**
 * cycle 152: 'on_hit_freeze' / 'reflect_crit' 유물 핸들러 추가.
 *
 * cycle 148 baseline 28 → 26.
 *
 * 1. on_hit_freeze (frost_anchor) — 일반 공격 시 val(=0.15) 확률로 적 1턴 빙결.
 *    기존 vampire_lord (lifeSteal) hook 직후에 동일 패턴으로 추가.
 *    val=1.0 → 100% 보장 / val=0 → 발동 0건. 동결의 닻 로그 출력.
 * 2. reflect_crit (mirror_of_fate) — critBonus +val.critBonus(=0.15) 부분 반영.
 *    피해 반사는 별도 사이클 (enemyAttack 훅 필요).
 */

const findRelic = (id) => RELICS.find((r) => r.id === id);

const baseStatsObj = {
    atk: 100,
    def: 50,
    elem: 'physical',
    activeSynergies: [],
    relics: [],
    critChance: 0,
};

// hp 큰 enemy로 1타에 안 죽도록 — newEnemyHp > 0 보장.
const baseEnemy = () => ({ name: '슬라임', hp: 10000, maxHp: 10000, atk: 10, def: 5, weakness: null, resistance: null });

const fakePlayer = () => ({
    name: 'tester',
    job: '모험가',
    level: 10,
    hp: 100, maxHp: 100, mp: 50, maxMp: 50,
    atk: 100, def: 50,
    inv: [], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
    relics: [],
    skillChoices: {},
    titles: [], activeTitle: null,
    killStreak: 0,
    combatFlags: {},
    status: [],
    stats: { kills: 0 },
});

test("on_hit_freeze (frost_anchor): val=1.0 강제 발동 — 적이 빙결 상태로 전환", () => {
    const player = fakePlayer();
    const enemy = baseEnemy();
    const stats = {
        ...baseStatsObj,
        relics: [{ ...findRelic('frost_anchor'), val: 1 }], // 100% 빙결 강제
    };

    const result = CombatEngine.attack(player, enemy, stats);
    assert.ok((result.updatedEnemy.stunnedTurns ?? 0) >= 1,
        `expected enemy stunnedTurns >= 1 (frozen); got ${result.updatedEnemy.stunnedTurns}`);
});

test("on_hit_freeze: val=0 → 빙결 발동 안 됨 (chance 가드)", () => {
    const player = fakePlayer();
    const enemy = baseEnemy();
    const stats = {
        ...baseStatsObj,
        relics: [{ ...findRelic('frost_anchor'), val: 0 }],
    };

    const result = CombatEngine.attack(player, enemy, stats);
    assert.equal(result.updatedEnemy.stunnedTurns ?? 0, 0,
        'val=0이면 빙결 발동 안 해야 함');
});

test("on_hit_freeze: 적 처치 시(newEnemyHp<=0) 빙결 무효 — postHitEnemy 가드", () => {
    const player = fakePlayer();
    const enemy = { ...baseEnemy(), hp: 1, maxHp: 100 };
    const stats = {
        ...baseStatsObj,
        relics: [{ ...findRelic('frost_anchor'), val: 1 }],
    };

    const result = CombatEngine.attack(player, enemy, stats);
    // 적이 죽었으면 빙결 의미 없음 — 적용 안 됨
    if (result.updatedEnemy.hp <= 0) {
        assert.equal(result.updatedEnemy.stunnedTurns ?? 0, 0,
            'newEnemyHp<=0 케이스에 빙결 적용은 의미 없음');
    }
});

test("reflect_crit (mirror_of_fate): critChance +15% 반영", () => {
    const base = fakePlayer();
    const baseStats = calculateFullStats(base);

    const withMirror = { ...base, relics: [findRelic('mirror_of_fate')] };
    const mStats = calculateFullStats(withMirror);

    const delta = mStats.critChance - baseStats.critChance;
    assert.ok(delta >= 0.14 && delta <= 0.16,
        `expected mirror_of_fate critChance +0.15; got delta=${delta.toFixed(3)}`);
});

test("cycle 148 baseline 회귀: on_hit_freeze / reflect_crit effect string이 src/에서 참조됨", async () => {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const HERE = path.dirname(fileURLToPath(import.meta.url));
    const ROOT = path.join(HERE, '..');
    const engineSrc = await readFile(path.join(ROOT, 'src/systems/CombatEngine.ts'), 'utf8');
    const calcSrc = await readFile(path.join(ROOT, 'src/utils/statsCalculator.ts'), 'utf8');
    assert.match(engineSrc, /'on_hit_freeze'/);
    assert.match(calcSrc, /'reflect_crit'/);
});
