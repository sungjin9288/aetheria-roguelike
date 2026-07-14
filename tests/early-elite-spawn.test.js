import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { CLASSES } from '../src/data/classes.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { spawnEnemy } from '../src/utils/exploreUtils.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { applyDynamicDifficulty } from '../src/systems/DifficultyManager.js';

/**
 * A-4 (B+ 2026-06): 초반 정예 — "방심하면 죽는" 첫 위협 모먼트.
 * 완전 엘리트(1.8~2.5x)는 Lv1에 불공정하므로 전용 완화 배율로 첫 위협은
 * 유지하되, 권장 회복 타이밍을 따르는 플레이어가 시작 물약 2개를 한 전투에
 * 모두 잃는 운 나쁜 결과는 제한한다.
 */

const withStubbedRandom = (value, fn) => {
    const orig = Math.random;
    Math.random = () => value;
    try { return fn(); } finally { Math.random = orig; }
};

const clone = (value) => structuredClone(value);
const HEAL_THRESHOLD = 0.35;
const SIMULATION_RUNS = 500;
const MAX_COMBAT_TURNS = 30;

const freshPlayer = () => {
    const player = clone(INITIAL_STATE.player);
    player.name = '테스트 모험가';
    player.loc = '고요한 숲';
    const stats = calculateFullStats(player);
    return { ...player, hp: stats.maxHp, maxHp: stats.maxHp, mp: stats.maxMp, maxMp: stats.maxMp };
};

const seededRandom = (seed) => {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
    };
};

const simulateEarlyElite = (seed) => {
    const mapData = { level: 1, monsters: ['거미떼'] };
    const playerAtStart = freshPlayer();
    const { mStats: rawEnemy } = withStubbedRandom(0.05, () =>
        spawnEnemy(mapData, playerAtStart, [], { addLog: () => {} }));
    let enemy = applyDynamicDifficulty(rawEnemy, playerAtStart, null).mStats;
    let player = playerAtStart;
    let potionsUsed = 0;
    let turns = 0;
    const starterPotion = playerAtStart.inv.find((item) => item.type === 'hp');
    const starterPotionCount = playerAtStart.inv.filter((item) => item.type === 'hp').length;
    const originalRandom = Math.random;
    Math.random = seededRandom(seed);

    try {
        while (player.hp > 0 && enemy.hp > 0 && turns < MAX_COMBAT_TURNS) {
            const stats = calculateFullStats(player);
            const shouldHeal = player.hp / stats.maxHp <= HEAL_THRESHOLD
                && potionsUsed < starterPotionCount;

            if (shouldHeal) {
                player = {
                    ...player,
                    hp: Math.min(stats.maxHp, player.hp + starterPotion.val),
                };
                potionsUsed += 1;
            } else {
                const skill = CLASSES[player.job].skills.find((entry) => entry.name === '강타');
                const result = player.mp >= skill.mp
                    ? CombatEngine.performSkill(player, enemy, stats, skill)
                    : CombatEngine.attack(player, enemy, stats);
                player = result.updatedPlayer;
                enemy = result.updatedEnemy;
                if (result.isVictory) break;
            }

            player = CombatEngine.tickCombatState(player).updatedPlayer;
            const counter = CombatEngine.enemyAttack(player, enemy, calculateFullStats(player));
            player = counter.updatedPlayer;
            enemy = counter.updatedEnemy;
            turns += 1;
        }
    } finally {
        Math.random = originalRandom;
    }

    return { won: enemy.hp <= 0, potionsUsed, turns, hp: player.hp };
};

test('A-4: Lv≤cap·낮은 random → 정예 개체 스폰', () => {
    const mapData = { level: 1, monsters: ['슬라임'] };
    // random 0.05: baseName index 0, earlyElite roll 0.05 < EARLY_ELITE_CHANCE(0.10) 발동
    const { mStats } = withStubbedRandom(0.05, () =>
        spawnEnemy(mapData, freshPlayer(), [], { addLog: () => {} }));
    assert.ok(mStats.name.startsWith('정예'), `정예 이름 (실제: ${mStats.name})`);
    assert.equal(mStats.isElite, true, '정예는 isElite');
    assert.ok(mStats.phase2, '정예는 50% HP 격노 페이즈 보유');
    assert.equal(mStats.phase2.atkBonus, BALANCE.EARLY_ELITE_PHASE_ATK_BONUS,
        '자동 초반 정예는 완화된 격노 공격 보너스 사용');
    assert.equal(
        mStats.phase2.pattern.heavyChance - mStats.pattern.heavyChance,
        BALANCE.EARLY_ELITE_PHASE_HEAVY_BONUS,
        '자동 초반 정예는 완화된 강타 확률 보너스 사용',
    );
});

test('A-4: 실제 전투 규칙에서도 시작 물약 2개 고갈은 드물고 위협감은 남는다', () => {
    const results = Array.from({ length: SIMULATION_RUNS }, (_, index) => simulateEarlyElite(index + 1));
    const wins = results.filter((result) => result.won).length;
    const anyPotion = results.filter((result) => result.potionsUsed > 0).length;
    const bothPotions = results.filter((result) => result.potionsUsed === 2).length;

    assert.ok(wins / results.length >= 0.98,
        `숙련된 기본 운영의 승률은 98% 이상이어야 함 (실제 ${wins}/${results.length})`);
    assert.ok(anyPotion / results.length >= 0.05,
        `정예 위협감은 남아 일부 전투에서 회복이 필요해야 함 (실제 ${anyPotion}/${results.length})`);
    assert.ok(bothPotions / results.length <= 0.05,
        `시작 물약 2개를 모두 쓰는 전투는 5% 이하여야 함 (실제 ${bothPotions}/${results.length})`);
});

test('A-4: 선택·도전형 일반 엘리트는 기존 격노 강도를 유지', () => {
    const player = freshPlayer();
    player.challengeModifiers = ['eliteOnly'];
    const mapData = { level: 1, monsters: ['슬라임'] };
    const { mStats } = withStubbedRandom(0.8, () =>
        spawnEnemy(mapData, player, [], { addLog: () => {} }));

    assert.equal(mStats.isElite, true);
    assert.equal(mStats.phase2.atkBonus, BALANCE.ELITE_PHASE_ATK_BONUS,
        '자동 조우가 아닌 엘리트는 기존 공격 보너스 유지');
    assert.equal(
        mStats.phase2.pattern.heavyChance - mStats.pattern.heavyChance,
        BALANCE.ELITE_PHASE_HEAVY_BONUS,
        '자동 조우가 아닌 엘리트는 기존 강타 보너스 유지',
    );
});

test('A-4: 맵 레벨이 cap 초과면 정예 미발동', () => {
    const mapData = { level: 10, monsters: ['슬라임'] };
    const { mStats } = withStubbedRandom(0.05, () =>
        spawnEnemy(mapData, freshPlayer(), [], { addLog: () => {} }));
    assert.ok(!mStats.name.startsWith('정예'), `cap 초과 → 정예 아님 (실제: ${mStats.name})`);
});
