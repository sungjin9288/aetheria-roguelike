import { MSG } from '../data/messages';
import { CombatEngine } from './CombatEngine';
import { buildRunSummary } from '../utils/gameUtils';
import { pushBattleRecord, makeBattleRecord } from './DifficultyManager';
import { calculateFullStats } from '../utils/statsCalculator';
import type { Item, Monster, Player } from '../types/index.js';
import { createSeededRandom } from '../utils/seededRandom.js';
import { resolveConsumableEffect } from './consumableEffect';

export { createSeededRandom } from '../utils/seededRandom.js';

export type CombatItemTurnResult = {
    kind: 'continue' | 'victory' | 'defeat' | 'rejected';
    player: Player;
    enemy: Monster | null;
    logs: Array<{ type: string; text: string }>;
    visualEffect: string | null;
    runSummary?: any;
    graveData?: any;
    victoryStats?: any;
};

export const resolveCombatItemTurn = ({
    player,
    enemy,
    item,
    initialPlayer,
    seed,
    now,
    rng,
}: {
    player: Player;
    enemy: Monster;
    item: Item;
    initialPlayer: Player;
    seed: number;
    now: number;
    rng?: () => number;
}): CombatItemTurnResult => {
    const random = rng || createSeededRandom(seed);
    const consumed = resolveConsumableEffect({ player, item });
    if (!consumed.ok) {
        return {
            kind: 'rejected',
            player,
            enemy,
            logs: [],
            visualEffect: null,
        };
    }
    const turnTick = CombatEngine.tickCombatState(consumed.player);
    const playerForEnemyTurn = turnTick.updatedPlayer;
    const counterStats = calculateFullStats(playerForEnemyTurn);
    const counterResult = CombatEngine.enemyAttack(playerForEnemyTurn, enemy, counterStats, random);
    const logs = [consumed.log, ...turnTick.logs, ...counterResult.logs];

    if (counterResult.isEnemyDead) {
        return {
            kind: 'victory',
            player: counterResult.updatedPlayer,
            enemy: null,
            logs: [...logs, { type: 'success', text: MSG.COMBAT_DOT_KILL(enemy.name || '적') }],
            visualEffect: null,
            victoryStats: counterStats,
        };
    }

    if (counterResult.isDead) {
        const deadPlayer = { ...counterResult.updatedPlayer, killStreak: 0 };
        const defeatResult = CombatEngine.handleDefeat(deadPlayer, initialPlayer, random, () => now);
        return {
            kind: 'defeat',
            player: {
                ...defeatResult.updatedPlayer,
                stats: pushBattleRecord(
                    defeatResult.updatedPlayer.stats,
                    makeBattleRecord('death', 0),
                ),
            },
            enemy: null,
            logs: [...logs, ...defeatResult.logs],
            visualEffect: null,
            runSummary: buildRunSummary(deadPlayer, playerForEnemyTurn.loc),
            graveData: defeatResult.graveData,
        };
    }

    return {
        kind: 'continue',
        player: counterResult.updatedPlayer,
        enemy: counterResult.updatedEnemy,
        logs,
        visualEffect: counterResult.isCrit ? 'shake' : null,
    };
};
