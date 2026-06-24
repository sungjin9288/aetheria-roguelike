import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';

/**
 * PR #3 (2026-06): 적 DEF 데미지식 반영 + armor_pen 부활.
 *
 * 확정 버그 (감사 §1.5):
 *  1. calculateDamage가 enemy.def를 무시 → 적 방어력이 dead stat.
 *  2. spawnEnemy가 def를 아예 설정 안 함 → 실전 enemy.def는 항상 undefined.
 *  3. armor_pen 유물이 플레이어 자신의 def를 줄이고 그마저 무시됨 → 완전 무효.
 *
 * 수정 방향 (감사 A-3): 비율 경감 mitigated = max(1, floor(dmg × K/(K+effDef))).
 *  - calculateDamage는 순수(raw atk roll) 유지 — 경감은 attack()/performSkill() 후처리.
 *  - spawnEnemy가 def = MONSTER_DEF_BASE + level×PER_LEVEL (+depth) × profile.defMult.
 *  - def=0 → 변화 없음(하위호환). 중후반은 firmer (mid-game-ttk-bands 밴드 내).
 */

const K = BALANCE.ENEMY_DEF_K;

// ── 순수 헬퍼 ────────────────────────────────────────────────────────────
test('mitigateByEnemyDef: def=0 → 변화 없음 (하위호환)', () => {
    assert.equal(CombatEngine.mitigateByEnemyDef(100, 0, []), 100);
});

test('mitigateByEnemyDef: def=K → 정확히 절반', () => {
    assert.equal(CombatEngine.mitigateByEnemyDef(100, K, []), 50);
});

test('mitigateByEnemyDef: 비율 경감 공식 일치', () => {
    assert.equal(
        CombatEngine.mitigateByEnemyDef(150, 50, []),
        Math.max(1, Math.floor(150 * K / (K + 50))),
    );
});

test('mitigateByEnemyDef: armor_pen이 적 DEF를 감소 (dead relic 부활)', () => {
    const withPen = CombatEngine.mitigateByEnemyDef(100, 100, [{ effect: 'armor_pen', val: 0.5 }]);
    const expected = Math.max(1, Math.floor(100 * K / (K + 50)));
    assert.equal(withPen, expected, 'armor_pen val=0.5 → 적 def 100→50');
    assert.ok(withPen > CombatEngine.mitigateByEnemyDef(100, 100, []),
        'armor_pen 보유 시 경감이 실제로 완화되어야 함');
});

test('mitigateByEnemyDef: 최소 1 보장', () => {
    assert.ok(CombatEngine.mitigateByEnemyDef(1, 100000, []) >= 1);
});

test('mitigateByEnemyDef: DEF 단조 감소', () => {
    const lowDef = CombatEngine.mitigateByEnemyDef(200, 10, []);
    const highDef = CombatEngine.mitigateByEnemyDef(200, 100, []);
    assert.ok(highDef < lowDef, `def100(${highDef}) < def10(${lowDef})`);
});

// ── spawnEnemy가 def를 설정 ───────────────────────────────────────────────
test('spawnEnemy: enemy.def 공식 적용 (BASE + level×PER_LEVEL)', () => {
    const mapData = { level: 20, monsters: ['슬라임'], boss: null, bossMonsters: [] };
    const player = { loc: '시험장', level: 22, stats: {}, job: '모험가', challengeModifiers: [] };
    const { mStats } = spawnEnemy(mapData, player, [], { addLog: () => {} });
    const expected = BALANCE.MONSTER_DEF_BASE + 20 * BALANCE.MONSTER_DEF_PER_LEVEL;
    assert.equal(mStats.def, expected, `Lv20 슬라임 def=${expected}`);
});

// ── attack() 통합: 적 DEF가 출력 데미지를 경감 ───────────────────────────
test('attack(): 적 DEF가 출력 데미지 경감 (def=0 대비 절반 수준)', () => {
    const orig = Math.random;
    Math.random = () => 0.99; // crit/proc 없음, 분산 상한
    try {
        const player = { hp: 1000, maxHp: 1000, status: [], combatFlags: {} };
        const stats = { atk: 100, def: 10, relics: [], elem: null, activeSynergies: [] };
        const base = { name: 'T', hp: 100000, maxHp: 100000 };
        const r0 = CombatEngine.attack(player, { ...base, def: 0 }, stats);
        const r1 = CombatEngine.attack(player, { ...base, def: 100 }, stats);
        const dmg0 = 100000 - r0.updatedEnemy.hp;
        const dmg1 = 100000 - r1.updatedEnemy.hp;
        assert.ok(dmg1 < dmg0, `def100 dmg(${dmg1}) < def0 dmg(${dmg0})`);
        assert.equal(dmg1, CombatEngine.mitigateByEnemyDef(dmg0, 100, []),
            'attack 경감이 헬퍼와 동일');
    } finally {
        Math.random = orig;
    }
});

// ── performSkill() 통합: 동일 경감 ────────────────────────────────────────
test('performSkill(): 적 DEF가 스킬 데미지 경감', () => {
    const orig = Math.random;
    Math.random = () => 0.99;
    try {
        const player = { hp: 1000, maxHp: 1000, mp: 100, maxMp: 100, status: [], combatFlags: {} };
        const stats = { atk: 100, def: 10, relics: [], elem: null, activeSynergies: [] };
        const skill = { name: '시험격', mult: 2.0, cost: 0, effect: null };
        const base = { name: 'T', hp: 100000, maxHp: 100000 };
        const r0 = CombatEngine.performSkill(player, { ...base, def: 0 }, stats, skill);
        const r1 = CombatEngine.performSkill(player, { ...base, def: 100 }, stats, skill);
        const dmg0 = 100000 - r0.updatedEnemy.hp;
        const dmg1 = 100000 - r1.updatedEnemy.hp;
        assert.ok(dmg1 < dmg0, `skill def100 dmg(${dmg1}) < def0 dmg(${dmg0})`);
        assert.equal(dmg1, CombatEngine.mitigateByEnemyDef(dmg0, 100, []),
            'skill 경감이 헬퍼와 동일');
    } finally {
        Math.random = orig;
    }
});
