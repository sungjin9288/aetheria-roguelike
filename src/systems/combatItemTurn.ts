import { MSG } from '../data/messages';
import { CombatEngine } from './CombatEngine';
import { buildRunSummary, toArray } from '../utils/gameUtils';
import { pushBattleRecord, makeBattleRecord } from './DifficultyManager';
import { calculateFullStats } from '../utils/statsCalculator';
import type { Item, Monster, Player } from '../types/index.js';

export type CombatItemTurnResult = {
    kind: 'continue' | 'victory' | 'defeat';
    player: Player;
    enemy: Monster | null;
    logs: Array<{ type: string; text: string }>;
    visualEffect: string | null;
    runSummary?: any;
    graveData?: any;
    victoryStats?: any;
};

export const createSeededRandom = (seed: number) => {
    let state = Math.trunc(seed) >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
};

const consumeItem = (player: Player, item: Item, stats: any) => {
    const inventory = (player.inv || []).filter((entry: any) => entry.id !== item.id);
    const itemName = item.name || '소모품';
    if (item.type === 'hp') {
        return {
            player: {
                ...player,
                hp: Math.min(stats.maxHp, (player.hp || 0) + (item.val || 0)),
                inv: inventory,
            },
            log: { type: 'success', text: MSG.ITEM_USE_SIMPLE(itemName) },
        };
    }
    if (item.type === 'mp') {
        return {
            player: {
                ...player,
                mp: Math.min(stats.maxMp, (player.mp || 0) + (item.val || 0)),
                inv: inventory,
            },
            log: { type: 'success', text: MSG.ITEM_USE_SIMPLE(itemName) },
        };
    }
    if (item.type === 'cure') {
        return {
            player: {
                ...player,
                status: toArray(player.status).filter((status: any) => status !== item.effect),
                inv: inventory,
            },
            log: { type: 'success', text: MSG.ITEM_USE_CURE(itemName) },
        };
    }
    return {
        player: {
            ...player,
            tempBuff: {
                atk: item.effect === 'atk_up' || item.effect === 'all_up' ? (item.val || 1.3) - 1 : 0,
                def: item.effect === 'def_up' || item.effect === 'all_up' ? (item.val || 1.3) - 1 : 0,
                turn: item.turn || 3,
                name: itemName,
            },
            inv: inventory,
        },
        log: { type: 'success', text: MSG.ITEM_USE_BUFF(itemName) },
    };
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
    const itemStats = calculateFullStats(player);
    const consumed = consumeItem(player, item, itemStats);
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
