import { BALANCE } from '../data/constants.js';
import { CombatEngine } from '../systems/CombatEngine.js';
import { getEffectiveMaxHp } from '../systems/vitals.js';
import type { Monster, Player } from '../types/index.js';
import { calculateFullStats } from './statsCalculator.js';

/**
 * 적의 가장 센 한 행동 예상치 (2026-10 Wave 87 우두머리 → Wave 88 보스, 소유자 결정 "예상 타격을 보스에도").
 *
 * 피해 식을 손으로 다시 쓰지 않고 실제 엔진(`CombatEngine.enemyAttack`)을 고정 굴림(`BALANCE.ENEMY_THREAT_PROBE_ROLL` —
 * 회피 · 방어 자세 · 막기가 굴러가지 않는다)으로 부른다. 방어 경감 · 원소 저항 · 저주 증폭 · 조합의 대가가 엔진과 갈라지지 않는다.
 *
 * 1. 페이즈가 있는 적(보스 · 정예)은 먼저 생명 1로 한 번 굴려 엔진이 모든 페이즈를 적용하게 한다 — 공격력 보너스 · 패턴 ·
 *    전환 때 거는 상태(저주라면 받는 피해가 커진다) · 소환 하수인이 실제 전환과 같다.
 * 2. 그 상태에서 강타 확정으로 한 번 — 하수인이 있으면 함께 친 피해까지 한 행동이다.
 * 3. 브레스가 있으면 브레스 차례로 한 번. 둘 가운데 큰 값이다.
 *
 * 행동 수에 따라 자라는 장기전 강화와, 맞은 뒤에 걸리는 상태의 지속 피해는 넣지 않는다(한 행동의 값이다).
 * 플레이어는 실효 최대 생명 · 상태 이상 없음으로 둔다. 게임 난수를 쓰지 않는다.
 */

export interface EnemyThreat {
    hit: number;
    maxHp: number;
    /** 한 방이 최대 생명의 몇 %인지(올림). */
    pct: number;
    /** 가득 찬 생명이 몇 번에 쓰러지는지. */
    hits: number;
}

const probeRoll = () => BALANCE.ENEMY_THREAT_PROBE_ROLL;

const strike = (player: Player, enemy: Monster, actionCount: number) => {
    const stats = calculateFullStats(player);
    if (!stats) return null;
    return CombatEngine.enemyAttack(player, { ...enemy, actionCount }, stats, probeRoll);
};

export const estimateEnemyMaxHit = (player: Player, enemy: Monster): number => {
    const maxHp = Math.max(1, getEffectiveMaxHp(player));
    const fullEnemyHp = Math.max(1, Number(enemy.maxHp) || Number(enemy.hp) || 1);
    let probe: Player = { ...player, hp: maxHp, status: [], statusStacks: {} };
    let foe: Monster = { ...enemy, hp: fullEnemyHp, stunnedTurns: 0, guarding: false };
    try {
        if ((foe.isBoss || foe.isElite) && (foe.phase2 || foe.phase3)) {
            const phased = strike(probe, { ...foe, hp: 1 }, 0);
            if (!phased) return 0;
            foe = { ...phased.updatedEnemy, hp: fullEnemyHp, stunnedTurns: 0, guarding: false };
            probe = { ...phased.updatedPlayer, hp: maxHp };
        }
        const heavy = strike(probe, { ...foe, pattern: { guardChance: 0, heavyChance: 1 } }, 0);
        const breathEvery = foe.mechanics?.breath?.every;
        const breath = breathEvery ? strike(probe, foe, breathEvery - 1) : null;
        const value = Math.max(Number(heavy?.damage) || 0, Number(breath?.damage) || 0);
        return Math.max(0, Math.floor(value));
    } catch {
        return 0;
    }
};

export const toEnemyThreat = (player: Player, hit: number): EnemyThreat => {
    const maxHp = Math.max(1, getEffectiveMaxHp(player));
    const safeHit = Math.max(1, hit);
    return { hit: safeHit, maxHp, pct: Math.ceil((safeHit / maxHp) * 100), hits: Math.max(1, Math.ceil(maxHp / safeHit)) };
};

export const getEnemyThreat = (player: Player, enemy: Monster): EnemyThreat => toEnemyThreat(player, estimateEnemyMaxHit(player, enemy));
