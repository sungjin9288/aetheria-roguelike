import { MSG } from '../data/messages';
import { CombatEngine } from './CombatEngine';
import { buildRunSummary, getJobSkills } from '../utils/gameUtils';
import { pushBattleRecord, makeBattleRecord } from './DifficultyManager';
import { calculateFullStats } from '../utils/statsCalculator';
import { createSeededRandom } from './combatItemTurn';
import type { Monster, Player } from '../types/index.js';

export type CombatActionKind = 'attack' | 'skill' | 'escape';

export type CombatActionTurnResult = {
    kind: 'continue' | 'victory' | 'defeat' | 'escape' | 'rejected';
    player: Player;
    enemy: Monster | null;
    logs: Array<{ type: string; text: string }>;
    visualEffect: string | null;
    victoryStats?: any;
    deadEnemy?: Monster;
    extendedVictoryChecks?: boolean;
    graveData?: any;
    runSummary?: any;
    stories: Array<{ type: string; data: any }>;
};

const selectedSkill = (player: Player, random: () => number) => {
    const skills = getJobSkills(player);
    if (skills.length === 0) return { skill: null, log: null };
    if (player.challengeModifiers?.includes('randomSkills')) {
        const skill = skills[Math.floor(random() * skills.length)];
        return { skill, log: { type: 'warn', text: MSG.COMBAT_CHAOS_SKILL(skill.name) } };
    }
    const selected = Number.isInteger(player.skillLoadout?.selected)
        ? player.skillLoadout!.selected as number
        : 0;
    const index = ((selected % skills.length) + skills.length) % skills.length;
    return { skill: skills[index], log: null };
};

const resolveDefeat = (
    player: Player,
    initialPlayer: Player,
    location: string,
    logs: Array<{ type: string; text: string }>,
    random: () => number,
    now: number,
): CombatActionTurnResult => {
    const deadPlayer = { ...player, killStreak: 0 };
    const defeatResult = CombatEngine.handleDefeat(deadPlayer, initialPlayer, random, () => now);
    const recordedPlayer = {
        ...defeatResult.updatedPlayer,
        stats: pushBattleRecord(
            defeatResult.updatedPlayer.stats,
            makeBattleRecord('death', 0),
        ),
    };
    return {
        kind: 'defeat',
        player: recordedPlayer,
        enemy: null,
        logs: [...logs, ...defeatResult.logs],
        visualEffect: null,
        graveData: defeatResult.graveData,
        runSummary: buildRunSummary(deadPlayer, location),
        stories: [
            { type: 'death', data: { loc: location } },
            { type: 'ruinRecap', data: { name: deadPlayer.name, level: deadPlayer.level } },
        ],
    };
};

