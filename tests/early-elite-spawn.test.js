import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { spawnEnemy } from '../src/utils/exploreUtils.js';
import { applyDynamicDifficulty } from '../src/systems/DifficultyManager.js';

/**
 * A-4 (B+ 2026-06): 초반 정예 — "방심하면 죽는" 첫 위협 모먼트.
 * 완전 엘리트(1.8~2.5x)는 Lv1에 불공정하므로 전용 완화 배율(1.5x)로 TTK를
 * 빠듯하게(영리하면 승리 가능) 맞춘다. 도망·첫 죽음 메타가 공정성 안전망.
 */

const withStubbedRandom = (value, fn) => {
    const orig = Math.random;
    Math.random = () => value;
    try { return fn(); } finally { Math.random = orig; }
};

const freshPlayer = () => ({ level: 1, atk: 12, def: 5, hp: 178, maxHp: 178, loc: '고요한 숲', stats: {} });

test('A-4: Lv≤cap·낮은 random → 정예 개체 스폰', () => {
    const mapData = { level: 1, monsters: ['슬라임'] };
    // random 0.05: baseName index 0, earlyElite roll 0.05 < EARLY_ELITE_CHANCE(0.10) 발동
    const { mStats } = withStubbedRandom(0.05, () =>
        spawnEnemy(mapData, freshPlayer(), [], { addLog: () => {} }));
    assert.ok(mStats.name.startsWith('정예'), `정예 이름 (실제: ${mStats.name})`);
    assert.equal(mStats.isElite, true, '정예는 isElite');
    assert.ok(mStats.phase2, '정예는 50% HP 격노 페이즈 보유');
});

test('A-4: 정예전은 빠듯하지만 Lv1 승리 가능 (margin ≤ 4턴)', () => {
    const mapData = { level: 1, monsters: ['슬라임'] };
    const { mStats: raw } = withStubbedRandom(0.05, () =>
        spawnEnemy(mapData, freshPlayer(), [], { addLog: () => {} }));
    const { mStats: elite } = applyDynamicDifficulty(raw, freshPlayer(), null);

    const lv1Atk = 12 + Math.floor(5 * BALANCE.ONE_HAND_ATK_RATIO); // 14
    const minSkillDmg = Math.floor(lv1Atk * BALANCE.DAMAGE_BASE_RATIO * 1.5); // 강타
    const turnsToKill = Math.ceil(elite.hp / minSkillDmg);
    const enemyDmg = Math.max(1, elite.atk - 5); // flat DEF 차감
    const turnsToDie = Math.ceil(178 / enemyDmg);

    assert.ok(turnsToKill < turnsToDie,
        `정예전은 승리 가능해야 함 (kill ${turnsToKill}턴 < die ${turnsToDie}턴, HP ${elite.hp}/ATK ${elite.atk})`);
    assert.ok(turnsToDie - turnsToKill <= 4,
        `일반전(margin ~9)보다 훨씬 빠듯 (margin ${turnsToDie - turnsToKill}턴)`);
});

test('A-4: 맵 레벨이 cap 초과면 정예 미발동', () => {
    const mapData = { level: 10, monsters: ['슬라임'] };
    const { mStats } = withStubbedRandom(0.05, () =>
        spawnEnemy(mapData, freshPlayer(), [], { addLog: () => {} }));
    assert.ok(!mStats.name.startsWith('정예'), `cap 초과 → 정예 아님 (실제: ${mStats.name})`);
});
