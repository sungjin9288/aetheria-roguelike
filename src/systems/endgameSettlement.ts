import { BALANCE } from '../data/constants';
import { DB } from '../data/db';
import { MSG } from '../data/messages';
import type { Monster, Player } from '../types/index.js';
import { normalizeEndgameProgress } from '../utils/dataMigration';

export interface EndgameSettlementResult {
    player: Player;
    enemy: Monster | null;
    gameState: string;
    logs: Array<{ type: string; text: string }>;
    outcome: 'none' | 'ascension' | 'true_boss' | 'true_ending' | 'replay' | 'blocked';
}

const resolvedName = (enemy: Monster) => String(enemy?.baseName || enemy?.name || '');

const isDemonKing = (enemy: Monster) => {
    const name = resolvedName(enemy);
    return name === '마왕';
};

const isTrueBoss = (enemy: Monster) => {
    const name = resolvedName(enemy);
    return name === '원시의 신' || name.includes('원초적 혼돈');
};

const validMultiplier = (value: unknown) => (
    typeof value === 'number' && Number.isFinite(value) && value > 0
);

const buildTrueBoss = (value: unknown): Monster | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const boss = value as Record<string, any>;
    if (boss.isBoss !== true
        || !validMultiplier(boss.hpMult)
        || !validMultiplier(boss.atkMult)
        || !validMultiplier(boss.expMult)
        || !validMultiplier(boss.goldMult)
        || !validMultiplier(boss.dropMod)) return null;
    return {
        name: '원시의 신',
        baseName: '원시의 신',
        hp: Math.floor(8_000 * boss.hpMult),
        maxHp: Math.floor(8_000 * boss.hpMult),
        atk: Math.floor(280 * boss.atkMult),
        def: 120,
        level: 70,
        isBoss: true,
        weakness: boss.weakness || '빛',
        resistance: boss.resistance || '어둠',
        expMult: boss.expMult,
        goldMult: boss.goldMult,
        dropMod: boss.dropMod,
        phase2: boss.phase2,
        phase3: boss.phase3,
        exp: 5_000,
        gold: 9_999,
        pattern: { guardChance: 0.05, heavyChance: 0.4 },
    };
};

export const resolveEndgameVictory = ({
    player,
    deadEnemy,
    receiptKey,
    rng,
    monsterCatalog = DB.MONSTERS,
}: {
    player: Player;
    deadEnemy: Monster;
    receiptKey: string;
    rng: () => number;
    now: number;
    monsterCatalog?: Record<string, any>;
}): EndgameSettlementResult => {
    const endgame = normalizeEndgameProgress(player.meta?.endgame);
    if (endgame.lastEndgameReceiptKey === receiptKey) {
        return {
            player,
            enemy: null,
            gameState: 'idle',
            logs: [],
            outcome: 'replay',
        };
    }

    if (isTrueBoss(deadEnemy)) {
        const heartId = `primal-heart:${receiptKey}`;
        const inventory = Array.isArray(player.inv) ? player.inv : [];
        const nextInventory = inventory.some((item) => item?.id === heartId)
            ? inventory
            : [
                ...inventory,
                {
                    id: heartId,
                    name: '원시의 심장',
                    type: 'key',
                    price: 0,
                    tier: 6,
                    desc: '원시의 신의 심장.',
                },
            ];
        return {
            player: {
                ...player,
                inv: nextInventory,
                meta: {
                    ...(player.meta || {}),
                    endgame: {
                        ...endgame,
                        lastEndgameReceiptKey: receiptKey,
                        trueEndingSeen: true,
                    },
                },
            },
            enemy: null,
            gameState: 'true_ending',
            logs: [{ type: 'critical', text: MSG.TRUE_GOD_SLAIN }],
            outcome: 'true_ending',
        };
    }

    if (!isDemonKing(deadEnemy)) {
        return {
            player,
            enemy: null,
            gameState: 'idle',
            logs: [],
            outcome: 'none',
        };
    }

    const required = Math.max(1, Number(BALANCE.PRIMAL_SHARD_REQUIRED) || 3);
    const prestigeRank = Math.max(0, Number(player.meta?.prestigeRank) || 0);
    const earnedShard = prestigeRank >= 1
        && endgame.primalShards < required
        && rng() < BALANCE.PRIMAL_SHARD_DROP_CHANCE;
    const shardCount = Math.min(required, endgame.primalShards + (earnedShard ? 1 : 0));
    const acceptedEndgame = {
        ...endgame,
        primalShards: shardCount,
        lastEndgameReceiptKey: receiptKey,
    };
    const acceptedPlayer = {
        ...player,
        meta: {
            ...(player.meta || {}),
            endgame: acceptedEndgame,
        },
        stats: {
            ...(player.stats || {}),
            demonKingSlain: (player.stats?.demonKingSlain || 0) + 1,
        },
    };
    const logs: Array<{ type: string; text: string }> = [];
    if (earnedShard) logs.push({ type: 'event', text: MSG.PRIMAL_SHARD_DROP(shardCount) });

    if (prestigeRank >= 3 && shardCount >= required) {
        const trueBoss = buildTrueBoss(monsterCatalog?.['원시의 신']);
        if (!trueBoss) {
            return {
                player: acceptedPlayer,
                enemy: null,
                gameState: 'ascension',
                logs,
                outcome: 'blocked',
            };
        }
        return {
            player: {
                ...acceptedPlayer,
                meta: {
                    ...(acceptedPlayer.meta || {}),
                    endgame: {
                        ...acceptedEndgame,
                        primalShards: shardCount - required,
                    },
                },
            },
            enemy: trueBoss,
            gameState: 'combat',
            logs: [
                ...logs,
                { type: 'critical', text: MSG.TRUE_BOSS_UNLOCK },
                { type: 'critical', text: MSG.TRUE_BOSS_APPEAR },
            ],
            outcome: 'true_boss',
        };
    }

    if (prestigeRank >= 1) {
        logs.push({ type: 'info', text: MSG.PRIMAL_SHARD_HINT(shardCount) });
    }
    logs.push({ type: 'system', text: MSG.DEMON_KING_SLAIN_ASCEND });
    return {
        player: acceptedPlayer,
        enemy: null,
        gameState: 'ascension',
        logs,
        outcome: 'ascension',
    };
};