export const resolveCombatActionTurn = ({
    player,
    enemy,
    kind,
    initialPlayer,
    seed,
    now,
    rng,
}: {
    player: Player;
    enemy: Monster;
    kind: CombatActionKind;
    initialPlayer: Player;
    seed: number;
    now: number;
    rng?: () => number;
}): CombatActionTurnResult => {
    const random = rng || createSeededRandom(seed);
    const stats = calculateFullStats(player);

    if (kind === 'escape') {
        const escapeResult = CombatEngine.attemptEscape(enemy, stats, random);
        if (escapeResult.success) {
            const hpRatio = (player.hp || 0) / Math.max(1, player.maxHp || 1);
            return {
                kind: 'escape',
                player: {
                    ...player,
                    stats: {
                        ...pushBattleRecord(player.stats, makeBattleRecord('escape', hpRatio)),
                        escapes: (player.stats?.escapes || 0) + 1,
                    },
                },
                enemy: null,
                logs: escapeResult.logs,
                visualEffect: null,
                stories: [],
            };
        }

        const protectionLogs: Array<{ type: string; text: string }> = [];
        const protectedResult = CombatEngine.applyFatalProtection(
            player,
            stats?.relics || [],
            escapeResult.damage || 0,
            protectionLogs,
        );
        const logs = [...escapeResult.logs, ...protectionLogs];
        if (protectedResult.isDead) {
            return resolveDefeat(
                protectedResult.updatedPlayer,
                initialPlayer,
                player.loc || '알 수 없는 곳',
                logs,
                random,
                now,
            );
        }
        return {
            kind: 'continue',
            player: protectedResult.updatedPlayer,
            enemy,
            logs,
            visualEffect: null,
            stories: [],
        };
    }

    let actionResult: any;
    const logs: Array<{ type: string; text: string }> = [];
    if (kind === 'skill') {
        const selected = selectedSkill(player, random);
        if (selected.log) logs.push(selected.log);
        actionResult = CombatEngine.performSkill(player, enemy, stats, selected.skill, random);
        if (!actionResult.success) {
            return {
                kind: 'rejected',
                player,
                enemy,
                logs: [...logs, ...(actionResult.logs || [])],
                visualEffect: null,
                stories: [],
            };
        }
    } else {
        actionResult = CombatEngine.attack(player, enemy, stats, random);
    }
    logs.push(...(actionResult.logs || []));

    if (actionResult.forceEscape) {
        const escapedPlayer = actionResult.updatedPlayer;
        const hpRatio = (escapedPlayer.hp || 0) / Math.max(1, escapedPlayer.maxHp || 1);
        return {
            kind: 'escape',
            player: {
                ...escapedPlayer,
                stats: {
                    ...pushBattleRecord(escapedPlayer.stats, makeBattleRecord('escape', hpRatio)),
                    escapes: (escapedPlayer.stats?.escapes || 0) + 1,
                },
            },
            enemy: null,
            logs,
            visualEffect: null,
            stories: [],
        };
    }

    if (actionResult.isVictory) {
        return {
            kind: 'victory',
            player: actionResult.updatedPlayer,
            enemy: null,
            logs,
            visualEffect: null,
            victoryStats: stats,
            deadEnemy: enemy,
            extendedVictoryChecks: true,
            stories: [],
        };
    }

    if (actionResult.updatedPlayer.extraTurnGranted) {
        return {
            kind: 'continue',
            player: { ...actionResult.updatedPlayer, extraTurnGranted: false },
            enemy: actionResult.updatedEnemy,
            logs,
            visualEffect: null,
            stories: [],
        };
    }

    const turnTick = CombatEngine.tickCombatState(actionResult.updatedPlayer);
    const playerForEnemyTurn = turnTick.updatedPlayer;
    const counterStats = calculateFullStats(playerForEnemyTurn);
    const counterResult = CombatEngine.enemyAttack(
        playerForEnemyTurn,
        actionResult.updatedEnemy,
        counterStats,
        random,
    );
    const stories = !actionResult.updatedEnemy?.phase2Triggered
        && counterResult.updatedEnemy?.phase2Triggered
        ? [{ type: 'bossPhase2', data: { bossName: counterResult.updatedEnemy.name } }]
        : [];
    const turnLogs = [...logs, ...turnTick.logs, ...counterResult.logs];

    if (counterResult.isEnemyDead) {
        return {
            kind: 'victory',
            player: counterResult.updatedPlayer,
            enemy: null,
            logs: [
                ...turnLogs,
                { type: 'success', text: MSG.COMBAT_DOT_KILL(actionResult.updatedEnemy?.name) },
            ],
            visualEffect: null,
            victoryStats: counterStats,
            deadEnemy: actionResult.updatedEnemy,
            extendedVictoryChecks: false,
            stories,
        };
    }

    if (counterResult.isDead) {
        const defeated = resolveDefeat(
            counterResult.updatedPlayer,
            initialPlayer,
            playerForEnemyTurn.loc,
            turnLogs,
            random,
            now,
        );
        return { ...defeated, stories: [...stories, ...defeated.stories] };
    }

    return {
        kind: 'continue',
        player: counterResult.updatedPlayer,
        enemy: counterResult.updatedEnemy,
        logs: turnLogs,
        visualEffect: counterResult.isCrit ? 'shake' : null,
        stories,
    };
};
